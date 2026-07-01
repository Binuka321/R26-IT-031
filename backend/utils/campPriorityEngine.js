import {
  calculateStandardRequirements,
  operationalPriority,
  shortage,
} from "./humanitarianStandards.js";

const PRIORITY_TO_SCORE = { High: 100, Medium: 55, Low: 10 };
const ROAD_ACCESS_SCORE = { Good: 0, Limited: 60, Blocked: 100 };

const boundedScore = (value) =>
  Math.round(Math.max(0, Math.min(Number(value || 0), 100)));

const shortageScore = (available, required) => {
  if (required <= 0) return 0;
  return boundedScore((1 - Math.min(Number(available || 0) / required, 1)) * 100);
};

const priorityFromScore = (score) => {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
};

const urgencyBandFromScore = (score) => {
  if (score >= 70) return "Critical";
  if (score >= 45) return "Moderate";
  return "Stable";
};

export class CampPriorityEngine {
  static calculatePriority(camp) {
    const population = Number(camp.population || 0);
    const requirements = calculateStandardRequirements(camp);
    const vulnerableCount =
      Number(camp.children_count || 0) +
      Number(camp.elderly_count || 0) +
      Number(camp.infants_count || 0) +
      Number(camp.pregnant_women_count || 0) +
      Number(camp.disabled_people_count || 0) +
      Number(camp.chronic_patients_count || 0);
    const vulnerableRatio = population > 0 ? vulnerableCount / population : 0;
    const campCapacity = Math.max(Number(camp.camp_capacity || 1), 1);
    const occupancyRatio = Number(
      camp.camp_occupancy_ratio || Math.min(population / campCapacity, 1),
    );

    const itemPriorityContext = {
      diseaseRisk: camp.disease_risk_level,
      vulnerableRatio,
      roadAccessStatus: camp.road_access_status,
    };
    const foodPriority = operationalPriority({
      category: "food",
      mlPriority: "Low",
      available: camp.food_available,
      required: requirements.food,
      ...itemPriorityContext,
    });
    const waterPriority = operationalPriority({
      category: "water",
      mlPriority: "Low",
      available: camp.water_available,
      required: requirements.water,
      ...itemPriorityContext,
    });
    const medicinePriority = operationalPriority({
      category: "medicine",
      mlPriority: "Low",
      available: camp.medicine_available,
      required: requirements.medicine,
      ...itemPriorityContext,
    });
    const sanitaryPriority = operationalPriority({
      category: "sanitary",
      mlPriority: "Low",
      available: camp.sanitary_available,
      required: requirements.sanitary,
      ...itemPriorityContext,
    });

    const factors = {
      population_score: boundedScore((population / 1000) * 100),
      food_shortage_score: shortageScore(camp.food_available, requirements.food),
      water_shortage_score: shortageScore(camp.water_available, requirements.water),
      medicine_shortage_score: shortageScore(
        camp.medicine_available,
        requirements.medicine,
      ),
      sanitary_shortage_score: shortageScore(
        camp.sanitary_available,
        requirements.sanitary,
      ),
      disease_risk_score: { Low: 20, Medium: 60, High: 100 }[
        camp.disease_risk_level
      ] || 20,
      vulnerable_population_score: boundedScore(vulnerableRatio * 150),
      road_access_score: ROAD_ACCESS_SCORE[camp.road_access_status] ?? 0,
      distance_score: boundedScore(
        (Number(camp.distance_from_distribution_center || 0) / 50) * 100,
      ),
      last_distribution_score: boundedScore(
        (Number(camp.last_distribution_hours ?? 24) / 72) * 100,
      ),
      camp_occupancy_score: boundedScore(occupancyRatio * 100),
      ml_item_priority_score: boundedScore(
        (PRIORITY_TO_SCORE[foodPriority] +
          PRIORITY_TO_SCORE[waterPriority] +
          PRIORITY_TO_SCORE[medicinePriority] +
          PRIORITY_TO_SCORE[sanitaryPriority]) /
          4,
      ),
    };
    factors.resource_shortage_score = boundedScore(
      (factors.food_shortage_score +
        factors.water_shortage_score +
        factors.medicine_shortage_score +
        factors.sanitary_shortage_score) /
        4,
    );

    const priorityScore = boundedScore(
      factors.resource_shortage_score * 0.3 +
        factors.ml_item_priority_score * 0.2 +
        factors.vulnerable_population_score * 0.15 +
        factors.road_access_score * 0.15 +
        factors.last_distribution_score * 0.1 +
        factors.camp_occupancy_score * 0.05 +
        factors.distance_score * 0.05,
    );
    const priorityLevel = priorityFromScore(priorityScore);

    return {
      priority_level: priorityLevel,
      camp_priority: priorityLevel,
      priority_score: priorityScore,
      urgency_score: priorityScore,
      urgency_band: urgencyBandFromScore(priorityScore),
      confidence_score: CampPriorityEngine.calculateConfidence(camp),
      food_priority: foodPriority,
      water_priority: waterPriority,
      medicine_priority: medicinePriority,
      sanitary_priority: sanitaryPriority,
      factors,
      explanations: CampPriorityEngine.buildExplanations(camp, factors),
      requirements,
      shortfalls: {
        food: shortage(requirements.food, camp.food_available),
        water: shortage(requirements.water, camp.water_available),
        medicine: shortage(requirements.medicine, camp.medicine_available),
        sanitary: shortage(requirements.sanitary, camp.sanitary_available),
      },
      model_version: "rule_based_humanitarian_fallback_v1",
    };
  }

