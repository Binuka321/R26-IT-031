import mongoose from 'mongoose';

const routeSchema = new mongoose.Schema({
  camp_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  route_name: { type: String, default: '' },
  start_latitude: { type: Number, required: true },
  start_longitude: { type: Number, required: true },
  end_latitude: { type: Number, required: true },
  end_longitude: { type: Number, required: true },
  route_coordinates: {
    type: [[Number]],
    default: []
  },
  waypoints: [{
    latitude: Number,
    longitude: Number,
    description: String
  }],
  distance: { type: Number, default: 0 },
  estimated_time: { type: String, default: '' },
  estimated_time_minutes: { type: Number, default: 0 },
  safety_score: { type: Number, default: 0, min: 0, max: 100 },
  route_status: {
    type: String,
    enum: ['Active', 'Blocked', 'Flooded', 'Alternative'],
    default: 'Active'
  },
  route_type: {
    type: String,
    enum: ['Safest', 'Shortest', 'Alternative'],
    default: 'Safest'
  },
  route_algorithm: {
    type: String,
    enum: ['A*', 'Dijkstra'],
    default: 'A*'
  },
  route_criteria_hash: {
    type: String,
    default: '',
    index: true
  },
  assigned_team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  warnings: [{ type: String }]
}, { timestamps: true });

routeSchema.index({ camp_id: 1, route_criteria_hash: 1 }, { unique: true, sparse: true });

export default mongoose.model('Route', routeSchema);
