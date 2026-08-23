import DailyTrainingData from '../models/DailyTrainingData.js';
import ModelTrainingRun from '../models/ModelTrainingRun.js';
import SensorPackage from '../models/SensorPackage.js';
import { MLModelService } from './mlModelService.js';

const getDayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export async function captureDailySensorData(day = getDayKey()) {
  const packages = await SensorPackage.find({ ingestEnabled: true }).lean();
  if (!packages.length) return { day, captured: 0 };

  const operations = packages.map((pkg) => ({
    updateOne: {
      filter: { packageId: pkg._id, day },
      update: {
        packageId: pkg._id,
        day,
        location: pkg.location?.name || pkg.name,
        latitude: pkg.location?.latitude,
        longitude: pkg.location?.longitude,
        rainfall: pkg.currentReadings?.rainfall,
        waterLevel: pkg.currentReadings?.waterLevel,
        flowRate: pkg.currentReadings?.flowRate,
        turbidity: pkg.currentReadings?.turbidity,
        sourceTimestamp: pkg.lastUpdate || new Date()
      },
      upsert: true
    }
  }));

  await DailyTrainingData.bulkWrite(operations, { ordered: false });
  return { day, captured: operations.length };
}

export async function trainDailyModel(day = getDayKey()) {
  const existingRun = await ModelTrainingRun.findOne({ day }).lean();
  if (existingRun?.status === 'success') return existingRun;

  const rows = await DailyTrainingData.find({ day, riskLevel: { $exists: true, $ne: null } }).lean();
  if (!rows.length) {
    return ModelTrainingRun.findOneAndUpdate(
      { day },
      { day, status: 'skipped', samples: 0, message: 'No labeled daily sensor data is available.' },
      { upsert: true, returnDocument: 'after' }
    );
  }

  const rainfallData = rows.map((row) => ({
    date: row.day,
    district: row.location,
    latitude: row.latitude,
    longitude: row.longitude,
    rainfall_mm: Number(row.rainfall || 0)
  }));
  const floodImpactData = rows.map((row) => ({
    date: row.day,
    latitude: row.latitude,
    longitude: row.longitude,
    rainfall_mm: Number(row.rainfall || 0),
    elevation_m: 0,
    distance_to_river_m: 1000,
    water_level_m: Number(row.waterLevel || 0),
    risk_level: row.riskLevel
  }));

  try {
    const result = await MLModelService.trainModel(rainfallData, floodImpactData, `flood_model_daily_${day}`);
    return ModelTrainingRun.findOneAndUpdate(
      { day },
      { day, status: 'success', samples: rows.length, result, message: 'Daily model training completed.' },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (error) {
    return ModelTrainingRun.findOneAndUpdate(
      { day },
      { day, status: 'failed', samples: rows.length, error: error.message, message: 'Daily model training failed.' },
      { upsert: true, returnDocument: 'after' }
    );
  }
}

export async function runDailyTraining() {
  const day = getDayKey();
  const capture = await captureDailySensorData(day);
  const training = await trainDailyModel(day);
  return { capture, training };
}

export function startDailyTrainingScheduler() {
  const run = () => runDailyTraining().catch((error) => {
    console.error('Daily training job failed:', error.message);
  });

  run();
  const interval = setInterval(run, 24 * 60 * 60 * 1000);
  return () => clearInterval(interval);
}
