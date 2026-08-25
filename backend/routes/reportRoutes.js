import express from "express";
import Camp from "../models/Camp.js";
import Distribution from "../models/Distribution.js";
import ItemPriority from "../models/ItemPriority.js";
import PriorityPrediction from "../models/PriorityPrediction.js";
import Resource from "../models/Resource.js";
import Route from "../models/Route.js";
import SafeZone from "../models/SafeZone.js";
import NeedReport from "../models/NeedReport.js";
import PriorityHistory from "../models/PriorityHistory.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { calculateStockDepletionForecast } from "../utils/humanitarianStandards.js";
import { calculateNeedReportImpact } from "../utils/needReportImpact.js";
import { buildRescueRecommendation } from "../utils/rescueRecommendation.js";
import {
  realCampFilter,
  realDistributionFilter,
  realNeedReportFilter,
  realResourceFilter,
  realSafeZoneFilter,
} from "../utils/operationalDataFilters.js";

const router = express.Router();

router.get("/camp-priority", authenticate, authorize("admin", "disaster_officer", "camp_coordinator"), async (req, res) => {
  try {
    const { include_seed, include_demo } = req.query;
    const baseCampFilter =
      include_seed === "true" && include_demo === "true"
        ? { status: "Active" }
        : realCampFilter({ status: "Active" });
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
    const impactEntries = await Promise.all(
      camps.map(async (camp) => [
        String(camp._id),
        await calculateNeedReportImpact(camp._id),
      ]),
    );
    const impactMap = new Map(impactEntries);

    const report = camps.map((c) => {
      const depletion = calculateStockDepletionForecast(c);
      const impact = impactMap.get(String(c._id)) || {};
      return ({
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
      need_report_impact_score: impact.impact_score || 0,
      active_need_reports: impact.active_reports || 0,
      emergency_need_reports: impact.emergency_reports || 0,
      stock_runs_out_first: depletion.most_critical_item,
      minimum_stock_hours: depletion.minimum_hours_remaining,
      food_hours_remaining: depletion.food.hours_remaining,
      water_hours_remaining: depletion.water.hours_remaining,
      medicine_hours_remaining: depletion.medicine.hours_remaining,
      sanitary_hours_remaining: depletion.sanitary.hours_remaining,
      disease_risk: c.disease_risk_level,
      food: c.food_available,
      water: c.water_available,
      medicine: c.medicine_available,
      sanitary: c.sanitary_available,
      });
    });
    res.json({ status: "success", data: report, generated_at: new Date() });
  } catch (error) {
    res.status(500).json({ error: "Report failed", details: error.message });
  }
});

router.get("/resources", authenticate, authorize("admin", "disaster_officer", "camp_coordinator"), async (req, res) => {
  try {
    const { include_seed } = req.query;
    const resourceFilter = include_seed === "true" ? {} : realResourceFilter();
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
      batch_number: r.batch_number || "N/A",
      expiry_date: r.expiry_date || null,
      days_until_expiry: r.expiry_date
        ? Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      expiring_soon: r.expiry_date
        ? ((new Date(r.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 30
        : false,
      fifo_note: r.expiry_date
        ? "Optimizer prioritizes earlier-expiring batches first."
        : "No expiry date recorded.",
    }));
    res.json({ status: "success", data: report, generated_at: new Date() });
  } catch (error) {
    res.status(500).json({ error: "Report failed", details: error.message });
  }
});