  static calculateConfidence(camp) {
    let score = 0;
    if (Number(camp.population || 0) > 0) score += 0.2;
    if (camp.disease_risk_level) score += 0.1;
    if (camp.road_access_status) score += 0.1;
    if (camp.food_available != null) score += 0.1;
    if (camp.water_available != null) score += 0.1;
    if (camp.medicine_available != null) score += 0.1;
    if (camp.sanitary_available != null) score += 0.1;
    if (camp.distance_from_distribution_center != null) score += 0.05;
    if (camp.last_distribution_hours != null) score += 0.1;
    if (
      Number(camp.children_count || 0) +
        Number(camp.elderly_count || 0) +
        Number(camp.infants_count || 0) +
        Number(camp.pregnant_women_count || 0) +
        Number(camp.disabled_people_count || 0) +
        Number(camp.chronic_patients_count || 0) >
      0
    ) {
      score += 0.05;
    }
    return Math.round(score * 100) / 100;
  }

  static buildExplanations(camp, factors) {
    const explanations = [];
    const addShortage = (key, message, detail) => {
      const score = factors[key] || 0;
      if (score >= 70) {
        explanations.push({ factor: key, severity: "High", message, detail, score });
      } else if (score >= 40) {
        explanations.push({
          factor: key,
          severity: "Medium",
          message: message.replace("Critical", "Moderate"),
          detail,
          score,
        });
      }
    };

    addShortage(
      "water_shortage_score",
      "Critical water shortage",
      "Water stock is below the two-day minimum planning requirement.",
    );
    addShortage(
      "food_shortage_score",
      "Critical food shortage",
      "Food packs are below the two-day minimum planning requirement.",
    );
    addShortage(
      "medicine_shortage_score",
      "Critical medicine shortage",
      "Medicine kit coverage is below the camp requirement.",
    );
    addShortage(
      "sanitary_shortage_score",
      "Critical sanitary shortage",
      "Sanitary kit coverage is below the camp requirement.",
    );

    if (factors.vulnerable_population_score >= 70) {
      explanations.push({
        factor: "vulnerable_population_score",
        severity: "High",
        message: "High vulnerable population",
        detail:
          "Children, elderly people, infants, pregnant women, disabled people, or chronic patients increase relief urgency.",
        score: factors.vulnerable_population_score,
      });
    }

    if (camp.road_access_status === "Blocked" || camp.road_access_status === "Limited") {
      explanations.push({
        factor: "road_access_score",
        severity: camp.road_access_status === "Blocked" ? "High" : "Medium",
        message:
          camp.road_access_status === "Blocked"
            ? "Road access is blocked"
            : "Road access is limited",
        detail:
          "Delivery needs route verification and may require alternative transport planning.",
        score: factors.road_access_score,
      });
    }

    if (factors.last_distribution_score >= 70) {
      explanations.push({
        factor: "last_distribution_score",
        severity: "High",
        message: "Delayed ration distribution",
        detail: `Last distribution was about ${Math.round(
          camp.last_distribution_hours ?? 24,
        )} hours ago.`,
        score: factors.last_distribution_score,
      });
    }

    return explanations.length
      ? explanations.slice(0, 6)
      : [
          {
            factor: "overall",
            severity: "Low",
            message: "No critical shortage factor detected",
            detail:
              "Current camp inputs do not show a severe shortage, access, or vulnerability trigger.",
            score: 0,
          },
        ];
  }

  static calculateBatchPriority(camps) {
    return camps.map((camp) => ({
      camp_id: camp._id,
      camp_name: camp.camp_name,
      ...this.calculatePriority(camp),
    }));
  }

  static rankCamps(campPriorities) {
    return [...campPriorities].sort((a, b) => b.priority_score - a.priority_score);
  }
}

export default CampPriorityEngine;
