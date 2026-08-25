import mongoose from "mongoose";

const notificationDeliverySchema = new mongoose.Schema(
  {
    notification_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      default: null,
      index: true,
    },
    channel: {
      type: String,
      enum: ["sms", "email", "whatsapp"],
      required: true,
      index: true,
    },
    recipient_role: { type: String, default: "all" },
    recipient_contact: { type: String, default: "" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["queued", "sent", "failed", "skipped"],
      default: "queued",
      index: true,
    },
    provider: { type: String, default: "manual_gateway_pending" },
    provider_response: { type: String, default: "" },
    sent_at: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("NotificationDelivery", notificationDeliverySchema);
