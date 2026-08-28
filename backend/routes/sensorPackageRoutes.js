import express from 'express';
import mongoose from 'mongoose';
import SensorPackage from '../models/SensorPackage.js';
import SensorReading from '../models/SensorReading.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

function toClient(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    name: o.name,
    location: o.location,
    sensors: o.sensors,
    boards: o.boards,
    ingestEnabled: o.ingestEnabled ?? true,
    waterLevelSettings: o.waterLevelSettings ?? undefined,
    status: o.status,
    lastUpdate: o.lastUpdate,
    currentReadings: o.currentReadings || {},
    sensorPoints: Array.isArray(o.sensorPoints)
      ? o.sensorPoints.map((point) => ({
          id: point._id ? String(point._id) : undefined,
          name: point.name || '',
          latitude: point.latitude,
          longitude: point.longitude
        }))
      : []
  };
}

function parseSensorPoints(rawPoints) {
  if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
    return { error: 'Add at least one sensor point' };
  }
  if (rawPoints.length > 20) {
    return { error: 'You can add at most 20 sensor points at a time' };
  }

  const points = [];
  for (let i = 0; i < rawPoints.length; i += 1) {
    const row = rawPoints[i] || {};
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!name) {
      return { error: `Point ${i + 1} needs a name` };
    }
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return { error: `Point ${i + 1} needs valid latitude and longitude` };
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return { error: `Point ${i + 1} has coordinates outside the valid range` };
    }
    points.push({ name, latitude, longitude });
  }

  return { points };
}

async function savePointsToPackage(packageId, points) {
  if (!packageId || !mongoose.isValidObjectId(packageId)) {
    return { error: 'Select a valid sensor package', status: 400 };
  }

  const updated = await SensorPackage.findByIdAndUpdate(
    packageId,
    { $push: { sensorPoints: { $each: points } } },
    { returnDocument: 'after', runValidators: true }
  );

  if (!updated) {
    return { error: 'Sensor package not found', status: 404 };
  }

  return { doc: updated };
}

