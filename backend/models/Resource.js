import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    resource_name: { type: String, required: true, trim: true },
    resource_type: {
      type: String,
      enum: [
        "food",
        "water",
        "medicine",
        "sanitary",
        "clothes",
        "baby_care",
        "emergency",
      ],
      required: true,
    },
    total_quantity: { type: Number, default: 0, min: 0 },
    allocated_quantity: { type: Number, default: 0, min: 0 },
    available_quantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "units" },
    low_stock_threshold: { type: Number, default: 50 },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);

resourceSchema.add({
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

// Auto-calculate available quantity before save
resourceSchema.pre("save", function () {
  this.available_quantity = this.total_quantity - this.allocated_quantity;
});

export default mongoose.model("Resource", resourceSchema);
