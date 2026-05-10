import mongoose from "mongoose";

const campSchema = new mongoose.Schema(
  {
    camp_name: { type: String, required: true, trim: true },
    safe_zone_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SafeZone",
      required: true,
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    population: { type: Number, default: 0, min: 0 },
    children_count: { type: Number, default: 0, min: 0 },
    elderly_count: { type: Number, default: 0, min: 0 },
    infants_count: { type: Number, default: 0, min: 0 },
    pregnant_women_count: { type: Number, default: 0, min: 0 },
    disabled_people_count: { type: Number, default: 0, min: 0 },
    chronic_patients_count: { type: Number, default: 0, min: 0 },
    food_available: { type: Number, default: 0, min: 0 },
    water_available: { type: Number, default: 0, min: 0 },
    medicine_available: { type: Number, default: 0, min: 0 },
    sanitary_available: { type: Number, default: 0, min: 0 },
    road_access_status: {
      type: String,
      enum: ["Good", "Limited", "Blocked"],
      default: "Good",
    },
    disease_risk_level: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },
    priority_level: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },
    priority_score: { type: Number, default: 0 },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    distance_from_distribution_center: { type: Number, default: 0, min: 0 },
    camp_capacity: { type: Number, default: 1, min: 1 },
    last_distribution_hours: { type: Number, default: 24, min: 0 },
    vehicle_capacity_total: { type: Number, default: 0, min: 0 },
    camp_occupancy_ratio: { type: Number, default: 0, min: 0 },
    vulnerable_ratio: { type: Number, default: 0, min: 0 },
    contact_person: { type: String, default: "" },
    contact_phone: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Evacuated"],
      default: "Active",
    },
    last_updated: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model("Camp", campSchema);
