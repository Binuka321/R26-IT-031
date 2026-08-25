import express from "express";
import Route from "../models/Route.js";
import Camp from "../models/Camp.js";
import NeedReport from "../models/NeedReport.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { RoutePlanningEngine } from "../utils/routePlanningEngine.js";
import { NotificationEngine } from "../utils/notificationEngine.js";
import { tryRecalculateCampPriority } from "../utils/campPriorityRecalculation.js";
import {
  fetchRdaRoadConditions,
  fetchRdaRoadConditionsForBounds,
} from "../utils/rdaRoadConditionService.js";

const router = express.Router();

function normalizeCoordinate(value) {
  return Number(Number(value).toFixed(5));
}

function normalizeCriteriaList(items) {
  return [...items]
    .map((item) => ({
      latitude: normalizeCoordinate(item.latitude),
      longitude: normalizeCoordinate(item.longitude),
      radius_km: item.radius_km ? Number(Number(item.radius_km).toFixed(2)) : undefined,
    }))
    .sort((a, b) => {
      if (a.latitude !== b.latitude) return a.latitude - b.latitude;
      return a.longitude - b.longitude;
    });
}

function normalizeRoadConstraints(constraints = {}) {
  return {
    traffic_level: ["Clear", "Moderate", "Heavy"].includes(constraints.traffic_level)
      ? constraints.traffic_level
      : "Clear",
    bridge_condition: ["Clear", "Weak", "Closed"].includes(constraints.bridge_condition)
      ? constraints.bridge_condition
      : "Clear",
    vehicle_passability: ["Passable", "Limited", "Not Passable"].includes(constraints.vehicle_passability)
      ? constraints.vehicle_passability
      : "Passable",
    restricted_vehicle_types: Array.isArray(constraints.restricted_vehicle_types)
      ? constraints.restricted_vehicle_types
      : [],
  };
}

function buildRouteCriteriaHash({
  camp_id,
  start_latitude,
  start_longitude,
  route_type,
  routing_preference,
  flood_zones,
  blocked_roads,
  vehicle_type,
  road_constraints,
}) {
  return JSON.stringify({
    camp_id: String(camp_id),
    start_latitude: normalizeCoordinate(start_latitude),
    start_longitude: normalizeCoordinate(start_longitude),
    route_type,
    routing_preference,
    vehicle_type,
    flood_zones: normalizeCriteriaList(flood_zones),
    blocked_roads: normalizeCriteriaList(blocked_roads),
    road_constraints: normalizeRoadConstraints(road_constraints),
  });
}

function mapNeedReportsToHazards(reports = []) {
  const activeReports = reports.filter((report) =>
    ["Pending", "In Progress", "Responded"].includes(report.status),
  );

  return {
    floodZones: activeReports
      .filter((report) => report.need_type === "Flood Level")
      .map((report) => ({
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
        radius_km: ["Emergency", "Critical"].includes(report.severity) ? 3 : 2,
      }))
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)),
    blockedRoads: activeReports
      .filter((report) => report.need_type === "Road Blockage")
      .map((report) => ({
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
        radius_km: ["Emergency", "Critical"].includes(report.severity) ? 1.2 : 0.8,
      }))
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)),
  };
}

function hasRoadBlockageEvidence(blockedRoads = [], liveRoadConditions = {}) {
  return (
    (Array.isArray(blockedRoads) && blockedRoads.length > 0) ||
    Number(liveRoadConditions?.count || 0) > 0
  );
}

function campRoadAccessStatusForRoute(route, roadBlockageEvidence) {
  if (route?.route_status === "Blocked") return "Blocked";
  const profile = route?.emergency_safety_profile || {};
  if (
    Number(profile.blocked_road_exposure_points || 0) > 0 ||
    Number(route?.safety_score || 0) < 50 ||
    roadBlockageEvidence
  ) {
    return "Limited";
  }
  return null;
}

function isSriLankaCoordinate(latitude, longitude) {
  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Number(latitude) >= 5.5 &&
    Number(latitude) <= 10.1 &&
    Number(longitude) >= 79.0 &&
    Number(longitude) <= 82.2
  );
}

