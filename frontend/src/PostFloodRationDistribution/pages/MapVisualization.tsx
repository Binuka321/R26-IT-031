 // @ts-nocheck
import React, { useEffect, useState } from "react";
import { PageHeader, Loading, PriorityBadge } from "../components/UIComponents";
import * as api from "../services/api";
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

export default function MapVisualization() {
  const [camps, setCamps] = useState<any[]>([]);
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [floodRiskMap, setFloodRiskMap] = useState<any[]>([]);
  const [districtGeoJson, setDistrictGeoJson] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSafeZoneId, setSelectedSafeZoneId] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

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

    return [];
  };

  const callFirstAvailableApi = async (functionNames: string[]) => {
    for (const functionName of functionNames) {
      const apiFunction = (api as any)[functionName];

      if (typeof apiFunction === "function") {
        try {
          const response = await apiFunction();
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
      item?.coordinates?.lon ??
      item?.center?.longitude ??
      item?.center?.lng ??
      item?.center?.lon;

    return {
      lat: Number(lat),
      lng: Number(lng),
    };
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
    ) {
      return "High";
    }

    if (
      text.includes("medium") ||
      text.includes("moderate") ||
      text.includes("warning")
    ) {
      return "Medium";
    }

    return "Low";
  };

  const getRiskColors = (priority: PriorityLevel) => {
    if (priority === "High") {
      return {
        border: "#dc2626", // Red border
        fill: "#ef4444", // Red fill
        fillOpacity: 0.6,
      };
    }

    if (priority === "Medium") {
      return {
        border: "#ea580c", // Orange border
        fill: "#f97316", // Orange fill
        fillOpacity: 0.55,
      };
    }

    return {
      border: "#86efac", // Light green border
      fill: "#bbf7d0", // Light green fill
      fillOpacity: 0.5,
    };
  };

  const getSafeZoneId = (safeZone: any) => {
    if (!safeZone) return "";
    return typeof safeZone === "object" ? safeZone._id : safeZone;
  };

  const getSafeZoneName = (safeZone: any) => {
    if (!safeZone) return "Linked";

    if (typeof safeZone === "object") {
      return safeZone.name || safeZone.safe_zone_name || "Linked";
    }

    const zone = safeZones.find((z) => z._id === safeZone);
    return zone?.name || "Linked";
  };

  const getDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
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
      feature?.properties?.NAME_2 ||
      feature?.properties?.ADM2_EN ||
      feature?.properties?.DISTRICT ||
      feature?.properties?.district ||
      feature?.properties?.name ||
      feature?.properties?.Name ||
      ""
    );
  };

  const getFloodRiskForDistrict = (districtName: string): PriorityLevel => {
    const normalizedDistrictName = normalizeText(districtName);

    const matchedRisk = floodRiskMap.find((riskItem) => {
      const riskDistrict =
        riskItem?.district ||
        riskItem?.district_name ||
        riskItem?.districtName ||
        riskItem?.area ||
        riskItem?.area_name ||
        riskItem?.region ||
        riskItem?.name;

      return normalizeText(riskDistrict) === normalizedDistrictName;
    });

    if (!matchedRisk) {
      return "Low";
    }

    return normalizePriority(
      matchedRisk?.risk_level ||
        matchedRisk?.flood_risk_level ||
        matchedRisk?.riskLevel ||
        matchedRisk?.floodRiskLevel ||
        matchedRisk?.priority_level ||
        matchedRisk?.severity ||
        matchedRisk?.status
    );
  };

  const getFloodRiskForPoint = (lat: number, lng: number): PriorityLevel => {
    const nearbyRiskItems = floodRiskMap.filter((riskItem) => {
      if (!hasValidSriLankaCoordinates(riskItem)) return false;

      const point = getCoordinates(riskItem);
      return getDistanceKm(lat, lng, point.lat, point.lng) <= 10;
    });

    if (nearbyRiskItems.length === 0) return "Low";

    const hasHigh = nearbyRiskItems.some(
      (item) =>
        normalizePriority(
          item?.risk_level ||
            item?.flood_risk_level ||
            item?.priority_level ||
            item?.severity ||
            item?.status
        ) === "High"
    );

    const hasMedium = nearbyRiskItems.some(
      (item) =>
        normalizePriority(
          item?.risk_level ||
            item?.flood_risk_level ||
            item?.priority_level ||
            item?.severity ||
            item?.status
        ) === "Medium"
    );

    if (hasHigh) return "High";
    if (hasMedium) return "Medium";
    return "Low";
  };

  const getCampPriority = (camp: any): PriorityLevel => {
    if (camp.priority_level) return normalizePriority(camp.priority_level);

    const point = getCoordinates(camp);
    return getFloodRiskForPoint(point.lat, point.lng);
  };

  const loadMapData = async () => {
    try {
      const [safeZoneData, campData, memberOneFloodData, geoJsonData] =
        await Promise.all([
          callFirstAvailableApi(["getSafeZones"]),
          callFirstAvailableApi(["getCamps"]),
          callFirstAvailableApi([
            "getFloodRiskMap",
            "getFloodMap",
            "getFloodRiskData",
            "getMemberOneFloodRiskMap",
          ]),
          fetch("/src/data/sri_lanka_districts.geojson")
            .then((res) => res.json())
            .catch(() => null),
        ]);

      setSafeZones(safeZoneData);
      setCamps(campData);
      setFloodRiskMap(memberOneFloodData);

      if (geoJsonData) {
        setDistrictGeoJson(geoJsonData);
      }

      console.log("Member 1 Flood Risk Map:", memberOneFloodData);
      console.log("Safe Zones:", safeZoneData);
      console.log("Camps:", campData);
    } catch (error) {
      console.error("Error loading Sri Lanka map data:", error);
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
    return <Loading message="Loading Sri Lanka flood risk and safe zone map..." />;
  }

  const validSafeZones = safeZones.filter((zone) =>
    hasValidSriLankaCoordinates(zone)
  );

  const getZoneById = (zoneId: string) => {
    return validSafeZones.find((zone) => zone._id === zoneId);
  };

  const selectedSafeZone = selectedSafeZoneId
    ? getZoneById(selectedSafeZoneId)
    : null;

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
      zonePoint.lng
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

  const validSafeZoneCamps = camps.filter((camp) => {
    const safeZoneId = getSafeZoneId(camp.safe_zone_id);
    const campPriority = getCampPriority(camp);

    const safeZoneMatch =
      !selectedSafeZoneId || safeZoneId === selectedSafeZoneId;

    const priorityMatch = !filterPriority || campPriority === filterPriority;

    return (
      hasValidSriLankaCoordinates(camp) &&
      safeZoneId &&
      safeZoneMatch &&
      priorityMatch &&
      isCampInsideSafeZone(camp)
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
          width: 300px !important;
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
          text-shadow:
            0 0 4px #ffffff,
            0 0 8px rgba(0, 191, 255, 0.9),
            0 0 12px rgba(37, 99, 235, 0.8);
        }

        @keyframes blueStarPulse {
          0%, 100% {
            transform: scale(0.85);
            opacity: 0.45;
          }

          50% {
            transform: scale(1.25);
            opacity: 0.2;
          }
        }
      `,
      }}
    />
  );

  return (
    <div className="flex flex-col min-h-[760px] h-[calc(100vh-140px)]">
      <MapStyles />

      <PageHeader
        title="Sri Lanka Flood Risk, Safe Zones and Camps Map"
        subtitle="Flood risk from Member 1, safe zones in dark green, camps inside safe zones as bright blue stars"
        icon="public"
      />

      {/* Control Panel */}
      <div className="flex flex-col gap-3 mb-4 bg-white p-3 px-5 rounded-2xl shadow-sm border border-gray-100 shrink-0 relative z-10">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
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

          {/* Counts + Refresh */}
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-600">
            <span>
              Flood Risk Points:{" "}
              <b className="text-orange-600">{floodRiskMap.length}</b>
            </span>

            <span>
              Safe Zones:{" "}
              <b className="text-green-800">{validSafeZones.length}</b>
            </span>

            <span>
              Camps:{" "}
              <b className="text-blue-600">{validSafeZoneCamps.length}</b>
            </span>

            <button
              onClick={() => {
                setRefreshing(true);
                loadMapData();
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span
                className={`material-icons text-sm ${
                  refreshing ? "animate-spin" : ""
                }`}
              >
                refresh
              </span>
              Refresh
            </button>
          </div>
        </div>

        {/* Selected Safe Zone Bar + Legend */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          <div className="text-sm text-gray-600">
            {selectedSafeZone ? (
              <span>
                Showing camps inside selected safe zone:{" "}
                <b className="text-green-900">{selectedSafeZone.name}</b>
              </span>
            ) : (
              <span>
                Showing camps from <b>all safe zones</b>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              High Flood Risk
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-orange-500"></div>
              Medium Flood Risk
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-green-200 border border-green-400"></div>
              Low Flood Risk
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-green-800"></div>
              Safe Zone (Dark Green)
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[#00bfff] text-lg leading-none">★</span>
              Camps in Safe Zones
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 bg-gray-100 rounded-3xl shadow-inner border border-gray-200 overflow-hidden relative z-0">
        {refreshing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-blue-200 flex items-center gap-2 text-sm font-medium text-blue-800">
            <span className="material-icons animate-spin text-blue-500 text-sm">
              refresh
            </span>
            Refreshing Sri Lanka map data...
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

          {/* Member 1 Flood Risk Map Layer */}
          {districtGeoJson && (
            <GeoJSON
              key={`flood-risk-layer-${floodRiskMap.length}`}
              data={districtGeoJson}
              style={(feature: any) => {
                const districtName = getDistrictNameFromFeature(feature);
                const priority = getFloodRiskForDistrict(districtName);
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
                const priority = getFloodRiskForDistrict(districtName);
                const colors = getRiskColors(priority);

                layer.bindPopup(`
                  <div style="font-family: inherit; min-width: 180px; padding: 8px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1e293b;">
                      ${districtName || "Sri Lanka District"}
                    </h4>
                    <div style="
                      background-color: ${colors.fill};
                      color: ${priority === "Low" ? "#166534" : "#ffffff"};
                      padding: 6px 10px;
                      border-radius: 8px;
                      font-weight: 700;
                      font-size: 13px;
                      border: 1px solid ${colors.border};
                    ">
                      Member 1 Flood Risk: ${priority}
                    </div>
                  </div>
                `);
              }}
            />
          )}

          {/* Fallback Member 1 Flood Risk Points, if flood map has point data */}
          {floodRiskMap
            .filter((riskItem) => hasValidSriLankaCoordinates(riskItem))
            .map((riskItem, index) => {
              const point = getCoordinates(riskItem);
              const priority = normalizePriority(
                riskItem?.risk_level ||
                  riskItem?.flood_risk_level ||
                  riskItem?.priority_level ||
                  riskItem?.severity ||
                  riskItem?.status
              );
              const colors = getRiskColors(priority);

              return (
                <Circle
                  key={`member-1-risk-point-${index}`}
                  center={[point.lat, point.lng]}
                  radius={Number(riskItem.radius_km || 4) * 1000}
                  pathOptions={{
                    color: colors.border,
                    weight: 2,
                    fillColor: colors.fill,
                    fillOpacity: 0.45,
                  }}
                >
                  <Tooltip>
                    Member 1 Flood Risk: {priority}
                  </Tooltip>

                  <Popup>
                    <div className="p-4 text-sm">
                      <h4 className="font-bold text-gray-800 mb-2">
                        Member 1 Flood Risk Area
                      </h4>
                      <p>
                        <b>Risk:</b> {priority}
                      </p>
                      <p>
                        <b>Location:</b> {point.lat.toFixed(4)},{" "}
                        {point.lng.toFixed(4)}
                      </p>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

          {/* Safe Zones Layer - dark green */}
          {validSafeZones.map((zone) => {
            const point = getCoordinates(zone);
            const radiusKm = Number(zone.radius_km || zone.radius || 2);
            const zoneCamps = getZoneCamps(zone._id);
            const isSelected = selectedSafeZoneId === zone._id;

            return (
              <Circle
                key={`safe-zone-${zone._id}`}
                center={[point.lat, point.lng]}
                radius={radiusKm * 1000}
                eventHandlers={{
                  click: () => setSelectedSafeZoneId(zone._id),
                }}
                pathOptions={{
                  color: isSelected ? "#facc15" : "#064e3b", // Dark green border
                  weight: isSelected ? 4 : 2.5,
                  fillColor: "#065f46", // Dark green fill
                  fillOpacity: isSelected ? 0.78 : 0.65,
                }}
              >
                <Tooltip>
                  Click to filter camps: {zone.name}
                </Tooltip>

                <Popup>
                  <div className="p-0">
                    <div className="flex items-center gap-2 p-3.5 bg-gradient-to-r from-green-50 to-white border-b border-green-100">
                      <div
                        className="p-1.5 rounded-lg"
                        style={{
                          backgroundColor: "#065f4620",
                          color: "#065f46",
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
                            : "#065f4620",
                          color: isSelected ? "#a16207" : "#065f46",
                          border: isSelected
                            ? "1px solid #facc1540"
                            : "1px solid #065f4640",
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
                          {zone.current_population || 0} / {zone.capacity || 0}
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
                        className="w-full mt-3 px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-semibold hover:bg-green-900 transition"
                      >
                        Filter Camps in This Safe Zone
                      </button>
                    </div>
                  </div>
                </Popup>
              </Circle>
            );
          })}

          {/* Camps inside safe zones - bright blue stars */}
          {validSafeZoneCamps.map((camp) => {
            const point = getCoordinates(camp);
            const campPriority = getCampPriority(camp);

            return (
              <Marker
                key={`camp-${camp._id}`}
                position={[point.lat, point.lng]}
                icon={brightBlueStarIcon}
              >
                <Tooltip>
                  {camp.camp_name}
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
                        <span>Disease Risk:</span>
                        <b>{camp.disease_risk_level || "N/A"}</b>
                      </div>

                      <div className="flex justify-between">
                        <span>Camp Priority:</span>
                        <b>{campPriority}</b>
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
        </MapContainer>
      </div>
    </div>
  );
}