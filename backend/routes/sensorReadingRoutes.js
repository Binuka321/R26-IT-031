import express from 'express';
import SensorPackage from '../models/SensorPackage.js';
import SensorReading from '../models/SensorReading.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

function toClient(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    packageId: o.packageId.toString(),
    timestamp: o.timestamp,
    waterLevel: o.waterLevel,
    unit: o.unit,
    flowRate: o.flowRate,
    rainfall: o.rainfall,
    turbidity: o.turbidity
  };
}

// Device ingest endpoint (ESP32)
router.post('/ingest', async (req, res) => {
  try {
    const expectedKey = process.env.DEVICE_INGEST_KEY;
    if (!expectedKey) {
      return res.status(500).json({ message: 'DEVICE_INGEST_KEY is not configured' });
    }

    const providedKey = req.headers['x-device-key'];
    if (providedKey !== expectedKey) {
      return res.status(401).json({ message: 'Invalid device key' });
    }

    const { packageId, waterLevel, unit = 'm', timestamp, flowRate, rainfall, turbidity } = req.body || {};
    if (!packageId || typeof packageId !== 'string') {
      return res.status(400).json({ message: 'packageId is required' });
    }
    if (waterLevel === undefined || Number.isNaN(Number(waterLevel))) {
      return res.status(400).json({ message: 'waterLevel must be a valid number' });
    }
    if (unit !== 'm' && unit !== 'ft') {
      return res.status(400).json({ message: 'unit must be m or ft' });
    }

    const pkg = await SensorPackage.findById(packageId);
    if (!pkg) {
      return res.status(404).json({ message: 'Sensor package not found' });
    }

    const readingTime = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(readingTime.getTime())) {
      return res.status(400).json({ message: 'Invalid timestamp' });
    }

    const doc = await SensorReading.create({
      packageId: pkg._id,
      timestamp: readingTime,
      waterLevel: Number(waterLevel),
      unit,
      flowRate: flowRate === undefined ? undefined : Number(flowRate),
      rainfall: rainfall === undefined ? undefined : Number(rainfall),
      turbidity: turbidity === undefined ? undefined : Number(turbidity)
    });

    pkg.currentReadings = {
      ...pkg.currentReadings,
      waterLevel: doc.waterLevel,
      flowRate: doc.flowRate ?? pkg.currentReadings?.flowRate,
      rainfall: doc.rainfall ?? pkg.currentReadings?.rainfall,
      turbidity: doc.turbidity ?? pkg.currentReadings?.turbidity
    };
    pkg.lastUpdate = readingTime;
    await pkg.save();

    return res.status(201).json({ ok: true, reading: toClient(doc) });
  } catch (err) {
    console.error('sensor-readings POST /ingest', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// Admin UI historical readings
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { packageId, limit = 200 } = req.query;
    if (!packageId || typeof packageId !== 'string') {
      return res.status(400).json({ message: 'packageId query is required' });
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    const docs = await SensorReading.find({ packageId })
      .sort({ timestamp: 1 })
      .limit(parsedLimit);
    return res.json(docs.map((d) => toClient(d)));
  } catch (err) {
    console.error('sensor-readings GET', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

export { router as sensorReadingRouter };
