import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Circle,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as api from "../services/api";
import {
  PageHeader,
  Loading,
  PriorityBadge,
  StatusBadge,
} from "../components/UIComponents";
import { Permissions } from "../utils/permissions";

// Fix Leaflet marker icons
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom Icons
const shiningSafeZoneIcon = L.divIcon({
  className: "shining-bullet",
  html: '<div style="width:14px; height:14px;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Force Leaflet to re-render markers when data changes
function MapInvalidator({ deps }: { deps: any[] }) {
  const map = useMap();
  const prevDepsRef = useRef(deps);

  useEffect(() => {
    // Check if deps actually changed (by length or identity)
    const changed = deps.some((d, i) => d !== prevDepsRef.current[i]);
    if (changed) {
      prevDepsRef.current = deps;
      // Small delay to let React finish rendering markers, then force Leaflet redraw
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [deps, map]);

  return null;
}

export default function MapVisualization({ userRole }: { userRole: string }) {
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSafeZoneId, setSelectedSafeZoneId] = useState<string | null>(null);
  const [districtGeoJson, setDistrictGeoJson] = useState<any>(null);
  const [showWorkflowLayer, setShowWorkflowLayer] = useState<"all" | "safezones" | "reports">("all");

  const getCoordinates = (item: any) => {
    const lat = item?.latitude ?? item?.lat ?? item?.location?.latitude ?? item?.location?.lat ?? item?.location?.coordinates?.[1] ?? item?.coords?.[0] ?? NaN;
    const lng = item?.longitude ?? item?.lng ?? item?.location?.longitude ?? item?.location?.lng ?? item?.location?.coordinates?.[0] ?? item?.coords?.[1] ?? NaN;
    return { lat: Number(lat), lng: Number(lng) };
  };

  const hasValidSriLankaCoordinates = (item: any) => {
    const { lat, lng } = getCoordinates(item);
    return !Number.isNaN(lat) && !Number.isNaN(lng) && lat >= 5.5 && lat <= 10.1 && lng >= 79.0 && lng <= 82.2;
  };

  const extractArray = (response: any): any[] => {
    const data = response?.data ?? response;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const callFirstAvailableApi = async (functionNames: string[], params?: Record<string, string>) => {
    for (const functionName of functionNames) {
      const apiFunction = (api as any)[functionName];
      if (typeof apiFunction === "function") {
        try {
          const response = params ? await apiFunction(params) : await apiFunction();
          return extractArray(response);
        } catch (error) {
          console.warn(`${functionName} failed:`, error);
        }
      }
    }
    return [];
  };

  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  const loadMapData = async () => {
    try {
      setLoading(true);
      // Wait a moment for session/token to stabilize
      await new Promise(r => setTimeout(r, 300));
      
      const isPublic = Permissions.isPublicUser(userRole);
      const token = localStorage.getItem("flood-user-token");
      
      // Attempt to peek at the token payload for debugging
      let sessionId = "Unknown";
      try {
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          sessionId = payload.id || "No ID in token";
        }
      } catch (e) {}

      console.log(`[Map Diagnostic] Role: ${userRole}, Token: ${!!token}, My Session ID: ${sessionId}`);

      const [safeZoneData, campData, reportData, predictionData, geoJsonData] = await Promise.all([
        callFirstAvailableApi(["getSafeZones"]),
        callFirstAvailableApi(["getCamps"]),
        callFirstAvailableApi(isPublic ? ["getMyNeedReports"] : ["getNeedReports"]),
        callFirstAvailableApi(["getAllPredictions"]),
        fetch("/src/data/sri_lanka_districts.geojson").then((res) => res.json()).catch(() => null),
      ]);

      console.log(`[Map Diagnostic] Data Loaded -> Reports Found: ${reportData.length}`);
      
      setSafeZones(safeZoneData);
      setCamps(campData);
      setReports(reportData);
      setPredictions(predictionData);

      const validReports = reportData.filter(hasValidSriLankaCoordinates);
      console.log(`[Map Diagnostic] Reports with valid coords: ${validReports.length}`);

      if (geoJsonData) setDistrictGeoJson(geoJsonData);
    } catch (err) {
      console.error("[Map Diagnostic] Error loading map data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    console.log("[Map] Role updated, loading data...", userRole);
    loadMapData(); 

    const handleFocus = () => {
      console.log("[Map] Window focused, refreshing data...");
      loadMapData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [userRole]);

  const getJitteredPosition = (lat: number, lng: number, items: any[], currentIndex: number, type?: "camp" | "report") => {
    let collisionCount = items.filter((item, idx) => {
      if (idx >= currentIndex) return false;
      const coords = getCoordinates(item);
      return Math.abs(coords.lat - lat) < 0.00001 && Math.abs(coords.lng - lng) < 0.00001;
    }).length;

    // If it's a camp, also check if it collides with a safe zone (since camps are usually inside safe zones)
    if (type === "camp") {
      const overlapsSafeZone = safeZones.some(zone => {
        const coords = getCoordinates(zone);
        return Math.abs(coords.lat - lat) < 0.00001 && Math.abs(coords.lng - lng) < 0.00001;
      });
      if (overlapsSafeZone) collisionCount += 1;
    }

    if (collisionCount === 0) return [lat, lng] as [number, number];
    const angle = collisionCount * 0.8; 
    const radius = type === "report" ? 0.0008 * (collisionCount + 1) : 0.0005 * (collisionCount + 1);
    return [lat + radius * Math.cos(angle), lng + radius * Math.sin(angle)] as [number, number];
  };

  const getDistrictRisk = (districtName: string) => {
    const pred = predictions.find(p => p.location?.toLowerCase() === districtName?.toLowerCase());
    return pred?.mlPrediction?.predictionLabel || "Low Risk";
  };

  const getDistrictRiskColor = (risk: string) => {
    if (risk.includes("High")) return "#ef4444"; 
    if (risk.includes("Moderate")) return "#f59e0b"; 
    return "#10b981"; 
  };

  const getCampIcon = (priority: string) => {
    const color = priority === "High" ? "#dc2626" : priority === "Medium" ? "#ea580c" : "#16a34a";
    return L.divIcon({
      className: "camp-marker",
      html: `<div style="background-color:${color}; width:12px; height:12px; border-radius:2px; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.2)"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  };

  const getCampNeedsAnalysis = (camp: any) => {
    const pop = camp.population || 1;
    return { food: pop * 6, water: pop * 10 };
  };

  const getDistanceKm = (a: any, b: any) => {
    const start = getCoordinates(a);
    const end = getCoordinates(b);
    if (
      Number.isNaN(start.lat) ||
      Number.isNaN(start.lng) ||
      Number.isNaN(end.lat) ||
      Number.isNaN(end.lng)
    ) {
      return Number.POSITIVE_INFINITY;
    }

    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(end.lat - start.lat);
    const dLng = toRad(end.lng - start.lng);
    const lat1 = toRad(start.lat);
    const lat2 = toRad(end.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const getNearestSafeZone = (item: any) => {
    return safeZones
      .filter(hasValidSriLankaCoordinates)
      .map((zone) => ({ zone, distance: getDistanceKm(item, zone) }))
      .sort((a, b) => a.distance - b.distance)[0];
  };

  const getOccupancyPercent = (item: any) => {
    const capacity = Number(item.capacity || item.camp_capacity || 0);
    const population = Number(item.current_population || item.population || 0);
    if (!capacity) return 0;
    return Math.min(100, Math.round((population / capacity) * 100));
  };

  const getReportGuidance = (report: any) => {
    const needType = report.need_type;
    const severity = report.severity;
    if (needType === "Rescue" || severity === "Emergency") {
      return {
        title: "Dispatch rescue team",
        detail: "Prioritize evacuation support and confirm contact by phone before moving.",
        icon: "emergency",
        color: "rose",
      };
    }
    if (needType === "Medical" || severity === "Critical") {
      return {
        title: "Send medical response",
        detail: "Prepare first-aid supplies and route the nearest available response team.",
        icon: "medical_services",
        color: "rose",
      };
    }
    if (needType === "Food" || needType === "Water") {
      return {
        title: "Add to ration route",
        detail: "Group with nearby requests or camps to reduce delivery time.",
        icon: "local_shipping",
        color: "amber",
      };
    }
    return {
      title: "Verify and assign",
      detail: "Review the request details, confirm location, and assign the correct team.",
      icon: "fact_check",
      color: "blue",
    };
  };

  const openDirections = (item: any) => {
    const point = getCoordinates(item);
    if (Number.isNaN(point.lat) || Number.isNaN(point.lng)) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`, "_blank");
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disaster Management Geospatial Command"
        subtitle="Real-time ML risk assessment and resource visualization"
        icon="explore"
        actions={
          <div className="flex gap-2">
            <button 
              onClick={() => { setLoading(true); loadMapData(); }}
              className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm text-gray-500 hover:text-blue-600 transition-all"
              title="Refresh Data"
            >
              <span className="material-icons text-sm">refresh</span>
            </button>
            <div className="bg-white p-1 rounded-xl border border-gray-100 shadow-sm flex">
              {["all", "safezones", "reports"].map(layer => (
                <button
                  key={layer}
                  onClick={() => setShowWorkflowLayer(layer as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    showWorkflowLayer === layer ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {layer.charAt(0).toUpperCase() + layer.slice(1)}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: "Safe Zones", val: safeZones.length, icon: "shield", color: "blue" },
          { label: "Active Camps", val: camps.length, icon: "home", color: "cyan" },
          { label: "Citizen Requests", val: reports.length, icon: "volunteer_activism", color: "amber" },
          { label: "High Risk Districts", val: predictions.filter(p => p.mlPrediction?.predictionLabel?.includes("High")).length, icon: "warning", color: "red" }
        ].map(stat => (
          <div key={stat.label} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-3 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl`}>
              <span className="material-icons">{stat.icon}</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{stat.label}</p>
              <p className="text-2xl font-black text-gray-800">{stat.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative" style={{ height: "650px" }}>
          <MapContainer center={[7.8731, 80.7718]} zoom={8} style={{ height: "100%", width: "100%" }} className="z-0">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapInvalidator deps={[camps, safeZones, reports]} />

            {districtGeoJson && (
              <GeoJSON
                data={districtGeoJson}
                style={(feature) => {
                  const risk = getDistrictRisk(feature?.properties?.NAME_2);
                  return {
                    fillColor: getDistrictRiskColor(risk),
                    weight: 1.5,
                    opacity: 0.8,
                    color: "white",
                    fillOpacity: 0.25,
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const risk = getDistrictRisk(feature?.properties?.NAME_2);
                  layer.bindTooltip(`<b>${feature?.properties?.NAME_2}</b><br/>ML Prediction: ${risk}`, { sticky: true });
                  layer.on({
                    click: () => setSelectedFeature({ type: "district", data: { name: feature?.properties?.NAME_2, risk } })
                  });
                }}
              />
            )}

            {(showWorkflowLayer === "all" || showWorkflowLayer === "safezones") &&
              safeZones.filter(hasValidSriLankaCoordinates).map((zone) => {
                const point = getCoordinates(zone);
                return (
                  <React.Fragment key={`zone-group-${zone._id}`}>
                    <Circle
                      center={[point.lat, point.lng]}
                      radius={(zone.radius_km || 5) * 1000}
                      pathOptions={{ color: "#1e40af", weight: 1, fillOpacity: 0.1 }}
                    />
                    <Marker 
                      position={[point.lat, point.lng]} 
                      icon={shiningSafeZoneIcon}
                      zIndexOffset={100}
                      riseOnHover={true}
                      eventHandlers={{ click: () => setSelectedFeature({ type: "safezone", data: zone }) }}
                    >
                      <Tooltip>Safe Zone: {zone.name}</Tooltip>
                    </Marker>
                  </React.Fragment>
                );
              })}

            {(showWorkflowLayer === "all" || showWorkflowLayer === "safezones") &&
              (() => {
                const filteredCamps = camps.filter(hasValidSriLankaCoordinates);
                return filteredCamps.map((camp, idx) => {
                  const point = getCoordinates(camp);
                  const jitteredPos = getJitteredPosition(point.lat, point.lng, filteredCamps, idx, "camp");
                  const priority = camp.priority_level || camp.predicted_priority || "Medium";
                  return (
                    <Marker 
                      key={`camp-${camp._id}`} 
                      position={jitteredPos} 
                      icon={getCampIcon(priority)}
                      zIndexOffset={1000}
                      riseOnHover={true}
                      eventHandlers={{ click: () => setSelectedFeature({ type: "camp", data: camp }) }}
                    >
                      <Tooltip>{camp.camp_name} ({priority})</Tooltip>
                    </Marker>
                  );
                });
              })()}

            {(showWorkflowLayer === "all" || showWorkflowLayer === "reports") &&
              (() => {
                const filteredReports = reports.filter(hasValidSriLankaCoordinates);
                return filteredReports.map((report, idx) => {
                  const point = getCoordinates(report);
                  const jitteredPos = getJitteredPosition(point.lat, point.lng, filteredReports, idx, "report");
                  const severity = report.severity === "High" || report.severity === "Critical" ? "High" : report.severity === "Low" ? "Low" : "Medium";
                  return (
                    <Marker
                      key={`report-${report._id}`}
                      position={jitteredPos}
                      icon={L.divIcon({
                        className: "report-marker",
                        html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-md border-2 ${severity === 'High' ? 'border-red-500 text-red-500' : severity === 'Medium' ? 'border-orange-500 text-orange-500' : 'border-green-500 text-green-500'} hover:scale-110 transition-transform"><span class="material-icons text-lg">warning</span></div>`,
                        iconSize: [32, 32],
                        iconAnchor: [16, 16],
                      })}
                      zIndexOffset={2000}
                      riseOnHover={true}
                      eventHandlers={{ click: () => setSelectedFeature({ type: "report", data: report }) }}
                    >
                      <Tooltip>Citizen Request: {report.need_type}</Tooltip>
                    </Marker>
                  );
                });
              })()}

            {/* Floating Legend */}
            <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-gray-100 shadow-xl text-[10px] space-y-2 min-w-[140px]">
              <p className="font-bold text-gray-800 uppercase tracking-tighter border-b pb-1 mb-1">Map Legend</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-700 animate-pulse border border-white"></div> <span className="text-gray-600">Safe Zone</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-600"></div> <span className="text-gray-600">High Priority Camp</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-500"></div> <span className="text-gray-600">Medium Priority Camp</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-600"></div> <span className="text-gray-600">Low Priority Camp</span></div>
                <div className="flex items-center gap-2"><span className="material-icons text-amber-500 text-xs">warning</span> <span className="text-gray-600">Citizen Request</span></div>
                <div className="pt-1 border-t mt-1">
                  <p className="font-bold text-gray-500 mb-1">Regional Risk (ML)</p>
                  <div className="flex items-center gap-2"><div className="w-3 h-1.5 bg-red-500/30 border border-red-500"></div> <span className="text-gray-600">High Risk Zone</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-1.5 bg-amber-500/30 border border-amber-500"></div> <span className="text-gray-600">Moderate Risk</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-1.5 bg-emerald-500/30 border border-emerald-500"></div> <span className="text-gray-600">Low Risk</span></div>
                </div>
              </div>
            </div>
          </MapContainer>
        </div>

        {/* Info Sidebar */}
        <div className="w-full lg:w-96 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
          <div className="bg-slate-900 p-4 border-b border-slate-800">
            <h3 className="font-black text-gray-800 flex items-center gap-2">
              <span className="material-icons text-cyan-300">radar</span> 
              <span className="text-white">Intelligence Panel</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">Operational details for the selected map item</p>
          </div>
          <div className="p-5 flex-1 overflow-y-auto">
            {selectedFeature ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start">
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider">
                    {selectedFeature.type}
                  </span>
                  <button onClick={() => setSelectedFeature(null)} className="text-gray-400 hover:text-red-500">
                    <span className="material-icons text-sm">close</span>
                  </button>
                </div>

                {selectedFeature.type === "district" && (
                  (() => {
                    const districtName = selectedFeature.data.name;
                    const districtReports = reports.filter((report) => {
                      const point = getCoordinates(report);
                      return hasValidSriLankaCoordinates(report) && districtName && point.lat && point.lng;
                    });
                    const highRisk = selectedFeature.data.risk?.includes("High");
                    return (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-2xl font-black text-gray-800">{districtName}</h4>
                          <p className="text-sm text-gray-500">Regional risk and response overview</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${highRisk ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
                          <p className="text-xs text-gray-500 font-bold mb-1 uppercase">ML Risk Status</p>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${highRisk ? "bg-red-500" : "bg-emerald-500"}`}></div>
                            <p className="font-bold text-gray-800">{selectedFeature.data.risk}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm">
                            <p className="text-[10px] uppercase font-bold text-gray-400">Safe Zones</p>
                            <p className="text-2xl font-black text-gray-800">{safeZones.length}</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm">
                            <p className="text-[10px] uppercase font-bold text-gray-400">Requests</p>
                            <p className="text-2xl font-black text-gray-800">{districtReports.length || reports.length}</p>
                          </div>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-600">
                          {highRisk
                            ? "Keep rescue and ration teams on standby for this area."
                            : "Continue monitoring and use nearby safe zones for preventive relocation."}
                        </div>
                      </div>
                    );
                  })()
                )}

                {selectedFeature.type === "safezone" && (
                  (() => {
                    const occupancy = getOccupancyPercent(selectedFeature.data);
                    const safeStatus = selectedFeature.data.safety_status || "Unknown";
                    return (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xl font-black text-gray-800">{selectedFeature.data.name}</h4>
                          <p className="text-sm text-gray-500">{selectedFeature.data.location_description || selectedFeature.data.district || "Verified safe zone"}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-bold text-blue-700">Occupancy</span>
                            <span className="font-black text-blue-900">{occupancy}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white overflow-hidden">
                            <div className={`h-full ${occupancy > 85 ? "bg-red-500" : occupancy > 65 ? "bg-amber-500" : "bg-blue-600"}`} style={{ width: `${occupancy}%` }} />
                          </div>
                          <p className="text-xs text-blue-700 mt-2">
                            {selectedFeature.data.current_population || 0} of {selectedFeature.data.capacity || 0} people
                          </p>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex justify-between border-b border-dashed pb-1"><span>Status:</span> <b className="text-blue-600">{safeStatus}</b></div>
                          <div className="flex justify-between border-b border-dashed pb-1"><span>Road Access:</span> <b>{selectedFeature.data.nearby_road_access || "Unknown"}</b></div>
                          <div className="flex justify-between"><span>Radius:</span> <b>{selectedFeature.data.radius_km || 0} km</b></div>
                        </div>
                      </div>
                    );
                  })()
                )}

                {selectedFeature.type === "camp" && (
                  (() => {
                    const needs = getCampNeedsAnalysis(selectedFeature.data);
                    const nearest = getNearestSafeZone(selectedFeature.data);
                    const shortageFood = Math.max(0, needs.food - Number(selectedFeature.data.food_available || 0));
                    const shortageWater = Math.max(0, needs.water - Number(selectedFeature.data.water_available || 0));
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <h4 className="text-lg font-black text-gray-800">{selectedFeature.data.camp_name}</h4>
                            <p className="text-sm text-gray-500">{selectedFeature.data.population || 0} people registered</p>
                          </div>
                          <PriorityBadge level={selectedFeature.data.priority_level || "Medium"} />
                        </div>
                        <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100">
                          <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Estimated Ration Requirement</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white p-2 rounded-lg shadow-sm"><b>{needs.food} kg</b><br />Food</div>
                            <div className="bg-white p-2 rounded-lg shadow-sm"><b>{needs.water} L</b><br />Water</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className={`p-3 rounded-2xl border ${shortageFood > 0 ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-emerald-50 border-emerald-100 text-emerald-800"}`}>
                            <p className="font-bold">Food Gap</p>
                            <p>{shortageFood} kg</p>
                          </div>
                          <div className={`p-3 rounded-2xl border ${shortageWater > 0 ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-emerald-50 border-emerald-100 text-emerald-800"}`}>
                            <p className="font-bold">Water Gap</p>
                            <p>{shortageWater} L</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p className="flex justify-between"><span>Contact:</span> <b>{selectedFeature.data.contact_person || selectedFeature.data.manager_name || "Volunteer"}</b></p>
                          <p className="flex justify-between"><span>Phone:</span> <b className="text-blue-600">{selectedFeature.data.contact_phone || "N/A"}</b></p>
                          <p className="flex justify-between"><span>Nearest Safe Zone:</span> <b>{nearest?.zone?.name || "N/A"}</b></p>
                          {nearest && <p className="flex justify-between"><span>Distance:</span> <b>{nearest.distance.toFixed(1)} km</b></p>}
                        </div>
                      </div>
                    );
                  })()
                )}

                {selectedFeature.type === "report" && (
                  (() => {
                    const guidance = getReportGuidance(selectedFeature.data);
                    const nearest = getNearestSafeZone(selectedFeature.data);
                    const point = getCoordinates(selectedFeature.data);
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <h4 className="text-lg font-black text-gray-800">{selectedFeature.data.need_type} Request</h4>
                            <p className="text-sm text-gray-500">{selectedFeature.data.people_count || 1} people affected</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <PriorityBadge level={selectedFeature.data.severity || "Medium"} />
                            <StatusBadge status={selectedFeature.data.status || "Pending"} />
                          </div>
                        </div>
                        <div className={`${guidance.color === "rose" ? "bg-rose-50 border-rose-100 text-rose-900" : guidance.color === "amber" ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-blue-50 border-blue-100 text-blue-900"} p-4 rounded-2xl border`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-icons text-sm">{guidance.icon}</span>
                            <p className="font-black text-sm">{guidance.title}</p>
                          </div>
                          <p className="text-xs leading-relaxed">{guidance.detail}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 italic text-sm text-amber-900">
                          "{selectedFeature.data.description || "No extra details provided."}"
                        </div>
                        <div className="text-sm text-gray-600 space-y-1 pt-2">
                          <p className="flex justify-between"><span>Reporter:</span> <b>{selectedFeature.data.reporter_name}</b></p>
                          <p className="flex justify-between"><span>Contact:</span> <b className="text-blue-600">{selectedFeature.data.contact_phone}</b></p>
                          <p className="flex justify-between"><span>Coordinates:</span> <b>{point.lat.toFixed(4)}, {point.lng.toFixed(4)}</b></p>
                          <p className="flex justify-between"><span>Nearest Safe Zone:</span> <b>{nearest?.zone?.name || "N/A"}</b></p>
                          {nearest && <p className="flex justify-between"><span>Distance:</span> <b>{nearest.distance.toFixed(1)} km</b></p>}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <span className="material-icons text-6xl text-gray-200">near_me</span>
                <p className="text-sm text-gray-400 font-medium">Click on any marker or district to view detailed intelligence</p>
              </div>
            )}
          </div>
          {selectedFeature && (
            <div className="p-4 bg-gray-50 border-t space-y-2">
              {/* 
                Purpose of INITIATE RESPONSE:
                This action is intended to trigger the operational response for the selected item.
                For Camps: Starts a distribution plan creation flow.
                For Citizen Requests: Starts a rescue/relief dispatch flow.
                (Currently a placeholder as backend integration is pending)
              */}
              <button 
                onClick={() => alert(`Initiating response for ${selectedFeature.type}: ${selectedFeature.data.camp_name || selectedFeature.data.need_type || selectedFeature.data.name}`)}
                className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
              >
                INITIATE RESPONSE
              </button>
              {selectedFeature.type !== "district" && (
                <button
                  onClick={() => openDirections(selectedFeature.data)}
                  className="w-full py-2 bg-white text-slate-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  OPEN DIRECTIONS
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
