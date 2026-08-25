import mongoose from "mongoose";

const rescueTeamLocationSchema = new mongoose.Schema(
  {
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy_meters: { type: Number, default: null },
    battery_level: { type: Number, default: null },
    status: {
      type: String,
      enum: ["available", "assigned", "en_route", "rescuing", "offline"],
      default: "available",
    },
    source: {
      type: String,
      enum: ["browser_gps", "mobile_app", "manual"],
      default: "browser_gps",
    },
    recorded_at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

rescueTeamLocationSchema.index({ team_id: 1, recorded_at: -1 });

export default mongoose.model("RescueTeamLocation", rescueTeamLocationSchema);
