import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['priority_alert', 'disease_alert', 'low_stock', 'route_alert', 'delivery_alert', 'system'],
    default: 'system'
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info'
  },
  target_role: {
    type: String,
    enum: ['all', 'admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'],
    default: 'all'
  },
  related_camp_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    default: null
  },
  status: {
    type: String,
    enum: ['unread', 'read'],
    default: 'unread'
  }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
