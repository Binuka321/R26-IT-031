import express from 'express';
import Rainfall from '../models/Rainfall.js';
import Prediction from '../models/Prediction.js';
import SensorPackage from '../models/SensorPackage.js';
import { MLModelService } from '../utils/mlModelService.js';
import { GeoJSONGenerator } from '../utils/geoJsonGenerator.js';
import * as turf from '@turf/turf';
import { rainfallHistoricalData } from '../data/rainfallDatabase.js';

const router = express.Router();

const buildFloodDepth = (waterLevel = 0, rainfall = 0, predictionLabel = '') => {
  let floodDepth = (Number(waterLevel) * 0.5) + (Number(rainfall) / 100 * 0.3);

  if (String(predictionLabel).toLowerCase().includes('high')) {
    floodDepth *= 1.5;
  } else if (String(predictionLabel).toLowerCase().includes('moderate')) {
    floodDepth *= 1.2;
  }

  return Number(floodDepth.toFixed(2));
};

const buildSeverity = (floodDepth) => {
  if (floodDepth > 2) return 'Severe Flood';
  if (floodDepth > 1) return 'Moderate Flood';
  return 'Minor Flood';
};

const normalizeSensorValue = (value) => {
  const normalized = Number(value);
  return Number.isNaN(normalized) ? 0 : normalized;
};

const normalizePeriod = (period) => {
  if (!period) return 'Any';
  const value = String(period).trim().toLowerCase();
  if (['morning', 'am'].includes(value)) return 'Morning';
  if (['afternoon', 'pm'].includes(value)) return 'Afternoon';
  if (['evening'].includes(value)) return 'Evening';
  if (['night'].includes(value)) return 'Night';
  return 'Any';
};

const getPeriodFactor = (period) => {
  switch (normalizePeriod(period)) {
    case 'Morning': return 0.85;
    case 'Afternoon': return 1.0;
    case 'Evening': return 1.1;
    case 'Night': return 0.9;
    default: return 1.0;
  }
};

const getPeriodCode = (period) => {
  switch (normalizePeriod(period)) {
    case 'Morning': return 1;
    case 'Afternoon': return 2;
    case 'Evening': return 3;
    case 'Night': return 4;
    default: return 0;
  }
};

const normalizeDate = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const findNearestDistrictData = (location, latitude, longitude) => {
  const formattedLocation = String(location || '').toLowerCase();
  const matchByName = Object.keys(rainfallHistoricalData).find((district) =>
    formattedLocation.includes(district.toLowerCase())
  );

  if (matchByName) {
    return rainfallHistoricalData[matchByName];
  }

  let bestDistrict = null;
  let bestDistance = Infinity;

  Object.values(rainfallHistoricalData).forEach((district) => {
    const latDiff = (district.latitude || 0) - (latitude || 0);
    const lonDiff = (district.longitude || 0) - (longitude || 0);
    const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDistrict = district;
    }
  });

  return bestDistrict || Object.values(rainfallHistoricalData)[0];
};

const buildPredictionPayload = (pkg) => ({
  location: pkg.location.name || pkg.name || 'Unknown',
  latitude: normalizeSensorValue(pkg.location.latitude),
  longitude: normalizeSensorValue(pkg.location.longitude),
  rainfall: normalizeSensorValue(pkg.currentReadings?.rainfall),
  waterLevel: normalizeSensorValue(pkg.currentReadings?.waterLevel),
  humidity: normalizeSensorValue(pkg.currentReadings?.humidity) || 75
});

const buildForecastedInputs = ({ location, latitude, longitude, rainfall, waterLevel, humidity }, predictionDate, predictionPeriod) => {
  const selectedDate = normalizeDate(predictionDate);
  const selectedPeriod = normalizePeriod(predictionPeriod);
  const today = normalizeDate(new Date());
  const useCurrentSensorData = selectedDate.getTime() === today.getTime() && rainfall > 0 && waterLevel > 0;

  if (useCurrentSensorData) {
    return {
      rainfall,
      waterLevel,
      humidity,
      predictionDate: selectedDate,
      predictionPeriod: selectedPeriod
    };
  }

  const districtData = findNearestDistrictData(location, latitude, longitude);
  const monthIndex = selectedDate.getMonth();
  const monthData = districtData.monthlyData?.[monthIndex] || {};
  const monthAverage = monthData.avgRainfall || 60;
  const periodFactor = getPeriodFactor(selectedPeriod);
  const forecastRainfall = Number(((monthAverage / 30) * periodFactor).toFixed(1));
  const forecastWaterLevel = Number(Math.max(0.2, forecastRainfall / 50 + (periodFactor - 0.9) * 0.1).toFixed(2));
  const rainySeason = Array.isArray(districtData.rainySeasonMonths) && districtData.rainySeasonMonths.includes(monthData.month);
  const forecastHumidity = Number(Math.min(95, Math.max(45, (rainySeason ? 80 : 65) + (periodFactor - 1) * 8))).toFixed(0);

  return {
    rainfall: forecastRainfall,
    waterLevel: forecastWaterLevel,
    humidity: Number(forecastHumidity),
    predictionDate: selectedDate,
    predictionPeriod: selectedPeriod
  };
};

