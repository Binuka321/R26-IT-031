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
  feedback_event: { type: String, default: '' },
  override: {
    is_overridden: { type: Boolean, default: false },
    original_priority_level: { type: String, default: '' },
    original_priority_score: { type: Number, default: 0 },
    override_reason: { type: String, default: '' },
    overridden_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    overridden_at: { type: Date, default: null }
  },
  relief_priorities: {
    food_priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low'
    },
    water_priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low'
    },
    medicine_priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low'
    },
    sanitary_priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low'
    }
  },
  factors: {
    population_score: { type: Number, default: 0 },
    resource_shortage_score: { type: Number, default: 0 },
    food_shortage_score: { type: Number, default: 0 },
    water_shortage_score: { type: Number, default: 0 },
    medicine_shortage_score: { type: Number, default: 0 },
    sanitary_shortage_score: { type: Number, default: 0 },
    disease_risk_score: { type: Number, default: 0 },
    vulnerable_population_score: { type: Number, default: 0 },
    road_access_score: { type: Number, default: 0 },
    distance_score: { type: Number, default: 0 },
    last_distribution_score: { type: Number, default: 0 },
    camp_occupancy_score: { type: Number, default: 0 },
    ml_item_priority_score: { type: Number, default: 0 },
  },
  explanations: [{
    factor: { type: String, default: '' },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low'
    },
    message: { type: String, default: '' },
    detail: { type: String, default: '' },
    score: { type: Number, default: 0 }
  }],
  predicted_at: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('PriorityPrediction', priorityPredictionSchema);
