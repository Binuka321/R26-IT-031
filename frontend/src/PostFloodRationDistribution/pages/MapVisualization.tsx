// @ts-nocheck
import React, { useEffect, useState } from "react";
import { PageHeader, Loading, PriorityBadge } from "../components/UIComponents";
import * as api from "../services/api";
import {
  filterOutSeedSafeZones,
  filterOutSeedCamps,
  filterOutSeedDiseaseResults,
} from "../utils/filterSeedData";
import {
  MapContainer,
  TileLayer,
  Popup,
  Circle,
  Marker,
  Tooltip,
  ZoomControl,
  GeoJSON,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
// @ts-ignore
import L from "leaflet";

type PriorityLevel = "High" | "Medium" | "Low";
type CampNeeds = {
  food: number;
  water: number;
  medicine: number;
  sanitary: number;
};

export default function MapVisualization() {
  const [camps, setCamps] = useState<any[]>([]);
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [districtGeoJson, setDistrictGeoJson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // External workflow/maps results (may not always be present)
  const [floodRiskMap, setFloodRiskMap] = useState<any[]>([]);
  const [drainWaterLevelMap, setDrainWaterLevelMap] = useState<any[]>([]);
  const [diseaseDetectionResults, setDiseaseDetectionResults] = useState<any[]>(
    [],
  );
  const [selectedSafeZoneId, setSelectedSafeZoneId] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [showWorkflowLayer, setShowWorkflowLayer] = useState("all");
  const [reports, setReports] = useState<any[]>([]);

  const center = [7.8731, 80.7718] as [number, number];
  const sriLankaBounds = [
    [5.5, 79.0],
    [10.1, 82.2],
  ] as [[number, number], [number, number]];

  const extractArray = (response: any): any[] => {
    const data = response?.data ?? response;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.camps)) return data.camps;
    if (Array.isArray(data?.safeZones)) return data.safeZones;
    if (Array.isArray(data?.floodRiskMap)) return data.floodRiskMap;
    if (Array.isArray(data?.floodMap)) return data.floodMap;
    if (Array.isArray(data?.drainWaterLevelMap)) return data.drainWaterLevelMap;
    if (Array.isArray(data?.diseaseDetectionResults))
      return data.diseaseDetectionResults;
    return [];
  };

  const callFirstAvailableApi = async (
    functionNames: string[],
    params?: Record<string, string>,
  ) => {
    for (const functionName of functionNames) {
      const apiFunction = (api as any)[functionName];
      if (typeof apiFunction === "function") {
        try {
          const response = params
            ? await apiFunction(params)
            : await apiFunction();
          return extractArray(response);
        } catch (error) {
          console.warn(`${functionName} failed:`, error);
        }
      }
    }
    return [];
  };

  const getCoordinates = (item: any) => {
    const lat =
      item?.latitude ??
      item?.lat ??
      item?.location?.latitude ??
      item?.location?.lat ??
      item?.coordinates?.latitude ??
      item?.coordinates?.lat ??
      item?.center?.latitude ??
      item?.center?.lat;
    const lng =
      item?.longitude ??
      item?.lng ??
      item?.lon ??
      item?.location?.longitude ??
      item?.location?.lng ??
      item?.location?.lon ??
      item?.coordinates?.longitude ??
      item?.coordinates?.lng ??
      item?.center?.longitude ??
      item?.center?.lng;
    return { lat: Number(lat), lng: Number(lng) };
  };

  const hasValidSriLankaCoordinates = (item: any) => {
    const { lat, lng } = getCoordinates(item);
    return (
      !Number.isNaN(lat) &&
      !Number.isNaN(lng) &&
      lat >= 5.5 &&
      lat <= 10.1 &&
      lng >= 79.0 &&
      lng <= 82.2
    );
  };

  const normalizeText = (value: any) => {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/_/g, "")
      .replace(/-/g, "");
  };

  const normalizePriority = (value: any): PriorityLevel => {
    const text = String(value || "").toLowerCase();
    if (
      text.includes("high") ||
      text.includes("critical") ||
      text.includes("danger") ||
      text.includes("severe")
    )
      return "High";
    if (
      text.includes("medium") ||
      text.includes("moderate") ||
      text.includes("warning")
    )
      return "Medium";
    return "Low";
  };

  const getRiskColors = (priority: PriorityLevel) => {
    if (priority === "High")
      return { border: "#dc2626", fill: "#ef4444", fillOpacity: 0.6 };
    if (priority === "Medium")
      return { border: "#ea580c", fill: "#f97316", fillOpacity: 0.55 };
    return { border: "#86efac", fill: "#bbf7d0", fillOpacity: 0.5 };
  };

  const getSafeZoneId = (safeZone: any) => {
    if (!safeZone) return "";
    return typeof safeZone === "object" ? safeZone._id : safeZone;
  };

  const getSafeZoneName = (safeZone: any) => {
    if (!safeZone) return "Linked";
    if (typeof safeZone === "object")
      return safeZone.name || safeZone.safe_zone_name || "Linked";
    const zone = safeZones.find((z) => z._id === safeZone);
    return zone?.name || "Linked";
  };

  const getDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const earthRadiusKm = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const getDistrictNameFromFeature = (feature: any) => {
    return (
      feature?.properties?.NAME_2 ??
      feature?.properties?.ADM2_EN ??
      feature?.properties?.DISTRICT ??
      feature?.properties?.district ??
      feature?.properties?.name ??
      feature?.properties?.Name ??
      ""
    );
  };

  // Comprehensive priority calculation using existing database data
  const getComprehensiveCampPriority = (camp: any): PriorityLevel => {
    // Use existing camp priority_level from database if available
    if (camp.priority_level) {
      return normalizePriority(camp.priority_level);
    }

    // Fallback: Use disease_risk_level from database
    if (camp.disease_risk_level) {
      return normalizePriority(camp.disease_risk_level);
    }

    // Fallback: Use population to determine priority
    const population = camp.population || 0;
    if (population > 500) return "High";
    if (population > 200) return "Medium";
    return "Low";
  };

  const getCampNeedsAnalysis = (camp: any): CampNeeds => {
    const population = camp.population || 0;
    const priority = getComprehensiveCampPriority(camp);

    // Base needs calculation
    const baseFood = Math.ceil(population * 0.5); // 0.5kg per person
    const baseWater = Math.ceil(population * 3); // 3 liters per person
    const baseMedicine = Math.ceil(population * 0.1); // Basic medical supplies
    const baseSanitary = Math.ceil(population * 0.2); // Sanitary items

    // Priority multiplier
    const multiplier =
      priority === "High" ? 1.5 : priority === "Medium" ? 1.2 : 1.0;

    return {
      food: Math.ceil(baseFood * multiplier),
      water: Math.ceil(baseWater * multiplier),
      medicine: Math.ceil(baseMedicine * multiplier),
      sanitary: Math.ceil(baseSanitary * multiplier),
    };
  };

  const getZoneById = (zoneId: string) => {
    return safeZones.find((zone) => zone._id === zoneId);
  };

  const isCampInsideSafeZone = (camp: any) => {
    const safeZoneId = getSafeZoneId(camp.safe_zone_id);
    const zone = getZoneById(safeZoneId);
    if (!zone || !hasValidSriLankaCoordinates(camp)) return false;

    const campPoint = getCoordinates(camp);
    const zonePoint = getCoordinates(zone);
    const radiusKm = Number(zone.radius_km || zone.radius || 2);

    const distanceKm = getDistanceKm(
      campPoint.lat,
      campPoint.lng,
      zonePoint.lat,
      zonePoint.lng,
    );
    return distanceKm <= radiusKm;
  };

  const getZoneCamps = (zoneId: string) => {
    return camps.filter((camp) => {
      const campSafeZoneId = getSafeZoneId(camp.safe_zone_id);
      return (
        campSafeZoneId === zoneId &&
        hasValidSriLankaCoordinates(camp) &&
        isCampInsideSafeZone(camp)
      );
    });
  };

  const loadMapData = async () => {
    try {
      const [safeZoneData, campData, reportData, geoJsonData] = await Promise.all([
        callFirstAvailableApi(["getSafeZones"]),
        callFirstAvailableApi(["getCamps"]),
        callFirstAvailableApi(["getNeedReports"]),
        fetch("/src/data/sri_lanka_districts.geojson")
          .then((res) => res.json())
          .catch(() => null),
      ]);

      setSafeZones(safeZoneData);
      setCamps(campData);
      setReports(reportData);

      if (geoJsonData) setDistrictGeoJson(geoJsonData);

      console.log("=== DATABASE DATA LOADING ===");
      console.log("Safe Zones:", safeZoneData.length);
      console.log("Camps:", campData.length);
      console.log("Sample Safe Zone:", safeZoneData[0]);
      console.log("Sample Camp:", campData[0]);
      console.log("All Safe Zones:", safeZoneData);
      console.log("Valid Safe Zones after coordinate check:", safeZoneData.filter((zone) => hasValidSriLankaCoordinates(zone)));
      
      // Detailed boundary coordinates logging
      safeZoneData.forEach((zone, index) => {
        const geoJson = zone.boundary_coordinates;
        console.log(`Safe Zone ${index + 1} Boundary Check:`, {
          name: zone.name,
          hasBoundary: !!geoJson,
          boundaryType: geoJson?.type,
          hasValidPolygon: geoJson?.type === "Polygon" && Array.isArray(geoJson?.coordinates),
          coordinatesLength: geoJson?.coordinates?.length,
          firstCoord: geoJson?.coordinates?.[0]
        });
      });
    } catch (error) {
      console.error("Error loading database data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMapData();
    const interval = setInterval(() => {
      loadMapData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Loading message="Loading comprehensive flood rescue and ration distribution map..." />
    );
  }

  const validSafeZones = safeZones.filter((zone) =>
    hasValidSriLankaCoordinates(zone),
  );
  
  console.log("Rendering Safe Zones:", validSafeZones.length);
  console.log("Selected Safe Zone ID:", selectedSafeZoneId);
  console.log("Current Layer:", showWorkflowLayer);
  
  // Log coordinate extraction for each safe zone
  safeZones.forEach((zone, index) => {
    const coords = getCoordinates(zone);
    console.log(`Safe Zone ${index + 1} (${zone.name || 'Unnamed'}):`, {
      id: zone._id,
      rawLat: zone.latitude,
      rawLng: zone.longitude,
      extractedLat: coords.lat,
      extractedLng: coords.lng,
      isValid: hasValidSriLankaCoordinates(zone)
    });
  });
  const validSafeZoneCamps = camps.filter((camp) => {
    const safeZoneId = getSafeZoneId(camp.safe_zone_id);
    const campPriority = getComprehensiveCampPriority(camp);
    const safeZoneMatch =
      !selectedSafeZoneId || safeZoneId === selectedSafeZoneId;
    const priorityMatch = !filterPriority || campPriority === filterPriority;
    const hasValidCoords = hasValidSriLankaCoordinates(camp);
    const isInsideZone = isCampInsideSafeZone(camp);
    return (
      hasValidCoords &&
      safeZoneId &&
      safeZoneMatch &&
      priorityMatch &&
      isInsideZone
    );
  });

  const brightBlueStarIcon = L.divIcon({
    className: "bright-blue-star-marker",
    html: `
      <div class="bright-blue-star-wrapper">
        <div class="bright-blue-star-glow"></div>
        <div class="bright-blue-star">★</div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });

  const MapStyles = () => (
    <style
      dangerouslySetInnerHTML={{
        __html: `
        .leaflet-popup-content-wrapper {
          padding: 0 !important;
          overflow: hidden;
          border-radius: 1rem !important;
          border: 1px solid #e5e7eb;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: 320px !important;
        }
        .leaflet-container {
          font-family: inherit;
        }
        .leaflet-control-zoom a {
          color: #475569 !important;
        }
        .bright-blue-star-marker {
          background: transparent !important;
          border: none !important;
        }
        .bright-blue-star-wrapper {
          position: relative;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bright-blue-star-glow {
          position: absolute;
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          background: rgba(0, 191, 255, 0.35);
          animation: blueStarPulse 1.8s ease-in-out infinite;
        }
        .bright-blue-star {
          position: relative;
          font-size: 28px;
          line-height: 28px;
          color: #00bfff;
          text-shadow: 0 0 4px #ffffff, 0 0 8px rgba(0, 191, 255, 0.9), 0 0 12px rgba(37, 99, 235, 0.8);
        }
        @keyframes blueStarPulse {
          0%, 100% { transform: scale(0.85); opacity: 0.45; }
          50% { transform: scale(1.25); opacity: 0.2; }
        }
      `,
      }}
    />
  );

  return (
    <div className="flex flex-col min-h-[760px] h-[calc(100vh-140px)]">
      <MapStyles />
      <PageHeader
        title="Post-Flood Rescue and Ration Distribution Command Center"
        subtitle="Integrated analysis from Member 1 (Flood Risk), Member 2 (Drain Water Level), Member 3 (Disease Detection) with comprehensive camp prioritization and relief planning"
        icon="public"
      />

      {/* Enhanced Control Panel */}
      <div className="flex flex-col gap-3 mb-4 bg-white p-3 px-5 rounded-2xl shadow-sm border border-gray-100 shrink-0 relative z-10">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* Workflow Layer Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-600 flex items-center gap-2 whitespace-nowrap">
                <span className="material-icons text-gray-400 text-sm">
                  layers
                </span>
                Data Layer:
              </span>
              <div className="flex flex-wrap bg-gray-50 p-1 rounded-xl border border-gray-100 justify-center">
                {[
                  { label: "All Data", value: "all" },
                  { label: "Risk Map", value: "flood" },
                  { label: "Safe Zones", value: "safezones" },
                  { label: "Citizen Requests", value: "reports" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setShowWorkflowLayer(item.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      showWorkflowLayer === item.value
                        ? "bg-white text-cyan-700 shadow-sm border border-gray-200/50"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-600 flex items-center gap-2 whitespace-nowrap">
                <span className="material-icons text-gray-400 text-sm">
                  filter_alt
                </span>
                Camp Priority:
              </span>
              <div className="flex flex-wrap bg-gray-50 p-1 rounded-xl border border-gray-100 justify-center">
                {[
                  { label: "All", value: "" },
                  { label: "High", value: "High" },
                  { label: "Medium", value: "Medium" },
                  { label: "Low", value: "Low" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setFilterPriority(item.value)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      filterPriority === item.value
                        ? "bg-white text-cyan-700 shadow-sm border border-gray-200/50"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Safe Zone Filter */}
            <button
              onClick={() => setSelectedSafeZoneId("")}
              disabled={!selectedSafeZoneId}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                selectedSafeZoneId
                  ? "bg-green-800 text-white hover:bg-green-900"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              All Safe Zones
            </button>
          </div>

          {/* Data Counts + Refresh */}
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-600">
            <span className="text-green-800">
              Safe Zones: <b>{validSafeZones.length}</b>
            </span>
            <span className="text-cyan-600">
              Camps: <b>{validSafeZoneCamps.length}</b>
            </span>
            <span className="text-amber-600">
              Citizen Requests: <b>{reports.length}</b>
            </span>

            <button
              onClick={() => {
                setRefreshing(true);
                loadMapData();
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span className={`material-icons text-sm ${refreshing ? "animate-spin" : ""}`}>refresh</span>
              Refresh Data
            </button>
          </div>
        </div>

        {/* Comprehensive Legend */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          <div className="text-sm text-gray-600">
            <b>Database Data:</b> Safe zones and camps with priority-based risk analysis
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              High Risk
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-orange-500"></div>
              Medium Risk
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-green-200 border border-green-400"></div>
              Low Risk
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-blue-800"></div>
              Safe Zone
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-500 material-icons text-sm">warning</span>
              Citizen Requests
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#00bfff] text-lg leading-none">★</span>
              Camps
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Map */}
      <div className="flex-1 bg-gray-100 rounded-3xl shadow-inner border border-gray-200 overflow-hidden relative z-0">
        {refreshing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-blue-200 flex items-center gap-2 text-sm font-medium text-blue-800">
            <span className="material-icons animate-spin text-blue-500 text-sm">
              refresh
            </span>
            Refreshing comprehensive data...
          </div>
        )}

        <MapContainer
          center={center}
          zoom={7.5}
          minZoom={7}
          maxBounds={sriLankaBounds}
          maxBoundsViscosity={1.0}
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          <ZoomControl position="bottomright" />

          {/* Risk Map Layer - Using Safe Zone Data */}
          {(showWorkflowLayer === "all" || showWorkflowLayer === "flood") &&
            districtGeoJson && (
              <GeoJSON
                key={`risk-layer-${validSafeZones.length}`}
                data={districtGeoJson}
                style={(feature: any) => {
                  const districtName = getDistrictNameFromFeature(feature);
                  const safeZonesInDistrict = validSafeZones.filter((zone) => {
                    const zoneDistrict =
                      zone?.district ??
                      zone?.district_name ??
                      zone?.region ??
                      zone?.area ??
                      zone?.name;
                    return (
                      normalizeText(zoneDistrict) ===
                      normalizeText(districtName)
                    );
                  });

                  let priority: PriorityLevel = "Low";
                  if (safeZonesInDistrict.length > 0) {
                    const hasUnsafeZones = safeZonesInDistrict.some((zone) => {
                      const status =
                        zone?.safety_status ?? zone?.status ?? "Safe";
                      return (
                        normalizeText(status).includes("unsafe") ||
                        normalizeText(status).includes("danger") ||
                        normalizeText(status).includes("risk")
                      );
                    });
                    const hasHighPopulationZones = safeZonesInDistrict.some(
                      (zone) => (zone.current_population || 0) > 500,
                    );

                    if (hasUnsafeZones || hasHighPopulationZones) {
                      priority = "High";
                    } else if (safeZonesInDistrict.length > 3) {
                      priority = "Medium";
                    }
                  }

                  const colors = getRiskColors(priority);
                  return {
                    color: colors.border,
                    weight: 1.8,
                    fillColor: colors.fill,
                    fillOpacity: colors.fillOpacity,
                  };
                }}
                onEachFeature={(feature, layer: any) => {
                  const districtName = getDistrictNameFromFeature(feature);
                  const safeZonesInDistrict = validSafeZones.filter((zone) => {
                    const zoneDistrict =
                      zone?.district ??
                      zone?.district_name ??
                      zone?.region ??
                      zone?.area ??
                      zone?.name;
                    return (
                      normalizeText(zoneDistrict) ===
                      normalizeText(districtName)
                    );
                  });

                  let priority: PriorityLevel = "Low";
                  if (safeZonesInDistrict.length > 0) {
                    const hasUnsafeZones = safeZonesInDistrict.some((zone) => {
                      const status =
                        zone?.safety_status ?? zone?.status ?? "Safe";
                      return (
                        normalizeText(status).includes("unsafe") ||
                        normalizeText(status).includes("danger") ||
                        normalizeText(status).includes("risk")
                      );
                    });
                    const hasHighPopulationZones = safeZonesInDistrict.some(
                      (zone) => (zone.current_population || 0) > 500,
                    );

                    if (hasUnsafeZones || hasHighPopulationZones) {
                      priority = "High";
                    } else if (safeZonesInDistrict.length > 3) {
                      priority = "Medium";
                    }
                  }

                  const colors = getRiskColors(priority);

                  layer.bindPopup(`
                  <div style="font-family: inherit; min-width: 200px; padding: 8px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1e293b;">
                      ${districtName || "Sri Lanka District"}
                    </h4>
                    <div style="background-color: ${colors.fill}; color: ${priority === "Low" ? "#166534" : "#ffffff"}; padding: 6px 10px; border-radius: 8px; font-weight: 700; font-size: 13px; border: 1px solid ${colors.border};">
                      Risk Level: ${priority} (${safeZonesInDistrict.length} Safe Zones)
                    </div>
                  </div>
                `);
                }}
              />
            )}

          {/* Safe Zones Layer */}
          {(showWorkflowLayer === "all" || showWorkflowLayer === "safezones") &&
            validSafeZones.map((zone) => {
              const point = getCoordinates(zone);
              const radiusKm = Number(zone.radius_km || zone.radius || 2);
              const zoneCamps = getZoneCamps(zone._id);
              const isSelected = selectedSafeZoneId === zone._id;
              
              // Check if zone has boundary_coordinates for polygon rendering
              // Handle GeoJSON format: boundary_coordinates: { type: "Polygon", coordinates: [...] }
              const geoJsonData = zone.boundary_coordinates;
              const hasPolygon = geoJsonData && 
                geoJsonData.type === "Polygon" && 
                Array.isArray(geoJsonData.coordinates);
              
              console.log(`Rendering ${zone.name}:`, {
                hasGeoJson: !!geoJsonData,
                geoJsonType: geoJsonData?.type,
                hasCoordinates: hasPolygon,
                coordinatesCount: geoJsonData?.coordinates?.length,
                usingPolygon: hasPolygon
              });
              
              // Use polygon if boundary coordinates exist in GeoJSON format
              if (hasPolygon) {
                const polygonData = {
                  type: "Feature",
                  geometry: {
                    type: "Polygon",
                    coordinates: geoJsonData.coordinates
                  },
                  properties: {
                    name: zone.name,
                    _id: zone._id
                  }
                };
                
                return (
                  <GeoJSON
                    key={`safe-zone-${zone._id}`}
                    data={polygonData}
                    eventHandlers={{
                      click: () => setSelectedSafeZoneId(zone._id),
                    }}
                    style={{
                      color: isSelected ? "#0c4a6e" : "#1e3a8a", // Dark blue border
                      weight: isSelected ? 4 : 2.5,
                      fillColor: isSelected ? "#0369a1" : "#1e40af", // Dark blue fill
                      fillOpacity: isSelected ? 0.85 : 0.65,
                    }}
                  >
                    <Tooltip>Click to filter camps: {zone.name}</Tooltip>
                    <Popup>
                      <div className="p-0">
                        <div className="flex items-center gap-2 p-3.5 bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
                          <div
                            className="p-1.5 rounded-lg"
                            style={{
                              backgroundColor: "#1e40af20",
                              color: "#1e40af",
                            }}
                          >
                            <span className="material-icons text-base block">
                              shield
                            </span>
                          </div>
                          <h4 className="font-bold text-gray-800 text-[15px] m-0 flex-1">
                            {zone.name}
                          </h4>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                            style={{
                              backgroundColor: isSelected
                                ? "#facc1520"
                                : "#1e40af20",
                              color: isSelected ? "#a16207" : "#1e40af",
                              border: isSelected
                                ? "1px solid #facc1540"
                                : "1px solid #1e40af40",
                            }}
                          >
                            {isSelected ? "SELECTED" : "SAFE ZONE"}
                          </span>
                        </div>
                        <div className="p-4 text-sm text-gray-600 space-y-2">
                          <div className="flex justify-between">
                            <span>Safety Status:</span>
                            <b>{zone.safety_status || "Safe"}</b>
                          </div>
                          <div className="flex justify-between">
                            <span>Capacity:</span>
                            <b>
                              {zone.current_population || 0} /{" "}
                              {zone.capacity || 0}
                            </b>
                          </div>
                          <div className="flex justify-between">
                            <span>Camps Inside:</span>
                            <b>{zoneCamps.length}</b>
                          </div>
                          <div className="flex justify-between">
                            <span>Road Access:</span>
                            <b>{zone.nearby_road_access || "N/A"}</b>
                          </div>
                          <button
                            onClick={() => setSelectedSafeZoneId(zone._id)}
                            className="w-full mt-3 px-4 py-2 rounded-lg bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900 transition"
                          >
                            Filter Camps in This Safe Zone
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </GeoJSON>
                );
              }
              
              // Fallback to circle if no boundary coordinates
              return (
                <Circle
                  key={`safe-zone-${zone._id}`}
                  center={[point.lat, point.lng]}
                  radius={radiusKm * 1000}
                  eventHandlers={{
                    click: () => setSelectedSafeZoneId(zone._id),
                  }}
                  pathOptions={{
                    color: isSelected ? "#0c4a6e" : "#1e3a8a", // Dark blue border (darker when selected)
                    weight: isSelected ? 4 : 2.5,
                    fillColor: isSelected ? "#0369a1" : "#1e40af", // Dark blue fill (darker when selected)
                    fillOpacity: isSelected ? 0.85 : 0.65,
                  }}
                >
                  <Tooltip>Click to filter camps: {zone.name}</Tooltip>
                  <Popup>
                    <div className="p-0">
                      <div className="flex items-center gap-2 p-3.5 bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
                        <div
                          className="p-1.5 rounded-lg"
                          style={{
                            backgroundColor: "#1e40af20",
                            color: "#1e40af",
                          }}
                        >
                          <span className="material-icons text-base block">
                            shield
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-800 text-[15px] m-0 flex-1">
                          {zone.name}
                        </h4>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{
                            backgroundColor: isSelected
                              ? "#facc1520"
                              : "#1e40af20",
                            color: isSelected ? "#a16207" : "#1e40af",
                            border: isSelected
                              ? "1px solid #facc1540"
                              : "1px solid #1e40af40",
                          }}
                        >
                          {isSelected ? "SELECTED" : "SAFE ZONE"}
                        </span>
                      </div>
                      <div className="p-4 text-sm text-gray-600 space-y-2">
                        <div className="flex justify-between">
                          <span>Safety Status:</span>
                          <b>{zone.safety_status || "Safe"}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Radius:</span>
                          <b>{radiusKm} km</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Capacity:</span>
                          <b>
                            {zone.current_population || 0} /{" "}
                            {zone.capacity || 0}
                          </b>
                        </div>
                        <div className="flex justify-between">
                          <span>Camps Inside:</span>
                          <b>{zoneCamps.length}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Road Access:</span>
                          <b>{zone.nearby_road_access || "N/A"}</b>
                        </div>
                        <button
                          onClick={() => setSelectedSafeZoneId(zone._id)}
                          className="w-full mt-3 px-4 py-2 rounded-lg bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900 transition"
                        >
                          Filter Camps in This Safe Zone
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

          {/* Camps with Comprehensive Priority Analysis */}
          {(showWorkflowLayer === "all" || showWorkflowLayer === "safezones") &&
            validSafeZoneCamps.map((camp) => {
              const point = getCoordinates(camp);
              const campPriority = getComprehensiveCampPriority(camp);
              const campNeeds = getCampNeedsAnalysis(camp);

              return (
                <Marker
                  key={`camp-${camp._id}`}
                  position={[point.lat, point.lng]}
                  icon={brightBlueStarIcon}
                >
                  <Tooltip>
                    {camp.camp_name} (Priority: {campPriority})
                  </Tooltip>
                  <Popup>
                    <div className="flex flex-col">
                      <div className="bg-gradient-to-r from-blue-50 to-white p-3.5 flex items-center justify-between border-b border-blue-100">
                        <h4 className="font-bold text-gray-800 truncate pr-3 m-0 text-[15px]">
                          {camp.camp_name}
                        </h4>
                        <PriorityBadge level={campPriority} />
                      </div>
                      <div className="p-4 space-y-3 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Safe Zone:</span>
                          <b>{getSafeZoneName(camp.safe_zone_id)}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Population:</span>
                          <b>{camp.population || 0}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Comprehensive Priority:</span>
                          <b
                            className={
                              campPriority === "High"
                                ? "text-red-600"
                                : campPriority === "Medium"
                                  ? "text-orange-600"
                                  : "text-green-600"
                            }
                          >
                            {campPriority}
                          </b>
                        </div>
                        <div className="border-t pt-3">
                          <h5 className="font-semibold text-gray-800 mb-2">
                            Relief Needs Analysis:
                          </h5>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between bg-gray-50 p-2 rounded">
                              <span>Food:</span>
                              <b>{campNeeds.food} kg</b>
                            </div>
                            <div className="flex justify-between bg-gray-50 p-2 rounded">
                              <span>Water:</span>
                              <b>{campNeeds.water} L</b>
                            </div>
                            <div className="flex justify-between bg-gray-50 p-2 rounded">
                              <span>Medicine:</span>
                              <b>{campNeeds.medicine} units</b>
                            </div>
                            <div className="flex justify-between bg-gray-50 p-2 rounded">
                              <span>Sanitary:</span>
                              <b>{campNeeds.sanitary} items</b>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>Contact:</span>
                          <b>{camp.contact_phone || "N/A"}</b>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* Citizen Need Reports Layer */}
          {(showWorkflowLayer === "all" || showWorkflowLayer === "reports") &&
            reports
              .filter((r) => hasValidSriLankaCoordinates(r))
              .map((report) => {
                const point = getCoordinates(report);
                const severity = normalizePriority(report.severity);
                
                return (
                  <Marker
                    key={`report-${report._id}`}
                    position={[point.lat, point.lng]}
                    icon={L.divIcon({
                      className: "citizen-report-marker",
                      html: `
                        <div class="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-md border-2 ${
                          severity === "High" ? "border-rose-500 text-rose-500" : 
                          severity === "Medium" ? "border-amber-500 text-amber-500" : "border-emerald-500 text-emerald-500"
                        }">
                          <span class="material-icons text-lg">warning</span>
                        </div>
                      `,
                      iconSize: [32, 32],
                      iconAnchor: [16, 16],
                    })}
                  >
                    <Tooltip>Citizen Request: {report.need_type}</Tooltip>
                    <Popup>
                      <div className="min-w-[280px]">
                        <div className={`p-3 bg-gradient-to-r ${
                          severity === "High" ? "from-rose-50 to-white" : 
                          severity === "Medium" ? "from-amber-50 to-white" : "from-emerald-50 to-white"
                        } border-b flex items-center justify-between`}>
                          <h4 className="font-bold text-gray-800 m-0">Citizen Request</h4>
                          <PriorityBadge level={severity} />
                        </div>
                        <div className="p-4 space-y-2 text-sm text-gray-600">
                          <div className="flex justify-between font-semibold text-gray-800">
                            <span>Type:</span>
                            <span className="text-blue-600">{report.need_type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Reporter:</span>
                            <b>{report.reporter_name}</b>
                          </div>
                          <div className="flex justify-between">
                            <span>People:</span>
                            <b>{report.people_count}</b>
                          </div>
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-bold uppercase">
                              {report.status || "Pending"}
                            </span>
                          </div>
                          <div className="mt-2 p-2 bg-gray-50 rounded italic text-xs">
                            "{report.description || "No additional details provided."}"
                          </div>
                          <div className="mt-3 pt-3 border-t flex items-center gap-2">
                            <span className="material-icons text-sm text-gray-400">phone</span>
                            <b className="text-gray-700">{report.contact_phone}</b>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
        </MapContainer>
      </div>
    </div>
  );
}
