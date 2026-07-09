import mongoose from 'mongoose';

const needReportSchema = new mongoose.Schema({
  reporter_name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  location_name: { type: String, default: '' },
  gps_accuracy_meters: { type: Number, default: null },
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
  // W2 Fix: Link reports to the nearest camp and safe zone for triage
  camp_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', default: null },
  safe_zone_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SafeZone', default: null },
  // Track who resolved this report and when
  resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolved_at: { type: Date, default: null },
  assigned_rescue_team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rescue_status: {
    type: String,
    enum: ['Unassigned', 'Assigned', 'En Route', 'Rescuing', 'Rescued', 'Closed'],
    default: 'Unassigned'
  },
  rescue_notes: { type: String, default: '' },
  rescue_transport_mode: {
    type: String,
    enum: ['truck', 'boat'],
    default: 'truck'
  },
  rescue_assigned_at: { type: Date, default: null },
  rescue_completed_at: { type: Date, default: null },
  rescue_history: [{
    status: String,
    note: String,
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updated_at: { type: Date, default: Date.now }
  }],
  // ID of the distribution plan created from this report (W15)
  converted_distribution_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Distribution', default: null },
  impact_score: { type: Number, default: 0 },
  priority_boost_applied: { type: Number, default: 0 },
  possible_duplicate: { type: Boolean, default: false, index: true },
  duplicate_group_key: { type: String, default: '', index: true },
  validation_notes: [{ type: String }],
  is_demo: { type: Boolean, default: false, index: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.model('NeedReport', needReportSchema);
