import React, { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  FormSelect,
  Loading,
  PageHeader,
  PrimaryButton,
  StatusBadge,
} from "../components/UIComponents";
import { FitMapToPoints, LiveRoadIncidentLayer, MapAutoResizer, operationalEmojiIcon, type LiveRoadIncident } from "../components/MapHelpers";
import * as api from "../services/api";
import { filterOutSeedCamps } from "../utils/filterSeedData";
import { GoogleMapActions, getGoogleMapsRouteUrl } from "../utils/googleMaps";
import { useLiveRefresh } from "../utils/useLiveRefresh";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type RouteMode = "Safest";

const routeModes: { value: RouteMode; label: string; icon: string; note: string }[] = [
  {
    value: "Safest",
    label: "Emergency safest",
    icon: "health_and_safety",
    note: "Prioritizes flood, road-blockage, bridge, traffic, road access, and vehicle safety before distance.",
  },
];

const distributionSourceIcon = operationalEmojiIcon({
  emoji: "📦",
  label: "Dispatch",
  color: "#0891b2",
  size: 40,
});

const reliefCampIcon = operationalEmojiIcon({
  emoji: "🏕️",
  label: "Relief camp",
  color: "#16a34a",
  size: 40,
});

const affectedCampIcon = operationalEmojiIcon({
  emoji: "🏕️",
  label: "Affected",
  color: "#dc2626",
  size: 42,
});

function routeTypeFromMode(mode: RouteMode) {
  return mode;
}

function routingPreferenceFromMode(mode: RouteMode) {
  return mode === "Safest" ? "road_network" : "road_network";
}

function getCampId(route: any) {
  return route?.camp_id && typeof route.camp_id === "object" ? route.camp_id._id : route?.camp_id;
}

function getCampName(route: any) {
  return route?.camp_id && typeof route.camp_id === "object" ? route.camp_id.camp_name : "Unknown camp";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not reported";
}

