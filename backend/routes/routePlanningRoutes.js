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

function buildRouteCriteriaHash({
  camp_id,
  start_latitude,
  start_longitude,
  route_type,
  flood_zones,
  blocked_roads,
}) {
  return JSON.stringify({
    camp_id: String(camp_id),
    start_latitude: normalizeCoordinate(start_latitude),
    start_longitude: normalizeCoordinate(start_longitude),
    route_type,
    flood_zones: normalizeCriteriaList(flood_zones),
    blocked_roads: normalizeCriteriaList(blocked_roads),
  });
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

      const start = { latitude: start_latitude, longitude: start_longitude };
      const end = { latitude: camp.latitude, longitude: camp.longitude };
      const routeCriteriaHash = buildRouteCriteriaHash({
        camp_id,
        start_latitude,
        start_longitude,
        route_type,
        flood_zones,
        blocked_roads,
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

      const result = RoutePlanningEngine.generateRoute(start, end, {
        floodZones: flood_zones,
        blockedRoads: blocked_roads,
        routeType: route_type,
      });

      const route = await Route.create({
        camp_id,
        route_name: `Route to ${camp.camp_name}`,
        start_latitude,
        start_longitude,
        end_latitude: camp.latitude,
        end_longitude: camp.longitude,
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
    const { include_seed, mine } = req.query;
    const camp = await Camp.findById(req.params.campId);
    if (!camp) return res.status(404).json({ error: "Camp not found" });

    if (mine === "true" && req.user) {
      if (
        !camp.created_by ||
        String(camp.created_by) !== String(req.user._id)
      ) {
        return res.json({ status: "success", data: [] });
      }
    } else if (include_seed !== "true") {
      if (!camp.created_by) return res.json({ status: "success", data: [] });
    }

    const routes = await Route.find({ camp_id: req.params.campId }).sort({
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
    const { include_seed, mine } = req.query;
    const campFilter = {};
    if (mine === "true" && req.user) campFilter.created_by = req.user._id;
    else if (include_seed !== "true") campFilter.created_by = { $ne: null };

    const camps = await Camp.find(campFilter).select("_id");
    const campIds = camps.map((c) => c._id);

    let routes = [];
    if (campIds.length > 0) {
      routes = await Route.find({ camp_id: { $in: campIds } })
        .populate("camp_id", "camp_name")
        .sort({ createdAt: -1 });
    }
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
