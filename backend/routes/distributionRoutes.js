import express from 'express';
import Distribution from '../models/Distribution.js';
import Camp from '../models/Camp.js';
import Resource from '../models/Resource.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { NotificationEngine } from '../utils/notificationEngine.js';

const router = express.Router();

router.post('/', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  try {
    const distribution = await Distribution.create(req.body);
    res.status(201).json({ status: 'success', data: distribution });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create distribution', details: error.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority_level } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority_level) filter.priority_level = priority_level;

    const distributions = await Distribution.find(filter)
      .populate('camp_id', 'camp_name priority_level')
      .populate('assigned_team_id', 'name')
      .sort({ created_at: -1 });
    res.json({ status: 'success', data: distributions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch', details: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const dist = await Distribution.findById(req.params.id)
      .populate('camp_id', 'camp_name latitude longitude')
      .populate('route_id')
      .populate('assigned_team_id', 'name');
    if (!dist) return res.status(404).json({ error: 'Not found' });
    res.json({ status: 'success', data: dist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch', details: error.message });
  }
});

router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const updateData = { status };
    if (status === 'On the Way') updateData.dispatched_at = new Date();
    if (status === 'Delivered') updateData.completed_at = new Date();

    const dist = await Distribution.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('camp_id', 'camp_name');
    if (!dist) return res.status(404).json({ error: 'Not found' });

    if (dist.camp_id) {
      await NotificationEngine.alertDeliveryStatus(dist, dist.camp_id, status);
    }
    res.json({ status: 'success', data: dist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status', details: error.message });
  }
});

router.put('/:id/assign-team', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  try {
    const dist = await Distribution.findByIdAndUpdate(req.params.id, { assigned_team_id: req.body.team_id }, { new: true });
    if (!dist) return res.status(404).json({ error: 'Not found' });
    res.json({ status: 'success', data: dist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign team', details: error.message });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Distribution.findByIdAndDelete(req.params.id);
    res.json({ status: 'success', message: 'Distribution deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete', details: error.message });
  }
});

// Stats
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const total = await Distribution.countDocuments();
    const pending = await Distribution.countDocuments({ status: 'Pending' });
    const onTheWay = await Distribution.countDocuments({ status: 'On the Way' });
    const delivered = await Distribution.countDocuments({ status: 'Delivered' });
    const failed = await Distribution.countDocuments({ status: 'Failed' });
    res.json({ status: 'success', data: { total, pending, onTheWay, delivered, failed } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

export { router as distributionRouter };
