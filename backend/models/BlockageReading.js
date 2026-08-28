import mongoose from 'mongoose';

const blockageReadingSchema = new mongoose.Schema(
  {
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SensorPackage',
      required: true,
      index: true
    },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    sensor1Distance: { type: Number },
    sensor2Distance: { type: Number },
    sensor3Distance: { type: Number },
    sensor1WaterLevel: { type: Number },
    sensor2WaterLevel: { type: Number },
    sensor3WaterLevel: { type: Number },
    difference12: { type: Number },
    difference23: { type: Number },
    blockageDetected: { type: Boolean, default: false },
    blockageLocation: { type: String, default: 'NONE' },
    unit: { type: String, default: 'm' }
  },
  { timestamps: true }
);

blockageReadingSchema.index({ packageId: 1, timestamp: -1 });

export default mongoose.model('BlockageReading', blockageReadingSchema);
