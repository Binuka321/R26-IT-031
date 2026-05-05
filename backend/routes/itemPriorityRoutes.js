import express from "express";
import Camp from "../models/Camp.js";
import ItemPriority from "../models/ItemPriority.js";
import DiseaseResult from "../models/DiseaseResult.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { ItemPriorityEngine } from "../utils/itemPriorityEngine.js";

const router = express.Router();

router.post(
  "/generate/:campId",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const camp = await Camp.findById(req.params.campId);
      if (!camp) return res.status(404).json({ error: "Camp not found" });

      const latestDisease = await DiseaseResult.findOne({
        camp_id: camp._id,
        status: "Active",
      }).sort({ detected_date: -1 });
      const result = ItemPriorityEngine.calculateItemPriorities(
        camp,
        latestDisease,
      );

      const itemPriority = await ItemPriority.findOneAndUpdate(
        { camp_id: camp._id },
        { camp_id: camp._id, ...result },
        { upsert: true, new: true },
      );

      res.json({ status: "success", data: itemPriority });
    } catch (error) {
      res
        .status(500)
        .json({
          error: "Failed to generate item priorities",
          details: error.message,
        });
    }
  },
);

router.get("/camp/:campId", authenticate, async (req, res) => {
  try {
    const itemPriority = await ItemPriority.findOne({
      camp_id: req.params.campId,
    }).sort({ updatedAt: -1 });
    if (!itemPriority)
      return res.status(404).json({ error: "No item priority found" });
    res.json({ status: "success", data: itemPriority });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch", details: error.message });
  }
});

router.put(
  "/:id",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const updated = await ItemPriority.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json({ status: "success", data: updated });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to update", details: error.message });
    }
  },
);

router.get("/", authenticate, async (req, res) => {
  try {
    const { include_seed, mine } = req.query;
    const campFilter = {};
    if (mine === "true" && req.user) campFilter.created_by = req.user._id;
    else if (include_seed !== "true") campFilter.created_by = { $ne: null };

    const camps = await Camp.find(campFilter).select("_id");
    const campIds = camps.map((c) => c._id);

    let items = [];
    if (campIds.length > 0) {
      items = await ItemPriority.find({ camp_id: { $in: campIds } }).populate(
        "camp_id",
        "camp_name population priority_level",
      );
    }

    res.json({ status: "success", data: items });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch", details: error.message });
  }
});

export { router as itemPriorityRouter };