function formatMinutes(value?: number | null) {
  const minutes = Math.max(0, Math.round(Number(value || 0)));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function getRouteColor(route: any, index: number) {
  if (route.route_status === "Blocked") return "#f43f5e";
  if (route.route_status === "Alternative") return "#f59e0b";
  if (route.route_source !== "road_network") return "#fb923c";
  return ["#22d3ee", "#38bdf8", "#a78bfa", "#34d399"][index % 4];
}

function getRouteMapLabel(index: number) {
  return `R${index + 1}`;
}

function getMobilityColor(mode?: string) {
  if (mode === "boat") return "#0ea5e9";
  if (mode === "hand-delivery") return "#f59e0b";
  return "#22c55e";
}

function getMobilityLabel(mode?: string) {
  if (mode === "boat") return "Boat";
  if (mode === "hand-delivery") return "Hand";
  return "Truck";
}

function getSegmentPositions(segment: any): [number, number][] {
  const path = Array.isArray(segment?.path) && segment.path.length >= 2
    ? segment.path
    : [segment?.start, segment?.end];

  return path
    .map((coord: number[]) => [Number(coord?.[0]), Number(coord?.[1])] as [number, number])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
}

function getSegmentLabelPosition(segment: any): [number, number] | null {
  const positions = getSegmentPositions(segment);
  if (!positions.length) return null;
  return positions[Math.floor(positions.length / 2)];
}

function getRouteMobilityPlan(route: any) {
  const plan = route?.mobility_plan || null;
  const hasSegments = Array.isArray(plan?.segments) && plan.segments.length > 0;
  const hasDistance =
    Number(plan?.truck_distance_km || 0) > 0 ||
    Number(plan?.boat_distance_km || 0) > 0 ||
    Number(plan?.hand_delivery_distance_km || 0) > 0;

  if (hasSegments || hasDistance) return plan;

  const routeCoordinates = route?.route_coordinates || [];
  const routeDistance = Number(route?.distance || 0);
  if (!routeCoordinates.length || routeDistance <= 0) return plan;

  return {
    truck_distance_km: Math.round(routeDistance * 100) / 100,
    boat_distance_km: 0,
    hand_delivery_distance_km: 0,
    estimated_mixed_time_minutes: route?.estimated_time_minutes || 0,
    primary_mode: "truck",
    transfer_points: [],
    segments: [
      {
        mode: "truck",
        distance_km: Math.round(routeDistance * 100) / 100,
        path: routeCoordinates,
        start: routeCoordinates[0],
        end: routeCoordinates[routeCoordinates.length - 1],
        reason: "Existing route has no mixed-mode segment data, so it is shown as a truck road section.",
      },
    ],
  };
}

function mobilitySegmentLabelIcon(segment: any) {
  const mode = getMobilityLabel(segment.mode);
  const color = getMobilityColor(segment.mode);
  const distance = Number(segment.distance_km || 0).toFixed(1);
  return L.divIcon({
    className: "mobility-segment-label",
    html: `<div style="transform:translate(-50%,-50%);white-space:nowrap;border-radius:9999px;background:white;border:2px solid ${color};color:#0f172a;padding:3px 8px;font-size:11px;font-weight:900;box-shadow:0 8px 18px rgba(15,23,42,.22);">${mode} ${distance} km</div>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function getRouteLabelPosition(route: any): [number, number] | null {
  const coordinates = route.route_coordinates || [];
  if (!coordinates.length) return null;
  const midpoint = coordinates[Math.floor(coordinates.length / 2)];
  const latitude = Number(midpoint?.[0]);
  const longitude = Number(midpoint?.[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return [latitude, longitude];
}

function getRouteEndPosition(route: any): [number, number] | null {
  const coordinates = route.route_coordinates || [];
  const lastCoordinate = coordinates[coordinates.length - 1];
  const latitude = Number(route.end_latitude ?? lastCoordinate?.[0]);
  const longitude = Number(route.end_longitude ?? lastCoordinate?.[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return [latitude, longitude];
}

function getRouteOverlapKey(route: any) {
  const coordinates = route.route_coordinates || [];
  if (!coordinates.length) return "";
  const sampleStep = Math.max(1, Math.floor(coordinates.length / 8));
  return coordinates
    .filter((_: number[], index: number) => index % sampleStep === 0 || index === coordinates.length - 1)
    .map((coord: number[]) => `${Number(coord[0]).toFixed(3)},${Number(coord[1]).toFixed(3)}`)
    .join("|");
}

function positionsAreClose(a: [number, number] | null, b: [number, number] | null, threshold = 0.015) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) <= threshold && Math.abs(a[1] - b[1]) <= threshold;
}

function routeLabelIcon(route: any, index: number) {
  const color = getRouteColor(route, index);
  const labelOffset = (index % 5) * 18;
  return L.divIcon({
    className: "route-number-label",
    html: `<div style="transform:translate(-50%, calc(-50% + ${labelOffset}px));white-space:nowrap;border-radius:9999px;background:${color};border:2px solid white;color:white;padding:3px 8px;font-size:11px;font-weight:900;box-shadow:0 8px 18px rgba(15,23,42,.25);">${getRouteMapLabel(index)}</div>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function getSafetyTone(score: number) {
  if (score >= 75) return "text-emerald-200 border-emerald-400/35 bg-emerald-500/10";
  if (score >= 50) return "text-cyan-100 border-cyan-400/35 bg-cyan-500/10";
  if (score >= 25) return "text-amber-100 border-amber-400/35 bg-amber-500/10";
  return "text-rose-100 border-rose-400/35 bg-rose-500/10";
}

function getDispatchGuidance(route: any) {
  const score = Number(route.safety_score || 0);
  if (route.route_status === "Blocked" || score < 25) {
    return "Do not dispatch on this route. Select an alternative route or use field verification.";
  }
  if (score < 50) return "High risk. Dispatch only with field confirmation and a backup plan.";
  if (score < 75) return "Usable with caution. Confirm bridge access, road passability, flood level, and team readiness.";
  return "Best available system recommendation. Confirm latest field conditions before movement.";
}

export default function RoutePlanning() {
  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [needReports, setNeedReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshingRoutes, setRefreshingRoutes] = useState(false);

  const [selectedCamp, setSelectedCamp] = useState("");
  const [startLat, setStartLat] = useState(6.9145);
  const [startLng, setStartLng] = useState(79.9738);
  const [routeMode, setRouteMode] = useState<RouteMode>("Safest");
  const [vehicleType, setVehicleType] = useState("truck");
  const [trafficLevel, setTrafficLevel] = useState("Clear");
  const [bridgeCondition, setBridgeCondition] = useState("Clear");
  const [vehiclePassability, setVehiclePassability] = useState("Passable");
  const [restrictSelectedVehicle, setRestrictSelectedVehicle] = useState(false);
  const [routeViewMode, setRouteViewMode] = useState<"current" | "all">("current");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routeMessage, setRouteMessage] = useState("");
  const [liveRoadIncidents, setLiveRoadIncidents] = useState<LiveRoadIncident[]>([]);
  const [lastLiveRoadConditionSummary, setLastLiveRoadConditionSummary] = useState<any>(null);
  const [showLiveRoadIncidents, setShowLiveRoadIncidents] = useState(true);

  const load = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [campsResponse, routesResponse, reportsResponse] = await Promise.all([
        api.getCamps(),
        api.getAllRoutes(),
        api.getNeedReports().catch(() => ({ data: [] })),
      ]);

      try {
        setCamps(filterOutSeedCamps(campsResponse.data || []));
      } catch {
        setCamps(campsResponse.data || []);
      }
      setAllRoutes(routesResponse.data || []);
      setNeedReports(reportsResponse.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  const selectedCampData = camps.find((camp) => camp._id === selectedCamp);
  const selectedMode = routeModes.find((mode) => mode.value === routeMode) || routeModes[0];

  const activeHazardReports = useMemo(
    () => needReports.filter((report) => ["Pending", "In Progress", "Responded"].includes(report.status)),
    [needReports],
  );

  const floodZoneInputs = useMemo(
    () =>
      activeHazardReports
        .filter((report) => report.need_type === "Flood Level")
        .map((report) => ({
          latitude: Number(report.latitude),
          longitude: Number(report.longitude),
          radius_km: ["Emergency", "Critical"].includes(report.severity) ? 3 : 2,
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)),
    [activeHazardReports],
  );

  const blockedRoadInputs = useMemo(
    () =>
      activeHazardReports
        .filter((report) => report.need_type === "Road Blockage")
        .map((report) => ({
          latitude: Number(report.latitude),
          longitude: Number(report.longitude),
          radius_km: ["Emergency", "Critical"].includes(report.severity) ? 1.2 : 0.8,
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)),
    [activeHazardReports],
  );

  const availableRoutes = useMemo(() => {
    return allRoutes;
  }, [allRoutes]);

  const recommendedRoute = availableRoutes
    .filter((route) => route.route_status !== "Blocked")
    .sort((a, b) => {
      if ((b.safety_score || 0) !== (a.safety_score || 0)) return (b.safety_score || 0) - (a.safety_score || 0);
      return (a.distance || 9999) - (b.distance || 9999);
    })[0];
  const selectedRoute =
    availableRoutes.find((route) => route._id === selectedRouteId) ||
    recommendedRoute ||
    availableRoutes[0] ||
    null;
  const routesForSelection = routeViewMode === "all"
    ? availableRoutes
    : selectedRoute
      ? [selectedRoute]
      : [];
  const bestRoute = selectedRoute || recommendedRoute;
  const routeOverlapIndexes = useMemo(() => {
    const overlapIndexes = new Set<number>();
    const geometryGroups = new Map<string, number[]>();

    routesForSelection.forEach((route, index) => {
      const key = getRouteOverlapKey(route);
      if (!key) return;
      const group = geometryGroups.get(key) || [];
      group.push(index);
      geometryGroups.set(key, group);
    });

    for (const group of geometryGroups.values()) {
      if (group.length > 1) group.forEach((index) => overlapIndexes.add(index));
    }

    for (let index = 0; index < routesForSelection.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < routesForSelection.length; nextIndex += 1) {
        const sameLabelArea = positionsAreClose(
          getRouteLabelPosition(routesForSelection[index]),
          getRouteLabelPosition(routesForSelection[nextIndex]),
        );
        const sameDestination = positionsAreClose(
          getRouteEndPosition(routesForSelection[index]),
          getRouteEndPosition(routesForSelection[nextIndex]),
          0.004,
        );
        if (sameLabelArea && sameDestination) {
          overlapIndexes.add(index);
          overlapIndexes.add(nextIndex);
        }
      }
    }

    return overlapIndexes;
  }, [routesForSelection]);

  const mapCenter: [number, number] =
    selectedCampData?.latitude && selectedCampData?.longitude
      ? [selectedCampData.latitude, selectedCampData.longitude]
      : [7.8731, 80.7718];
  const routePositions = routesForSelection.flatMap((route) =>
    (route.route_coordinates || []).map((coord: number[]) => [coord[0], coord[1]] as [number, number]),
  );
  const routeDestinationMarkers = useMemo(() => {
    const markerMap = new Map<string, {
      key: string;
      latitude: number;
      longitude: number;
      name: string;
      status?: string;
      safetyScore?: number;
      routeLabels: string[];
    }>();

    routesForSelection.forEach((route, index) => {
      const routeCoordinates = route.route_coordinates || [];
      const lastCoordinate = routeCoordinates[routeCoordinates.length - 1];
      const latitude = Number(route.end_latitude ?? lastCoordinate?.[0]);
      const longitude = Number(route.end_longitude ?? lastCoordinate?.[1]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      const label = routeOverlapIndexes.has(index) ? getRouteMapLabel(index) : "";
      const existing = markerMap.get(key);
      if (existing) {
        if (label) existing.routeLabels.push(label);
        existing.safetyScore = Math.max(Number(existing.safetyScore || 0), Number(route.safety_score || 0));
        if (existing.status !== "Active") existing.status = route.route_status;
        return;
      }

      markerMap.set(key, {
          key,
          latitude,
          longitude,
          name: getCampName(route),
          status: route.route_status,
          safetyScore: route.safety_score,
          routeLabels: label ? [label] : [],
      });
    });

    return Array.from(markerMap.values());
  }, [routesForSelection, routeOverlapIndexes]);
  const mapFitPoints: [number, number][] = [
    [startLat, startLng],
    ...(selectedCampData ? [[selectedCampData.latitude, selectedCampData.longitude] as [number, number]] : []),
    ...routeDestinationMarkers.map((marker) => [marker.latitude, marker.longitude] as [number, number]),
    ...routePositions,
  ];

  const stats = [
    { label: "Generated", value: allRoutes.length, icon: "route", tone: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100" },
    {
      label: "Road Network",
      value: allRoutes.filter((route) => route.route_source === "road_network").length,
      icon: "alt_route",
      tone: "border-blue-400/30 bg-blue-500/10 text-blue-100",
    },
    {
      label: "Blocked",
      value: allRoutes.filter((route) => route.route_status === "Blocked").length,
      icon: "block",
      tone: "border-rose-400/30 bg-rose-500/10 text-rose-100",
    },
    {
      label: "Avg Safety",
      value: allRoutes.length
        ? Math.round(allRoutes.reduce((sum, route) => sum + Number(route.safety_score || 0), 0) / allRoutes.length)
        : 0,
      icon: "security",
      tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    },
  ];

  const handleGenerate = async () => {
    if (!selectedCamp) {
      alert("Select a destination camp");
      return;
    }
    const validRouteModes = routeModes.map((mode) => mode.value);
    const validVehicles = ["truck", "ambulance", "boat", "hand-delivery"];
    const validTrafficLevels = ["Clear", "Moderate", "Heavy"];
    const validBridgeConditions = ["Clear", "Weak", "Closed"];
    const validPassability = ["Passable", "Limited", "Not Passable"];

    if (!Number.isFinite(startLat) || startLat < 5 || startLat > 10) {
      alert("Start latitude must be inside Sri Lanka.");
      return;
    }
    if (!Number.isFinite(startLng) || startLng < 79 || startLng > 82) {
      alert("Start longitude must be inside Sri Lanka.");
      return;
    }
    if (!validRouteModes.includes(routeMode)) {
      alert("Select a valid route strategy.");
      return;
    }
    if (!validVehicles.includes(vehicleType)) {
      alert("Select a valid vehicle.");
      return;
    }
    if (!validTrafficLevels.includes(trafficLevel)) {
      alert("Select a valid traffic level.");
      return;
    }
    if (!validBridgeConditions.includes(bridgeCondition)) {
      alert("Select a valid bridge condition.");
      return;
    }
    if (!validPassability.includes(vehiclePassability)) {
      alert("Select a valid road access value.");
      return;
    }

    setGenerating(true);
    setRouteMessage("");
    try {
      const response = await api.generateRoute({
        camp_id: selectedCamp,
        start_latitude: startLat,
        start_longitude: startLng,
        route_type: routeTypeFromMode(routeMode),
        routing_preference: routingPreferenceFromMode(routeMode),
        replace_existing: true,
        vehicle_type: vehicleType,
        road_constraints: {
          traffic_level: trafficLevel,
          bridge_condition: bridgeCondition,
          vehicle_passability: vehiclePassability,
          restricted_vehicle_types: restrictSelectedVehicle ? [vehicleType] : [],
        },
        flood_zones: floodZoneInputs,
        blocked_roads: blockedRoadInputs,
      });

      const liveSummary = response.live_road_conditions || response.data?.live_road_condition_summary;
      setLastLiveRoadConditionSummary(liveSummary || null);
      setLiveRoadIncidents(liveSummary?.blocked_roads || []);
      setRouteMessage(
        response.already_exists
          ? `Existing route reused. ${liveSummary?.count ?? 0} RDA road incident(s) checked.`
          : `Route generated with ${floodZoneInputs.length} flood report(s), ${blockedRoadInputs.length} citizen blockage report(s), and ${liveSummary?.count ?? 0} RDA incident(s).`,
      );

      if (response.data) {
        setAllRoutes((current) => [
          response.data,
          ...current.filter((route) => getCampId(route) !== selectedCamp),
        ]);
        setSelectedRouteId(response.data._id);
      }
      setRouteViewMode("current");
      const refreshedRoutes = await api.getAllRoutes();
      setAllRoutes(refreshedRoutes.data || []);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm("Remove this generated route?")) return;
    try {
      await api.deleteRoute(routeId);
      await load(false);
      setRouteMessage("Route removed.");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const refreshLiveRoutes = async ({ silent = false } = {}) => {
    if (!routesForSelection.length) {
      if (!silent) setRouteMessage("No generated routes available to refresh.");
      return;
    }

    setRefreshingRoutes(true);
    if (!silent) setRouteMessage("");
    try {
      const results = await Promise.allSettled(routesForSelection.map((route) => api.refreshRoute(route._id)));
      const successfulResponses = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
        .map((result) => result.value);
      const refreshedRoutes = successfulResponses.map((response: any) => response.data).filter(Boolean);
      const failedCount = results.length - successfulResponses.length;
      const latestLiveSummary =
        successfulResponses.find((response: any) => response.live_road_conditions)?.live_road_conditions ||
        refreshedRoutes.find((route: any) => route.live_road_condition_summary)?.live_road_condition_summary ||
        null;

      if (!refreshedRoutes.length && failedCount > 0) {
        const firstFailure = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(firstFailure?.reason?.message || "Live route refresh failed.");
      }

      setAllRoutes((current) =>
        current.map((route) => refreshedRoutes.find((updated: any) => updated._id === route._id) || route),
      );
      setLastLiveRoadConditionSummary(latestLiveSummary);
      setLiveRoadIncidents(latestLiveSummary?.blocked_roads || []);
      setRouteMessage(
        `${silent ? "Auto live route adjustment" : "Live route refresh"} completed for ${refreshedRoutes.length} route(s). ${latestLiveSummary?.count ?? 0} RDA incident(s) checked.${failedCount ? ` ${failedCount} route(s) could not be updated.` : ""}`,
      );
      await load(false);
    } catch (error: any) {
      if (!silent) alert(error.message);
      else console.error(error);
      setRouteMessage(error.message || "Live route refresh failed.");
    } finally {
      setRefreshingRoutes(false);
    }
  };

  useLiveRefresh(() => load(false), [], 30000, !generating && !refreshingRoutes);
  useLiveRefresh(
    () => refreshLiveRoutes({ silent: true }),
    [selectedCamp, routesForSelection.length],
    60000,
    Boolean(selectedCamp && routesForSelection.length) && !generating && !refreshingRoutes,
  );

  if (loading) return <Loading message="Loading route planning console..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency Safest Route Planning"
        subtitle="Risk-aware dispatch routing that prioritizes safety over shortest distance"
        icon="route"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void refreshLiveRoutes()}
              disabled={refreshingRoutes || routesForSelection.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={`material-icons text-base ${refreshingRoutes ? "animate-spin" : ""}`}>sync</span>
              {refreshingRoutes ? "Updating routes..." : "Refresh Live Routes"}
            </button>
            <button
              onClick={() => void load(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
            >
              <span className="material-icons text-base">refresh</span>
              Reload Data
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-lg border p-4 ${stat.tone}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide opacity-75">{stat.label}</p>
                <p className="mt-1 text-2xl font-black">{stat.value}</p>
              </div>
              <span className="material-icons">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Generate Route</h2>
              <p className="text-xs text-slate-400">Choose destination and field constraints for the safest dispatch route.</p>
            </div>
            <span className="material-icons text-cyan-200">add_road</span>
          </div>

          <div className="space-y-4">
            <FormSelect
              label="Destination Camp"
              value={selectedCamp}
              onChange={setSelectedCamp}
              options={[
                { value: "", label: "Select destination camp" },
                ...camps.map((camp) => ({ value: camp._id, label: camp.camp_name })),
              ]}
            />

            <FormSelect
              label="Route Strategy"
              value={routeMode}
              onChange={(value) => setRouteMode(value as RouteMode)}
              options={routeModes.map((mode) => ({ value: mode.value, label: mode.label }))}
            />

            <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
                <span className="material-icons text-base text-cyan-200">{selectedMode.icon}</span>
                {selectedMode.label}
              </div>
              <p className="text-xs text-cyan-100/80">{selectedMode.note}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-200">Start Latitude</span>
                <input
                  type="number"
                  value={startLat}
                  step="0.0001"
                  onChange={(event) => setStartLat(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-200">Start Longitude</span>
                <input
                  type="number"
                  value={startLng}
                  step="0.0001"
                  onChange={(event) => setStartLng(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormSelect
                label="Vehicle"
                value={vehicleType}
                onChange={setVehicleType}
                options={[
                  { value: "truck", label: "Truck" },
                  { value: "ambulance", label: "Ambulance" },
                  { value: "boat", label: "Boat" },
                  { value: "hand-delivery", label: "Hand Delivery" },
                ]}
              />
              <FormSelect
                label="Traffic"
                value={trafficLevel}
                onChange={setTrafficLevel}
                options={[
                  { value: "Clear", label: "Clear" },
                  { value: "Moderate", label: "Moderate" },
                  { value: "Heavy", label: "Heavy" },
                ]}
              />
              <FormSelect
                label="Bridge"
                value={bridgeCondition}
                onChange={setBridgeCondition}
                options={[
                  { value: "Clear", label: "Clear" },
                  { value: "Weak", label: "Weak" },
                  { value: "Closed", label: "Closed" },
                ]}
              />
              <FormSelect
                label="Road Access"
                value={vehiclePassability}
                onChange={setVehiclePassability}
                options={[
                  { value: "Passable", label: "Passable" },
                  { value: "Limited", label: "Limited" },
                  { value: "Not Passable", label: "Not Passable" },
                ]}
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={restrictSelectedVehicle}
                onChange={(event) => setRestrictSelectedVehicle(event.target.checked)}
                className="h-4 w-4"
              />
              Selected vehicle is restricted
            </label>

            <PrimaryButton onClick={handleGenerate} icon="route" disabled={generating || !selectedCamp} className="w-full justify-center">
              {generating ? "Generating..." : "Generate Route"}
            </PrimaryButton>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Operational Map</h2>
              <p className="text-xs text-slate-400">
                {selectedCampData ? selectedCampData.camp_name : "Select a camp to focus the route corridor"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowLiveRoadIncidents((current) => !current)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                  showLiveRoadIncidents
                    ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
                    : "border-slate-600 bg-slate-800 text-slate-300"
                }`}
              >
                RDA incidents ({liveRoadIncidents.length})
              </button>
              <select
                value={routeViewMode}
                onChange={(event) => setRouteViewMode(event.target.value as "current" | "all")}
                className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100"
              >
                <option value="current">Current route</option>
                <option value="all">All routes</option>
              </select>
              {routeViewMode === "current" && availableRoutes.length > 0 && (
                <select
                  value={selectedRoute?._id || ""}
                  onChange={(event) => setSelectedRouteId(event.target.value)}
                  className="max-w-[220px] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100"
                >
                  {availableRoutes.map((route, index) => (
                    <option key={route._id} value={route._id}>
                      {index + 1}. {getCampName(route)} | safety {route.safety_score ?? "N/A"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="relative h-[520px]">
            <div className="absolute left-3 top-3 z-[1000] flex flex-wrap gap-2 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs font-bold text-slate-100 shadow-lg">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-5 rounded-full bg-emerald-500" />
                Truck road
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-5 rounded-full bg-sky-500" />
                Boat section
              </span>
              {(selectedRoute || bestRoute)?.route_coordinates?.length ? (
                <a
                  href={getGoogleMapsRouteUrl(((selectedRoute || bestRoute).route_coordinates || []).map((coord: number[]) => [coord[0], coord[1]] as [number, number]))}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-cyan-600 px-2 py-1 text-white hover:bg-cyan-500"
                >
                  <span className="material-icons text-xs">route</span>
                  Google route
                </a>
              ) : (
                <GoogleMapActions latitude={startLat} longitude={startLng} compact directions={false} />
              )}
            </div>
            <MapContainer center={mapCenter} zoom={11} style={{ height: "520px", minHeight: "520px", width: "100%" }}>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapAutoResizer deps={[selectedCamp, routesForSelection.length, showLiveRoadIncidents]} />
              <FitMapToPoints points={mapFitPoints.length ? mapFitPoints : [mapCenter]} />
              {showLiveRoadIncidents && <LiveRoadIncidentLayer incidents={liveRoadIncidents} maxItems={160} />}
              <Marker position={[startLat, startLng]} icon={distributionSourceIcon} zIndexOffset={1600}>
                <Popup>Relief dispatch start point</Popup>
              </Marker>
              {selectedCampData && routeDestinationMarkers.length === 0 && (
                <Marker position={[selectedCampData.latitude, selectedCampData.longitude]} icon={reliefCampIcon} zIndexOffset={1700}>
                  <Popup>Relief distribution camp: {selectedCampData.camp_name}</Popup>
                </Marker>
              )}
              {routeDestinationMarkers.map((marker) => (
                <Marker
                  key={`affected-${marker.key}`}
                  position={[marker.latitude, marker.longitude]}
                  icon={affectedCampIcon}
                  zIndexOffset={1900}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold">Affected relief camp: {marker.name}</p>
                      {!!marker.routeLabels.length && <p>Overlapping routes: {marker.routeLabels.join(", ")}</p>}
                      <p>Status: {marker.status || "Unknown"}</p>
                      <p>Safety: {marker.safetyScore ?? "N/A"}/100</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {routesForSelection.map((route, index) => {
                const positions = (route.route_coordinates || []).map((coord: number[]) => [coord[0], coord[1]] as [number, number]);
                const labelPosition = getRouteLabelPosition(route);
                const mobilityPlan = getRouteMobilityPlan(route);
                const mobilitySegments = mobilityPlan?.segments || [];
                const showMobilityLabels = bestRoute?._id === route._id || selectedRoute?._id === route._id;
                return (
                  <React.Fragment key={route._id}>
                    <Polyline
                      positions={positions}
                      pathOptions={{
                        color: mobilitySegments.length ? "#0f172a" : getRouteColor(route, index),
                        weight: bestRoute?._id === route._id ? 9 : 6,
                        opacity: mobilitySegments.length ? 0.35 : bestRoute?._id === route._id ? 0.95 : 0.72,
                        dashArray: route.route_source === "road_network" ? undefined : "10 8",
                      }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <p className="font-bold">{route.route_name}</p>
                          <p>Status: {route.route_status}</p>
                          <p>Safety: {route.safety_score}/100</p>
                          {positions.length >= 2 && (
                            <a href={getGoogleMapsRouteUrl(positions)} target="_blank" rel="noreferrer">
                              Open this route in Google Maps
                            </a>
                          )}
                        </div>
                      </Popup>
                    </Polyline>
                    {mobilitySegments.map((segment: any, segmentIndex: number) => {
                      const segmentPositions = getSegmentPositions(segment);
                      const segmentLabelPosition = getSegmentLabelPosition(segment);
                      if (segmentPositions.length < 2) return null;
                      return (
                        <React.Fragment key={`${route._id}-mobility-${segmentIndex}`}>
                          <Polyline
                            positions={segmentPositions}
                            pathOptions={{
                              color: getMobilityColor(segment.mode),
                              weight: bestRoute?._id === route._id ? 7 : 5,
                              opacity: bestRoute?._id === route._id ? 0.96 : 0.78,
                              dashArray: segment.mode === "boat" ? "8 7" : undefined,
                            }}
                          >
                            <Popup>
                              <div className="text-xs">
                                <p className="font-bold">{getMobilityLabel(segment.mode)} section</p>
                                <p>Distance: {Number(segment.distance_km || 0).toFixed(2)} km</p>
                                {segment.reason && <p>{segment.reason}</p>}
                              </div>
                            </Popup>
                          </Polyline>
                          {showMobilityLabels && segmentLabelPosition && Number(segment.distance_km || 0) > 0.05 && (
                            <Marker
                              position={segmentLabelPosition}
                              icon={mobilitySegmentLabelIcon(segment)}
                              interactive={false}
                              zIndexOffset={2800 + segmentIndex}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                    {labelPosition && routeOverlapIndexes.has(index) && (
                      <Marker
                        position={labelPosition}
                        icon={routeLabelIcon(route, index)}
                        interactive={false}
                        zIndexOffset={2600 + index}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </MapContainer>
          </div>
        </section>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Generated Routes</h2>
              <p className="text-xs text-slate-400">
                {routesForSelection.length} route(s) shown in {routeViewMode === "all" ? "All routes" : "Current route"} mode
              </p>
            </div>
          </div>

          {routesForSelection.length === 0 ? (
            <EmptyState icon="route" title="No routes found" subtitle="Generate a route for the selected camp." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {routesForSelection.map((route, index) => {
                const score = Number(route.safety_score || 0);
                const profile = route.emergency_safety_profile;
                const mobilityPlan = getRouteMobilityPlan(route);
                const routeLabel = `${index + 1}. Emergency safest`;
                return (
                  <article key={route._id} className={`rounded-lg border p-4 ${getSafetyTone(score)}`}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white">{route.route_name || `Route to ${getCampName(route)}`}</h3>
                        <p className="text-xs text-slate-300">
                          {routeLabel} | {route.route_algorithm} | {route.route_source === "road_network" ? "Road network" : "Estimated backup"}
                        </p>
                        {profile?.risk_level && (
                          <p className="mt-1 text-xs text-slate-300">
                            Risk-aware model: {profile.risk_level} corridor risk
                          </p>
                        )}
                      </div>
                      <StatusBadge status={route.route_status} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-slate-950/50 p-2">
                        <p className="font-black text-white">{score}</p>
                        <p className="text-slate-400">Safety</p>
                      </div>
                      <div className="rounded-lg bg-slate-950/50 p-2">
                        <p className="font-black text-white">{route.distance || 0}</p>
                        <p className="text-slate-400">km</p>
                      </div>
                      <div className="rounded-lg bg-slate-950/50 p-2">
                        <p className="font-black text-white">{route.estimated_time || "N/A"}</p>
                        <p className="text-slate-400">Time</p>
                      </div>
                    </div>

                    {mobilityPlan && (
                      <div className="mt-3 rounded-lg border border-cyan-400/25 bg-slate-950/40 p-3 text-xs text-slate-200">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="font-bold text-white">Truck / Boat split</p>
                          <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 font-bold text-cyan-100">
                            {String(mobilityPlan.primary_mode || "truck").replace("-", " ")}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-md bg-slate-950/70 p-2">
                            <p className="font-black text-white">{mobilityPlan.truck_distance_km ?? 0}</p>
                            <p className="text-slate-400">Truck km</p>
                          </div>
                          <div className="rounded-md bg-slate-950/70 p-2">
                            <p className="font-black text-white">{mobilityPlan.boat_distance_km ?? 0}</p>
                            <p className="text-slate-400">Boat km</p>
                          </div>
                          <div className="rounded-md bg-slate-950/70 p-2">
                            <p className="font-black text-white">{mobilityPlan.transfer_points?.length ?? 0}</p>
                            <p className="text-slate-400">Transfers</p>
                          </div>
                        </div>
                        <p className="mt-2 text-slate-300">
                          Mixed travel estimate: {formatMinutes(mobilityPlan.estimated_mixed_time_minutes)}
                        </p>
                      </div>
                    )}

                    <p className="mt-3 rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-200">
                      {getDispatchGuidance(route)}
                    </p>

                    {profile && (
                      <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-200">
                        <p className="font-bold text-white">Why this is safest</p>
                        <p className="mt-1">
                          Flood exposure: {profile.flood_exposure_points ?? 0} point(s) | Road blockage exposure:{" "}
                          {profile.blocked_road_exposure_points ?? 0} point(s)
                        </p>
                        {!!profile.reasons?.length && (
                          <p className="mt-1 text-slate-300">{profile.reasons[0]}</p>
                        )}
                      </div>
                    )}

                    {!!route.warnings?.length && (
                      <div className="mt-3 space-y-1">
                        {route.warnings.slice(0, 4).map((warning: string, warningIndex: number) => (
                          <p key={`${route._id}-${warningIndex}`} className="flex gap-1 text-xs text-amber-100">
                            <span className="material-icons text-sm">warning</span>
                            {warning}
                          </p>
                        ))}
                      </div>
                    )}

                    {route.live_road_condition_summary && (
                      <p className="mt-3 text-xs text-slate-300">
                        RDA incidents considered: {route.live_road_condition_summary.count || 0} | Last update:{" "}
                        {formatDateTime(route.live_road_condition_summary.last_updated)}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-slate-700 pt-3 text-xs text-slate-400">
                      <span>{String(route.vehicle_type || "truck").replace("-", " ")}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedRouteId(route._id);
                            setRouteViewMode("current");
                          }}
                          className={`rounded-md border px-2 py-1 font-semibold ${
                            selectedRoute?._id === route._id && routeViewMode === "current"
                              ? "border-cyan-300 bg-cyan-500/20 text-cyan-100"
                              : "border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                          }`}
                        >
                          Current
                        </button>
                        <button
                          onClick={() => handleDeleteRoute(route._id)}
                          className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 font-semibold text-rose-100 hover:bg-rose-500/20"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <div className="mb-4 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
              <span className="material-icons text-cyan-200">fact_check</span>
              Route Decision
            </h2>
            {bestRoute ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-white">
                  {bestRoute.route_name || `Route to ${getCampName(bestRoute)}`}
                </p>
                <p className="text-xs text-slate-300">
                  {bestRoute.distance} km | {bestRoute.estimated_time} | safety {bestRoute.safety_score}/100
                </p>
                {getRouteMobilityPlan(bestRoute) && (
                  <p className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-200">
                    Truck {getRouteMobilityPlan(bestRoute)?.truck_distance_km ?? 0} km | Boat{" "}
                    {getRouteMobilityPlan(bestRoute)?.boat_distance_km ?? 0} km | Transfers{" "}
                    {getRouteMobilityPlan(bestRoute)?.transfer_points?.length ?? 0}
                  </p>
                )}
                <p className="rounded-lg border border-cyan-400/25 bg-slate-950/50 p-3 text-xs text-cyan-100">
                  {getDispatchGuidance(bestRoute)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No usable route selected yet.</p>
            )}
          </div>

          <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
              <span className="material-icons text-rose-200">location_on</span>
              Affected Areas
            </h2>
            {routeDestinationMarkers.length ? (
              <div className="space-y-2">
                {routeDestinationMarkers.map((marker) => (
                  <div key={`affected-summary-${marker.key}`} className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-200">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-white">{marker.name}</p>
                        <p className="mt-1 text-slate-400">
                          {marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}
                        </p>
                        <div className="mt-2">
                          <GoogleMapActions latitude={marker.latitude} longitude={marker.longitude} compact />
                        </div>
                        {!!marker.routeLabels.length && (
                          <p className="mt-1 text-slate-300">Overlapping routes: {marker.routeLabels.join(", ")}</p>
                        )}
                      </div>
                      <StatusBadge status={marker.status || "Active"} />
                    </div>
                    <p className="mt-2 text-slate-300">Safety score: {marker.safetyScore ?? "N/A"}/100</p>
                  </div>
                ))}
              </div>
            ) : selectedCampData ? (
              <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-200">
                <p className="font-bold text-white">{selectedCampData.camp_name}</p>
                <p className="mt-1 text-slate-400">
                  {Number(selectedCampData.latitude).toFixed(4)}, {Number(selectedCampData.longitude).toFixed(4)}
                </p>
                <div className="mt-2">
                  <GoogleMapActions latitude={selectedCampData.latitude} longitude={selectedCampData.longitude} compact />
                </div>
                <p className="mt-2 text-slate-300">Generate a route to attach live route status and safety details.</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Select all statuses to view every generated affected destination currently loaded.</p>
            )}
          </div>

          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">Data Sources</h2>
          <div className="space-y-3 text-sm">
            {[
              { label: "Citizen road blockages", value: blockedRoadInputs.length, icon: "report" },
              { label: "Flood-level reports", value: floodZoneInputs.length, icon: "water_damage" },
              { label: "Live RDA incidents", value: lastLiveRoadConditionSummary?.count ?? "Auto", icon: "report_problem" },
              { label: "Field checks", value: 4, icon: "engineering" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950 p-3">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="material-icons text-base text-cyan-200">{item.icon}</span>
                  {item.label}
                </span>
                <b className="text-white">{item.value}</b>
              </div>
            ))}
          </div>

          {routeMessage && (
            <div className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
              {routeMessage}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <p className="font-bold">Dispatch rule</p>
            <p className="mt-1">
              Safety is prioritized over shortest distance. Treat routes below 50 safety as unsafe until field teams confirm bridge access, road passability, and current flood conditions.
            </p>
            {lastLiveRoadConditionSummary?.last_updated && (
              <p className="mt-2 text-amber-200/80">RDA source updated: {formatDateTime(lastLiveRoadConditionSummary.last_updated)}</p>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
              <span className="material-icons text-cyan-200">{selectedMode.icon}</span>
              {selectedMode.label}
            </div>
            <p className="text-xs text-slate-400">{selectedMode.note}</p>
          </div>
        </aside>
      </section>
    </div>
  );
}
