import axios from "axios";
import SensorPackage from "../models/SensorPackage.js";
import Prediction from "../models/Prediction.js";

// 🔥 YOUR EXISTING FUNCTION (FIXED: removed randomness)
export const predictFloodRisk = (historicalData, currentDailyRainfall, district) => {
  const districtData = historicalData[district];
  if (!districtData) throw new Error(`District ${district} not found`);

  const currentMonth = new Date().getMonth();
  const historicalMonth = districtData.monthlyData[currentMonth];

  const dailyAvg = historicalMonth.avgRainfall / 30;
  const intensityFactor = currentDailyRainfall / dailyAvg;

  let riskLevel = "LOW";
  let recommendation = "Monitor conditions";

  if (intensityFactor > 3) {
    riskLevel = "CRITICAL";
    recommendation = "Evacuate immediately";
  } else if (intensityFactor > 2) {
    riskLevel = "HIGH";
    recommendation = "Prepare emergency response";
  } else if (intensityFactor > 1.5) {
    riskLevel = "MEDIUM";
    recommendation = "Monitor closely";
  }

  return {
    intensityFactor: Number(intensityFactor.toFixed(2)),
    riskLevel,
    recommendation
  };
};

// 🔥 MAIN ENGINE
export const runFloodPrediction = async (historicalData) => {
  const sensors = await SensorPackage.find();
  const results = [];

  for (const sensor of sensors) {
    const rainfall = sensor.currentReadings?.rainfall || 0;
    const waterLevel = sensor.currentReadings?.waterLevel || 0;

    // =========================
    // HISTORICAL ANALYSIS
    // =========================
    const analysis = predictFloodRisk(
      historicalData,
      rainfall,
      sensor.location.name
    );

    // =========================
    // BUILD FEATURES
    // =========================
    const features = {
      rainfall,
      water_level: waterLevel,
      soil_moisture: sensor.currentReadings?.turbidity || 0,
      latitude: sensor.location.latitude,
      longitude: sensor.location.longitude,
      intensity_factor: analysis.intensityFactor
    };

    // =========================
    // CALL PYTHON ML API
    // =========================
    const response = await axios.post(
      "http://localhost:5000/api/ml/prediction/predict",
      { features }
    );

    const ml = response.data;

    // =========================
    // SAVE TO DATABASE
    // =========================
    const saved = await Prediction.create({
      location: sensor.location.name,
      latitude: sensor.location.latitude,
      longitude: sensor.location.longitude,

      rainfall,
      waterLevel,

      mlPrediction: {
        prediction: ml.prediction,
        predictionLabel: ml.prediction_label,
        confidence: ml.confidence,
        modelType: "random_forest"
      },

      floodDepth: ml.flood_depth,
      severity: ml.severity,
      intensityFactor: analysis.intensityFactor,
      recommendation: analysis.recommendation
    });

    results.push(saved);
  }

  return results;
};