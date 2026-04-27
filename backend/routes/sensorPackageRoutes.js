import express from 'express';
import SensorPackage from '../models/SensorPackage.js';
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
    status: o.status,
    lastUpdate: o.lastUpdate,
    currentReadings: o.currentReadings || {}
  };
}

// Admin-only: list sensor packages
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const items = await SensorPackage.find().sort({ createdAt: -1 });
    res.json(items.map((d) => toClient(d)));
  } catch (err) {
    console.error('sensor-packages GET', err);
    res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// Admin-only: create sensor package
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, location, sensors, boards } = req.body || {};

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
      status: 'active',
      lastUpdate: new Date(),
      currentReadings: {}
    });

    res.status(201).json(toClient(doc));
  } catch (err) {
    console.error('sensor-packages POST', err);
    res.status(500).json({ message: err?.message || 'Server error' });
  }
});

export { router as sensorPackageRouter };

