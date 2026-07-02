import express from "express";
import Camp from "../models/Camp.js";
import ItemPriority from "../models/ItemPriority.js";
import PriorityPrediction from "../models/PriorityPrediction.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { NotificationEngine } from "../utils/notificationEngine.js";
import { buildMlItemPriorityData } from "../utils/mlItemPriorityData.js";
import { PostFloodMLService } from "../utils/postFloodMLService.js";
import { applyNeedReportImpactToPrediction } from "../utils/needReportImpact.js";
import { recordPriorityHistory } from "../utils/priorityHistory.js";
import { realCampFilter } from "../utils/operationalDataFilters.js";

const router = express.Router();

const priorityLevelFromScore = (score) => {
  if (Number(score || 0) >= 70) return "High";
  if (Number(score || 0) >= 45) return "Medium";
  return "Low";
};

const urgencyBandFromScore = (score) => {
  if (Number(score || 0) >= 70) return "Critical";
  if (Number(score || 0) >= 45) return "Moderate";
  return "Stable";
};

const normalizeOperationalPriority = (result) => {
  const score = Number(result.priority_score || result.urgency_score || 0);
  const operationalLevel = priorityLevelFromScore(score);
  const originalModelLevel = result.camp_priority || result.priority_level || "";
  const explanations = [...(result.explanations || [])];

  if (originalModelLevel && originalModelLevel !== operationalLevel) {
    explanations.unshift({
      factor: "operational_score_alignment",
      severity: "Medium",
      message: "Operational tier derived from urgency score",
      detail: `The model class was ${originalModelLevel}, but the continuous operational score is ${score}/100, so the displayed tier is ${operationalLevel}.`,
      score,
    });
  }

  return {
    ...result,
    model_class_prediction: originalModelLevel,
    camp_priority: operationalLevel,
    priority_level: operationalLevel,
    priority_score: score,
    urgency_score: score,
    urgency_band: urgencyBandFromScore(score),
    explanations: explanations.slice(0, 8),
  };
};

const buildMlPredictionData = (camp, result) => ({
  camp_id: camp._id,
  priority_level: result.camp_priority,
  priority_score: result.priority_score,
  confidence_score: result.confidence_score,
  factors: result.factors || {},
  explanations: result.explanations || [],
  relief_priorities: {
    food_priority: result.food_priority,
    water_priority: result.water_priority,
    medicine_priority: result.medicine_priority,
    sanitary_priority: result.sanitary_priority,
  },
  need_report_impact: result.need_report_impact || {},
  predicted_at: new Date(),
  prediction_source: result.prediction_source || "ml_model",
  model_version: result.model_version || "post_flood_camp_relief_rf_v2_standards",
  feedback_event: result.fallback_reason
    ? `Fallback used: ${result.fallback_reason}`
    : "",
});

const buildResultRow = (camp, result) => ({
  camp_id: camp._id,
  camp_name: camp.camp_name,
  priority_level: result.camp_priority,
  priority_score: result.priority_score,
  confidence_score: result.confidence_score,
  factors: result.factors || {},
  explanations: result.explanations || [],
  relief_priorities: {
    food_priority: result.food_priority,
    water_priority: result.water_priority,
    medicine_priority: result.medicine_priority,
    sanitary_priority: result.sanitary_priority,
  },
  prediction_source: result.prediction_source || "ml_model",
});

// GET post-flood ML service status
router.get("/ml-status", authenticate, async (req, res) => {
  const status = await PostFloodMLService.getServiceStatus();
  res.status(status.available ? 200 : 503).json({
    status: status.available ? "success" : "error",
    data: status,
  });
});

router.get(
  "/review-queue",
  authenticate,
  authorize("admin", "disaster_officer", "camp_coordinator"),
  async (req, res) => {
    try {
      const confidenceMax = Number(req.query.confidence_max || 0.65);
      const predictions = await PriorityPrediction.find({
        prediction_source: "ml_model",
        confidence_score: { $lte: confidenceMax },
      })
        .populate("camp_id", "camp_name population road_access_status priority_level priority_score")
        .sort({ confidence_score: 1, priority_score: -1 })
        .lean();

      res.json({
        status: "success",
        data: predictions,
        count: predictions.length,
        confidence_max: confidenceMax,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch review queue",
        details: error.message,
      });
    }
  },
);

