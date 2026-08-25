import mongoose from "mongoose";

const stockItemSchema = new mongoose.Schema(
  {
    resource_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      default: null,
    },
    item_name: { type: String, required: true, trim: true },
    item_type: {
      type: String,
      enum: ["food", "water", "medicine", "sanitary", "clothes", "baby_care", "emergency"],
      required: true,
    },
    quantity_available: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "units" },
    low_stock_threshold: { type: Number, default: 50, min: 0 },
  },
  { _id: false },
);

const distributionCenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, default: "", trim: true },
    manager_name: { type: String, default: "", trim: true },
    contact_phone: { type: String, default: "", trim: true },
    capacity_units: { type: Number, default: 0, min: 0 },
    vehicle_capacity_units: { type: Number, default: 0, min: 0 },
    operating_status: {
      type: String,
      enum: ["Open", "Limited", "Closed"],
      default: "Open",
      index: true,
    },
    stock_items: [stockItemSchema],
    notes: { type: String, default: "" },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

distributionCenterSchema.index({ latitude: 1, longitude: 1 });

export default mongoose.model("DistributionCenter", distributionCenterSchema);
