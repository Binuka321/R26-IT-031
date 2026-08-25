import mongoose from 'mongoose';

const itemPrioritySchema = new mongoose.Schema({
  camp_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  food_priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  water_priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  medicine_priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  sanitary_priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  recommended_food_qty: { type: Number, default: 0 },
  recommended_water_qty: { type: Number, default: 0 },
  recommended_medicine_qty: { type: Number, default: 0 },
  recommended_sanitary_qty: { type: Number, default: 0 },
  required_food_qty: { type: Number, default: 0 },
  required_water_qty: { type: Number, default: 0 },
  required_medicine_qty: { type: Number, default: 0 },
  required_sanitary_qty: { type: Number, default: 0 },
  available_food_qty: { type: Number, default: 0 },
  available_water_qty: { type: Number, default: 0 },
  available_medicine_qty: { type: Number, default: 0 },
  available_sanitary_qty: { type: Number, default: 0 },
  coverage: {
    food: { type: Number, default: 0 },
    water: { type: Number, default: 0 },
    medicine: { type: Number, default: 0 },
    sanitary: { type: Number, default: 0 }
  },
  overall_urgency: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  notes: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('ItemPriority', itemPrioritySchema);
