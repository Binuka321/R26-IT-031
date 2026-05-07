import mongoose from 'mongoose';

const priorityPredictionSchema = new mongoose.Schema({
  camp_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  priority_level: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    required: true
  },
  priority_score: { type: Number, default: 0 },
  confidence_score: { type: Number, default: 0 },
  model_version: { type: String, default: 'rule_based_v1' },
  prediction_source: {
    type: String,
    enum: ['rule_based', 'ml_model'],
    default: 'rule_based'
  },
  factors: {
    population_score: { type: Number, default: 0 },
    resource_shortage_score: { type: Number, default: 0 },
    disease_risk_score: { type: Number, default: 0 },
    vulnerable_population_score: { type: Number, default: 0 },
    distance_score: { type: Number, default: 0 }
  },
  predicted_at: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('PriorityPrediction', priorityPredictionSchema);