function decodePolyline(encoded) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = null;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

function routeGeometryKey(coordinates = []) {
  return coordinates
    .filter((_, index) => index % Math.max(1, Math.floor(coordinates.length / 20)) === 0)
    .map(([latitude, longitude]) => `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`)
    .join("|");
}

function applyOperationalConstraints(result, options = {}) {
  const vehicleType = options.vehicleType || "truck";
  const constraints = normalizeRoadConstraints(options.roadConstraints);
  const warnings = [...(result.warnings || [])];
  let safetyScore = Number(result.safety_score || 0);
  let timeMinutes = Number(result.estimated_time_minutes || 0);
  let routeStatus = result.route_status || "Active";

  if (constraints.traffic_level === "Moderate") {
    timeMinutes = Math.round(timeMinutes * 1.25);
    safetyScore -= 5;
    warnings.push("Moderate traffic considered in travel time and safety score");
  } else if (constraints.traffic_level === "Heavy") {
    timeMinutes = Math.round(timeMinutes * 1.6);
    safetyScore -= 15;
    warnings.push("Heavy traffic considered in travel time and safety score");
  }

  if (constraints.bridge_condition === "Weak") {
    safetyScore -= ["truck", "ambulance"].includes(vehicleType) ? 25 : 10;
    warnings.push("Weak bridge condition considered for selected vehicle type");
  } else if (constraints.bridge_condition === "Closed") {
    safetyScore = 0;
    routeStatus = "Blocked";
    warnings.push("Bridge condition is closed for this route");
  }

  if (constraints.vehicle_passability === "Limited") {
    safetyScore -= ["truck", "ambulance"].includes(vehicleType) ? 15 : 5;
    timeMinutes = Math.round(timeMinutes * 1.15);
    warnings.push(`Route has limited passability for ${vehicleType}`);
  } else if (constraints.vehicle_passability === "Not Passable") {
    safetyScore = 0;
    routeStatus = "Blocked";
    warnings.push(`Route is not passable for ${vehicleType}`);
  }

  if (constraints.restricted_vehicle_types.includes(vehicleType)) {
    safetyScore = 0;
    routeStatus = "Blocked";
    warnings.push(`${vehicleType} is restricted on this route`);
  }

  safetyScore = Math.max(0, Math.min(100, Math.round(safetyScore)));
  if (routeStatus !== "Blocked") {
    routeStatus = safetyScore < 50 ? "Alternative" : "Active";
  }

  const hours = Math.floor(timeMinutes / 60);
  const minutes = timeMinutes % 60;

  return {
    ...result,
    safety_score: safetyScore,
    estimated_time_minutes: timeMinutes,
    estimated_time: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    route_status: routeStatus,
    vehicle_type: vehicleType,
    road_constraints: constraints,
    emergency_safety_profile: {
      ...(result.emergency_safety_profile || {}),
      model: result.emergency_safety_profile?.model || "Emergency risk-aware safest route",
      priority: "safety_over_distance",
      reasons: [
        ...(result.emergency_safety_profile?.reasons || []),
        "Operational constraints applied: traffic, bridge condition, vehicle passability, and vehicle restrictions",
      ],
    },
    warnings,
  };
}

