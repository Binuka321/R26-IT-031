import {
  PRIORITY_VALUES,
  calculateStandardRequirements,
  operationalPriority,
  shortage,
  vulnerablePopulationRatio,
} from "./humanitarianStandards.js";

/**
 * Rule-based fallback relief item prioritization.
 * Uses humanitarian minimum coverage standards and context escalation.
 */
export class ItemPriorityEngine {
  static calculateItemPriorities(camp, diseaseData = null) {
    const requirements = calculateStandardRequirements(camp);
    const diseaseRisk =
      diseaseData?.risk_level || camp.disease_risk_level || "Low";
    const vulnerableRatio = vulnerablePopulationRatio(camp);
    const roadAccessStatus = camp.road_access_status || "Good";
    const sharedContext = { diseaseRisk, vulnerableRatio, roadAccessStatus };

    const recommended_food_qty = shortage(
      requirements.food,
      camp.food_available,
    );
    const recommended_water_qty = shortage(
      requirements.water,
      camp.water_available,
    );
    const recommended_medicine_qty = shortage(
      requirements.medicine,
      camp.medicine_available,
    );
    const recommended_sanitary_qty = shortage(
      requirements.sanitary,
      camp.sanitary_available,
    );

    const food_priority = operationalPriority({
      category: "food",
      available: camp.food_available,
      required: requirements.food,
      ...sharedContext,
    });
    const water_priority = operationalPriority({
      category: "water",
      available: camp.water_available,
      required: requirements.water,
      ...sharedContext,
    });
    const medicine_priority = operationalPriority({
      category: "medicine",
      available: camp.medicine_available,
      required: requirements.medicine,
      ...sharedContext,
    });
    const sanitary_priority = operationalPriority({
      category: "sanitary",
      available: camp.sanitary_available,
      required: requirements.sanitary,
      ...sharedContext,
    });

    const avgPriority =
      (PRIORITY_VALUES[food_priority] +
        PRIORITY_VALUES[water_priority] +
        PRIORITY_VALUES[medicine_priority] +
        PRIORITY_VALUES[sanitary_priority]) /
      4;

    let overall_urgency = "Low";
    if (avgPriority >= 2.5) overall_urgency = "High";
    else if (avgPriority >= 1.5) overall_urgency = "Medium";

    return {
      food_priority,
      water_priority,
      medicine_priority,
      sanitary_priority,
      recommended_food_qty,
      recommended_water_qty,
      recommended_medicine_qty,
      recommended_sanitary_qty,
      overall_urgency,
      notes: this._generateNotes(
        food_priority,
        water_priority,
        medicine_priority,
        sanitary_priority,
        diseaseRisk,
      ),
    };
  }

  static _generateNotes(food, water, medicine, sanitary, diseaseRisk) {
    const notes = [];
    if (food === "High") notes.push("Critical food coverage gap");
    if (water === "High") notes.push("Critical WASH water coverage gap");
    if (medicine === "High") notes.push("Urgent health kit coverage gap");
    if (sanitary === "High") notes.push("Urgent hygiene kit coverage gap");
    if (diseaseRisk === "High") notes.push("High disease risk escalation");
    return notes.join(". ") || "Minimum coverage currently met";
  }
}

export default ItemPriorityEngine;
