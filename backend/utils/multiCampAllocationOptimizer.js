import Camp from "../models/Camp.js";
import ItemPriority from "../models/ItemPriority.js";
import PriorityPrediction from "../models/PriorityPrediction.js";
import Resource from "../models/Resource.js";
import Route from "../models/Route.js";
import Distribution from "../models/Distribution.js";

const RESOURCE_TYPES = ["food", "water", "medicine", "sanitary"];

const RECOMMENDED_QTY_FIELD = {
  food: "recommended_food_qty",
  water: "recommended_water_qty",
  medicine: "recommended_medicine_qty",
  sanitary: "recommended_sanitary_qty",
};

const PRIORITY_WEIGHT = { High: 1.2, Medium: 1, Low: 0.75 };

const roundQty = (value) => Math.max(0, Math.floor(Number(value || 0)));

const routeMultiplier = (route) => {
  if (!route) return 0.7;
  if (route.route_status === "Blocked" || route.route_status === "Flooded") return 0.25;
  if (route.safety_score >= 80) return 1;
  if (route.safety_score >= 50) return 0.75;
  return 0.45;
};

const fuelRequired = (route) => {
  if (!route) return 8;
  return Math.max(2, Number(route.distance || 0) * 0.35);
};

const expiryMultiplier = (resource) => {
  if (!resource.expiry_date) return 1;
  const daysUntilExpiry =
    (new Date(resource.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry <= 7) return 1.25;
  if (daysUntilExpiry <= 30) return 1.1;
  return 1;
};

function groupResourcesByType(resources) {
  const grouped = new Map();
  for (const type of RESOURCE_TYPES) grouped.set(type, []);

  for (const resource of resources) {
    if (!grouped.has(resource.resource_type)) continue;
    const available = Number(resource.available_quantity ?? resource.total_quantity - resource.allocated_quantity);
    if (available <= 0) continue;
    grouped.get(resource.resource_type).push({
      resource_id: resource._id,
      resource_name: resource.resource_name,
      resource_type: resource.resource_type,
      available_quantity: available,
      unit: resource.unit || "units",
      expiry_date: resource.expiry_date,
      expiry_multiplier: expiryMultiplier(resource),
    });
  }

  for (const type of RESOURCE_TYPES) {
    grouped.get(type).sort((a, b) => {
      if (!a.expiry_date && !b.expiry_date) return 0;
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
    });
  }

  return grouped;
}

function takeFromResourcePool(pool, requestedQty) {
  let remaining = roundQty(requestedQty);
  const allocations = [];

  for (const resource of pool) {
    if (remaining <= 0) break;
    const qty = Math.min(remaining, roundQty(resource.available_quantity));
    if (qty <= 0) continue;
    resource.available_quantity -= qty;
    remaining -= qty;
    allocations.push({
      resource_id: resource.resource_id,
      resource_name: resource.resource_name,
      quantity: qty,
      unit: resource.unit,
      expiry_date: resource.expiry_date,
      fifo_reason: resource.expiry_date
        ? "Selected early because this batch expires sooner"
        : "Selected from available stock",
    });
  }

  return {
    allocated_quantity: requestedQty - remaining,
    unmet_quantity: remaining,
    resources: allocations,
  };
}

export async function optimizeMultiCampAllocation(options = {}) {
  const {
    max_camps = 10,
    trucks_available = 5,
    truck_capacity_units = 1000,
    fuel_litres_available = 250,
    min_route_safety_score = 25,
    equity_weight = 20,
  } = options;

  const [camps, itemPriorities, predictions, resources, routes, distributions] = await Promise.all([
    Camp.find({ status: "Active" }).lean(),
    ItemPriority.find().lean(),
    PriorityPrediction.find().lean(),
    Resource.find().lean(),
    Route.find().sort({ safety_score: -1, distance: 1 }).lean(),
    Distribution.find().lean(),
  ]);

  const itemPriorityByCamp = new Map(itemPriorities.map((item) => [String(item.camp_id), item]));
  const predictionByCamp = new Map(predictions.map((item) => [String(item.camp_id), item]));
  const routeByCamp = new Map();
  for (const route of routes) {
    const campId = String(route.camp_id);
    if (!routeByCamp.has(campId)) routeByCamp.set(campId, route);
  }
  const distributionsByCamp = new Map();
  for (const distribution of distributions) {
    const campId = String(distribution.camp_id);
    const list = distributionsByCamp.get(campId) || [];
    list.push(distribution);
    distributionsByCamp.set(campId, list);
  }

  const resourcePools = groupResourcesByType(resources);
  let trucksRemaining = Number(trucks_available);
  let fuelRemaining = Number(fuel_litres_available);

  const candidates = camps
    .map((camp) => {
      const campId = String(camp._id);
      const itemPriority = itemPriorityByCamp.get(campId);
      const prediction = predictionByCamp.get(campId);
      const route = routeByCamp.get(campId);
      const campDistributions = distributionsByCamp.get(campId) || [];
      const requested = {};
      let totalRequested = 0;

      for (const type of RESOURCE_TYPES) {
        const qty = roundQty(itemPriority?.[RECOMMENDED_QTY_FIELD[type]]);
        requested[type] = qty;
        totalRequested += qty;
      }

      const priorityScore = Number(prediction?.priority_score ?? camp.priority_score ?? 0);
      const vulnerableCount =
        Number(camp.children_count || 0) +
        Number(camp.elderly_count || 0) +
        Number(camp.infants_count || 0) +
        Number(camp.pregnant_women_count || 0) +
        Number(camp.disabled_people_count || 0) +
        Number(camp.chronic_patients_count || 0);
      const vulnerableRatio = camp.population > 0 ? vulnerableCount / camp.population : 0;
      const completedCycles = campDistributions.filter((dist) =>
        ["Delivered", "Partial"].includes(dist.status),
      ).length;
      const failedOrPartialCycles = campDistributions.filter((dist) =>
        ["Failed", "Partial"].includes(dist.status),
      ).length;
      const equityScore = Math.min(
        100,
        vulnerableRatio * 70 +
          (completedCycles === 0 ? 20 : 0) +
          Math.min(failedOrPartialCycles * 8, 20),
      );
      const safetyMultiplier = routeMultiplier(route);
      const demandScore = totalRequested > 0 ? Math.min(totalRequested / 1000, 1) * 20 : 0;
      const weightedScore =
        priorityScore * (PRIORITY_WEIGHT[camp.priority_level] || 1)
        + demandScore
        + (safetyMultiplier * 15)
        + (equityScore * (Number(equity_weight) / 100));

      return {
        camp,
        itemPriority,
        prediction,
        route,
        requested,
        totalRequested,
        weightedScore,
        safetyMultiplier,
        fuelNeed: fuelRequired(route),
        equityScore,
      };
    })
    .filter((candidate) => candidate.totalRequested > 0)
    .filter((candidate) => !candidate.route || candidate.route.safety_score >= Number(min_route_safety_score))
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, Number(max_camps));

  const plans = [];
  const skipped = [];

  for (const candidate of candidates) {
    if (trucksRemaining <= 0) {
      skipped.push({
        camp_id: candidate.camp._id,
        camp_name: candidate.camp.camp_name,
        reason: "No trucks remaining",
      });
      continue;
    }

    if (fuelRemaining < candidate.fuelNeed) {
      skipped.push({
        camp_id: candidate.camp._id,
        camp_name: candidate.camp.camp_name,
        reason: "Insufficient fuel for safest available route",
        fuel_required: Math.round(candidate.fuelNeed * 10) / 10,
      });
      continue;
    }

    let vehicleCapacityRemaining = Number(truck_capacity_units);
    const itemAllocations = [];

    for (const type of RESOURCE_TYPES) {
      if (vehicleCapacityRemaining <= 0) break;
      const requestedQty = candidate.requested[type];
      if (requestedQty <= 0) continue;

      const pool = resourcePools.get(type);
      const adjustedRequest = Math.min(requestedQty, vehicleCapacityRemaining);
      const result = takeFromResourcePool(pool, adjustedRequest);
      vehicleCapacityRemaining -= result.allocated_quantity;

      if (result.allocated_quantity > 0 || result.unmet_quantity > 0) {
        itemAllocations.push({
          resource_type: type,
          requested_quantity: requestedQty,
          allocated_quantity: result.allocated_quantity,
          unmet_quantity: requestedQty - result.allocated_quantity,
          resources: result.resources,
        });
      }
    }

    const totalAllocated = itemAllocations.reduce(
      (sum, item) => sum + item.allocated_quantity,
      0,
    );

    if (totalAllocated <= 0) {
      skipped.push({
        camp_id: candidate.camp._id,
        camp_name: candidate.camp.camp_name,
        reason: "No matching stock available",
      });
      continue;
    }

    trucksRemaining -= 1;
    fuelRemaining -= candidate.fuelNeed;

    plans.push({
      camp_id: candidate.camp._id,
      camp_name: candidate.camp.camp_name,
      priority_level: candidate.camp.priority_level,
      priority_score: Number(candidate.prediction?.priority_score ?? candidate.camp.priority_score ?? 0),
      route_id: candidate.route?._id || null,
      route_safety_score: candidate.route?.safety_score ?? null,
      route_status: candidate.route?.route_status || "Unknown",
      fuel_required_litres: Math.round(candidate.fuelNeed * 10) / 10,
      vehicle_capacity_used: totalAllocated,
      vehicle_capacity_remaining: vehicleCapacityRemaining,
      allocation_score: Math.round(candidate.weightedScore),
      equity_score: Math.round(candidate.equityScore),
      item_allocations: itemAllocations,
      notes: candidate.route
        ? "Allocation uses highest-safety available route for this camp."
        : "No route found; allocation should be field-verified before dispatch.",
    });
  }

  const remainingStock = {};
  for (const type of RESOURCE_TYPES) {
    remainingStock[type] = resourcePools
      .get(type)
      .reduce((sum, resource) => sum + roundQty(resource.available_quantity), 0);
  }

  return {
    generated_at: new Date(),
    constraints: {
      max_camps: Number(max_camps),
      trucks_available: Number(trucks_available),
      truck_capacity_units: Number(truck_capacity_units),
      fuel_litres_available: Number(fuel_litres_available),
      min_route_safety_score: Number(min_route_safety_score),
      equity_weight: Number(equity_weight),
    },
    used: {
      trucks: Number(trucks_available) - trucksRemaining,
      fuel_litres: Math.round((Number(fuel_litres_available) - fuelRemaining) * 10) / 10,
    },
    remaining: {
      trucks: trucksRemaining,
      fuel_litres: Math.round(fuelRemaining * 10) / 10,
      stock: remainingStock,
    },
    plans,
    skipped,
    summary: {
      active_camps_considered: camps.length,
      camps_with_shortfalls: candidates.length,
      camps_allocated: plans.length,
      total_allocated_quantity: plans.reduce((sum, plan) => sum + plan.vehicle_capacity_used, 0),
    },
  };
}