async function getRoadNetworkRoute(start, end, routeType, options = {}) {
  const profile = "driving";
  const url = new URL(
    `https://router.project-osrm.org/route/v1/${profile}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}`,
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("alternatives", "true");
  url.searchParams.set("steps", "true");
  url.searchParams.set("continue_straight", "false");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json();
    if (!response.ok || payload.code !== "Ok" || !payload.routes?.length) {
      throw new Error(payload.message || "Road-network route unavailable");
    }

    const candidates = payload.routes.map((route, index) => {
      const coordinates = route.geometry?.type === "LineString"
        ? route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude])
        : decodePolyline(route.geometry);
      const assessed = RoutePlanningEngine.assessRoadNetworkRoute(coordinates, {
        routeType,
        floodZones: options.floodZones || [],
        blockedRoads: options.blockedRoads || [],
      });

      return applyOperationalConstraints({
        index,
        route,
        coordinates,
        geometry_key: routeGeometryKey(coordinates),
        ...assessed,
        distance: Math.round((route.distance / 1000) * 100) / 100,
        estimated_time_minutes: Math.max(1, Math.round(route.duration / 60)),
        osrm_distance_km: Math.round((route.distance / 1000) * 100) / 100,
        osrm_time_minutes: Math.max(1, Math.round(route.duration / 60)),
      }, {
        vehicleType: options.vehicleType,
        roadConstraints: options.roadConstraints,
      });
    });
    const uniqueCandidates = [];
    const seenGeometry = new Set();
    for (const candidate of candidates) {
      if (seenGeometry.has(candidate.geometry_key)) continue;
      seenGeometry.add(candidate.geometry_key);
      uniqueCandidates.push(candidate);
    }

    const bySafest = [...uniqueCandidates].sort((a, b) => {
      if (b.safety_score !== a.safety_score) return b.safety_score - a.safety_score;
      return a.osrm_distance_km - b.osrm_distance_km;
    });
    const selected = bySafest[0];

    const coordinates = selected.coordinates;
    const selectedRoute = selected.route;
    const alternativeCount = uniqueCandidates.length;

    return {
      route_coordinates: coordinates,
      waypoints: coordinates.slice(1, -1).map((coord, index) => ({
        latitude: coord[0],
        longitude: coord[1],
        description: `Road waypoint ${index + 1}`,
      })),
      distance: selected.osrm_distance_km,
      estimated_time: selected.estimated_time,
      estimated_time_minutes: selected.estimated_time_minutes,
      mobility_plan: selected.mobility_plan,
      safety_score: selected.safety_score,
      route_status: selected.route_status,
      route_type: "Safest",
      route_algorithm: "OSRM",
      warnings: [
        ...selected.warnings,
        "Road-network route generated from OpenStreetMap/OSRM data",
        `${alternativeCount} road-network candidate route(s) evaluated`,
        "Operational constraints applied: traffic, bridge condition, vehicle passability, and vehicle restrictions",
        "Selected route has the best emergency safety score among available road-network candidates",
      ],
      route_source: "road_network",
      accuracy_level: "High",
      accuracy_notes:
        "Road-network route generated from OpenStreetMap/OSRM and adjusted using field-provided traffic, bridge, vehicle passability, flood, and vehicle constraints.",
      vehicle_type: options.vehicleType || "truck",
      road_constraints: normalizeRoadConstraints(options.roadConstraints),
    };
  } finally {
    clearTimeout(timeout);
  }
}

