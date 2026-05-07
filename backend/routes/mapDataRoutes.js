import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// In-memory store for map data (from Member 1 & 2)
let mapData = { flood_zones: [], water_levels: [], safe_zone_candidates: [], blocked_roads: [] };

router.post('/', authenticate, async (req, res) => {
  try {
    const { flood_zones, water_levels, safe_zone_candidates, blocked_roads } = req.body;
    if (flood_zones) mapData.flood_zones = flood_zones;
    if (water_levels) mapData.water_levels = water_levels;
    if (safe_zone_candidates) mapData.safe_zone_candidates = safe_zone_candidates;
    if (blocked_roads) mapData.blocked_roads = blocked_roads;
    mapData.updated_at = new Date();
    res.json({ status: 'success', message: 'Map data updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update map data', details: error.message });
  }
});

router.get('/flood-zones', authenticate, (req, res) => {
  res.json({ status: 'success', data: mapData.flood_zones });
});

router.get('/water-levels', authenticate, (req, res) => {
  res.json({ status: 'success', data: mapData.water_levels });
});

router.get('/safe-zones', authenticate, (req, res) => {
  res.json({ status: 'success', data: mapData.safe_zone_candidates });
});

router.get('/blocked-roads', authenticate, (req, res) => {
  res.json({ status: 'success', data: mapData.blocked_roads });
});

export { router as mapDataRouter };
