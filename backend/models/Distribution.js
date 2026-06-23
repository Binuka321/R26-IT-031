import mongoose from 'mongoose';

const distributionSchema = new mongoose.Schema({
  camp_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  route_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    default: null
  },
  assigned_team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  priority_level: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  item_list: [{
    item_name: { type: String, required: true },
    item_type: {
      type: String,
      enum: ['food', 'water', 'medicine', 'sanitary', 'clothes', 'baby_care', 'emergency']
    },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: 'units' },
    // W13 Fix: Per-item delivery tracking for partial deliveries
    delivered_quantity: { type: Number, default: 0 },
    delivery_status: {
      type: String,
      enum: ['Pending', 'Partial', 'Delivered', 'Unavailable'],
      default: 'Pending'
    }
  }],
  delivery_method: {
    type: String,
    enum: ['truck', 'boat', 'helicopter', 'hand-delivery'],
    default: 'truck'
  },
  status: {
    type: String,
    enum: ['Pending', 'On the Way', 'Delivered', 'Partial', 'Failed'],
    default: 'Pending'
  },
  notes: { type: String, default: '' },
  // W13 Fix: Partial delivery reason
  partial_reason: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  dispatched_at: { type: Date, default: null },
  completed_at: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('Distribution', distributionSchema);