// Staff-visible: list sensor packages for flood maps and operations dashboards
router.get('/', authenticate, authorize('admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'), async (req, res) => {
  try {
    const items = await SensorPackage.find().sort({ createdAt: -1 });
    res.json(items.map((d) => toClient(d)));
  } catch (err) {
    console.error('sensor-packages GET', err);
    res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// Admin-only: add named lat/lng sensor points to a package
router.post('/points', authenticate, authorize('admin'), async (req, res) => {
  try {
    const packageId = req.body?.packageId;
    const parsed = parseSensorPoints(req.body?.points);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const result = await savePointsToPackage(packageId, parsed.points);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(201).json(toClient(result.doc));
  } catch (err) {
    console.error('sensor-packages POST /points', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// Admin-only: create sensor package
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, location, sensors, boards, waterLevelSettings } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Package name is required' });
    }
    if (
      !location ||
      !location.name ||
      !location.basin ||
      !location.river ||
      !location.station ||
      location.latitude === undefined ||
      location.longitude === undefined ||
      !location.address
    ) {
      return res.status(400).json({ message: 'Complete location details are required' });
    }
    if (!boards || (!boards.esp32 && !boards.uno)) {
      return res.status(400).json({ message: 'Select at least one board (ESP32 or UNO)' });
    }

    const ultraCount = Math.max(0, Number(sensors?.ultrasonic) || 0);
    let persistedWaterLevels = undefined;
    if (ultraCount > 0) {
      if (!waterLevelSettings || typeof waterLevelSettings !== 'object') {
        return res.status(400).json({ message: 'Water level unit and flood thresholds are required when ultrasonic sensors are used' });
      }
      const unit = waterLevelSettings.unit;
      if (unit !== 'ft' && unit !== 'm') {
        return res.status(400).json({ message: 'Water level unit must be ft or m' });
      }
      const alertLevel = Number(waterLevelSettings.alertLevel);
      const minorFloodLevel = Number(waterLevelSettings.minorFloodLevel);
      const majorFloodLevel = Number(waterLevelSettings.majorFloodLevel);
      if ([alertLevel, minorFloodLevel, majorFloodLevel].some((n) => Number.isNaN(n))) {
        return res.status(400).json({ message: 'Alert Level, Minor Flood Level, and Major Flood Level must be valid numbers' });
      }
      if (alertLevel < 0 || minorFloodLevel < 0 || majorFloodLevel < 0) {
        return res.status(400).json({ message: 'Water level thresholds must not be negative' });
      }
      persistedWaterLevels = { unit, alertLevel, minorFloodLevel, majorFloodLevel };
    }

    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ message: 'Invalid latitude or longitude' });
    }

    const doc = await SensorPackage.create({
      name: name.trim(),
      location: {
        name: String(location.name).trim(),
        basin: String(location.basin).trim(),
        river: String(location.river).trim(),
        station: String(location.station).trim(),
        latitude: lat,
        longitude: lng,
        address: String(location.address).trim()
      },
      sensors: {
        ultrasonic: Math.max(0, Number(sensors?.ultrasonic) || 0),
        flow: Math.max(0, Number(sensors?.flow) || 0),
        rain: Math.max(0, Number(sensors?.rain) || 0),
        turbidity: Math.max(0, Number(sensors?.turbidity) || 0)
      },
      boards: {
        esp32: Boolean(boards.esp32),
        uno: Boolean(boards.uno)
      },
      ...(persistedWaterLevels ? { waterLevelSettings: persistedWaterLevels } : {}),
      status: 'active',
      lastUpdate: new Date(),
      currentReadings: {},
      sensorPoints: []
    });

    res.status(201).json(toClient(doc));
  } catch (err) {
    console.error('sensor-packages POST', err);
    res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// Admin-only: update sensor package
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, sensors, boards, waterLevelSettings, status, ingestEnabled } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Package name is required' });
    }
    if (
      !location ||
      !location.name ||
      !location.basin ||
      !location.river ||
      !location.station ||
      location.latitude === undefined ||
      location.longitude === undefined ||
      !location.address
    ) {
      return res.status(400).json({ message: 'Complete location details are required' });
    }
    if (!boards || (!boards.esp32 && !boards.uno)) {
      return res.status(400).json({ message: 'Select at least one board (ESP32 or UNO)' });
    }

    const ultraCount = Math.max(0, Number(sensors?.ultrasonic) || 0);
    let persistedWaterLevels = undefined;
    if (ultraCount > 0) {
      if (!waterLevelSettings || typeof waterLevelSettings !== 'object') {
        return res.status(400).json({ message: 'Water level unit and flood thresholds are required when ultrasonic sensors are used' });
      }
      const unit = waterLevelSettings.unit;
      if (unit !== 'ft' && unit !== 'm') {
        return res.status(400).json({ message: 'Water level unit must be ft or m' });
      }
      const alertLevel = Number(waterLevelSettings.alertLevel);
      const minorFloodLevel = Number(waterLevelSettings.minorFloodLevel);
      const majorFloodLevel = Number(waterLevelSettings.majorFloodLevel);
      if ([alertLevel, minorFloodLevel, majorFloodLevel].some((n) => Number.isNaN(n))) {
        return res.status(400).json({ message: 'Alert Level, Minor Flood Level, and Major Flood Level must be valid numbers' });
      }
      if (alertLevel < 0 || minorFloodLevel < 0 || majorFloodLevel < 0) {
        return res.status(400).json({ message: 'Water level thresholds must not be negative' });
      }
      persistedWaterLevels = { unit, alertLevel, minorFloodLevel, majorFloodLevel };
    }

    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ message: 'Invalid latitude or longitude' });
    }

    const doc = await SensorPackage.findById(id);
    if (!doc) {
      return res.status(404).json({ message: 'Sensor package not found' });
    }

    doc.name = name.trim();
    doc.location = {
      name: String(location.name).trim(),
      basin: String(location.basin).trim(),
      river: String(location.river).trim(),
      station: String(location.station).trim(),
      latitude: lat,
      longitude: lng,
      address: String(location.address).trim()
    };
    doc.sensors = {
      ultrasonic: Math.max(0, Number(sensors?.ultrasonic) || 0),
      flow: Math.max(0, Number(sensors?.flow) || 0),
      rain: Math.max(0, Number(sensors?.rain) || 0),
      turbidity: Math.max(0, Number(sensors?.turbidity) || 0)
    };
    doc.boards = {
      esp32: Boolean(boards.esp32),
      uno: Boolean(boards.uno)
    };
    if (typeof ingestEnabled === 'boolean') {
      doc.ingestEnabled = ingestEnabled;
    }
    doc.waterLevelSettings = persistedWaterLevels;
    if (status === 'active' || status === 'inactive' || status === 'warning') {
      doc.status = status;
    }

    await doc.save();
    return res.json(toClient(doc));
  } catch (err) {
    console.error('sensor-packages PUT', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// Admin-only: toggle ingest enable/disable (data collection)
router.patch('/:id/ingest', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { ingestEnabled } = req.body || {};
    if (typeof ingestEnabled !== 'boolean') {
      return res.status(400).json({ message: 'ingestEnabled must be boolean' });
    }
    const doc = await SensorPackage.findById(id);
    if (!doc) {
      return res.status(404).json({ message: 'Sensor package not found' });
    }
    doc.ingestEnabled = ingestEnabled;
    await doc.save();
    return res.json(toClient(doc));
  } catch (err) {
    console.error('sensor-packages PATCH /ingest', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// Admin-only: add sensor points (lat/lng) to a package
router.post('/:id/points', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = parseSensorPoints(req.body?.points);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const result = await savePointsToPackage(id, parsed.points);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(201).json(toClient(result.doc));
  } catch (err) {
    console.error('sensor-packages POST /points', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// Admin-only: delete sensor package
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await SensorPackage.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Sensor package not found' });
    }
    await Promise.all([
      SensorReading.deleteMany({ packageId: existing._id }),
      SensorPackage.findByIdAndDelete(id)
    ]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('sensor-packages DELETE', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

export { router as sensorPackageRouter };

