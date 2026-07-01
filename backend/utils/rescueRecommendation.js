export function buildRescueRecommendation({ camp, prediction, needImpact = {}, route = null }) {
  const score = Number(prediction?.priority_score ?? camp?.priority_score ?? 0);
  const vulnerableCount =
    Number(camp?.children_count || 0) +
    Number(camp?.elderly_count || 0) +
    Number(camp?.infants_count || 0) +
    Number(camp?.pregnant_women_count || 0) +
    Number(camp?.disabled_people_count || 0) +
    Number(camp?.chronic_patients_count || 0);
  const population = Math.max(Number(camp?.population || 0), 1);
  const vulnerableRatio = vulnerableCount / population;
  const roadBlocked =
    camp?.road_access_status === "Blocked" ||
    route?.route_status === "Blocked" ||
    route?.route_status === "Flooded";
  const emergencyReports = Number(needImpact?.emergency_reports || 0);
  const rescueReports = Number(needImpact?.type_counts?.Rescue || 0);
  const floodReports = Number(needImpact?.type_counts?.["Flood Level"] || 0);
  const medicalHigh = prediction?.medicine_priority === "High";
  const waterHigh = prediction?.water_priority === "High";

  if ((roadBlocked && score >= 75 && emergencyReports > 0) || rescueReports >= 2) {
    return {
      mode: "Evacuation Support",
      severity: "Critical",
      recommended_team: "rescue_team",
      delivery_method: roadBlocked ? "boat" : "truck",
      reason:
        "Blocked access or repeated rescue reports combined with high urgency requires evacuation or rescue support.",
    };
  }

  if (floodReports >= 2 || (roadBlocked && score >= 65)) {
    return {
      mode: "Rescue Team Required",
      severity: "High",
      recommended_team: "rescue_team",
      delivery_method: roadBlocked ? "boat" : "truck",
      reason:
        "Flood/access risk is high enough that ration delivery should be coordinated with a rescue team.",
    };
  }

  if (medicalHigh || (vulnerableRatio >= 0.45 && emergencyReports > 0)) {
    return {
      mode: "Medical Team Required",
      severity: "High",
      recommended_team: "medical_team",
      delivery_method: roadBlocked ? "boat" : "truck",
      reason:
        "Medical priority or vulnerable population pressure indicates the need for health support during delivery.",
    };
  }

  if (waterHigh && score >= 60) {
    return {
      mode: "Urgent Ration Delivery",
      severity: "Medium",
      recommended_team: "relief_team",
      delivery_method: roadBlocked ? "boat" : "truck",
      reason:
        "Water shortage and camp urgency are high; prioritize immediate relief dispatch.",
    };
  }

  return {
    mode: "Standard Ration Delivery",
    severity: score >= 45 ? "Medium" : "Low",
    recommended_team: "relief_team",
    delivery_method: roadBlocked ? "boat" : "truck",
    reason:
      "Current signals indicate ration distribution is sufficient with routine monitoring.",
  };
}
