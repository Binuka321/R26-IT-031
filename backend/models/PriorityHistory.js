import mongoose from "mongoose";

const priorityHistorySchema = new mongoose.Schema(
  {
    camp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Camp",
      required: true,
      index: true,
    },
    priority_level: {
      type: String,
      enum: ["Low", "Medium", "High"],
      required: true,
    },
    priority_score: { type: Number, default: 0 },
    confidence_score: { type: Number, default: 0 },
    prediction_source: {
      type: String,
      enum: ["rule_based", "ml_model", "manual_override"],
      default: "rule_based",
    },
    model_version: { type: String, default: "" },
    feedback_event: { type: String, default: "" },
    need_report_impact_score: { type: Number, default: 0 },
    applied_need_report_boost: { type: Number, default: 0 },
    relief_priorities: {
      food_priority: { type: String, default: "Low" },
      water_priority: { type: String, default: "Low" },
      medicine_priority: { type: String, default: "Low" },
      sanitary_priority: { type: String, default: "Low" },
    },
    factors: { type: Object, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model("PriorityHistory", priorityHistorySchema);
