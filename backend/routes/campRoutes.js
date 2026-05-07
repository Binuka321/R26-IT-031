import express from "express";
import Camp from "../models/Camp.js";
import SafeZone from "../models/SafeZone.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
const validRoadAccessStatuses = ["Good", "Limited", "Blocked"];

function validateCampNeedFields(data) {
  const population = Number(data.population || 0);
  const children = Number(data.children_count || 0);
  const elderly = Number(data.elderly_count || 0);
  const campCapacity = Number(data.camp_capacity || 0);
  const distance = Number(data.distance_from_distribution_center || 0);

  if (population <= 0) return "Population must be greater than 0";
  if (children < 0) return "Children count cannot be negative";
  if (elderly < 0) return "Elderly count cannot be negative";
  if (children + elderly > population) {
    return "Children count and elderly count cannot exceed total population";
  }
  if (campCapacity <= 0) return "Camp capacity must be greater than 0";
  if (distance < 0) return "Distance from distribution center cannot be negative";

  for (const field of [
    "food_available",
    "water_available",
    "medicine_available",
    "sanitary_available",
  ]) {
    if (Number(data[field] || 0) < 0) {
      return "Resource quantities cannot be negative";
    }
  }

  if (
    data.road_access_status &&
    !validRoadAccessStatuses.includes(data.road_access_status)
  ) {
    return "Road access status must be Good, Limited, or Blocked";
  }

  return null;
}

// Haversine helper
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST create camp (validates inside safe zone)
router.post(
  "/",
  authenticate,
  authorize("admin", "disaster_officer", "camp_coordinator"),
  async (req, res) => {
    try {
      const { safe_zone_id, latitude, longitude } = req.body;

      // Validate safe zone exists
      const safeZone = await SafeZone.findById(safe_zone_id);
      if (!safeZone) {
        return res.status(400).json({ error: "Invalid safe zone ID" });
      }

      // Check if camp location is inside the safe zone
      const dist = haversineDistance(
        latitude,
        longitude,
        safeZone.latitude,
        safeZone.longitude,
      );
      if (dist > (safeZone.radius_km || 5)) {
        return res.status(400).json({
          error: "Camp location is outside the safe zone boundary",
          distance_km: Math.round(dist * 100) / 100,
          max_radius_km: safeZone.radius_km || 5,
        });
      }

      const validationError = validateCampNeedFields(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const payload = {
        ...req.body,
        road_access_status: req.body.road_access_status || "Good",
        last_updated: new Date(),
        created_by: req.user?.id || null,
      };
      const camp = await Camp.create(payload);

      // Update safe zone population
      await SafeZone.findByIdAndUpdate(safe_zone_id, {
        $inc: { current_population: camp.population || 0 },
      });

      res.status(201).json({ status: "success", data: camp });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to create camp", details: error.message });
    }
  },
);

// GET all camps (with optional filters)
router.get("/", authenticate, async (req, res) => {
  try {
    const {
      priority_level,
      disease_risk_level,
      safe_zone_id,
      status,
      search,
      mine,
      include_seed,
    } = req.query;
    const filter = {};
    if (priority_level) filter.priority_level = priority_level;
    if (disease_risk_level) filter.disease_risk_level = disease_risk_level;
    if (safe_zone_id) filter.safe_zone_id = safe_zone_id;
    if (status) filter.status = status;
    if (search) {
      filter.camp_name = { $regex: search, $options: "i" };
    }
    if (mine === "true") {
      filter.created_by = req.user?.id;
    } else if (include_seed !== "true") {
      filter.created_by = { $ne: null };
    }

    const camps = await Camp.find(filter)
      .populate("safe_zone_id", "name safety_status")
      .sort({ priority_level: -1, updatedAt: -1 });
    res.json({ status: "success", data: camps });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch camps", details: error.message });
  }
});

// GET camps by safe zone
router.get("/safe-zone/:safeZoneId", authenticate, async (req, res) => {
  try {
    const camps = await Camp.find({
      safe_zone_id: req.params.safeZoneId,
    }).populate("safe_zone_id", "name");
    res.json({ status: "success", data: camps });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch camps", details: error.message });
  }
});

// GET camp by ID
router.get("/:id", authenticate, async (req, res) => {
  try {
    const camp = await Camp.findById(req.params.id).populate(
      "safe_zone_id",
      "name safety_status latitude longitude",
    );
    if (!camp) return res.status(404).json({ error: "Camp not found" });
    res.json({ status: "success", data: camp });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch camp", details: error.message });
  }
});

// PUT update camp
router.put(
  "/:id",
  authenticate,
  authorize("admin", "disaster_officer", "camp_coordinator"),
  async (req, res) => {
    try {
      const existingCamp = await Camp.findById(req.params.id);
      if (!existingCamp) return res.status(404).json({ error: "Camp not found" });

      const mergedData = { ...existingCamp.toObject(), ...req.body };
      const validationError = validateCampNeedFields(mergedData);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const camp = await Camp.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          road_access_status: req.body.road_access_status || "Good",
          last_updated: new Date(),
        },
        { new: true },
      ).populate("safe_zone_id", "name");

      res.json({ status: "success", data: camp });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to update camp", details: error.message });
    }
  },
);