router.get("/distributions", authenticate, authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"), async (req, res) => {
  try {
    const distFilter = req.query.include_demo === "true" ? {} : realDistributionFilter();
    const dists = await Distribution.find(distFilter)
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
    const { include_seed, include_demo } = req.query;
    const campFilter =
      include_seed === "true" && include_demo === "true"
        ? {}
        : realCampFilter();
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

router.get("/fairness-audit", authenticate, authorize("admin", "disaster_officer", "camp_coordinator"), async (req, res) => {
  try {
    const { include_seed, include_demo } = req.query;
    const campFilter =
      include_seed === "true" && include_demo === "true"
        ? { status: "Active" }
        : realCampFilter({ status: "Active" });

    const camps = await Camp.find(campFilter).lean();
    const campIds = camps.map((camp) => camp._id);
    const [distributions, predictions] = await Promise.all([
      Distribution.find({
        camp_id: { $in: campIds },
        ...(include_demo === "true" ? {} : realDistributionFilter()),
      }).lean(),
      PriorityPrediction.find({ camp_id: { $in: campIds } }).lean(),
    ]);

    const distributionsByCamp = new Map();
    for (const distribution of distributions) {
      const campId = String(distribution.camp_id);
      const list = distributionsByCamp.get(campId) || [];
      list.push(distribution);
      distributionsByCamp.set(campId, list);
    }

    const predictionByCamp = new Map(
      predictions.map((prediction) => [String(prediction.camp_id), prediction]),
    );

    const groupTotals = {
      children: 0,
      elderly: 0,
      infants: 0,
      pregnant_women: 0,
      disabled_people: 0,
      chronic_patients: 0,
    };

    const rows = camps.map((camp) => {
      const groupCounts = {
        children: camp.children_count || 0,
        elderly: camp.elderly_count || 0,
        infants: camp.infants_count || 0,
        pregnant_women: camp.pregnant_women_count || 0,
        disabled_people: camp.disabled_people_count || 0,
        chronic_patients: camp.chronic_patients_count || 0,
      };

      Object.entries(groupCounts).forEach(([key, value]) => {
        groupTotals[key] += value || 0;
      });

      const vulnerablePopulation = Object.values(groupCounts).reduce(
        (sum, value) => sum + (value || 0),
        0,
      );
      const vulnerableRatio = camp.population > 0
        ? vulnerablePopulation / camp.population
        : 0;
      const campDistributions = distributionsByCamp.get(String(camp._id)) || [];
      const completedCycles = campDistributions.filter((dist) =>
        ["Delivered", "Partial"].includes(dist.status),
      );
      const failedCycles = campDistributions.filter((dist) => dist.status === "Failed");
      const partialCycles = campDistributions.filter((dist) => dist.status === "Partial");

      const plannedQty = campDistributions.reduce(
        (sum, dist) => sum + (dist.item_list || []).reduce(
          (itemSum, item) => itemSum + Number(item.quantity || 0),
          0,
        ),
        0,
      );
      const deliveredQty = campDistributions.reduce(
        (sum, dist) => sum + (dist.item_list || []).reduce((itemSum, item) => {
          if (dist.status === "Delivered") return itemSum + Number(item.quantity || 0);
          return itemSum + Number(item.delivered_quantity || 0);
        }, 0),
        0,
      );
      const completionRate = plannedQty > 0 ? deliveredQty / plannedQty : 0;
      const supportPerVulnerablePerson = vulnerablePopulation > 0
        ? deliveredQty / vulnerablePopulation
        : deliveredQty;
      const lastSupport = completedCycles
        .map((dist) => dist.completed_at || dist.updatedAt || dist.created_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      const hoursSinceSupport = lastSupport
        ? Math.round((Date.now() - new Date(lastSupport).getTime()) / (1000 * 60 * 60))
        : null;

      let riskScore = 0;
      if (vulnerableRatio >= 0.5) riskScore += 30;
      else if (vulnerableRatio >= 0.3) riskScore += 15;
      if (completedCycles.length === 0) riskScore += 30;
      if ((hoursSinceSupport ?? camp.last_distribution_hours ?? 0) > 72) riskScore += 25;
      else if ((hoursSinceSupport ?? camp.last_distribution_hours ?? 0) > 48) riskScore += 15;
      if (completionRate < 0.5 && plannedQty > 0) riskScore += 20;
      else if (completionRate < 0.8 && plannedQty > 0) riskScore += 10;
      if (failedCycles.length > 0) riskScore += 10;
      if (partialCycles.length > 0) riskScore += 10;

      const fairness_status =
        riskScore >= 70 ? "At Risk" : riskScore >= 40 ? "Watch" : "Fair";

      return {
        camp_id: camp._id,
        camp_name: camp.camp_name,
        population: camp.population || 0,
        vulnerable_population: vulnerablePopulation,
        vulnerable_ratio: Math.round(vulnerableRatio * 100),
        children: groupCounts.children,
        elderly: groupCounts.elderly,
        infants: groupCounts.infants,
        pregnant_women: groupCounts.pregnant_women,
        disabled_people: groupCounts.disabled_people,
        chronic_patients: groupCounts.chronic_patients,
        priority_level: camp.priority_level,
        priority_score: predictionByCamp.get(String(camp._id))?.priority_score ?? camp.priority_score ?? 0,
        distribution_cycles: campDistributions.length,
        completed_cycles: completedCycles.length,
        partial_cycles: partialCycles.length,
        failed_cycles: failedCycles.length,
        planned_quantity: plannedQty,
        delivered_quantity: deliveredQty,
        completion_rate: Math.round(completionRate * 100),
        support_per_vulnerable_person: Math.round(supportPerVulnerablePerson * 100) / 100,
        hours_since_support: hoursSinceSupport ?? camp.last_distribution_hours ?? null,
        fairness_risk_score: Math.min(100, riskScore),
        fairness_status,
      };
    }).sort((a, b) => b.fairness_risk_score - a.fairness_risk_score);

    const vulnerablePopulation = Object.values(groupTotals).reduce(
      (sum, value) => sum + value,
      0,
    );
    const atRiskCamps = rows.filter((row) => row.fairness_status === "At Risk").length;
    const watchCamps = rows.filter((row) => row.fairness_status === "Watch").length;
    const fairCamps = rows.filter((row) => row.fairness_status === "Fair").length;

    res.json({
      status: "success",
      data: {
        summary: {
          active_camps: camps.length,
          vulnerable_population: vulnerablePopulation,
          at_risk_camps: atRiskCamps,
          watch_camps: watchCamps,
          fair_camps: fairCamps,
          average_completion_rate: rows.length
            ? Math.round(rows.reduce((sum, row) => sum + row.completion_rate, 0) / rows.length)
            : 0,
        },
        group_totals: groupTotals,
        rows,
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Fairness audit failed", details: error.message });
  }
});

router.get("/accountability-audit", authenticate, authorize("admin", "disaster_officer"), async (req, res) => {
  try {
    const includeDemo = req.query.include_demo === "true";
    const [camps, distributions, needReports] = await Promise.all([
      Camp.find(includeDemo ? { status: "Active" } : realCampFilter({ status: "Active" })).lean(),
      Distribution.find(includeDemo ? {} : realDistributionFilter()).lean(),
      NeedReport.find({
        status: { $in: ["Pending", "In Progress"] },
        ...(includeDemo ? {} : realNeedReportFilter()),
      }).lean(),
    ]);

    const findings = [];
    const distributionsByCamp = new Map();
    for (const distribution of distributions) {
      const campId = String(distribution.camp_id);
      const list = distributionsByCamp.get(campId) || [];
      list.push(distribution);
      distributionsByCamp.set(campId, list);

      for (const item of distribution.item_list || []) {
        if (Number(item.delivered_quantity || 0) > Number(item.quantity || 0)) {
          findings.push({
            type: "delivery_quantity_mismatch",
            severity: "High",
            camp_id: distribution.camp_id,
            distribution_id: distribution._id,
            message: `Delivered quantity exceeds planned quantity for ${item.item_name}`,
          });
        }
      }
    }

    for (const camp of camps) {
      const vulnerableTotal =
        Number(camp.children_count || 0) +
        Number(camp.elderly_count || 0) +
        Number(camp.infants_count || 0) +
        Number(camp.pregnant_women_count || 0) +
        Number(camp.disabled_people_count || 0) +
        Number(camp.chronic_patients_count || 0);

      if (vulnerableTotal > Number(camp.population || 0) * 1.3) {
        findings.push({
          type: "vulnerable_count_mismatch",
          severity: "Medium",
          camp_id: camp._id,
          camp_name: camp.camp_name,
          message: "Vulnerable group count is unusually high compared with camp population",
        });
      }

      const campDistributions = distributionsByCamp.get(String(camp._id)) || [];
      const failedOrPartial = campDistributions.filter((dist) =>
        ["Failed", "Partial"].includes(dist.status),
      );
      if (failedOrPartial.length >= 3) {
        findings.push({
          type: "repeated_failed_or_partial_deliveries",
          severity: "High",
          camp_id: camp._id,
          camp_name: camp.camp_name,
          message: `${failedOrPartial.length} repeated failed/partial distribution cycle(s) detected`,
        });
      }

      const deliveredQuantity = campDistributions.reduce(
        (sum, dist) => sum + (dist.item_list || []).reduce((itemSum, item) => {
          if (dist.status === "Delivered") return itemSum + Number(item.quantity || 0);
          return itemSum + Number(item.delivered_quantity || 0);
        }, 0),
        0,
      );
      if (camp.priority_score >= 70 && deliveredQuantity === 0) {
        findings.push({
          type: "high_priority_without_delivery",
          severity: "High",
          camp_id: camp._id,
          camp_name: camp.camp_name,
          message: "High urgency camp has no delivered relief quantity recorded",
        });
      }
    }

    const reportKey = (report) =>
      [
        report.contact_phone,
        report.need_type,
        Number(report.latitude).toFixed(3),
        Number(report.longitude).toFixed(3),
      ].join("|");
    const reportGroups = new Map();
    for (const report of needReports) {
      const key = reportKey(report);
      const list = reportGroups.get(key) || [];
      list.push(report);
      reportGroups.set(key, list);
    }
    for (const reports of reportGroups.values()) {
      if (reports.length >= 3) {
        findings.push({
          type: "duplicate_need_reports",
          severity: "Medium",
          camp_id: reports[0].camp_id,
          message: `${reports.length} similar unresolved need reports from the same contact/location`,
        });
      }
    }

    res.json({
      status: "success",
      data: {
        summary: {
          total_findings: findings.length,
          high: findings.filter((finding) => finding.severity === "High").length,
          medium: findings.filter((finding) => finding.severity === "Medium").length,
        },
        findings,
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Accountability audit failed", details: error.message });
  }
});

router.get("/evaluation-metrics", authenticate, authorize("admin", "disaster_officer"), async (req, res) => {
  try {
    const includeDemo = req.query.include_demo === "true";
    const [camps, distributions, resources] = await Promise.all([
      Camp.find(includeDemo ? { status: "Active" } : realCampFilter({ status: "Active" })).lean(),
      Distribution.find(includeDemo ? {} : realDistributionFilter()).lean(),
      Resource.find(realResourceFilter()).lean(),
    ]);
    const visibleCampIds = camps.map((camp) => camp._id);
    const [predictions, histories] = await Promise.all([
      PriorityPrediction.find({ camp_id: { $in: visibleCampIds } }).lean(),
      PriorityHistory.find({ camp_id: { $in: visibleCampIds } })
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    const delivered = distributions.filter((dist) => dist.status === "Delivered");
    const partial = distributions.filter((dist) => dist.status === "Partial");
    const failed = distributions.filter((dist) => dist.status === "Failed");
    const completed = [...delivered, ...partial];
    const completionRate = distributions.length
      ? Math.round(((delivered.length + partial.length * 0.5) / distributions.length) * 100)
      : 0;
    const avgResponseHours = completed.length
      ? Math.round(
          completed.reduce((sum, dist) => {
            const start = new Date(dist.created_at || dist.createdAt).getTime();
            const end = new Date(dist.completed_at || dist.updatedAt).getTime();
            return sum + Math.max(0, end - start) / (1000 * 60 * 60);
          }, 0) / completed.length,
        )
      : 0;
    const impactDists = distributions.filter((dist) => dist.relief_impact_score != null);
    const avgPriorityReduction = impactDists.length
      ? Math.round(
          impactDists.reduce((sum, dist) => sum + Number(dist.relief_impact_score || 0), 0) /
            impactDists.length,
        )
      : 0;
    const totalStock = resources.reduce((sum, item) => sum + Number(item.total_quantity || 0), 0);
    const allocatedStock = resources.reduce((sum, item) => sum + Number(item.allocated_quantity || 0), 0);
    const stockUtilization = totalStock ? Math.round((allocatedStock / totalStock) * 100) : 0;
    const fallbackUsage = predictions.filter((item) => item.prediction_source === "rule_based").length;
    const needBoosted = predictions.filter((item) => Number(item.need_report_impact?.applied_boost || 0) > 0).length;

    const historyByCamp = new Map();
    for (const history of histories) {
      const campId = String(history.camp_id);
      const list = historyByCamp.get(campId) || [];
      list.push(history);
      historyByCamp.set(campId, list);
    }
    const driftRows = camps.map((camp) => {
      const list = historyByCamp.get(String(camp._id)) || [];
      const first = list[0];
      const last = list[list.length - 1];
      const drift = first && last ? Number(last.priority_score || 0) - Number(first.priority_score || 0) : 0;
      return {
        camp_id: camp._id,
        camp_name: camp.camp_name,
        samples: list.length,
        first_score: first?.priority_score ?? camp.priority_score ?? 0,
        latest_score: last?.priority_score ?? camp.priority_score ?? 0,
        drift,
        trend: drift > 5 ? "Worsening" : drift < -5 ? "Improving" : "Stable",
      };
    }).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

    res.json({
      status: "success",
      data: {
        summary: {
          active_camps: camps.length,
          total_distributions: distributions.length,
          delivery_completion_rate: completionRate,
          failed_delivery_rate: distributions.length ? Math.round((failed.length / distributions.length) * 100) : 0,
          average_response_hours: avgResponseHours,
          average_priority_reduction_after_delivery: avgPriorityReduction,
          stock_utilization_rate: stockUtilization,
          ml_fallback_usage_count: fallbackUsage,
          need_report_boosted_camps: needBoosted,
          priority_history_records: histories.length,
        },
        drift_rows: driftRows,
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Evaluation metrics failed", details: error.message });
  }
});

router.get("/decision-audit", authenticate, authorize("admin", "disaster_officer"), async (req, res) => {
  try {
    const includeDemo = req.query.include_demo === "true";
    const campFilter = includeDemo ? {} : realCampFilter();
    const visibleCamps = await Camp.find(campFilter).select("_id").lean();
    const visibleCampIds = visibleCamps.map((camp) => camp._id);
    const [predictions, distributions] = await Promise.all([
      PriorityPrediction.find({ camp_id: { $in: visibleCampIds } })
        .populate("camp_id", "camp_name")
        .sort({ updatedAt: -1 })
        .lean(),
      Distribution.find({
        camp_id: { $in: visibleCampIds },
        $or: [
          { relief_impact_score: { $ne: null } },
          { failure_reason: { $ne: "" } },
        ],
        ...(includeDemo ? {} : realDistributionFilter()),
      })
        .populate("camp_id", "camp_name")
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const predictionEvents = predictions.flatMap((prediction) => {
      const events = [];
      if (prediction.override?.is_overridden) {
        events.push({
          event_type: "priority_override",
          severity: "High",
          camp_name: prediction.camp_id?.camp_name || "N/A",
          score_before: prediction.override.original_priority_score,
          score_after: prediction.priority_score,
          reason: prediction.override.override_reason,
          event_time: prediction.override.overridden_at || prediction.updatedAt,
        });
      }
      if (prediction.prediction_source === "rule_based") {
        events.push({
          event_type: "ml_fallback_used",
          severity: "Medium",
          camp_name: prediction.camp_id?.camp_name || "N/A",
          score_after: prediction.priority_score,
          reason: prediction.feedback_event || "Rule-based fallback prediction used",
          event_time: prediction.updatedAt,
        });
      }
      if (Number(prediction.need_report_impact?.applied_boost || 0) > 0) {
        events.push({
          event_type: "need_report_boost",
          severity: "Medium",
          camp_name: prediction.camp_id?.camp_name || "N/A",
          score_after: prediction.priority_score,
          reason: `Need reports added +${prediction.need_report_impact.applied_boost} urgency points`,
          event_time: prediction.updatedAt,
        });
      }
      return events;
    });

    const deliveryEvents = distributions.map((dist) => ({
      event_type: dist.failure_reason ? "delivery_feedback_failure" : "delivery_impact",
      severity: dist.failure_reason ? "High" : "Low",
      camp_name: dist.camp_id?.camp_name || "N/A",
      score_before: dist.priority_before_delivery,
      score_after: dist.priority_after_delivery,
      relief_impact_score: dist.relief_impact_score,
      reason: dist.failure_reason || "Delivery impact measured after field confirmation",
      event_time: dist.updatedAt,
    }));

    const events = [...predictionEvents, ...deliveryEvents]
      .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())
      .slice(0, 100);

    res.json({
      status: "success",
      data: {
        summary: {
          total_events: events.length,
          overrides: events.filter((event) => event.event_type === "priority_override").length,
          fallback_events: events.filter((event) => event.event_type === "ml_fallback_used").length,
          need_boost_events: events.filter((event) => event.event_type === "need_report_boost").length,
          delivery_feedback_events: events.filter((event) => event.event_type.includes("delivery")).length,
        },
        events,
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Decision audit failed", details: error.message });
  }
});

router.get("/duplicate-need-clusters", authenticate, authorize("admin", "disaster_officer", "camp_coordinator"), async (req, res) => {
  try {
    const reports = await NeedReport.find({
      status: { $in: ["Pending", "In Progress", "Responded"] },
      ...(req.query.include_demo === "true" ? {} : realNeedReportFilter()),
    }).populate("camp_id", "camp_name").lean();
    const groups = new Map();
    for (const report of reports) {
      const key = [
        report.contact_phone,
        report.need_type,
        Number(report.latitude).toFixed(3),
        Number(report.longitude).toFixed(3),
      ].join("|");
      const list = groups.get(key) || [];
      list.push(report);
      groups.set(key, list);
    }

    const clusters = [...groups.values()]
      .filter((items) => items.length >= 2)
      .map((items) => ({
        cluster_key: String(items[0]._id),
        camp_name: items[0].camp_id?.camp_name || "Unlinked",
        need_type: items[0].need_type,
        contact_phone: items[0].contact_phone,
        report_count: items.length,
        max_severity: items.some((item) => ["Critical", "Emergency"].includes(item.severity))
          ? "Critical"
          : items.some((item) => item.severity === "High")
            ? "High"
            : "Medium",
        people_count: items.reduce((sum, item) => sum + Number(item.people_count || 0), 0),
        latitude: Number(items[0].latitude).toFixed(3),
        longitude: Number(items[0].longitude).toFixed(3),
        latest_report_at: items
          .map((item) => item.createdAt)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
      }))
      .sort((a, b) => b.report_count - a.report_count);

    res.json({
      status: "success",
      data: {
        summary: {
          duplicate_clusters: clusters.length,
          clustered_reports: clusters.reduce((sum, cluster) => sum + cluster.report_count, 0),
        },
        clusters,
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Duplicate need cluster report failed", details: error.message });
  }
});

router.get("/rescue-recommendations", authenticate, authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"), async (req, res) => {
  try {
    const includeDemo = req.query.include_demo === "true";
    const [camps, predictions, routes] = await Promise.all([
      Camp.find(includeDemo ? { status: "Active" } : realCampFilter({ status: "Active" })).lean(),
      PriorityPrediction.find().lean(),
      Route.find().sort({ safety_score: -1 }).lean(),
    ]);
    const predictionMap = new Map(predictions.map((item) => [String(item.camp_id), item]));
    const routeMap = new Map();
    for (const route of routes) {
      const campId = String(route.camp_id);
      if (!routeMap.has(campId)) routeMap.set(campId, route);
    }
    const rows = await Promise.all(camps.map(async (camp) => {
      const impact = await calculateNeedReportImpact(camp._id);
      const prediction = predictionMap.get(String(camp._id)) || camp;
      const recommendation = buildRescueRecommendation({
        camp,
        prediction,
        needImpact: impact,
        route: routeMap.get(String(camp._id)),
      });
      return {
        camp_id: camp._id,
        camp_name: camp.camp_name,
        priority_score: prediction.priority_score || camp.priority_score || 0,
        road_access_status: camp.road_access_status,
        active_need_reports: impact.active_reports,
        emergency_reports: impact.emergency_reports,
        rescue_mode: recommendation.mode,
        severity: recommendation.severity,
        recommended_team: recommendation.recommended_team,
        delivery_method: recommendation.delivery_method,
        reason: recommendation.reason,
      };
    }));

    res.json({
      status: "success",
      data: {
        summary: {
          critical_rescue_modes: rows.filter((row) => row.severity === "Critical").length,
          high_rescue_modes: rows.filter((row) => row.severity === "High").length,
        },
        rows: rows.sort((a, b) => b.priority_score - a.priority_score),
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Rescue recommendations failed", details: error.message });
  }
});

router.get("/request-clusters", authenticate, authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"), async (req, res) => {
  try {
    const reports = await NeedReport.find({
      status: { $in: ["Pending", "In Progress", "Responded"] },
      latitude: { $ne: null },
      longitude: { $ne: null },
    }).lean();
    const radiusKm = Number(req.query.radius_km || 1.5);
    const visited = new Set();
    const distanceKm = (a, b) => {
      const r = 6371;
      const dLat = ((Number(b.latitude) - Number(a.latitude)) * Math.PI) / 180;
      const dLng = ((Number(b.longitude) - Number(a.longitude)) * Math.PI) / 180;
      const lat1 = (Number(a.latitude) * Math.PI) / 180;
      const lat2 = (Number(b.latitude) * Math.PI) / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };
    const severityWeight = { Low: 1, Medium: 2, High: 3, Critical: 4, Emergency: 5 };
    const clusters = [];

    for (const report of reports) {
      if (visited.has(String(report._id))) continue;
      const members = reports.filter((candidate) =>
        !visited.has(String(candidate._id)) &&
        candidate.need_type === report.need_type &&
        distanceKm(report, candidate) <= radiusKm
      );
      if (members.length < 2) continue;
      members.forEach((member) => visited.add(String(member._id)));
      const people = members.reduce((sum, member) => sum + Number(member.people_count || 0), 0);
      const maxSeverity = members
        .map((member) => member.severity)
        .sort((a, b) => (severityWeight[b] || 0) - (severityWeight[a] || 0))[0];
      const priorityScore = Math.min(100, members.length * 12 + people * 0.4 + (severityWeight[maxSeverity] || 1) * 10);
      clusters.push({
        need_type: report.need_type,
        report_count: members.length,
        people_count: people,
        max_severity: maxSeverity,
        center_latitude: Number((members.reduce((sum, item) => sum + Number(item.latitude), 0) / members.length).toFixed(5)),
        center_longitude: Number((members.reduce((sum, item) => sum + Number(item.longitude), 0) / members.length).toFixed(5)),
        cluster_priority_score: Math.round(priorityScore),
        recommended_action:
          report.need_type === "Rescue" || maxSeverity === "Emergency"
            ? "Dispatch rescue team and verify access route"
            : `Create grouped ${report.need_type.toLowerCase()} distribution response`,
        report_ids: members.map((member) => member._id),
      });
    }

    res.json({
      status: "success",
      data: {
        summary: {
          clusters: clusters.length,
          clustered_reports: clusters.reduce((sum, item) => sum + item.report_count, 0),
          radius_km: radiusKm,
        },
        rows: clusters.sort((a, b) => b.cluster_priority_score - a.cluster_priority_score),
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Request clustering failed", details: error.message });
  }
});

router.get("/auto-recommendations", authenticate, authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"), async (req, res) => {
  try {
    const [camps, predictions, itemPriorities, routes, teams] = await Promise.all([
      Camp.find(realCampFilter({ status: "Active" })).lean(),
      PriorityPrediction.find().lean(),
      ItemPriority.find().lean(),
      Route.find().sort({ safety_score: -1, distance: 1 }).lean(),
      import("../models/User.js").then(({ default: User }) => User.find({ role: "rescue_team" }).select("name username").lean()),
    ]);
    const predictionByCamp = new Map(predictions.map((item) => [String(item.camp_id), item]));
    const itemByCamp = new Map(itemPriorities.map((item) => [String(item.camp_id), item]));
    const routeByCamp = new Map();
    for (const route of routes) {
      const key = String(route.camp_id);
      if (!routeByCamp.has(key)) routeByCamp.set(key, route);
    }
    const rows = [];
    for (const camp of camps) {
      const prediction = predictionByCamp.get(String(camp._id));
      const item = itemByCamp.get(String(camp._id));
      const route = routeByCamp.get(String(camp._id));
      const impact = await calculateNeedReportImpact(camp._id);
      const priorities = [
        { type: "food", priority: item?.food_priority || prediction?.relief_priorities?.food_priority || "Low", quantity: item?.recommended_food_qty || 0 },
        { type: "water", priority: item?.water_priority || prediction?.relief_priorities?.water_priority || "Low", quantity: item?.recommended_water_qty || 0 },
        { type: "medicine", priority: item?.medicine_priority || prediction?.relief_priorities?.medicine_priority || "Low", quantity: item?.recommended_medicine_qty || 0 },
        { type: "sanitary", priority: item?.sanitary_priority || prediction?.relief_priorities?.sanitary_priority || "Low", quantity: item?.recommended_sanitary_qty || 0 },
      ];
      const highItems = priorities.filter((entry) => entry.priority === "High");
      const selectedItems = highItems.length ? highItems : priorities.filter((entry) => entry.priority === "Medium").slice(0, 2);
      const deliveryMethod =
        route?.mobility_plan?.primary_mode === "mixed"
          ? "mixed"
          : Number(route?.mobility_plan?.boat_distance_km || 0) > 0 || camp.road_access_status === "Blocked"
            ? "boat"
            : "truck";
      rows.push({
        camp_id: camp._id,
        camp_name: camp.camp_name,
        priority_score: prediction?.priority_score ?? camp.priority_score ?? 0,
        priority_level: prediction?.priority_level || camp.priority_level,
        which_camp_first_rank_hint: prediction?.priority_score ?? camp.priority_score ?? 0,
        recommended_items: selectedItems.map((entry) => `${entry.type}:${entry.priority}:${entry.quantity}`).join(", "),
        recommended_quantity_total: selectedItems.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
        route_id: route?._id || null,
        route_safety_score: route?.safety_score ?? null,
        delivery_method: deliveryMethod,
        recommended_team: teams[rows.length % Math.max(teams.length, 1)]?.name || teams[rows.length % Math.max(teams.length, 1)]?.username || "Assign nearest available team",
        reason: `${impact.active_reports} active report(s), route safety ${route?.safety_score ?? "N/A"}, priority ${prediction?.priority_score ?? camp.priority_score ?? 0}`,
      });
    }
    const sorted = rows.sort((a, b) => b.priority_score - a.priority_score).map((row, index) => ({
      rank: index + 1,
      ...row,
    }));
    res.json({
      status: "success",
      data: {
        summary: {
          recommendations: sorted.length,
          high_priority: sorted.filter((row) => row.priority_level === "High").length,
        },
        rows: sorted.slice(0, 25),
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Auto recommendations failed", details: error.message });
  }
});

router.get("/performance-metrics", authenticate, authorize("admin", "disaster_officer", "camp_coordinator"), async (req, res) => {
  try {
    const [rescueReports, distributions, resources, highPriorityCamps] = await Promise.all([
      NeedReport.find({ need_type: "Rescue" }).lean(),
      Distribution.find().populate("camp_id", "camp_name priority_level").lean(),
      Resource.find().lean(),
      Camp.find({ priority_level: "High" }).lean(),
    ]);
    const completedRescue = rescueReports.filter((report) => report.rescue_assigned_at && report.rescue_completed_at);
    const avgRescueMinutes = completedRescue.length
      ? Math.round(completedRescue.reduce((sum, report) =>
          sum + (new Date(report.rescue_completed_at).getTime() - new Date(report.rescue_assigned_at).getTime()) / 60000,
        0) / completedRescue.length)
      : 0;
    const completedDeliveries = distributions.filter((dist) => ["Delivered", "Partial"].includes(dist.status)).length;
    const failedDeliveries = distributions.filter((dist) => dist.status === "Failed");
    const stockOutItems = resources.filter((resource) => Number(resource.available_quantity || 0) <= 0).length;
    const highPriorityResponseRows = highPriorityCamps.map((camp) => {
      const related = distributions
        .filter((dist) => String(dist.camp_id?._id || dist.camp_id) === String(camp._id))
        .sort((a, b) => new Date(a.created_at || a.createdAt).getTime() - new Date(b.created_at || b.createdAt).getTime());
      const first = related[0];
      const delayHours = first
        ? Math.round((new Date(first.created_at || first.createdAt).getTime() - new Date(camp.updatedAt || camp.createdAt).getTime()) / 3600000)
        : null;
      return {
        camp_name: camp.camp_name,
        priority_score: camp.priority_score || 0,
        first_distribution_status: first?.status || "No distribution yet",
        response_delay_hours: delayHours,
      };
    });
    res.json({
      status: "success",
      data: {
        summary: {
          average_rescue_response_minutes: avgRescueMinutes,
          delivery_completion_rate: distributions.length ? Math.round((completedDeliveries / distributions.length) * 100) : 0,
          failed_delivery_count: failedDeliveries.length,
          stock_out_frequency: stockOutItems,
          high_priority_camps_waiting: highPriorityResponseRows.filter((row) => row.first_distribution_status === "No distribution yet").length,
        },
        rows: [
          { metric: "Average rescue response time", value: avgRescueMinutes, unit: "minutes" },
          { metric: "Delivery completion rate", value: distributions.length ? Math.round((completedDeliveries / distributions.length) * 100) : 0, unit: "%" },
          { metric: "Failed delivery reasons", value: failedDeliveries.map((dist) => dist.failure_reason || "Unknown").join(" | ") || "None", unit: "" },
          { metric: "Stock-out frequency", value: stockOutItems, unit: "items" },
          { metric: "High priority camp response gaps", value: highPriorityResponseRows.filter((row) => row.first_distribution_status === "No distribution yet").length, unit: "camps" },
        ],
        high_priority_response_rows: highPriorityResponseRows,
      },
      generated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: "Performance metrics failed", details: error.message });
  }
});

// Dashboard summary combining all stats
router.get("/dashboard", authenticate, async (req, res) => {
  try {
    const { include_seed, include_demo } = req.query;
    const baseFilter =
      include_seed === "true" && include_demo === "true"
        ? {}
        : realCampFilter();

    const totalSafeZones = await SafeZone.countDocuments(
      include_seed === "true" ? {} : realSafeZoneFilter(),
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
    const distFilter = include_demo === "true" ? {} : realDistributionFilter();
    const totalDist = await Distribution.countDocuments(distFilter);
    const pendingDist = await Distribution.countDocuments({
      ...distFilter,
      status: "Pending",
    });
    const deliveredDist = await Distribution.countDocuments({
      ...distFilter,
      status: "Delivered",
    });
    const camps = await Camp.find(baseFilter);
    const totalPop = camps.reduce((s, c) => s + (c.population || 0), 0);
    const resources = await Resource.find(include_seed === "true" ? {} : realResourceFilter());
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
    const needReportFilter = include_demo === "true" ? {} : realNeedReportFilter();
    const totalNeedReports = await NeedReport.countDocuments(needReportFilter);
    const pendingNeedReports = await NeedReport.countDocuments({
      ...needReportFilter,
      status: "Pending",
    });
    const inProgressNeedReports = await NeedReport.countDocuments({
      ...needReportFilter,
      status: "In Progress",
    });
    const emergencyNeedReports = await NeedReport.countDocuments({
      ...needReportFilter,
      severity: { $in: ["Critical", "Emergency"] },
      status: { $in: ["Pending", "In Progress"] },
    });
    const activeRescueMissions = await NeedReport.countDocuments({
      ...needReportFilter,
      need_type: "Rescue",
      rescue_status: { $nin: ["Rescued", "Closed"] },
    });
    const unassignedRescueMissions = await NeedReport.countDocuments({
      ...needReportFilter,
      need_type: "Rescue",
      $or: [
        { rescue_status: "Unassigned" },
        { rescue_status: { $exists: false } },
        { assigned_rescue_team_id: null },
      ],
    });
    const rescuedMissions = await NeedReport.countDocuments({
      ...needReportFilter,
      need_type: "Rescue",
      rescue_status: { $in: ["Rescued", "Closed"] },
    });
    const activeNeedReports = await NeedReport.find({
      ...needReportFilter,
      status: { $in: ["Pending", "In Progress", "Responded"] },
      camp_id: { $in: campIds },
    }).lean();
    const needImpactByCamp = new Map();
    for (const report of activeNeedReports) {
      const campId = String(report.camp_id);
      const existing = needImpactByCamp.get(campId) || {
        active_reports: 0,
        emergency_reports: 0,
        affected_people: 0,
      };
      existing.active_reports += 1;
      existing.affected_people += Number(report.people_count || 0);
      if (["Critical", "Emergency"].includes(report.severity)) {
        existing.emergency_reports += 1;
      }
      needImpactByCamp.set(campId, existing);
    }
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
    const depletionRows = camps.map((camp) => {
      const depletion = calculateStockDepletionForecast(camp);
      const impact = needImpactByCamp.get(String(camp._id)) || {
        active_reports: 0,
        emergency_reports: 0,
        affected_people: 0,
      };
      return {
        camp_id: camp._id,
        camp_name: camp.camp_name,
        priority_score: camp.priority_score || 0,
        most_critical_item: depletion.most_critical_item,
        minimum_hours_remaining: depletion.minimum_hours_remaining,
        water_hours_remaining: depletion.water.hours_remaining,
        food_hours_remaining: depletion.food.hours_remaining,
        medicine_hours_remaining: depletion.medicine.hours_remaining,
        sanitary_hours_remaining: depletion.sanitary.hours_remaining,
        active_need_reports: impact.active_reports,
        emergency_need_reports: impact.emergency_reports,
        affected_people_from_reports: impact.affected_people,
      };
    }).sort((a, b) =>
      (a.minimum_hours_remaining ?? Number.MAX_SAFE_INTEGER) -
      (b.minimum_hours_remaining ?? Number.MAX_SAFE_INTEGER),
    );
    const criticalDepletionCamps = depletionRows.filter((row) =>
      row.minimum_hours_remaining != null && row.minimum_hours_remaining <= 24,
    ).length;
    const topNeedImpactCamps = [...depletionRows]
      .sort((a, b) =>
        (b.emergency_need_reports * 10 + b.active_need_reports) -
        (a.emergency_need_reports * 10 + a.active_need_reports),
      )
      .slice(0, 5);

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
        totalNeedReports,
        pendingNeedReports,
        inProgressNeedReports,
        emergencyNeedReports,
        activeRescueMissions,
        unassignedRescueMissions,
        rescuedMissions,
        criticalDepletionCamps,
        stockDepletionForecast: depletionRows.slice(0, 8),
        topNeedImpactCamps,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Dashboard failed", details: error.message });
  }
});

export { router as reportRouter };
