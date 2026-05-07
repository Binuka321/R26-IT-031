import mongoose from 'mongoose';

const sensorReadingSchema = new mongoose.Schema(
  {
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SensorPackage',
      required: true,
      index: true
    },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    waterLevel: { type: Number },
    unit: { type: String, enum: ['ft', 'm'], default: 'm' },
    flowRate: { type: Number },
    rainfall: { type: Number },
    turbidity: { type: Number }
  },
  { timestamps: true }
);

sensorReadingSchema.index({ packageId: 1, timestamp: 1 });

export default mongoose.model('SensorReading', sensorReadingSchema);
