import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { optimizeMultiCampAllocation } from "../utils/multiCampAllocationOptimizer.js";

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

export { router as allocationOptimizerRouter };
