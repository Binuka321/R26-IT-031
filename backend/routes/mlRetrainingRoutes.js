import express from "express";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import MLTrainingFeedback from "../models/MLTrainingFeedback.js";
import Camp from "../models/Camp.js";
import Distribution from "../models/Distribution.js";
import PriorityPrediction from "../models/PriorityPrediction.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { PostFloodMLService } from "../utils/postFloodMLService.js";

const router = express.Router();
let lastRetrainingJob = null;

function csvEscape(value) {
  const raw = value == null ? "" : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function featureSnapshot(camp) {
  return PostFloodMLService.buildCampPayload(camp);
}

function labelFromOutcome(outcome, fallback = "Medium") {
  if (outcome === "successful") return "Low";
  if (outcome === "partial") return "Medium";
  if (outcome === "failed") return "High";
  return fallback || "Medium";
}

function getMLServiceDir() {
  const candidates = [
    path.resolve(process.cwd(), "ml-service"),
    path.resolve(process.cwd(), "..", "ml-service"),
  ];
  const found = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "train_model.py")),
  );
  return found || candidates[0];
}

function getPythonCommand() {
  if (process.env.PYTHON_BIN) {
    return { command: process.env.PYTHON_BIN, args: ["train_model.py"] };
  }
  if (process.platform === "win32") {
    const mlServicePython = path.join(getMLServiceDir(), ".venv", "Scripts", "python.exe");
    const windowsPythonCandidates = [
      mlServicePython,
      "C:\\Python314\\python.exe",
      "C:\\Users\\udesh\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
      "C:\\Python313\\python.exe",
      "C:\\Windows\\py.exe",
    ];
    const pythonExe = windowsPythonCandidates.find((candidate) => fs.existsSync(candidate));
    if (pythonExe?.endsWith("py.exe")) {
      return { command: pythonExe, args: ["-3", "train_model.py"] };
    }
    if (pythonExe) {
      return { command: pythonExe, args: ["train_model.py"] };
    }
    return { command: "python", args: ["train_model.py"] };
  }
  return { command: "python3", args: ["train_model.py"] };
}

router.post(
  "/feedback",
  authenticate,
  authorize("admin", "disaster_officer", "camp_coordinator", "rescue_team"),
  async (req, res) => {
    try {
      const { camp_id, distribution_id, response_outcome = "pending_review", notes = "" } = req.body;
      const camp = await Camp.findById(camp_id);
      if (!camp) return res.status(404).json({ error: "Camp not found" });
      const distribution = distribution_id ? await Distribution.findById(distribution_id) : null;
      const prediction = await PriorityPrediction.findOne({ camp_id }).sort({ predicted_at: -1 });
      const actualPriority = req.body.actual_priority_after_response || labelFromOutcome(response_outcome, camp.priority_level);

      let deliveredRatio = null;
      if (distribution?.item_list?.length) {
        const planned = distribution.item_list.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const delivered = distribution.item_list.reduce((sum, item) => sum + Number(item.delivered_quantity || 0), 0);
        deliveredRatio = planned > 0 ? Math.round((delivered / planned) * 100) / 100 : null;
      }

      const feedback = await MLTrainingFeedback.create({
        camp_id,
        distribution_id: distribution_id || null,
        prediction_id: prediction?._id || null,
        predicted_priority_level: prediction?.priority_level || camp.priority_level || "",
        predicted_priority_score: prediction?.priority_score || camp.priority_score || 0,
        actual_priority_after_response: actualPriority,
        response_outcome,
        response_time_minutes: req.body.response_time_minutes ?? null,
        delivered_ratio: deliveredRatio,
        notes,
        feature_snapshot: featureSnapshot(camp),
        label_snapshot: {
          camp_priority: actualPriority,
          food_priority: req.body.food_priority || prediction?.relief_priorities?.food_priority || "Medium",
          water_priority: req.body.water_priority || prediction?.relief_priorities?.water_priority || "Medium",
          medicine_priority: req.body.medicine_priority || prediction?.relief_priorities?.medicine_priority || "Medium",
          sanitary_priority: req.body.sanitary_priority || prediction?.relief_priorities?.sanitary_priority || "Medium",
        },
        recorded_by: req.user.id || req.user._id,
      });

      res.status(201).json({ status: "success", data: feedback });
    } catch (error) {
      res.status(500).json({ error: "Failed to record training feedback", details: error.message });
    }
  },
);

