const mongoose = require('mongoose');

const screeningSchema = new mongoose.Schema(
  {
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 120,
    },

    gender: {
      type: String,
      required: true,
      enum: ['male', 'female', 'other'],
    },

    duration: {
      type: String,
      required: true,
    },

    selectedSymptoms: {
      type: [String],
      default: [],
    },

    selectedExposures: {
      type: [String],
      default: [],
    },

    riskFactors: {
      type: [String],
      default: [],
    },

    riskLevel: {
      type: String,
      required: true,
      enum: ['Low', 'Medium', 'High'],
    },

    recommendation: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Screening ||
  mongoose.model('Screening', screeningSchema);