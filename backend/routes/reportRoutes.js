import express from "express";
import Camp from "../models/Camp.js";
import Distribution from "../models/Distribution.js";
import Resource from "../models/Resource.js";
import Route from "../models/Route.js";
import SafeZone from "../models/SafeZone.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/camp-priority", authenticate, async (req, res) => {
  try {
    const { include_seed } = req.query;
    const baseCampFilter = { status: "Active" };
    if (include_seed !== "true") baseCampFilter.created_by = { $ne: null };
    const camps = await Camp.find(baseCampFilter)
      .populate("safe_zone_id", "name")
      .sort({ priority_score: -1 });
    const report = camps.map((c) => ({
      camp_name: c.camp_name,
      safe_zone: c.safe_zone_id?.name || "N/A",
      population: c.population,
      priority_level: c.priority_level,
      priority_score: c.priority_score,
      disease_risk: c.disease_risk_level,
      food: c.food_available,
      water: c.water_available,
      medicine: c.medicine_available,
      sanitary: c.sanitary_available,
    }));
    res.json({ status: "success", data: report, generated_at: new Date() });
  } catch (error) {
    res.status(500).json({ error: "Report failed", details: error.message });
  }
});

router.get("/resources", authenticate, async (req, res) => {
  try {
    const { include_seed } = req.query;
    const resourceFilter = {};
    if (include_seed !== "true") resourceFilter.created_by = { $ne: null };
    const resources = await Resource.find(resourceFilter).sort({
      resource_type: 1,
    });
    const report = resources.map((r) => ({
      name: r.resource_name,
      type: r.resource_type,
      total: r.total_quantity,
      allocated: r.allocated_quantity,
      available: r.available_quantity,
      unit: r.unit,
      low_stock: r.available_quantity <= r.low_stock_threshold,
    }));
    res.json({ status: "success", data: report, generated_at: new Date() });
  } catch (error) {
    res.status(500).json({ error: "Report failed", details: error.message });
  }
});

router.get("/distributions", authenticate, async (req, res) => {
  try {
    const dists = await Distribution.find()
      .populate("camp_id", "camp_name")
      .populate("assigned_team_id", "name")
      .sort({ created_at: -1 });
    const total = dists.length;
    const pending = dists.filter((d) => d.status === "Pending").length;
    const delivered = dists.filter((d) => d.status === "Delivered").length;
    const failed = dists.filter((d) => d.status === "Failed").length;
    res.json({
      status: "success",
      data: { total, pending, delivered, failed, distributions: dists },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Report failed", details: error.message });
  }
});

router.get("/routes", authenticate, async (req, res) => {
  try {
    const { include_seed } = req.query;
    const routeFilter = {};
    if (include_seed !== "true") routeFilter.created_by = { $ne: null };
    const routes = await Route.find(routeFilter).populate(
      "camp_id",
      "camp_name",
    );
    const avgSafety =
      routes.length > 0
        ? Math.round(
            routes.reduce((s, r) => s + r.safety_score, 0) / routes.length,
          )
        : 0;
    res.json({
      status: "success",
      data: {
        total_routes: routes.length,
        avg_safety_score: avgSafety,
        blocked: routes.filter((r) => r.route_status === "Blocked").length,
        active: routes.filter((r) => r.route_status === "Active").length,
        routes,
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Report failed", details: error.message });
  }
});

// Dashboard summary combining all stats
router.get("/dashboard", authenticate, async (req, res) => {
  try {
    const { include_seed } = req.query;
    const baseFilter = {};
    if (include_seed !== "true") baseFilter.created_by = { $ne: null };

    const totalSafeZones = await SafeZone.countDocuments(
      include_seed === "true" ? {} : { created_by: { $ne: null } },
    );
    const totalCamps = await Camp.countDocuments(baseFilter);
    const highPriority = await Camp.countDocuments({
      ...baseFilter,
      priority_level: "High",
    });
    const medPriority = await Camp.countDocuments({
      ...baseFilter,
      priority_level: "Medium",
    });
    const lowPriority = await Camp.countDocuments({
      ...baseFilter,
      priority_level: "Low",
    });
    const totalDist = await Distribution.countDocuments();
    const pendingDist = await Distribution.countDocuments({
      status: "Pending",
    });
    const deliveredDist = await Distribution.countDocuments({
      status: "Delivered",
    });
    const camps = await Camp.find(baseFilter);
    const totalPop = camps.reduce((s, c) => s + (c.population || 0), 0);
    const resources = await Resource.find(baseFilter);
    const totalFood = resources
      .filter((r) => r.resource_type === "food")
      .reduce((s, r) => s + r.available_quantity, 0);
    const totalWater = resources
      .filter((r) => r.resource_type === "water")
      .reduce((s, r) => s + r.available_quantity, 0);
    const totalMedicine = resources
      .filter((r) => r.resource_type === "medicine")
      .reduce((s, r) => s + r.available_quantity, 0);
    const totalSanitary = resources
      .filter((r) => r.resource_type === "sanitary")
      .reduce((s, r) => s + r.available_quantity, 0);

    res.json({
      status: "success",
      data: {
        totalSafeZones,
        totalCamps,
        highPriority,
        medPriority,
        lowPriority,
        totalPopulation: totalPop,
        totalDistributions: totalDist,
        pendingDistributions: pendingDist,
        completedDistributions: deliveredDist,
        totalFood,
        totalWater,
        totalMedicine,
        totalSanitary,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Dashboard failed", details: error.message });
  }
});

export { router as reportRouter };
