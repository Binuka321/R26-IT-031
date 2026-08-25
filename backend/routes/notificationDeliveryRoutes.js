import express from "express";
import NotificationDelivery from "../models/NotificationDelivery.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const filter = {};
      if (req.query.channel) filter.channel = req.query.channel;
      if (req.query.status) filter.status = req.query.status;
      const deliveries = await NotificationDelivery.find(filter)
        .populate("notification_id", "type severity related_camp_id")
        .sort({ createdAt: -1 })
        .limit(300);
      res.json({ status: "success", data: deliveries });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alert deliveries", details: error.message });
    }
  },
);

router.put(
  "/:id/status",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const { status, provider_response = "" } = req.body;
      if (!["queued", "sent", "failed", "skipped"].includes(status)) {
        return res.status(400).json({ error: "Invalid delivery status" });
      }
      const delivery = await NotificationDelivery.findByIdAndUpdate(
        req.params.id,
        {
          status,
          provider_response,
          sent_at: status === "sent" ? new Date() : null,
        },
        { returnDocument: "after" },
      );
      if (!delivery) return res.status(404).json({ error: "Delivery record not found" });
      res.json({ status: "success", data: delivery });
    } catch (error) {
      res.status(500).json({ error: "Failed to update alert delivery", details: error.message });
    }
  },
);

export { router as notificationDeliveryRouter };