router.post(
  "/generate",
  authenticate,
  authorize("admin", "disaster_officer", "rescue_team"),
  async (req, res) => {
    try {
      const {
        camp_id,
        start_latitude,
        start_longitude,
        route_type = "Safest",
        routing_preference = "road_network",
        flood_zones = [],
        blocked_roads = [],
        vehicle_type = "truck",
        road_constraints = {},
        replace_existing = false,
      } = req.body;

      const camp = await Camp.findById(camp_id);
      if (!camp) return res.status(404).json({ error: "Camp not found" });
      if (route_type !== "Safest") {
        return res.status(400).json({
          error: "Emergency safest routing is the only supported route type",
        });
      }
      if (!["road_network", "grid_fallback"].includes(routing_preference)) {
        return res.status(400).json({
          error: "routing_preference must be road_network or grid_fallback",
        });
      }
      if (!Number.isFinite(Number(start_latitude)) || !Number.isFinite(Number(start_longitude))) {
        return res.status(400).json({ error: "Start latitude and longitude are required" });
      }
      if (!isSriLankaCoordinate(start_latitude, start_longitude)) {
        return res.status(400).json({ error: "Start point must be within Sri Lanka" });
      }
      if (!isSriLankaCoordinate(camp.latitude, camp.longitude)) {
        return res.status(400).json({ error: "Camp coordinates must be within Sri Lanka" });
      }

      const start = {
        latitude: Number(start_latitude),
        longitude: Number(start_longitude),
      };
      const end = { latitude: camp.latitude, longitude: camp.longitude };
      const liveRoadConditions = await fetchRdaRoadConditions(start, end);
      const allBlockedRoads = [
        ...blocked_roads,
        ...(liveRoadConditions.blocked_roads || []),
      ];
      const routeCriteriaHash = buildRouteCriteriaHash({
        camp_id,
        start_latitude,
        start_longitude,
        route_type: "Safest",
        routing_preference,
        flood_zones,
        blocked_roads: allBlockedRoads,
        vehicle_type,
        road_constraints,
      });

      const existingRoute = await Route.findOne({
        camp_id,
        route_criteria_hash: routeCriteriaHash,
      });

      if (existingRoute && replace_existing) {
        await Route.deleteMany({ camp_id });
      }

      if (existingRoute && !replace_existing) {
        let realtime_update = null;
        const roadAccessStatus = campRoadAccessStatusForRoute(
          existingRoute,
          hasRoadBlockageEvidence(blocked_roads, liveRoadConditions),
        );
        if (roadAccessStatus) {
          await Camp.findByIdAndUpdate(camp_id, {
            road_access_status: roadAccessStatus,
            last_updated: new Date(),
          });
          realtime_update = await tryRecalculateCampPriority(camp_id, "route_rechecked");
        }
        return res.json({
          status: "success",
          already_exists: true,
          message: "Route already exists for the same camp and criteria",
          data: existingRoute,
          live_road_conditions: liveRoadConditions,
          realtime_update,
        });
      }

      let result;
      if (routing_preference === "grid_fallback") {
        result = applyOperationalConstraints(RoutePlanningEngine.generateRoute(start, end, {
          floodZones: flood_zones,
          blockedRoads: allBlockedRoads,
          routeType: "Safest",
        }), {
          vehicleType: vehicle_type,
          roadConstraints: road_constraints,
        });
        result.warnings = [
          ...(result.warnings || []),
          "Backup route requested by user. This is an estimated grid route, not a verified road path.",
        ];
      } else {
        try {
          result = await getRoadNetworkRoute(start, end, "Safest", {
            floodZones: flood_zones,
            blockedRoads: allBlockedRoads,
            vehicleType: vehicle_type,
            roadConstraints: road_constraints,
          });
        } catch (error) {
          return res.status(502).json({
            error: "Road-network route unavailable",
            details:
              `${error.message}. Emergency safest routing needs a verified road-network path before dispatch.`,
            live_road_conditions: liveRoadConditions,
          });
        }
      }

      result.warnings = [
        ...(result.warnings || []),
        liveRoadConditions.warning ||
          `${liveRoadConditions.count} live RDA road incident(s) considered`,
      ];

      const route = await Route.create({
        camp_id,
        route_name: `Route to ${camp.camp_name}`,
        start_latitude,
        start_longitude,
        end_latitude: camp.latitude,
        end_longitude: camp.longitude,
        created_by: req.user?._id || null,
        route_criteria_hash: routeCriteriaHash,
        live_road_condition_summary: {
          source: liveRoadConditions.source,
          count: liveRoadConditions.count,
          last_updated: liveRoadConditions.last_updated,
          warning: liveRoadConditions.warning || "",
        },
        ...result,
      });

      if (route.safety_score < 50) {
        await NotificationEngine.alertUnsafeRoute(route, camp, req.user.id);
      }
      let realtime_update = null;
      const roadAccessStatus = campRoadAccessStatusForRoute(
        route,
        hasRoadBlockageEvidence(blocked_roads, liveRoadConditions),
      );
      if (roadAccessStatus) {
        await Camp.findByIdAndUpdate(camp_id, {
          road_access_status: roadAccessStatus,
          last_updated: new Date(),
        });
        realtime_update = await tryRecalculateCampPriority(camp_id, "route_condition_update");
      }

      res.status(201).json({
        status: "success",
        data: route,
        live_road_conditions: liveRoadConditions,
        realtime_update,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to generate route", details: error.message });
    }
  },
);

router.get(
  "/live-road-conditions/check",
  authenticate,
  authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"),
  async (req, res) => {
    try {
      const { camp_id, start_latitude, start_longitude } = req.query;
      const camp = await Camp.findById(camp_id);
      if (!camp) return res.status(404).json({ error: "Camp not found" });
      if (!Number.isFinite(Number(start_latitude)) || !Number.isFinite(Number(start_longitude))) {
        return res.status(400).json({ error: "Start latitude and longitude are required" });
      }

      const liveRoadConditions = await fetchRdaRoadConditions(
        {
          latitude: Number(start_latitude),
          longitude: Number(start_longitude),
        },
        {
          latitude: camp.latitude,
          longitude: camp.longitude,
        },
      );

      res.json({ status: "success", data: liveRoadConditions });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch live road conditions",
        details: error.message,
      });
    }
  },
);

