import express from "express";
import DistributionCenter from "../models/DistributionCenter.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

function distanceKm(aLat, aLng, bLat, bLng) {
  const radius = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function validateCenter(data) {
  if (!String(data.name || "").trim()) return "Center name is required";
  const phone = String(data.contact_phone || "").replace(/\s/g, "");
  if (phone && !/^(?:\+94|0)[0-9]{9}$/.test(phone)) {
    return "Contact phone must be a valid Sri Lankan number";
  }
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || latitude < 5 || latitude > 10) return "Latitude must be inside Sri Lanka";
  if (!Number.isFinite(longitude) || longitude < 79 || longitude > 82) return "Longitude must be inside Sri Lanka";
  if (data.operating_status && !["Open", "Limited", "Closed"].includes(data.operating_status)) {
    return "Invalid operating status";
  }
  return "";
}

router.get("/", authenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.operating_status = req.query.status;
    const centers = await DistributionCenter.find(filter).sort({ createdAt: -1 });
    res.json({ status: "success", data: centers });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch distribution centers", details: error.message });
  }
});

router.get("/nearest", authenticate, async (req, res) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }
    const centers = await DistributionCenter.find({ operating_status: { $ne: "Closed" } }).lean();
    const ranked = centers
      .map((center) => ({
        ...center,
        distance_km: Math.round(distanceKm(latitude, longitude, center.latitude, center.longitude) * 100) / 100,
      }))
      .sort((a, b) => a.distance_km - b.distance_km);
    res.json({ status: "success", data: ranked[0] || null, alternatives: ranked.slice(1, 5) });
  } catch (error) {
    res.status(500).json({ error: "Failed to find nearest center", details: error.message });
  }
});

router.post(
  "/",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const error = validateCenter(req.body);
      if (error) return res.status(400).json({ error });
      const center = await DistributionCenter.create({
        ...req.body,
        latitude: Number(req.body.latitude),
        longitude: Number(req.body.longitude),
        created_by: req.user.id || req.user._id,
      });
      res.status(201).json({ status: "success", data: center });
    } catch (error) {
      res.status(500).json({ error: "Failed to create distribution center", details: error.message });
    }
  },
);

router.put(
  "/:id",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const error = validateCenter({ ...req.body, name: req.body.name || "center" });
      if (error) return res.status(400).json({ error });
      const center = await DistributionCenter.findByIdAndUpdate(
        req.params.id,
        req.body,
        { returnDocument: "after" },
      );
      if (!center) return res.status(404).json({ error: "Distribution center not found" });
      res.json({ status: "success", data: center });
    } catch (error) {
      res.status(500).json({ error: "Failed to update distribution center", details: error.message });
    }
  },
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const center = await DistributionCenter.findByIdAndDelete(req.params.id);
      if (!center) return res.status(404).json({ error: "Distribution center not found" });
      res.json({ status: "success", message: "Distribution center deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete distribution center", details: error.message });
    }
  },
);

export { router as distributionCenterRouter };
