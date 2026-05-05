import express from "express";
import SafeZone from "../models/SafeZone.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST create safe zone
router.post(
  "/",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const payload = { ...req.body, created_by: req.user?.id || null };
      const safeZone = await SafeZone.create(payload);
      res.status(201).json({ status: "success", data: safeZone });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to create safe zone", details: error.message });
    }
  },
);

// GET all safe zones
router.get("/", authenticate, async (req, res) => {
  try {
    const { mine, include_seed } = req.query;
    const filter = {};
    if (mine === "true") {
      filter.created_by = req.user?.id;
    } else if (include_seed !== "true") {
      // by default, exclude seed/system records (created_by == null)
      filter.created_by = { $ne: null };
    }

    const safeZones = await SafeZone.find(filter).sort({ createdAt: -1 });
    res.json({ status: "success", data: safeZones });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch safe zones", details: error.message });
  }
});

// GET safe zone by ID
router.get("/:id", authenticate, async (req, res) => {
  try {
    const safeZone = await SafeZone.findById(req.params.id);
    if (!safeZone)
      return res.status(404).json({ error: "Safe zone not found" });
    res.json({ status: "success", data: safeZone });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch safe zone", details: error.message });
  }
});

// PUT update safe zone
router.put(
  "/:id",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const safeZone = await SafeZone.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!safeZone)
        return res.status(404).json({ error: "Safe zone not found" });
      res.json({ status: "success", data: safeZone });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to update safe zone", details: error.message });
    }
  },
);

// DELETE safe zone (admin only)
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const safeZone = await SafeZone.findByIdAndDelete(req.params.id);
    if (!safeZone)
      return res.status(404).json({ error: "Safe zone not found" });
    res.json({ status: "success", message: "Safe zone deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete safe zone", details: error.message });
  }
});

// POST check if coordinates are inside a safe zone
router.post("/check-location", authenticate, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: "latitude and longitude required" });
    }

    const safeZones = await SafeZone.find({ safety_status: "Safe" });

    // Check if point is within radius of any safe zone
    const insideZones = safeZones.filter((zone) => {
      const dist = haversineDistance(
        latitude,
        longitude,
        zone.latitude,
        zone.longitude,
      );
      return dist <= (zone.radius_km || 2);
    });

    res.json({
      status: "success",
      is_safe: insideZones.length > 0,
      safe_zones: insideZones,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Location check failed", details: error.message });
  }
});

// Haversine helper
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { router as safeZoneRouter };
