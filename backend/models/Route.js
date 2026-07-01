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
    enum: ['A*', 'Dijkstra', 'OSRM'],
    default: 'A*'
  },
  route_source: {
    type: String,
    enum: ['road_network', 'grid_fallback'],
    default: 'grid_fallback'
  },
  vehicle_type: {
    type: String,
    enum: ['truck', 'boat', 'helicopter', 'hand-delivery', 'ambulance'],
    default: 'truck'
  },
  road_constraints: {
    traffic_level: {
      type: String,
      enum: ['Clear', 'Moderate', 'Heavy'],
      default: 'Clear'
    },
    bridge_condition: {
      type: String,
      enum: ['Clear', 'Weak', 'Closed'],
      default: 'Clear'
    },
    minimum_road_width_m: { type: Number, default: 0 },
    restricted_vehicle_types: [{ type: String }]
  },
  accuracy_level: {
    type: String,
    enum: ['High', 'Estimated'],
    default: 'Estimated'
  },
  accuracy_notes: { type: String, default: '' },
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
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  warnings: [{ type: String }]
}, { timestamps: true });

routeSchema.index({ camp_id: 1, route_criteria_hash: 1 }, { unique: true, sparse: true });

export default mongoose.model('Route', routeSchema);
