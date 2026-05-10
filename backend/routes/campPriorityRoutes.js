import express from "express";
import Camp from "../models/Camp.js";
import ItemPriority from "../models/ItemPriority.js";
import PriorityPrediction from "../models/PriorityPrediction.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { NotificationEngine } from "../utils/notificationEngine.js";
import { buildMlItemPriorityData } from "../utils/mlItemPriorityData.js";
import { PostFloodMLService } from "../utils/postFloodMLService.js";

const router = express.Router();

const buildMlPredictionData = (camp, result) => ({
  camp_id: camp._id,
  priority_level: result.camp_priority,
  priority_score: result.priority_score,
  confidence_score: result.confidence_score,
  relief_priorities: {
    food_priority: result.food_priority,
    water_priority: result.water_priority,
    medicine_priority: result.medicine_priority,
    sanitary_priority: result.sanitary_priority,
  },
  predicted_at: new Date(),
  prediction_source: "ml_model",
  model_version: result.model_version || "post_flood_camp_relief_rf_v2_standards",
});

const buildResultRow = (camp, result) => ({
  camp_id: camp._id,
  camp_name: camp.camp_name,
  priority_level: result.camp_priority,
  priority_score: result.priority_score,
  confidence_score: result.confidence_score,
  relief_priorities: {
    food_priority: result.food_priority,
    water_priority: result.water_priority,
    medicine_priority: result.medicine_priority,
    sanitary_priority: result.sanitary_priority,
  },
  prediction_source: "ml_model",
});

// GET post-flood ML service status
router.get("/ml-status", authenticate, async (req, res) => {
  const status = await PostFloodMLService.getServiceStatus();
  res.status(status.available ? 200 : 503).json({
    status: status.available ? "success" : "error",
    data: status,
  });
});

// POST predict priority for a camp
router.post(
  "/camp-priority",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const { camp_id } = req.body;
      const camp = await Camp.findById(camp_id);
      if (!camp) return res.status(404).json({ error: "Camp not found" });

      const result = await PostFloodMLService.predictCampNeeds(camp);

      const prediction = await PriorityPrediction.findOneAndUpdate(
        { camp_id },
        buildMlPredictionData(camp, result),
        { upsert: true, new: true },
      );

      await Camp.findByIdAndUpdate(camp_id, {
        priority_level: result.camp_priority,
        priority_score: result.priority_score,
      });

      await ItemPriority.findOneAndUpdate(
        { camp_id: camp._id },
        buildMlItemPriorityData(camp, result),
        { upsert: true, new: true },
      );

      await NotificationEngine.alertHighPriorityCamp(camp, {
        priority_level: result.camp_priority,
        priority_score: result.priority_score,
      });

      res.json({ status: "success", data: prediction });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to predict priority", details: error.message });
    }
  },
);

// GET prediction for a camp
router.get("/camp/:campId", authenticate, async (req, res) => {
  try {
    const prediction = await PriorityPrediction.findOne({
      camp_id: req.params.campId,
    }).sort({ predicted_at: -1 });
    if (!prediction)
      return res.status(404).json({ error: "No prediction found" });
    res.json({ status: "success", data: prediction });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch prediction", details: error.message });
  }
});

// POST recalculate all camps
router.post(
  "/recalculate-all",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const camps = await Camp.find({ status: "Active" });
      const results = [];
      const failures = [];
      const batchResult = await PostFloodMLService.predictBatchCampNeeds(camps);
      const campMap = new Map(camps.map((camp) => [String(camp._id), camp]));

      for (const item of batchResult.predictions) {
        const camp = campMap.get(String(item.camp_id));
        if (!camp) continue;

        const result = item.prediction;
        const prediction = await PriorityPrediction.findOneAndUpdate(
          { camp_id: camp._id },
          buildMlPredictionData(camp, result),
          { upsert: true, new: true },
        );
        await Camp.findByIdAndUpdate(camp._id, {
          priority_level: result.camp_priority,
          priority_score: result.priority_score,
        });
        await ItemPriority.findOneAndUpdate(
          { camp_id: camp._id },
          buildMlItemPriorityData(camp, result),
          { upsert: true, new: true },
        );
        results.push(buildResultRow(camp, result));
      }

      failures.push(...(batchResult.errors || []));

      const ranked = [...results].sort((a, b) => b.priority_score - a.priority_score);
      res.json({
        status: failures.length ? "partial_success" : "success",
        data: ranked,
        total: ranked.length,
        failed: failures.length,
        failures,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to recalculate", details: error.message });
    }
  },
);

// GET all predictions
router.get("/", authenticate, async (req, res) => {
  try {
    const { include_seed, mine } = req.query;
    const campFilter = { status: "Active" };
    if (mine === "true" && req.user) campFilter.created_by = req.user._id;
    else if (include_seed !== "true") campFilter.created_by = { $ne: null };

    const camps = await Camp.find(campFilter).select("_id");
    const campIds = camps.map((c) => c._id);

    let predictions = [];
    if (campIds.length > 0) {
      predictions = await PriorityPrediction.find({ camp_id: { $in: campIds } })
        .populate(
          "camp_id",
          "camp_name population children_count elderly_count food_available water_available medicine_available sanitary_available road_access_status priority_level",
        )
        .sort({ priority_score: -1 })
        .lean();

      const itemPriorities = await ItemPriority.find({
        camp_id: { $in: campIds },
      }).lean();
      const itemPriorityMap = new Map(
        itemPriorities.map((item) => [String(item.camp_id), item]),
      );

      predictions = predictions.map((prediction) => {
        const campId =
          typeof prediction.camp_id === "object"
            ? String(prediction.camp_id._id)
            : String(prediction.camp_id);

        return {
          ...prediction,
          item_priority: itemPriorityMap.get(campId) || null,
        };
      });
    }
    res.json({ status: "success", data: predictions });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch predictions", details: error.message });
  }
});

export { router as campPriorityRouter };
