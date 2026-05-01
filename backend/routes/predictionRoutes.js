import express from 'express';
import Rainfall from '../models/Rainfall.js';
import Prediction from '../models/Prediction.js';
import { MLModelService } from '../utils/mlModelService.js';
import { GeoJSONGenerator } from '../utils/geoJsonGenerator.js';

const router = express.Router();

/**
 * 🔥 SINGLE PREDICTION (UPDATED WITH FLOOD DEPTH)
 */
router.post('/predict', async (req, res) => {
  try {
    const {
      location,
      latitude,
      longitude,
      rainfall,
      waterLevel,
      humidity = 75
    } = req.body;

    if (!location || latitude === undefined || longitude === undefined || rainfall === undefined || waterLevel === undefined) {
      return res.status(400).json({
        error: 'Missing required prediction fields'
      });
    }

    // =========================
    // CALL PYTHON ML SERVICE
    // =========================
    const ml = await MLModelService.predictFloodRisk(
      location,
      rainfall,
      waterLevel,
      latitude,
      longitude,
      humidity
    );

    // =========================
    // 🔥 FLOOD DEPTH CALCULATION
    // =========================
    let floodDepth =
      (waterLevel * 0.5) +
      (rainfall / 100 * 0.3);

    if (ml.predictionLabel.includes("High")) {
      floodDepth *= 1.5;
    } else if (ml.predictionLabel.includes("Moderate")) {
      floodDepth *= 1.2;
    }

    floodDepth = Number(floodDepth.toFixed(2));

    let severity = "Minor Flood";
    if (floodDepth > 2) severity = "Severe Flood";
    else if (floodDepth > 1) severity = "Moderate Flood";

    // =========================
    // SAVE TO DB
    // =========================
    const saved = await Prediction.findOneAndUpdate(
      { location },
      {
        location,
        latitude,
        longitude,
        rainfall,
        waterLevel,
        humidity,

        mlPrediction: {
          prediction: ml.prediction,
          predictionLabel: ml.predictionLabel,
          confidence: ml.confidence,
          modelVersion: ml.modelVersion || "v1",
          modelType: ml.modelType || "ML"
        },

        floodDepth,
        severity,
        riskLevel: ml.predictionLabel,

        updatedAt: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({
      status: "success",
      data: saved
    });

  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({
      error: "Prediction failed",
      details: error.message
    });
  }
});


// =========================
// 🔥 GENERATE GEOJSON (UPDATED)
// =========================
router.get('/geojson', async (req, res) => {
  try {
    const predictions = await Prediction.find();

    const features = predictions.map(p => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [p.longitude, p.latitude]
      },
      properties: {
        location: p.location,
        rainfall: p.rainfall,
        waterLevel: p.waterLevel,
        risk: p.mlPrediction?.predictionLabel,
        severity: p.severity,
        floodDepth: p.floodDepth,
        confidence: p.mlPrediction?.confidence || 0.5
      }
    }));

    res.json({
      type: "FeatureCollection",
      features
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// =========================
// 🔥 HEATMAP (USING FLOOD DEPTH)
// =========================
router.get('/heatmap', async (req, res) => {
  try {
    const predictions = await Prediction.find();

    const heatmap = predictions.map(p => [
      p.latitude,
      p.longitude,
      p.floodDepth || 0.2
    ]);

    res.json({
      status: "success",
      data: heatmap
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/zones', async (req, res) => {
  try {
    const predictions = await Prediction.find();

    // Group points by severity
    const zones = {
      severe: [],
      moderate: [],
      minor: []
    };

    predictions.forEach(p => {
      const point = [p.longitude, p.latitude];

      if (p.severity === "Severe Flood") {
        zones.severe.push(point);
      } else if (p.severity === "Moderate Flood") {
        zones.moderate.push(point);
      } else {
        zones.minor.push(point);
      }
    });

    res.json(zones);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// SUMMARY
// =========================
router.get('/summary', async (req, res) => {
  try {
    const predictions = await Prediction.find();

    const summary = {
      total: predictions.length,
      severe: predictions.filter(p => p.severity === "Severe Flood").length,
      moderate: predictions.filter(p => p.severity === "Moderate Flood").length,
      minor: predictions.filter(p => p.severity === "Minor Flood").length
    };

    res.json(summary);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


export { router as predictionRouter };