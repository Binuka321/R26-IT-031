import mongoose from "mongoose";

const safeZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    boundary_coordinates: {
      type: {
        type: String,
        enum: ["Polygon"],
        default: "Polygon",
      },
      coordinates: {
        type: [[[Number]]],
        default: undefined,
      },
    },
    radius_km: { type: Number, default: 2 },
    capacity: { type: Number, default: 0 },
    current_population: { type: Number, default: 0 },
    nearby_road_access: { type: String, default: "" },
    safety_status: {
      type: String,
      enum: ["Safe", "At Risk", "Compromised"],
      default: "Safe",
    },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("SafeZone", safeZoneSchema);