router.get('/sensor-predictions', async (req, res) => {
  try {
    const predictionDate = normalizeDate(req.query.date);
    const predictionPeriod = normalizePeriod(req.query.period);

    const packages = await SensorPackage.find({ ingestEnabled: true }).lean();
    if (!packages.length) {
      return res.status(404).json({ error: 'No sensor packages available for predictions' });
    }

    const sensorPredictions = await Promise.all(packages.map(async (pkg) => {
      const payload = buildPredictionPayload(pkg);
      const forecastInputs = buildForecastedInputs(payload, predictionDate, predictionPeriod);

      const ml = await MLModelService.predictFloodRisk(
        payload.location,
        forecastInputs.rainfall,
        forecastInputs.waterLevel,
        payload.latitude,
        payload.longitude,
        forecastInputs.humidity,
        predictionDate,
        predictionPeriod
      );

      const floodDepth = buildFloodDepth(forecastInputs.waterLevel, forecastInputs.rainfall, ml.predictionLabel);
      const severity = buildSeverity(floodDepth);

      const saved = await Prediction.findOneAndUpdate(
        {
          location: payload.location,
          predictionDate,
          predictionPeriod
        },
        {
          location: payload.location,
          latitude: payload.latitude,
          longitude: payload.longitude,
          rainfall: forecastInputs.rainfall,
          waterLevel: forecastInputs.waterLevel,
          humidity: forecastInputs.humidity,
          predictionDate,
          predictionPeriod,
          mlPrediction: {
            prediction: ml.prediction,
            predictionLabel: ml.predictionLabel,
            confidence: ml.confidence,
            modelVersion: ml.modelVersion || 'v1',
            modelType: ml.modelType || 'ML'
          },
          floodDepth,
          severity,
          riskLevel: ml.predictionLabel,
          updatedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );

      return saved;
    }));

    return res.json({ status: 'success', data: sensorPredictions });
  } catch (error) {
    console.error('Sensor prediction error:', error);
    return res.status(500).json({ error: 'Failed to generate sensor-driven predictions', details: error.message });
  }
});

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
      humidity = 75,
      predictionDate,
      predictionPeriod
    } = req.body;

    if (!location || latitude === undefined || longitude === undefined || rainfall === undefined) {
      return res.status(400).json({
        error: 'Missing required prediction fields'
      });
    }

    const requestedDate = normalizeDate(predictionDate);
    const requestedPeriod = normalizePeriod(predictionPeriod);
    let resolvedWaterLevel = Number(waterLevel);

    if (!Number.isFinite(resolvedWaterLevel)) {
      const packages = await SensorPackage.find({ ingestEnabled: true }).lean();
      const nearest = packages
        .map((pkg) => ({
          pkg,
          distance: Math.sqrt(
            (Number(pkg.location.latitude) - Number(latitude)) ** 2 +
            (Number(pkg.location.longitude) - Number(longitude)) ** 2
          )
        }))
        .sort((a, b) => a.distance - b.distance)[0]?.pkg;
      resolvedWaterLevel = normalizeSensorValue(nearest?.currentReadings?.waterLevel);
    }

    const forecastInputs = buildForecastedInputs({
      location,
      latitude,
      longitude,
      rainfall: normalizeSensorValue(rainfall),
      waterLevel: resolvedWaterLevel,
      humidity: normalizeSensorValue(humidity) || 75
    }, requestedDate, requestedPeriod);
    const calculatedRainfall = forecastInputs.rainfall;
    const calculatedWaterLevel = forecastInputs.waterLevel;

    // =========================
    // CALL PYTHON ML SERVICE
    // =========================
    const ml = await MLModelService.predictFloodRisk(
      location,
      calculatedRainfall,
      calculatedWaterLevel,
      latitude,
      longitude,
      humidity,
      requestedDate,
      requestedPeriod
    );

    // =========================
    // 🔥 FLOOD DEPTH CALCULATION
    // =========================
    let floodDepth =
      (calculatedWaterLevel * 0.5) +
      (calculatedRainfall / 100 * 0.3);

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
      {
        location,
        predictionDate: requestedDate,
        predictionPeriod: requestedPeriod
      },
      {
        location,
        latitude,
        longitude,
        rainfall: calculatedRainfall,
        waterLevel: calculatedWaterLevel,
        humidity: forecastInputs.humidity,
        predictionDate: requestedDate,
        predictionPeriod: requestedPeriod,

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
    const filter = {};
    if (req.query.date) {
      filter.predictionDate = normalizeDate(req.query.date);
    }
    if (req.query.period) {
      filter.predictionPeriod = normalizePeriod(req.query.period);
    }

    const predictions = await Prediction.find(filter);

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
        predictionDate: p.predictionDate,
        predictionPeriod: p.predictionPeriod,
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