router.get(
  "/live-road-conditions",
  authenticate,
  authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"),
  async (req, res) => {
    try {
      const { minLat, maxLat, minLng, maxLng } = req.query;
      const hasBounds = [minLat, maxLat, minLng, maxLng].every((value) =>
        Number.isFinite(Number(value)),
      );
      const liveRoadConditions = await fetchRdaRoadConditionsForBounds(
        hasBounds
          ? {
              minLat: Number(minLat),
              maxLat: Number(maxLat),
              minLng: Number(minLng),
              maxLng: Number(maxLng),
            }
          : undefined,
      );

      res.json({ status: "success", data: liveRoadConditions });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch live road conditions",
        details: error.message,
      });
    }
  },
);

router.post(
  "/:id/refresh",
  authenticate,
  authorize("admin", "disaster_officer", "rescue_team"),
  async (req, res) => {
    try {
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: "Invalid route ID format" });
      }

      const route = await Route.findById(req.params.id);
      if (!route) return res.status(404).json({ error: "Route not found" });

      const camp = await Camp.findById(route.camp_id);
      if (!camp) return res.status(404).json({ error: "Camp not found" });

      const start = {
        latitude: Number(route.start_latitude),
        longitude: Number(route.start_longitude),
      };
      const end = {
        latitude: Number(route.end_latitude || camp.latitude),
        longitude: Number(route.end_longitude || camp.longitude),
      };

      const activeReports = await NeedReport.find({
        status: { $in: ["Pending", "In Progress", "Responded"] },
        is_demo: { $ne: true },
      }).lean();
      const citizenHazards = mapNeedReportsToHazards(activeReports);
      const liveRoadConditions = await fetchRdaRoadConditions(start, end);
      const allBlockedRoads = [
        ...citizenHazards.blockedRoads,
        ...(liveRoadConditions.blocked_roads || []),
      ];
      const routingPreference = route.route_source === "grid_fallback" ? "grid_fallback" : "road_network";
      const routeType = "Safest";

      let result;
      if (routingPreference === "grid_fallback") {
        result = applyOperationalConstraints(RoutePlanningEngine.generateRoute(start, end, {
          floodZones: citizenHazards.floodZones,
          blockedRoads: allBlockedRoads,
          routeType,
        }), {
          vehicleType: route.vehicle_type,
          roadConstraints: route.road_constraints,
        });
        result.warnings = [
          ...(result.warnings || []),
          "Refreshed as an estimated backup route using latest citizen and RDA road conditions.",
        ];
      } else {
        try {
          result = await getRoadNetworkRoute(start, end, routeType, {
            floodZones: citizenHazards.floodZones,
            blockedRoads: allBlockedRoads,
            vehicleType: route.vehicle_type,
            roadConstraints: route.road_constraints,
          });
        } catch (error) {
          return res.status(502).json({
            error: "Road-network route refresh unavailable",
            details:
              `${error.message}. Existing emergency safest route was not changed until a verified road-network refresh is available.`,
            live_road_conditions: liveRoadConditions,
          });
        }
      }

      result.warnings = [
        ...(result.warnings || []),
        `${citizenHazards.floodZones.length} active citizen flood report(s) considered`,
        `${citizenHazards.blockedRoads.length} active citizen road blockage report(s) considered`,
        liveRoadConditions.warning ||
          `${liveRoadConditions.count} live RDA road incident(s) considered`,
      ];

      const routeCriteriaHash = buildRouteCriteriaHash({
        camp_id: route.camp_id,
        start_latitude: start.latitude,
        start_longitude: start.longitude,
        route_type: routeType,
        routing_preference: routingPreference,
        flood_zones: citizenHazards.floodZones,
        blocked_roads: allBlockedRoads,
        vehicle_type: route.vehicle_type,
        road_constraints: route.road_constraints,
      });

      const refreshedRoute = await Route.findByIdAndUpdate(
        route._id,
        {
          route_criteria_hash: routeCriteriaHash,
          live_road_condition_summary: {
            source: liveRoadConditions.source,
            count: liveRoadConditions.count,
            last_updated: liveRoadConditions.last_updated,
            warning: liveRoadConditions.warning || "",
          },
          ...result,
        },
        { returnDocument: "after" },
      ).populate("camp_id", "camp_name");

      let realtime_update = null;
      const roadAccessStatus = campRoadAccessStatusForRoute(
        refreshedRoute,
        hasRoadBlockageEvidence(citizenHazards.blockedRoads, liveRoadConditions),
      );
      if (roadAccessStatus) {
        await Camp.findByIdAndUpdate(route.camp_id, {
          road_access_status: roadAccessStatus,
          last_updated: new Date(),
        });
        realtime_update = await tryRecalculateCampPriority(route.camp_id, "route_live_refresh");
      }

      res.json({
        status: "success",
        data: refreshedRoute,
        live_road_conditions: liveRoadConditions,
        realtime_update,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to refresh route",
        details: error.message,
      });
    }
  },
);

