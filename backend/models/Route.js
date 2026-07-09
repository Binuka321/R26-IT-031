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
  emergency_safety_profile: {
    model: { type: String, default: '' },
    priority: { type: String, default: 'safety_over_distance' },
    risk_level: {
      type: String,
      enum: ['Low', 'Moderate', 'High'],
      default: 'Low'
    },
    nearest_flood_hazard_km: { type: Number, default: null },
    nearest_blocked_road_km: { type: Number, default: null },
    flood_exposure_points: { type: Number, default: 0 },
    blocked_road_exposure_points: { type: Number, default: 0 },
    reasons: [{ type: String }]
  },
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
    enum: ['truck', 'boat', 'hand-delivery', 'ambulance'],
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
    vehicle_passability: {
      type: String,
      enum: ['Passable', 'Limited', 'Not Passable'],
      default: 'Passable'
    },
    restricted_vehicle_types: [{ type: String }]
  },
  mobility_plan: {
    truck_distance_km: { type: Number, default: 0 },
    boat_distance_km: { type: Number, default: 0 },
    hand_delivery_distance_km: { type: Number, default: 0 },
    estimated_truck_minutes: { type: Number, default: 0 },
    estimated_boat_minutes: { type: Number, default: 0 },
    estimated_hand_delivery_minutes: { type: Number, default: 0 },
    estimated_mixed_time_minutes: { type: Number, default: 0 },
    primary_mode: {
      type: String,
      enum: ['truck', 'boat', 'hand-delivery', 'mixed'],
      default: 'truck'
    },
    transfer_points: [{
      latitude: Number,
      longitude: Number,
      from_mode: String,
      to_mode: String,
      reason: String
    }],
    segments: [{
      mode: String,
      distance_km: Number,
      path: [[Number]],
      start: [Number],
      end: [Number],
      reason: String
    }],
    notes: [{ type: String }]
  },
  live_road_condition_summary: {
    source: { type: String, default: '' },
    count: { type: Number, default: 0 },
    last_updated: { type: Date, default: null },
    warning: { type: String, default: '' }
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
