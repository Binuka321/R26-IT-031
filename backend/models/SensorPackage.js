import mongoose from 'mongoose';

const sensorPackageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: {
      name: { type: String, required: true, trim: true },
      basin: { type: String, trim: true, default: '' },
      river: { type: String, trim: true, default: '' },
      station: { type: String, trim: true, default: '' },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, required: true, trim: true }
    },
    sensors: {
      ultrasonic: { type: Number, default: 0, min: 0 },
      flow: { type: Number, default: 0, min: 0 },
      rain: { type: Number, default: 0, min: 0 },
      turbidity: { type: Number, default: 0, min: 0 }
    },
    boards: {
      esp32: { type: Boolean, default: false },
      uno: { type: Boolean, default: false }
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'warning'],
      default: 'active'
    },
    lastUpdate: { type: Date, default: Date.now },
    currentReadings: {
      waterLevel: { type: Number },
      flowRate: { type: Number },
      rainfall: { type: Number },
      turbidity: { type: Number }
    }
  },
  { timestamps: true }
);

export default mongoose.model('SensorPackage', sensorPackageSchema);

