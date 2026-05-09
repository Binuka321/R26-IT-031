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
