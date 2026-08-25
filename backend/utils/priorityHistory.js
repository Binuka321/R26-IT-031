import PriorityHistory from "../models/PriorityHistory.js";

export async function recordPriorityHistory(campId, result, feedbackEvent = "priority_update") {
  if (!campId || !result) return null;

  return PriorityHistory.create({
    camp_id: campId,
    priority_level: result.camp_priority || result.priority_level || "Low",
    priority_score: Number(result.priority_score || 0),
    confidence_score: Number(result.confidence_score || 0),
    prediction_source: result.prediction_source || "rule_based",
    model_version: result.model_version || "",
    feedback_event: feedbackEvent,
    need_report_impact_score: Number(result.need_report_impact?.impact_score || 0),
    applied_need_report_boost: Number(result.need_report_impact?.applied_boost || 0),
    relief_priorities: {
      food_priority: result.food_priority || "Low",
      water_priority: result.water_priority || "Low",
      medicine_priority: result.medicine_priority || "Low",
      sanitary_priority: result.sanitary_priority || "Low",
    },
    factors: result.factors || {},
  });
}
