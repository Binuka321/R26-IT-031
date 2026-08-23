import mongoose from 'mongoose';

const modelTrainingRunSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true },
    status: { type: String, enum: ['skipped', 'success', 'failed'], required: true },
    samples: { type: Number, default: 0 },
    message: String,
    result: mongoose.Schema.Types.Mixed,
    error: String,
    completedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model('ModelTrainingRun', modelTrainingRunSchema);
