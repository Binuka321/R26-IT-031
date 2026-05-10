import mongoose from 'mongoose';

const needReportSchema = new mongoose.Schema({
  reporter_name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  need_type: { 
    type: String, 
    enum: ['Food', 'Water', 'Medical', 'Rescue', 'Shelter', 'Road Blockage', 'Flood Level', 'Other'],
    required: true 
  },
  severity: { 
    type: String, 
    enum: ['Low', 'Medium', 'High', 'Critical', 'Emergency'],
    default: 'Medium'
  },
  people_count: { type: Number, default: 1 },
  description: { type: String, default: '' },
  contact_phone: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Responded', 'Resolved'],
    default: 'Pending'
  },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.model('NeedReport', needReportSchema);
