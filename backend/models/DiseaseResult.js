import mongoose from 'mongoose';

const diseaseResultSchema = new mongoose.Schema({
  camp_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  disease_type: { type: String, required: true, trim: true },
  risk_level: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  detected_date: { type: Date, default: Date.now },
  medicine_urgency: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  sanitary_urgency: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  affected_count: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Active', 'Contained', 'Resolved'],
    default: 'Active'
  }
}, { timestamps: true });

export default mongoose.model('DiseaseResult', diseaseResultSchema);
