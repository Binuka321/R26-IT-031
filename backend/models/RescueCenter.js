import mongoose from "mongoose";

const rescueCenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, default: "", trim: true },
    commander_name: { type: String, default: "", trim: true },
    contact_phone: { type: String, default: "", trim: true },
    rescue_team_capacity: { type: Number, default: 0, min: 0 },
    boat_capacity: { type: Number, default: 0, min: 0 },
    ambulance_capacity: { type: Number, default: 0, min: 0 },
    operating_status: {
      type: String,
      enum: ["Open", "Limited", "Closed"],
      default: "Open",
      index: true,
    },
    notes: { type: String, default: "" },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

rescueCenterSchema.index({ latitude: 1, longitude: 1 });

export default mongoose.model("RescueCenter", rescueCenterSchema);
