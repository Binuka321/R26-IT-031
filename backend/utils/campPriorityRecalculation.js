import Camp from "../models/Camp.js";
import ItemPriority from "../models/ItemPriority.js";
import PriorityPrediction from "../models/PriorityPrediction.js";
import { buildMlItemPriorityData } from "./mlItemPriorityData.js";
import { PostFloodMLService } from "./postFloodMLService.js";

const buildPredictionData = (camp, result, feedbackEvent = "field_update") => ({
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
  predicted_at: new Date(),
  prediction_source: "ml_model",
  model_version: result.model_version || "post_flood_camp_relief_rf_v2_standards",
  feedback_event: feedbackEvent,
});

export async function recalculateCampPriority(campId, feedbackEvent = "field_update") {
  const camp = await Camp.findById(campId);
  if (!camp || camp.status !== "Active") {
    return {
      recalculated: false,
      reason: camp ? "Camp is not active" : "Camp not found",
    };
  }

  const result = await PostFloodMLService.predictCampNeeds(camp);
  const prediction = await PriorityPrediction.findOneAndUpdate(
    { camp_id: camp._id },
    buildPredictionData(camp, result, feedbackEvent),
    { upsert: true, new: true },
  );

  await Camp.findByIdAndUpdate(camp._id, {
    priority_level: result.camp_priority,
    priority_score: result.priority_score,
    last_updated: new Date(),
  });

  await ItemPriority.findOneAndUpdate(
    { camp_id: camp._id },
    buildMlItemPriorityData(camp, result),
    { upsert: true, new: true },
  );

  return {
    recalculated: true,
    feedback_event: feedbackEvent,
    priority_level: result.camp_priority,
    priority_score: result.priority_score,
    explanations: result.explanations || [],
    prediction_id: prediction._id,
  };
}

export async function tryRecalculateCampPriority(campId, feedbackEvent = "field_update") {
  try {
    return await recalculateCampPriority(campId, feedbackEvent);
  } catch (error) {
    return {
      recalculated: false,
      feedback_event: feedbackEvent,
      warning: "Camp data was saved, but automatic ML reprioritization failed",
      details: error.message,
    };
  }
}

export async function tryRecalculateActiveCampPriorities(feedbackEvent = "system_update") {
  try {
    const camps = await Camp.find({ status: "Active" }).select("_id");
    const results = await Promise.allSettled(
      camps.map((camp) => recalculateCampPriority(camp._id, feedbackEvent)),
    );

    return {
      recalculated: results.filter((result) => result.status === "fulfilled").length,
      failed: results.filter((result) => result.status === "rejected").length,
      feedback_event: feedbackEvent,
    };
  } catch (error) {
    return {
      recalculated: 0,
      failed: 0,
      feedback_event: feedbackEvent,
      warning: "Automatic batch ML reprioritization failed",
      details: error.message,
    };
  }
}
