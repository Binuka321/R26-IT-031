import express from "express";
import Route from "../models/Route.js";
import Camp from "../models/Camp.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { RoutePlanningEngine } from "../utils/routePlanningEngine.js";
import { NotificationEngine } from "../utils/notificationEngine.js";

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
    minimum_road_width_m: Number(constraints.minimum_road_width_m || 0),
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
    vehicle_type,
    flood_zones: normalizeCriteriaList(flood_zones),
    blocked_roads: normalizeCriteriaList(blocked_roads),
    road_constraints: normalizeRoadConstraints(road_constraints),
  });
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

  if (constraints.minimum_road_width_m > 0) {
    const minimumRequiredWidth = {
      truck: 3.5,
      ambulance: 3,
      boat: 0,
      helicopter: 0,
      "hand-delivery": 0,
    }[vehicleType] ?? 3;

    if (constraints.minimum_road_width_m < minimumRequiredWidth) {
      safetyScore -= 30;
      warnings.push(
        `Road width ${constraints.minimum_road_width_m}m is below ${minimumRequiredWidth}m required for ${vehicleType}`,
      );
    } else {
      warnings.push(`Road width checked for ${vehicleType}`);
    }
  }

  if (constraints.restricted_vehicle_types.includes(vehicleType)) {
    safetyScore = 0;
    routeStatus = "Blocked";
    warnings.push(`${vehicleType} is restricted on this route`);
  }

  safetyScore = Math.max(0, Math.min(100, Math.round(safetyScore)));
  if (routeStatus !== "Blocked") {
    routeStatus = safetyScore < 25 ? "Blocked" : safetyScore < 50 ? "Alternative" : "Active";
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
    warnings,
  };
}

async function getRoadNetworkRoute(start, end, routeType, options = {}) {
  const profile = routeType === "Shortest" ? "driving" : "driving";
  const url = new URL(
    `https://router.project-osrm.org/route/v1/${profile}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}`,
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("alternatives", routeType === "Shortest" ? "false" : "true");
  url.searchParams.set("steps", "false");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json();
    if (!response.ok || payload.code !== "Ok" || !payload.routes?.length) {
      throw new Error(payload.message || "Road-network route unavailable");
    }

    const candidates = payload.routes.map((route, index) => {
      const coordinates = decodePolyline(route.geometry);
      const assessed = RoutePlanningEngine.assessRoadNetworkRoute(coordinates, {
        routeType,
        floodZones: options.floodZones || [],
        blockedRoads: options.blockedRoads || [],
      });

      return applyOperationalConstraints({
        index,
        route,
        coordinates,
        ...assessed,
        osrm_distance_km: Math.round((route.distance / 1000) * 100) / 100,
        osrm_time_minutes: Math.max(1, Math.round(route.duration / 60)),
      }, {
        vehicleType: options.vehicleType,
        roadConstraints: options.roadConstraints,
      });
    });

    const bySafest = [...candidates].sort((a, b) => {
      if (b.safety_score !== a.safety_score) return b.safety_score - a.safety_score;
      return a.osrm_distance_km - b.osrm_distance_km;
    });
    const byShortest = [...candidates].sort((a, b) => a.osrm_distance_km - b.osrm_distance_km);

    const selected =
      routeType === "Shortest"
        ? byShortest[0]
        : routeType === "Alternative"
          ? bySafest[1] || bySafest[0]
          : bySafest[0];

    const coordinates = selected.coordinates;
    const selectedRoute = selected.route;
    const alternativeCount = payload.routes.length;

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
      safety_score: selected.safety_score,
      route_status: selected.route_status,
      route_type: routeType,
      route_algorithm: "OSRM",
      warnings: [
        ...selected.warnings,
        "Road-network route generated from OpenStreetMap/OSRM data",
        `${alternativeCount} road-network candidate route(s) evaluated`,
        "Operational constraints applied: traffic, bridge condition, road width, and vehicle restrictions",
        routeType === "Safest"
          ? "Selected route has the best safety score among available road-network candidates"
          : routeType === "Alternative"
            ? "Selected route is an alternate candidate for comparison"
            : "Selected route has the shortest road-network distance",
      ],
      route_source: "road_network",
      accuracy_level: "High",
      accuracy_notes:
        "Road-network route generated from OpenStreetMap/OSRM and adjusted using field-provided traffic, bridge, road-width, flood, and vehicle constraints.",
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
        flood_zones = [],
        blocked_roads = [],
        vehicle_type = "truck",
        road_constraints = {},
      } = req.body;

      const camp = await Camp.findById(camp_id);
      if (!camp) return res.status(404).json({ error: "Camp not found" });
      if (!["Safest", "Shortest", "Alternative"].includes(route_type)) {
        return res.status(400).json({
          error: "route_type must be Safest, Shortest, or Alternative",
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
      const routeCriteriaHash = buildRouteCriteriaHash({
        camp_id,
        start_latitude,
        start_longitude,
        route_type,
        flood_zones,
        blocked_roads,
        vehicle_type,
        road_constraints,
      });

      const existingRoute = await Route.findOne({
        camp_id,
        $or: [
          { route_criteria_hash: routeCriteriaHash },
          {
            start_latitude: Number(start_latitude),
            start_longitude: Number(start_longitude),
            end_latitude: Number(camp.latitude),
            end_longitude: Number(camp.longitude),
            route_type,
            vehicle_type,
          },
        ],
      });

      if (existingRoute) {
        return res.json({
          status: "success",
          already_exists: true,
          message: "Route already exists for the same camp and criteria",
          data: existingRoute,
        });
      }

      let result;
      try {
        result = await getRoadNetworkRoute(start, end, route_type, {
          floodZones: flood_zones,
          blockedRoads: blocked_roads,
          vehicleType: vehicle_type,
          roadConstraints: road_constraints,
        });
      } catch (error) {
        result = applyOperationalConstraints(RoutePlanningEngine.generateRoute(start, end, {
          floodZones: flood_zones,
          blockedRoads: blocked_roads,
          routeType: route_type,
        }), {
          vehicleType: vehicle_type,
          roadConstraints: road_constraints,
        });
        result.warnings = [
          ...(result.warnings || []),
          `Road-network routing unavailable: ${error.message}`,
        ];
      }

      const route = await Route.create({
        camp_id,
        route_name: `Route to ${camp.camp_name}`,
        start_latitude,
        start_longitude,
        end_latitude: camp.latitude,
        end_longitude: camp.longitude,
        created_by: req.user?._id || null,
        route_criteria_hash: routeCriteriaHash,
        ...result,
      });

      if (route.safety_score < 50) {
        await NotificationEngine.alertUnsafeRoute(route, camp);
      }

      res.status(201).json({ status: "success", data: route });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to generate route", details: error.message });
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
        { new: true },
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

      res.json({
        status: "success",
        message: "Route removed successfully",
        data: route,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to remove route", details: error.message });
    }
  },
);


export { router as routePlanningRouter };
