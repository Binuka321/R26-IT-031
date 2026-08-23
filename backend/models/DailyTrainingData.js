import mongoose from 'mongoose';

const dailyTrainingDataSchema = new mongoose.Schema(
  {
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SensorPackage',
      required: true,
      index: true
    },
    day: { type: String, required: true },
    location: { type: String, required: true },
    latitude: Number,
    longitude: Number,
    rainfall: Number,
    waterLevel: Number,
    flowRate: Number,
    turbidity: Number,
    riskLevel: { type: String, enum: ['Low', 'Moderate', 'High', 'Very High'] },
    sourceTimestamp: Date
  },
  { timestamps: true }
);

dailyTrainingDataSchema.index({ packageId: 1, day: 1 }, { unique: true });

dailyTrainingDataSchema.index({ day: 1, riskLevel: 1 });

export default mongoose.model('DailyTrainingData', dailyTrainingDataSchema);
