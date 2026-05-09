export const HUMANITARIAN_STANDARDS = {
  planningDays: 2,
  foodPacksPerPersonPerDay: 1,
  waterLitresPerPersonPerDay: 15,
  peoplePerSanitaryKit: 5,
  sanitaryKitCoverageDays: 14,
  peoplePerMedicineKit: 1000,
  medicineKitCoverageDays: 90,
};

export const PRIORITY_VALUES = { Low: 1, Medium: 2, High: 3 };

export const priorityRank = (priority) => PRIORITY_VALUES[priority] || 1;

export const maxPriority = (...priorities) =>
  priorities.reduce(
    (highest, priority) =>
      priorityRank(priority) > priorityRank(highest) ? priority : highest,
    "Low",
  );

export const shortage = (required, available) =>
  Math.max(0, Math.ceil(required - (available || 0)));

export const coveragePriority = (available, required) => {
  if (required <= 0) return "Low";
  const coverageRatio = (available || 0) / required;
  if (coverageRatio < 0.5) return "High";
  if (coverageRatio < 1) return "Medium";
  return "Low";
};

export const vulnerablePopulationRatio = (camp) => {
  const population = camp.population || 1;
  return ((camp.children_count || 0) + (camp.elderly_count || 0)) / population;
};

export const calculateStandardRequirements = (camp) => {
  const population = camp.population || 0;
  const {
    planningDays,
    foodPacksPerPersonPerDay,
    waterLitresPerPersonPerDay,
    peoplePerSanitaryKit,
    sanitaryKitCoverageDays,
    peoplePerMedicineKit,
    medicineKitCoverageDays,
  } = HUMANITARIAN_STANDARDS;

  return {
    food: population * foodPacksPerPersonPerDay * planningDays,
    water: population * waterLitresPerPersonPerDay * planningDays,
    medicine: Math.ceil(
      (population * planningDays) /
        (peoplePerMedicineKit * medicineKitCoverageDays),
    ),
    sanitary: Math.ceil(
      (population * planningDays) /
        (peoplePerSanitaryKit * sanitaryKitCoverageDays),
    ),
  };
};

export const applyContextualEscalation = (priority, context) => {
  const { category, diseaseRisk, vulnerableRatio, roadAccessStatus } = context;
  let escalated = priority;

  if (
    ["medicine", "sanitary", "water"].includes(category) &&
    diseaseRisk === "High"
  ) {
    escalated = maxPriority(escalated, "High");
  } else if (
    ["medicine", "sanitary", "water"].includes(category) &&
    diseaseRisk === "Medium"
  ) {
    escalated = maxPriority(escalated, "Medium");
  }

  if (["food", "water", "medicine"].includes(category) && vulnerableRatio > 0.4) {
    escalated = maxPriority(escalated, "Medium");
  }

  if (roadAccessStatus === "Blocked" && escalated !== "Low") {
    escalated = maxPriority(escalated, "High");
  } else if (roadAccessStatus === "Limited" && escalated === "Medium") {
    escalated = maxPriority(escalated, "High");
  }

  return escalated;
};

export const operationalPriority = ({
  category,
  mlPriority,
  available,
  required,
  diseaseRisk,
  vulnerableRatio,
  roadAccessStatus,
}) => {
  const missingQty = shortage(required, available);
  if (missingQty === 0) return "Low";

  const standardsPriority = coveragePriority(available, required);
  const combinedPriority = maxPriority(standardsPriority, mlPriority || "Low");

  return applyContextualEscalation(combinedPriority, {
    category,
    diseaseRisk,
    vulnerableRatio,
    roadAccessStatus,
  });
};
