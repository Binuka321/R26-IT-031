import express from "express";
import Resource from "../models/Resource.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { NotificationEngine } from "../utils/notificationEngine.js";
import { tryRecalculateActiveCampPriorities } from "../utils/campPriorityRecalculation.js";
import { realResourceFilter } from "../utils/operationalDataFilters.js";

const router = express.Router();
const validResourceTypes = ["food", "water", "medicine", "sanitary", "clothes", "baby_care", "emergency"];
const defaultUnitsByType = {
  food: "packs",
  water: "bottles",
  medicine: "kits",
  sanitary: "kits",
  clothes: "pieces",
  baby_care: "packs",
  emergency: "kits",
};

function validateResourcePayload(data, { partial = false } = {}) {
  const errors = [];
  const check = (condition, message) => {
    if (condition) errors.push(message);
  };

  if (!partial || data.resource_name !== undefined) {
    const name = String(data.resource_name || "").trim();
    check(name.length < 3, "Resource name must be at least 3 characters");
    check(name.length > 80, "Resource name is too long");
  }
  if (!partial || data.resource_type !== undefined) {
    check(!validResourceTypes.includes(data.resource_type), "Invalid resource type");
  }
  if (!partial || data.total_quantity !== undefined) {
    const total = Number(data.total_quantity);
    check(!Number.isFinite(total) || total <= 0, "Total quantity must be greater than 0");
    check(total > 1000000, "Total quantity looks too large");
  }
  if (!partial || data.allocated_quantity !== undefined) {
    const allocated = Number(data.allocated_quantity || 0);
    check(!Number.isFinite(allocated) || allocated < 0, "Allocated quantity cannot be negative");
  }
  const total = Number(data.total_quantity);
  const allocated = Number(data.allocated_quantity || 0);
  if (Number.isFinite(total) && Number.isFinite(allocated)) {
    check(allocated > total, "Allocated quantity cannot exceed total quantity");
  }
  if (!partial || data.unit !== undefined) {
    const unit = String(data.unit || "").trim();
    check(!unit, "Unit is required");
    check(unit.length > 30, "Unit is too long");
  }
  if (!partial || data.low_stock_threshold !== undefined) {
    const threshold = Number(data.low_stock_threshold || 0);
    check(!Number.isFinite(threshold) || threshold < 0, "Low stock threshold cannot be negative");
    if (Number.isFinite(total)) check(threshold > total, "Low stock threshold cannot exceed total quantity");
  }

  return errors;
}

router.post(
  "/",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const normalizedType = req.body.resource_type || "food";
      const payload = {
        ...req.body,
        unit: String(req.body.unit || "").trim() || defaultUnitsByType[normalizedType] || "units",
        created_by: req.user?.id || null,
      };
      const validationErrors = validateResourcePayload(payload);
      if (validationErrors.length) {
        return res.status(400).json({ error: validationErrors[0], errors: validationErrors });
      }
      const resource = new Resource(payload);
      resource.available_quantity =
        resource.total_quantity - resource.allocated_quantity;
      await resource.save();
      const realtime_update = await tryRecalculateActiveCampPriorities("resource_created");
      res.status(201).json({ status: "success", data: resource, realtime_update });
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
      Object.assign(filter, realResourceFilter());
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

      const payload = {
        ...req.body,
        unit: req.body.unit !== undefined
          ? String(req.body.unit || "").trim()
          : resource.unit,
      };
      const validationErrors = validateResourcePayload(
        {
          ...resource.toObject(),
          ...payload,
        },
        { partial: true },
      );
      if (validationErrors.length) {
        return res.status(400).json({ error: validationErrors[0], errors: validationErrors });
      }

      Object.assign(resource, payload);
      resource.available_quantity =
        resource.total_quantity - resource.allocated_quantity;
      await resource.save();

      if (resource.available_quantity <= resource.low_stock_threshold) {
        await NotificationEngine.alertLowStock(resource, req.user.id);
      }
      const realtime_update = await tryRecalculateActiveCampPriorities("resource_stock_updated");
      res.json({ status: "success", data: resource, realtime_update });
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
      if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: "Allocation quantity must be greater than 0" });
      }
      const resource = await Resource.findById(resource_id);
      if (!resource)
        return res.status(404).json({ error: "Resource not found" });
      if (resource.available_quantity < Number(quantity)) {
        return res.status(400).json({
          error: "Insufficient stock",
          available: resource.available_quantity,
        });
      }
      resource.allocated_quantity += Number(quantity);
      resource.available_quantity =
        resource.total_quantity - resource.allocated_quantity;
      await resource.save();

      if (resource.available_quantity <= resource.low_stock_threshold) {
        await NotificationEngine.alertLowStock(resource, req.user.id);
      }
      const realtime_update = await tryRecalculateActiveCampPriorities("resource_allocated");
      res.json({ status: "success", data: resource, realtime_update });
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
    const realtime_update = await tryRecalculateActiveCampPriorities("resource_deleted");
    res.json({ status: "success", message: "Resource deleted", realtime_update });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete", details: error.message });
  }
});

export { router as resourceRouter };
