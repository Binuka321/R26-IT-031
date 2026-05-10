import express from "express";
import Camp from "../models/Camp.js";
import Distribution from "../models/Distribution.js";
import ItemPriority from "../models/ItemPriority.js";
import PriorityPrediction from "../models/PriorityPrediction.js";
import Resource from "../models/Resource.js";
import Route from "../models/Route.js";
import SafeZone from "../models/SafeZone.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/camp-priority", authenticate, authorize("admin", "disaster_officer", "camp_coordinator"), async (req, res) => {
  try {
    const { include_seed } = req.query;
    const baseCampFilter = { status: "Active" };
    if (include_seed !== "true") baseCampFilter.created_by = { $ne: null };
    const camps = await Camp.find(baseCampFilter)
      .populate("safe_zone_id", "name")
      .sort({ priority_score: -1 });
    const campIds = camps.map((camp) => camp._id);
    const predictions = await PriorityPrediction.find({
      camp_id: { $in: campIds },
    }).lean();
    const items = await ItemPriority.find({ camp_id: { $in: campIds } }).lean();
    const predictionMap = new Map(
      predictions.map((prediction) => [String(prediction.camp_id), prediction]),
    );
    const itemMap = new Map(items.map((item) => [String(item.camp_id), item]));
    const report = camps.map((c) => ({
      camp_name: c.camp_name,
      safe_zone: c.safe_zone_id?.name || "N/A",
      population: c.population,
      priority_level: c.priority_level,
      priority_score: c.priority_score,
      prediction_source:
        predictionMap.get(String(c._id))?.prediction_source || "not_generated",
      model_version: predictionMap.get(String(c._id))?.model_version || "N/A",
      confidence_score:
        predictionMap.get(String(c._id))?.confidence_score ?? "N/A",
      food_priority: itemMap.get(String(c._id))?.food_priority || "N/A",
      water_priority: itemMap.get(String(c._id))?.water_priority || "N/A",
      medicine_priority: itemMap.get(String(c._id))?.medicine_priority || "N/A",
      sanitary_priority: itemMap.get(String(c._id))?.sanitary_priority || "N/A",
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

router.get("/resources", authenticate, authorize("admin", "disaster_officer", "camp_coordinator"), async (req, res) => {
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

router.get("/distributions", authenticate, authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"), async (req, res) => {
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

router.get("/routes", authenticate, authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"), async (req, res) => {
  try {
    const { include_seed } = req.query;
    const campFilter = {};
    if (include_seed !== "true") campFilter.created_by = { $ne: null };
    const camps = await Camp.find(campFilter).select("_id");
    const campIds = camps.map((camp) => camp._id);
    const routes = await Route.find({ camp_id: { $in: campIds } }).populate(
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
        routes: routes.map((route) => ({
          camp_name: route.camp_id?.camp_name || "N/A",
          route_type: route.route_type,
          route_algorithm: route.route_algorithm,
          distance: route.distance,
          estimated_time: route.estimated_time,
          safety_score: route.safety_score,
          route_status: route.route_status,
          warnings: route.warnings?.join("; ") || "",
        })),
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
    const campIds = camps.map((camp) => camp._id);
    const itemPriorities = await ItemPriority.find({
      camp_id: { $in: campIds },
    });
    const generatedRoutes = await Route.countDocuments({
      camp_id: { $in: campIds },
    });
    const activeRoutes = await Route.countDocuments({
      camp_id: { $in: campIds },
      route_status: "Active",
    });
    const blockedRoutes = await Route.countDocuments({
      camp_id: { $in: campIds },
      route_status: "Blocked",
    });
    const criticalFoodCamps = itemPriorities.filter(
      (item) => item.food_priority === "High",
    ).length;
    const criticalWaterCamps = itemPriorities.filter(
      (item) => item.water_priority === "High",
    ).length;
    const criticalMedicineCamps = itemPriorities.filter(
      (item) => item.medicine_priority === "High",
    ).length;
    const criticalSanitaryCamps = itemPriorities.filter(
      (item) => item.sanitary_priority === "High",
    ).length;
    const resourceAvailability = resources.reduce((summary, resource) => {
      const type = resource.resource_type || "other";
      const existing = summary.get(type) || {
        type,
        total_quantity: 0,
        allocated_quantity: 0,
        available_quantity: 0,
        item_count: 0,
        low_stock_count: 0,
      };

      existing.total_quantity += resource.total_quantity || 0;
      existing.allocated_quantity += resource.allocated_quantity || 0;
      existing.available_quantity += resource.available_quantity || 0;
      existing.item_count += 1;
      if ((resource.available_quantity || 0) <= (resource.low_stock_threshold || 0)) {
        existing.low_stock_count += 1;
      }
      summary.set(type, existing);
      return summary;
    }, new Map());

    const resourceByType = Object.fromEntries(
      [...resourceAvailability.entries()].map(([type, data]) => [
        type,
        data.available_quantity,
      ]),
    );
    const totalFood = resourceByType.food || 0;
    const totalWater = resourceByType.water || 0;
    const totalMedicine = resourceByType.medicine || 0;
    const totalSanitary = resourceByType.sanitary || 0;

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
        resourceAvailability: [...resourceAvailability.values()].sort((a, b) =>
          a.type.localeCompare(b.type),
        ),
        criticalFoodCamps,
        criticalWaterCamps,
        criticalMedicineCamps,
        criticalSanitaryCamps,
        generatedRoutes,
        activeRoutes,
        blockedRoutes,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Dashboard failed", details: error.message });
  }
});

export { router as reportRouter };
