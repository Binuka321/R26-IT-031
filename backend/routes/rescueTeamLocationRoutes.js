import express from "express";
import RescueTeamLocation from "../models/RescueTeamLocation.js";
import User from "../models/User.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

function validateLocationPayload(data) {
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || latitude < 5 || latitude > 10) {
    return "Latitude must be inside Sri Lanka";
  }
  if (!Number.isFinite(longitude) || longitude < 79 || longitude > 82) {
    return "Longitude must be inside Sri Lanka";
  }
  return "";
}

router.post(
  "/me",
  authenticate,
  authorize("rescue_team", "admin", "disaster_officer"),
  async (req, res) => {
    try {
      const error = validateLocationPayload(req.body);
      if (error) return res.status(400).json({ error });

      const teamId = req.body.team_id || req.user.id || req.user._id;
      if (req.user.role === "rescue_team" && String(teamId) !== String(req.user.id || req.user._id)) {
        return res.status(403).json({ error: "Rescue teams can only update their own location" });
      }

      const team = await User.findById(teamId);
      if (!team || team.role !== "rescue_team") {
        return res.status(400).json({ error: "A valid rescue team is required" });
      }

      const location = await RescueTeamLocation.create({
        team_id: teamId,
        latitude: Number(req.body.latitude),
        longitude: Number(req.body.longitude),
        accuracy_meters: req.body.accuracy_meters ?? null,
        battery_level: req.body.battery_level ?? null,
        status: req.body.status || "available",
        source: req.body.source || "browser_gps",
        recorded_at: new Date(),
      });

      res.status(201).json({ status: "success", data: location });
    } catch (error) {
      res.status(500).json({ error: "Failed to record rescue team location", details: error.message });
    }
  },
);

router.get(
  "/latest",
  authenticate,
  authorize("admin", "disaster_officer", "rescue_team"),
  async (req, res) => {
    try {
      const teamFilter = req.user.role === "rescue_team"
        ? { _id: req.user.id || req.user._id, role: "rescue_team" }
        : { role: "rescue_team" };
      const teams = await User.find(teamFilter).select("name username role").lean();
      const latest = [];

      for (const team of teams) {
        const location = await RescueTeamLocation.findOne({ team_id: team._id })
          .sort({ recorded_at: -1 })
          .lean();
        latest.push({
          team,
          location,
          is_online: location
            ? Date.now() - new Date(location.recorded_at).getTime() <= 15 * 60 * 1000
            : false,
        });
      }

      res.json({ status: "success", data: latest });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rescue team locations", details: error.message });
    }
  },
);

router.get(
  "/:teamId/history",
  authenticate,
  authorize("admin", "disaster_officer", "rescue_team"),
  async (req, res) => {
    try {
      if (req.user.role === "rescue_team" && String(req.params.teamId) !== String(req.user.id || req.user._id)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const history = await RescueTeamLocation.find({ team_id: req.params.teamId })
        .sort({ recorded_at: -1 })
        .limit(limit)
        .lean();
      res.json({ status: "success", data: history });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch location history", details: error.message });
    }
  },
);

export { router as rescueTeamLocationRouter };
