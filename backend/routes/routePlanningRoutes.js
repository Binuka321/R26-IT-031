import express from 'express';
import Route from '../models/Route.js';
import Camp from '../models/Camp.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { RoutePlanningEngine } from '../utils/routePlanningEngine.js';
import { NotificationEngine } from '../utils/notificationEngine.js';

const router = express.Router();

router.post('/generate', authenticate, authorize('admin', 'disaster_officer', 'rescue_team'), async (req, res) => {
  try {
    const { camp_id, start_latitude, start_longitude, route_type = 'Safest', flood_zones = [], blocked_roads = [] } = req.body;

    const camp = await Camp.findById(camp_id);
    if (!camp) return res.status(404).json({ error: 'Camp not found' });

    const start = { latitude: start_latitude, longitude: start_longitude };
    const end = { latitude: camp.latitude, longitude: camp.longitude };

    const result = RoutePlanningEngine.generateRoute(start, end, { floodZones: flood_zones, blockedRoads: blocked_roads, routeType: route_type });

    const route = await Route.create({
      camp_id, route_name: `Route to ${camp.camp_name}`,
      start_latitude, start_longitude,
      end_latitude: camp.latitude, end_longitude: camp.longitude,
      ...result
    });

    if (route.safety_score < 50) {
      await NotificationEngine.alertUnsafeRoute(route, camp);
    }

    res.status(201).json({ status: 'success', data: route });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate route', details: error.message });
  }
});

router.get('/camp/:campId', authenticate, async (req, res) => {
  try {
    const { include_seed, mine } = req.query;
    const camp = await Camp.findById(req.params.campId);
    if (!camp) return res.status(404).json({ error: 'Camp not found' });

    if (mine === 'true' && req.user) {
      if (!camp.created_by || String(camp.created_by) !== String(req.user._id)) {
        return res.json({ status: 'success', data: [] });
      }
    } else if (include_seed !== 'true') {
      if (!camp.created_by) return res.json({ status: 'success', data: [] });
    }

    const routes = await Route.find({ camp_id: req.params.campId }).sort({ safety_score: -1 });
    res.json({ status: 'success', data: routes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routes', details: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const route = await Route.findById(req.params.id).populate('camp_id', 'camp_name');
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json({ status: 'success', data: route });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch route', details: error.message });
  }
});

router.post('/assign', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  try {
    const { route_id, team_id } = req.body;
    const route = await Route.findByIdAndUpdate(route_id, { assigned_team_id: team_id }, { new: true });
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json({ status: 'success', data: route });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign', details: error.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { include_seed, mine } = req.query;
    const campFilter = {};
    if (mine === 'true' && req.user) campFilter.created_by = req.user._id;
    else if (include_seed !== 'true') campFilter.created_by = { $ne: null };

    const camps = await Camp.find(campFilter).select('_id');
    const campIds = camps.map(c => c._id);

    let routes = [];
    if (campIds.length > 0) {
      routes = await Route.find({ camp_id: { $in: campIds } }).populate('camp_id', 'camp_name').sort({ createdAt: -1 });
    }
    res.json({ status: 'success', data: routes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch', details: error.message });
  }
});

export { router as routePlanningRouter };
