import mongoose from "mongoose";

const mlTrainingFeedbackSchema = new mongoose.Schema(
  {
    camp_id: { type: mongoose.Schema.Types.ObjectId, ref: "Camp", required: true, index: true },
    distribution_id: { type: mongoose.Schema.Types.ObjectId, ref: "Distribution", default: null },
    prediction_id: { type: mongoose.Schema.Types.ObjectId, ref: "PriorityPrediction", default: null },
    predicted_priority_level: { type: String, default: "" },
    predicted_priority_score: { type: Number, default: 0 },
    actual_priority_after_response: {
      type: String,
      enum: ["Low", "Medium", "High", ""],
      default: "",
    },
    response_outcome: {
      type: String,
      enum: ["successful", "partial", "failed", "pending_review"],
      default: "pending_review",
    },
    response_time_minutes: { type: Number, default: null },
    delivered_ratio: { type: Number, default: null },
    notes: { type: String, default: "" },
    feature_snapshot: { type: Object, default: {} },
    label_snapshot: { type: Object, default: {} },
    used_for_training: { type: Boolean, default: false, index: true },
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("MLTrainingFeedback", mlTrainingFeedbackSchema);
