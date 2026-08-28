import express from 'express';
import mongoose from 'mongoose';
import SensorPackage from '../models/SensorPackage.js';
import BlockageReading from '../models/BlockageReading.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

function toClient(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    packageId: o.packageId.toString(),
    timestamp: o.timestamp,
    sensor1Distance: o.sensor1Distance,
    sensor2Distance: o.sensor2Distance,
    sensor3Distance: o.sensor3Distance,
    sensor1WaterLevel: o.sensor1WaterLevel,
    sensor2WaterLevel: o.sensor2WaterLevel,
    sensor3WaterLevel: o.sensor3WaterLevel,
    difference12: o.difference12,
    difference23: o.difference23,
    blockageDetected: Boolean(o.blockageDetected),
    blockageLocation: o.blockageLocation || 'NONE',
    unit: o.unit || 'm'
  };
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? NaN : n;
}

// Device ingest from blockage Arduino (separate from flood sensor ingest)
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

    const body = req.body || {};
    const { packageId, unit = 'm', timestamp, blockageDetected, blockageLocation } = body;

    if (!packageId || typeof packageId !== 'string') {
      return res.status(400).json({ message: 'packageId is required' });
    }
    if (!mongoose.isValidObjectId(packageId)) {
      return res.status(400).json({ message: 'packageId is not valid' });
    }

    const sensor1Distance = optionalNumber(body.sensor1Distance);
    const sensor2Distance = optionalNumber(body.sensor2Distance);
    const sensor3Distance = optionalNumber(body.sensor3Distance);
    const sensor1WaterLevel = optionalNumber(body.sensor1WaterLevel);
    const sensor2WaterLevel = optionalNumber(body.sensor2WaterLevel);
    const sensor3WaterLevel = optionalNumber(body.sensor3WaterLevel);
    const difference12 = optionalNumber(body.difference12);
    const difference23 = optionalNumber(body.difference23);

    const numericFields = [
      sensor1Distance,
      sensor2Distance,
      sensor3Distance,
      sensor1WaterLevel,
      sensor2WaterLevel,
      sensor3WaterLevel,
      difference12,
      difference23
    ];
    if (numericFields.some((n) => Number.isNaN(n))) {
      return res.status(400).json({ message: 'Sensor readings must be valid numbers' });
    }

    const pkg = await SensorPackage.findById(packageId);
    if (!pkg) {
      return res.status(404).json({ message: 'Sensor package not found' });
    }

    const readingTime = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(readingTime.getTime())) {
      return res.status(400).json({ message: 'Invalid timestamp' });
    }

    const doc = await BlockageReading.create({
      packageId: pkg._id,
      timestamp: readingTime,
      sensor1Distance,
      sensor2Distance,
      sensor3Distance,
      sensor1WaterLevel,
      sensor2WaterLevel,
      sensor3WaterLevel,
      difference12,
      difference23,
      blockageDetected: Boolean(blockageDetected),
      blockageLocation: typeof blockageLocation === 'string' && blockageLocation.trim()
        ? blockageLocation.trim()
        : 'NONE',
      unit: unit === 'ft' ? 'ft' : 'm'
    });

    return res.status(201).json({ ok: true, reading: toClient(doc) });
  } catch (err) {
    console.error('blockage-readings POST /ingest', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { packageId, limit = 1 } = req.query;
    if (!packageId || typeof packageId !== 'string') {
      return res.status(400).json({ message: 'packageId query is required' });
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 1, 1), 200);
    const docs = await BlockageReading.find({ packageId })
      .sort({ timestamp: -1 })
      .limit(parsedLimit);
    return res.json(docs.map((d) => toClient(d)));
  } catch (err) {
    console.error('blockage-readings GET', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

export { router as blockageReadingRouter };