router.post(
  "/what-if",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const { camp_id, proposed_resources = {} } = req.body;
      const camp = await Camp.findById(camp_id);
      if (!camp) return res.status(404).json({ error: "Camp not found" });

      const current = normalizeOperationalPriority(await applyNeedReportImpactToPrediction(
        camp._id,
        await PostFloodMLService.predictCampNeedsWithFallback(camp),
      ));
      const simulatedCamp = camp.toObject();
      const proposed = {
        food: Number(proposed_resources.food || 0),
        water: Number(proposed_resources.water || 0),
        medicine: Number(proposed_resources.medicine || 0),
        sanitary: Number(proposed_resources.sanitary || 0),
      };

      simulatedCamp.food_available = Number(simulatedCamp.food_available || 0) + proposed.food;
      simulatedCamp.water_available = Number(simulatedCamp.water_available || 0) + proposed.water;
      simulatedCamp.medicine_available = Number(simulatedCamp.medicine_available || 0) + proposed.medicine;
      simulatedCamp.sanitary_available = Number(simulatedCamp.sanitary_available || 0) + proposed.sanitary;
      simulatedCamp.last_distribution_hours = 0;

      const projected = normalizeOperationalPriority(await applyNeedReportImpactToPrediction(
        camp._id,
        await PostFloodMLService.predictCampNeedsWithFallback(simulatedCamp),
      ));
      const impactScore = Math.max(
        0,
        Number(current.priority_score || 0) - Number(projected.priority_score || 0),
      );

      res.json({
        status: "success",
        data: {
          camp_id: camp._id,
          camp_name: camp.camp_name,
          proposed_resources: proposed,
          current_priority: current,
          projected_priority: projected,
          relief_impact_score: impactScore,
          interpretation:
            impactScore > 0
              ? `Proposed delivery may reduce urgency by ${impactScore} point(s).`
              : "Proposed delivery is not expected to reduce the urgency score.",
        },
      });
    } catch (error) {
      res.status(500).json({
        error: "What-if simulation failed",
        details: error.message,
      });
    }
  },
);