router.get(
  "/feedback",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const feedback = await MLTrainingFeedback.find({})
        .populate("camp_id", "camp_name")
        .populate("distribution_id", "status")
        .sort({ createdAt: -1 })
        .limit(300);
      res.json({ status: "success", data: feedback });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training feedback", details: error.message });
    }
  },
);

router.post(
  "/export-dataset",
  authenticate,
  authorize("admin", "disaster_officer"),
  async (req, res) => {
    try {
      const feedback = await MLTrainingFeedback.find({}).lean();
      const columns = [
        "population", "children_count", "elderly_count", "infants_count",
        "pregnant_women_count", "disabled_people_count", "chronic_patients_count",
        "food_available", "water_available", "medicine_available", "sanitary_available",
        "last_distribution_hours", "vehicle_capacity_total", "distance_from_distribution_center",
        "camp_capacity", "camp_occupancy_ratio", "vulnerable_ratio", "road_access_status",
        "camp_priority", "food_priority", "water_priority", "medicine_priority", "sanitary_priority",
      ];
      const rows = feedback.map((item) => {
        const feature = item.feature_snapshot || {};
        const label = item.label_snapshot || {};
        return columns.map((column) => csvEscape(feature[column] ?? label[column])).join(",");
      });
      const outDir = path.join(getMLServiceDir(), "dataset");
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, "camp_relief_priority_feedback.csv");
      fs.writeFileSync(outPath, [columns.join(","), ...rows].join("\n"), "utf-8");
      res.json({ status: "success", data: { rows: rows.length, path: outPath } });
    } catch (error) {
      res.status(500).json({ error: "Failed to export feedback dataset", details: error.message });
    }
  },
);

router.post(
  "/retrain",
  authenticate,
  authorize("admin"),
  async (_req, res) => {
    if (lastRetrainingJob?.status === "running") {
      return res.status(409).json({ error: "Retraining is already running", data: lastRetrainingJob });
    }

    const startedAt = new Date();
    lastRetrainingJob = {
      status: "running",
      started_at: startedAt,
      finished_at: null,
      exit_code: null,
      output: "",
      error: "",
    };

    const mlServiceDir = getMLServiceDir();
    const python = getPythonCommand();
    const child = spawn(python.command, python.args, {
      cwd: mlServiceDir,
      shell: false,
    });
    child.stdout.on("data", (data) => {
      lastRetrainingJob.output += data.toString().slice(-4000);
    });
    child.stderr.on("data", (data) => {
      lastRetrainingJob.error += data.toString().slice(-4000);
    });
    child.on("error", (error) => {
      lastRetrainingJob.status = "failed";
      lastRetrainingJob.exit_code = null;
      lastRetrainingJob.finished_at = new Date();
      lastRetrainingJob.error += `\nFailed to start ${python.command}: ${error.message}`;
    });
    child.on("close", async (code) => {
      if (lastRetrainingJob.status === "failed" && lastRetrainingJob.finished_at) return;
      lastRetrainingJob.status = code === 0 ? "completed" : "failed";
      lastRetrainingJob.exit_code = code;
      lastRetrainingJob.finished_at = new Date();
      if (code === 0) {
        await MLTrainingFeedback.updateMany({}, { used_for_training: true });
      }
    });

    res.status(202).json({ status: "success", data: lastRetrainingJob });
  },
);

router.get(
  "/status",
  authenticate,
  authorize("admin", "disaster_officer"),
  (_req, res) => {
    res.json({
      status: "success",
      data: lastRetrainingJob || { status: "idle" },
    });
  },
);

export { router as mlRetrainingRouter };
