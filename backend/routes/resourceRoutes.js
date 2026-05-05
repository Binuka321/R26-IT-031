import express from "express";
import Resource from "../models/Resource.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { NotificationEngine } from "../utils/notificationEngine.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const payload = { ...req.body, created_by: req.user?.id || null };
      const resource = new Resource(payload);
      resource.available_quantity =
        resource.total_quantity - resource.allocated_quantity;
      await resource.save();
      res.status(201).json({ status: "success", data: resource });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to create resource", details: error.message });
    }
  },
);

router.get("/", authenticate, async (req, res) => {
  try {
    const { resource_type, mine, include_seed } = req.query;
    const filter = resource_type ? { resource_type } : {};
    if (mine === "true") {
      filter.created_by = req.user?.id;
    } else if (include_seed !== "true") {
      filter.created_by = { $ne: null };
    }
    const resources = await Resource.find(filter).sort({ resource_type: 1 });
    res.json({ status: "success", data: resources });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch resources", details: error.message });
  }
});

router.put(
  "/:id",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const resource = await Resource.findById(req.params.id);
      if (!resource)
        return res.status(404).json({ error: "Resource not found" });

      Object.assign(resource, req.body);
      resource.available_quantity =
        resource.total_quantity - resource.allocated_quantity;
      await resource.save();

      if (resource.available_quantity <= resource.low_stock_threshold) {
        await NotificationEngine.alertLowStock(resource);
      }
      res.json({ status: "success", data: resource });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to update resource", details: error.message });
    }
  },
);

router.post(
  "/allocate",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const { resource_id, quantity } = req.body;
      const resource = await Resource.findById(resource_id);
      if (!resource)
        return res.status(404).json({ error: "Resource not found" });
      if (resource.available_quantity < quantity) {
        return res
          .status(400)
          .json({
            error: "Insufficient stock",
            available: resource.available_quantity,
          });
      }
      resource.allocated_quantity += quantity;
      resource.available_quantity =
        resource.total_quantity - resource.allocated_quantity;
      await resource.save();

      if (resource.available_quantity <= resource.low_stock_threshold) {
        await NotificationEngine.alertLowStock(resource);
      }
      res.json({ status: "success", data: resource });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to allocate", details: error.message });
    }
  },
);

router.get("/low-stock", authenticate, async (req, res) => {
  try {
    const resources = await Resource.find({
      $expr: { $lte: ["$available_quantity", "$low_stock_threshold"] },
    });
    res.json({ status: "success", data: resources, count: resources.length });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch low stock", details: error.message });
  }
});

router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    await Resource.findByIdAndDelete(req.params.id);
    res.json({ status: "success", message: "Resource deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete", details: error.message });
  }
});

export { router as resourceRouter };
