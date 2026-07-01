import express from "express";
import mongoose from "mongoose";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { optimizeMultiCampAllocation } from "../utils/multiCampAllocationOptimizer.js";
import Distribution from "../models/Distribution.js";
import Resource from "../models/Resource.js";
import { tryRecalculateCampPriority } from "../utils/campPriorityRecalculation.js";

const router = express.Router();

router.post(
  "/optimize",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const result = await optimizeMultiCampAllocation(req.body || {});
      res.json({ status: "success", data: result });
    } catch (error) {
      res.status(500).json({
        error: "Failed to optimize multi-camp allocation",
        details: error.message,
      });
    }
  },
);

router.post(
  "/create-plans",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const optimizerResult = await optimizeMultiCampAllocation(req.body || {});
      const created = [];

      for (const plan of optimizerResult.plans || []) {
        const itemList = [];

        for (const allocation of plan.item_allocations || []) {
          for (const selected of allocation.resources || []) {
            if (Number(selected.quantity || 0) <= 0) continue;

            const resource = await Resource.findById(selected.resource_id).session(session);
            if (!resource) {
              throw new Error(`Resource not found for ${selected.resource_name}`);
            }
            if (Number(resource.available_quantity || 0) < Number(selected.quantity || 0)) {
              throw new Error(`Insufficient stock for ${resource.resource_name}`);
            }

            resource.allocated_quantity += Number(selected.quantity || 0);
            await resource.save({ session });

            itemList.push({
              item_name: resource.resource_name,
              item_type: resource.resource_type,
              quantity: Number(selected.quantity || 0),
              unit: resource.unit || selected.unit || "units",
            });
          }
        }

        if (itemList.length === 0) continue;

        const [distribution] = await Distribution.create(
          [
            {
              camp_id: plan.camp_id,
              route_id: plan.route_id || null,
              priority_level: plan.priority_level || "Medium",
              delivery_method: plan.delivery_recommendation?.method || "truck",
              item_list: itemList,
              status: "Pending",
              notes: [
                "Created from multi-camp optimizer.",
                plan.delivery_recommendation?.label,
                plan.delivery_recommendation?.reason,
                `Allocation score: ${plan.allocation_score}. Equity score: ${plan.equity_score}.`,
              ].filter(Boolean).join(" "),
              priority_before_delivery: plan.priority_score ?? null,
            },
          ],
          { session },
        );

        created.push({
          distribution_id: distribution._id,
          camp_id: plan.camp_id,
          camp_name: plan.camp_name,
          delivery_method: distribution.delivery_method,
          item_count: itemList.length,
          allocation_score: plan.allocation_score,
        });
      }

      await session.commitTransaction();

      const recalculations = await Promise.allSettled(
        created.map((item) =>
          tryRecalculateCampPriority(item.camp_id, "optimized_distribution_plan_created"),
        ),
      );

      res.status(201).json({
        status: "success",
        data: {
          created,
          optimizer_summary: optimizerResult.summary,
          skipped: optimizerResult.skipped,
          recalculated: recalculations.filter((item) => item.status === "fulfilled").length,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({
        error: "Failed to create optimized distribution plans",
        details: error.message,
      });
    } finally {
      session.endSession();
    }
  },
);

export { router as allocationOptimizerRouter };