router.get("/camp/:campId", authenticate, authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"), async (req, res) => {
  try {
    const { mine } = req.query;
    const camp = await Camp.findById(req.params.campId);
    if (!camp) return res.status(404).json({ error: "Camp not found" });

    const routeFilter = { camp_id: req.params.campId };
    if (mine === "true" && req.user) routeFilter.created_by = req.user._id;

    const routes = await Route.find(routeFilter).sort({
      safety_score: -1,
    });
    res.json({ status: "success", data: routes });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch routes", details: error.message });
  }
});

// Get all routes with camp details
router.get("/", authenticate, authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"), async (req, res) => {
  try {
    const { mine } = req.query;
    const routeFilter = {};
    if (mine === "true" && req.user) routeFilter.created_by = req.user._id;

    const routes = await Route.find(routeFilter)
      .populate("camp_id", "camp_name")
      .sort({ createdAt: -1 });
    res.json({ status: "success", data: routes });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch", details: error.message });
  }
});

router.get("/:id", authenticate, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid route ID format" });
    }
    const route = await Route.findById(req.params.id).populate(
      "camp_id",
      "camp_name",
    );
    if (!route) return res.status(404).json({ error: "Route not found" });
    res.json({ status: "success", data: route });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch route", details: error.message });
  }
});

router.post(
  "/assign",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const { route_id, team_id } = req.body;
      const route = await Route.findByIdAndUpdate(
        route_id,
        { assigned_team_id: team_id },
        { returnDocument: "after" },
      );
      if (!route) return res.status(404).json({ error: "Route not found" });
      res.json({ status: "success", data: route });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to assign", details: error.message });
    }
  },
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin", "disaster_officer", "rescue_team"),
  async (req, res) => {
    try {
      const route = await Route.findByIdAndDelete(req.params.id);
      if (!route) return res.status(404).json({ error: "Route not found" });
      const realtime_update = await tryRecalculateCampPriority(route.camp_id, "route_removed");

      res.json({
        status: "success",
        message: "Route removed successfully",
        data: route,
        realtime_update,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to remove route", details: error.message });
    }
  },
);


export { router as routePlanningRouter };