router.post(
  "/override",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const { camp_id, priority_level, priority_score, reason } = req.body;
      if (!["Low", "Medium", "High"].includes(priority_level)) {
        return res.status(400).json({ error: "priority_level must be Low, Medium, or High" });
      }
      if (!reason || String(reason).trim().length < 5) {
        return res.status(400).json({ error: "Override reason is required" });
      }

      const camp = await Camp.findById(camp_id);
      if (!camp) return res.status(404).json({ error: "Camp not found" });
      const scoreInput = Number(priority_score);
      const score = Number.isFinite(scoreInput)
        ? Math.max(0, Math.min(100, scoreInput))
        : camp.priority_score;

      const existing = await PriorityPrediction.findOne({ camp_id });
      const prediction = await PriorityPrediction.findOneAndUpdate(
        { camp_id },
        {
          camp_id,
          priority_level,
          priority_score: score,
          prediction_source: existing?.prediction_source || "ml_model",
          model_version: existing?.model_version || "manual_override",
          confidence_score: existing?.confidence_score || 1,
          relief_priorities: existing?.relief_priorities || {},
          factors: existing?.factors || {},
          explanations: [
            ...(existing?.explanations || []),
            {
              factor: "officer_override",
              severity: "Medium",
              message: "Officer override applied",
              detail: reason,
              score,
            },
          ],
          override: {
            is_overridden: true,
            original_priority_level: existing?.priority_level || camp.priority_level,
            original_priority_score: existing?.priority_score ?? camp.priority_score,
            override_reason: reason,
            overridden_by: req.user?._id || null,
            overridden_at: new Date(),
          },
          predicted_at: new Date(),
        },
        { upsert: true, returnDocument: "after" },
      );

      await Camp.findByIdAndUpdate(camp_id, {
        priority_level,
        priority_score: score,
        last_updated: new Date(),
      });
      await recordPriorityHistory(
        camp_id,
        {
          priority_level,
          camp_priority: priority_level,
          priority_score: score,
          confidence_score: existing?.confidence_score || 1,
          prediction_source: "manual_override",
          model_version: "manual_override",
          food_priority: existing?.relief_priorities?.food_priority || "Low",
          water_priority: existing?.relief_priorities?.water_priority || "Low",
          medicine_priority: existing?.relief_priorities?.medicine_priority || "Low",
          sanitary_priority: existing?.relief_priorities?.sanitary_priority || "Low",
          factors: existing?.factors || {},
        },
        "officer_override",
      );

      res.json({ status: "success", data: prediction });
    } catch (error) {
      res.status(500).json({
        error: "Failed to override priority",
        details: error.message,
      });
    }
  },
);

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

      const result = await applyNeedReportImpactToPrediction(
        camp._id,
        await PostFloodMLService.predictCampNeedsWithFallback(camp),
      );
      const normalizedResult = normalizeOperationalPriority(result);

      const prediction = await PriorityPrediction.findOneAndUpdate(
        { camp_id },
        buildMlPredictionData(camp, normalizedResult),
        { upsert: true, returnDocument: "after" },
      );

      await Camp.findByIdAndUpdate(camp_id, {
        priority_level: normalizedResult.camp_priority,
        priority_score: normalizedResult.priority_score,
      });

      await ItemPriority.findOneAndUpdate(
        { camp_id: camp._id },
        buildMlItemPriorityData(camp, normalizedResult),
        { upsert: true, returnDocument: "after" },
      );
      await recordPriorityHistory(camp._id, normalizedResult, "manual_single_recalculate");

      await NotificationEngine.alertHighPriorityCamp(camp, {
        priority_level: normalizedResult.camp_priority,
        priority_score: normalizedResult.priority_score,
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
      const includeDemo = req.query.include_demo === "true";
      const camps = await Camp.find({
        ...(includeDemo ? { status: "Active" } : realCampFilter({ status: "Active" })),
      });
      const results = [];
      const failures = [];
      const batchResult = await PostFloodMLService.predictBatchCampNeedsWithFallback(camps);
      const campMap = new Map(camps.map((camp) => [String(camp._id), camp]));

      for (const item of batchResult.predictions) {
        const camp = campMap.get(String(item.camp_id));
        if (!camp) continue;

        const result = normalizeOperationalPriority(await applyNeedReportImpactToPrediction(
          camp._id,
          item.prediction,
        ));
        const prediction = await PriorityPrediction.findOneAndUpdate(
          { camp_id: camp._id },
          buildMlPredictionData(camp, result),
          { upsert: true, returnDocument: "after" },
        );
        await Camp.findByIdAndUpdate(camp._id, {
          priority_level: result.camp_priority,
          priority_score: result.priority_score,
        });
        await ItemPriority.findOneAndUpdate(
          { camp_id: camp._id },
          buildMlItemPriorityData(camp, result),
          { upsert: true, returnDocument: "after" },
        );
        await recordPriorityHistory(camp._id, result, "manual_batch_recalculate");
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
        fallback: Boolean(batchResult.fallback),
        fallback_reason: batchResult.fallback_reason || null,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to recalculate", details: error.message });
    }
  },
);

// GET all predictions
router.get("/", authenticate, authorize("admin", "disaster_officer", "camp_coordinator"), async (req, res) => {
  try {
    const { include_seed, mine, include_demo } = req.query;
    const campFilter = { status: "Active" };
    if (mine === "true" && req.user) campFilter.created_by = req.user._id;
    if (include_seed !== "true" || include_demo !== "true") {
      Object.assign(campFilter, realCampFilter());
    }

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