// DELETE camp
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const camp = await Camp.findByIdAndDelete(req.params.id);
    if (!camp) return res.status(404).json({ error: "Camp not found" });

    // Decrement safe zone population
    if (camp.safe_zone_id && camp.population) {
      await SafeZone.findByIdAndUpdate(camp.safe_zone_id, {
        $inc: { current_population: -camp.population },
      });
    }

    res.json({ status: "success", message: "Camp deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete camp", details: error.message });
  }
});

// GET camp need analysis
router.get("/:id/needs", authenticate, async (req, res) => {
  try {
    const camp = await Camp.findById(req.params.id);
    if (!camp) return res.status(404).json({ error: "Camp not found" });

    const pop = camp.population || 1;
    const foodNeeded = pop * 3 * 2; // 3 packs/day for 2 days
    const waterNeeded = pop * 5 * 2; // 5 liters/day for 2 days
    const medicineNeeded = pop * 0.5;
    const sanitaryNeeded = pop * 2;

    const needs = {
      population: pop,
      children_count: camp.children_count,
      elderly_count: camp.elderly_count,
      vulnerable_ratio:
        (((camp.children_count + camp.elderly_count) / pop) * 100).toFixed(1) +
        "%",
      food: {
        available: camp.food_available,
        needed: foodNeeded,
        shortage: Math.max(0, foodNeeded - camp.food_available),
        coverage_days:
          camp.food_available > 0
            ? (camp.food_available / (pop * 3)).toFixed(1)
            : "0",
      },
      water: {
        available: camp.water_available,
        needed: waterNeeded,
        shortage: Math.max(0, waterNeeded - camp.water_available),
        coverage_days:
          camp.water_available > 0
            ? (camp.water_available / (pop * 5)).toFixed(1)
            : "0",
      },
      medicine: {
        available: camp.medicine_available,
        needed: medicineNeeded,
        shortage: Math.max(0, medicineNeeded - camp.medicine_available),
        adequacy:
          camp.medicine_available >= medicineNeeded
            ? "Adequate"
            : "Insufficient",
      },
      sanitary: {
        available: camp.sanitary_available,
        needed: sanitaryNeeded,
        shortage: Math.max(0, sanitaryNeeded - camp.sanitary_available),
        adequacy:
          camp.sanitary_available >= sanitaryNeeded
            ? "Adequate"
            : "Insufficient",
      },
      disease_risk_level: camp.disease_risk_level,
      overall_need_score: 0,
    };

    // Calculate overall need score (0-100)
    const foodScore =
      Math.min(needs.food.shortage / Math.max(foodNeeded, 1), 1) * 100;
    const waterScore =
      Math.min(needs.water.shortage / Math.max(waterNeeded, 1), 1) * 100;
    const medScore =
      Math.min(needs.medicine.shortage / Math.max(medicineNeeded, 1), 1) * 100;
    const sanScore =
      Math.min(needs.sanitary.shortage / Math.max(sanitaryNeeded, 1), 1) * 100;
    needs.overall_need_score = Math.round(
      (foodScore + waterScore + medScore + sanScore) / 4,
    );

    res.json({ status: "success", data: needs });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to calculate needs", details: error.message });
  }
});

// GET camp priority
router.get("/:id/priority", authenticate, async (req, res) => {
  try {
    const camp = await Camp.findById(req.params.id);
    if (!camp) return res.status(404).json({ error: "Camp not found" });

    // Import and use priority engine
    const { CampPriorityEngine } =
      await import("../utils/campPriorityEngine.js");
    const priority = CampPriorityEngine.calculatePriority(camp);

    res.json({
      status: "success",
      data: { camp_id: camp._id, camp_name: camp.camp_name, ...priority },
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to calculate priority", details: error.message });
  }
});

// GET dashboard stats
router.get("/stats/summary", authenticate, async (req, res) => {
  try {
    const totalCamps = await Camp.countDocuments();
    const highPriority = await Camp.countDocuments({ priority_level: "High" });
    const mediumPriority = await Camp.countDocuments({
      priority_level: "Medium",
    });
    const lowPriority = await Camp.countDocuments({ priority_level: "Low" });
    const activeCamps = await Camp.countDocuments({ status: "Active" });

    const camps = await Camp.find();
    const totalPopulation = camps.reduce(
      (sum, c) => sum + (c.population || 0),
      0,
    );
    const totalFood = camps.reduce(
      (sum, c) => sum + (c.food_available || 0),
      0,
    );
    const totalWater = camps.reduce(
      (sum, c) => sum + (c.water_available || 0),
      0,
    );
    const totalMedicine = camps.reduce(
      (sum, c) => sum + (c.medicine_available || 0),
      0,
    );
    const totalSanitary = camps.reduce(
      (sum, c) => sum + (c.sanitary_available || 0),
      0,
    );

    res.json({
      status: "success",
      data: {
        totalCamps,
        activeCamps,
        highPriority,
        mediumPriority,
        lowPriority,
        totalPopulation,
        totalFood,
        totalWater,
        totalMedicine,
        totalSanitary,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to get stats", details: error.message });
  }
});

export { router as campRouter };
