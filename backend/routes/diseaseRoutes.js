import express from "express";
import DiseaseResult from "../models/DiseaseResult.js";
import Camp from "../models/Camp.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { NotificationEngine } from "../utils/notificationEngine.js";

const router = express.Router();

router.post("/", authenticate, async (req, res) => {
  try {
    const payload = { ...req.body, created_by: req.user?.id || null };
    const result = await DiseaseResult.create(payload);
    if (result.camp_id) {
      const camp = await Camp.findByIdAndUpdate(
        result.camp_id,
        { disease_risk_level: result.risk_level },
        { new: true },
      );
      if (camp && result.risk_level === "High") {
        await NotificationEngine.alertDiseaseRisk(camp, result);
      }
    }
    res.status(201).json({ status: "success", data: result });
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Failed to create disease result",
        details: error.message,
      });
  }
});

router.get("/", authenticate, async (req, res) => {
  try {
    const { mine, include_seed } = req.query;
    const filter = {};
    if (mine === "true") {
      filter.created_by = req.user?.id;
    } else if (include_seed !== "true") {
      filter.created_by = { $ne: null };
    }
    const results = await DiseaseResult.find(filter)
      .populate("camp_id", "camp_name")
      .sort({ detected_date: -1 });
    res.json({ status: "success", data: results });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch", details: error.message });
  }
});

router.get("/camp/:campId", authenticate, async (req, res) => {
  try {
    const results = await DiseaseResult.find({
      camp_id: req.params.campId,
    }).sort({ detected_date: -1 });
    res.json({ status: "success", data: results });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch", details: error.message });
  }
});

router.get("/alerts", authenticate, async (req, res) => {
  try {
    const alerts = await DiseaseResult.find({
      risk_level: "High",
      status: "Active",
    }).populate("camp_id", "camp_name population");
    res.json({ status: "success", data: alerts, count: alerts.length });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch alerts", details: error.message });
  }
});

router.put(
  "/:id",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const result = await DiseaseResult.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!result) return res.status(404).json({ error: "Not found" });
      res.json({ status: "success", data: result });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to update", details: error.message });
    }
  },
);

export { router as diseaseRouter };
