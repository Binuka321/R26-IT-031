import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema({
  location: String,
  latitude: Number,
  longitude: Number,

  // =========================
  // INPUT DATA (FROM IoT)
  // =========================
  rainfall: Number,
  waterLevel: Number,
  humidity: { type: Number, default: 75 },

  // =========================
  // ML OUTPUT
  // =========================
  mlPrediction: {
    prediction: mongoose.Schema.Types.Mixed,
    predictionLabel: String,
    confidence: Number,
    modelVersion: String,
    modelType: String
  },

  // =========================
  // 🔥 NEW: FLOOD ENGINE OUTPUT
  // =========================
  floodDepth: Number,           // meters
  severity: String,             // Minor / Moderate / Severe
  intensityFactor: Number,      // from rainfall analysis
  recommendation: String,       // action advice

  // =========================
  // LEGACY (optional)
  // =========================
  FRI: Number,
  riskLevel: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Prediction', predictionSchema);