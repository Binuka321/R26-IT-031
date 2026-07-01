import {
  PRIORITY_VALUES,
  calculateStandardRequirements,
  shortage,
} from "./humanitarianStandards.js";

const overallUrgency = (priorities) => {
  const averagePriority =
    priorities.reduce(
      (total, priority) => total + (PRIORITY_VALUES[priority] || 1),
      0,
    ) / priorities.length;

  if (averagePriority >= 2.5) return "High";
  if (averagePriority >= 1.5) return "Medium";
  return "Low";
};

const coverageRatio = (available, required) => {
  if (required <= 0) return 1;
  return Math.round((Number(available || 0) / required) * 100) / 100;
};

export const buildMlItemPriorityData = (camp, result) => {
  const requirements = calculateStandardRequirements(camp);
  const recommendedFoodQty = shortage(requirements.food, camp.food_available);
  const recommendedWaterQty = shortage(requirements.water, camp.water_available);
  const recommendedMedicineQty = shortage(
    requirements.medicine,
    camp.medicine_available,
  );
  const recommendedSanitaryQty = shortage(
    requirements.sanitary,
    camp.sanitary_available,
  );

  const foodPriority = result.food_priority || "Low";
  const waterPriority = result.water_priority || "Low";
  const medicinePriority = result.medicine_priority || "Low";
  const sanitaryPriority = result.sanitary_priority || "Low";

  return {
    camp_id: camp._id,
    food_priority: foodPriority,
    water_priority: waterPriority,
    medicine_priority: medicinePriority,
    sanitary_priority: sanitaryPriority,
    recommended_food_qty: recommendedFoodQty,
    recommended_water_qty: recommendedWaterQty,
    recommended_medicine_qty: recommendedMedicineQty,
    recommended_sanitary_qty: recommendedSanitaryQty,
    required_food_qty: requirements.food,
    required_water_qty: requirements.water,
    required_medicine_qty: requirements.medicine,
    required_sanitary_qty: requirements.sanitary,
    available_food_qty: Number(camp.food_available || 0),
    available_water_qty: Number(camp.water_available || 0),
    available_medicine_qty: Number(camp.medicine_available || 0),
    available_sanitary_qty: Number(camp.sanitary_available || 0),
    coverage: {
      food: coverageRatio(camp.food_available, requirements.food),
      water: coverageRatio(camp.water_available, requirements.water),
      medicine: coverageRatio(camp.medicine_available, requirements.medicine),
      sanitary: coverageRatio(camp.sanitary_available, requirements.sanitary),
    },
    overall_urgency: overallUrgency([
      foodPriority,
      waterPriority,
      medicinePriority,
      sanitaryPriority,
    ]),
    notes:
      "ML prediction trained from Sphere/WHO-aligned minimum coverage labels",
  };
};
