import NeedReport from "../models/NeedReport.js";

const SEVERITY_WEIGHT = {
  Low: 3,
  Medium: 6,
  High: 10,
  Critical: 16,
  Emergency: 22,
};

const NEED_TYPE_WEIGHT = {
  Food: 6,
  Water: 8,
  Medical: 10,
  Rescue: 14,
  Shelter: 5,
  "Road Blockage": 12,
  "Flood Level": 12,
  Other: 4,
};

const NEED_TO_ITEM_PRIORITY = {
  Food: "food_priority",
  Water: "water_priority",
  Medical: "medicine_priority",
};

const maxPriority = (current, next) => {
  const rank = { Low: 1, Medium: 2, High: 3 };
  return rank[next] > rank[current] ? next : current;
};

export async function calculateNeedReportImpact(campId) {
  if (!campId) {
    return {
      impact_score: 0,
      active_reports: 0,
      emergency_reports: 0,
      clustered_reports: 0,
      reasons: [],
    };
  }

  const reports = await NeedReport.find({
    camp_id: campId,
    status: { $in: ["Pending", "In Progress", "Responded"] },
  }).lean();

  let rawScore = 0;
  const reasons = [];
  const typeCounts = {};
  let affectedPeople = 0;

  for (const report of reports) {
    const severityScore = SEVERITY_WEIGHT[report.severity] || 6;
    const typeScore = NEED_TYPE_WEIGHT[report.need_type] || 4;
    const peopleScore = Math.min(Number(report.people_count || 1) * 0.25, 8);
    const reportScore = severityScore + typeScore + peopleScore;

    rawScore += reportScore;
    affectedPeople += Number(report.people_count || 0);
    typeCounts[report.need_type] = (typeCounts[report.need_type] || 0) + 1;

    if (["Critical", "Emergency"].includes(report.severity)) {
      reasons.push({
        factor: "need_report_impact_score",
        severity: "High",
        message: `${report.severity} ${report.need_type} request`,
        detail: `${report.people_count || 1} people affected; unresolved citizen report increases urgency.`,
        score: Math.round(Math.min(reportScore, 100)),
      });
    }
  }

  const clusteredReports = Object.entries(typeCounts).filter(([, count]) => count >= 3);
  for (const [needType, count] of clusteredReports) {
    rawScore += Number(count) * 4;
    reasons.push({
      factor: "need_report_cluster",
      severity: "Medium",
      message: `Clustered ${needType} reports`,
      detail: `${count} unresolved reports of the same type indicate repeated field demand.`,
      score: Math.min(100, Number(count) * 12),
    });
  }

  const impactScore = Math.round(Math.min(rawScore, 100));

  return {
    impact_score: impactScore,
    active_reports: reports.length,
    emergency_reports: reports.filter((report) =>
      ["Critical", "Emergency"].includes(report.severity),
    ).length,
    affected_people: affectedPeople,
    clustered_reports: clusteredReports.length,
    type_counts: typeCounts,
    reasons: reasons.slice(0, 5),
  };
}

export async function applyNeedReportImpactToPrediction(campId, prediction) {
  const impact = await calculateNeedReportImpact(campId);
  if (!impact.impact_score) {
    return {
      ...prediction,
      need_report_impact: impact,
    };
  }

  const impactBoost = Math.min(20, Math.round(impact.impact_score * 0.2));
  const boostedScore = Math.min(100, Number(prediction.priority_score || 0) + impactBoost);
  const priorityLevel = boostedScore >= 70 ? "High" : boostedScore >= 45 ? "Medium" : "Low";
  const reliefPriorities = { ...prediction };

  for (const needType of Object.keys(impact.type_counts || {})) {
    const itemKey = NEED_TO_ITEM_PRIORITY[needType];
    if (itemKey && impact.type_counts[needType] >= 2) {
      reliefPriorities[itemKey] = maxPriority(reliefPriorities[itemKey] || "Low", "High");
    }
  }

  return {
    ...prediction,
    ...reliefPriorities,
    camp_priority: priorityLevel,
    priority_level: priorityLevel,
    priority_score: boostedScore,
    urgency_score: boostedScore,
    urgency_band: boostedScore >= 70 ? "Critical" : boostedScore >= 45 ? "Moderate" : "Stable",
    factors: {
      ...(prediction.factors || {}),
      need_report_impact_score: impact.impact_score,
    },
    explanations: [
      ...(prediction.explanations || []),
      ...impact.reasons,
    ].slice(0, 8),
    need_report_impact: {
      ...impact,
      applied_boost: impactBoost,
    },
  };
}
