import express from 'express';
import Notification from '../models/Notification.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    // Filter by user role
    filter.$or = [
      { target_role: 'all' },
      { target_role: req.user.role }
    ];

    const notifications = await Notification.find(filter)
      .populate('related_camp_id', 'camp_name')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ status: 'success', data: notifications });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch', details: error.message });
  }
});

router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      status: 'unread',
      $or: [{ target_role: 'all' }, { target_role: req.user.role }]
    });
    res.json({ status: 'success', count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count', details: error.message });
  }
});

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { status: 'read' }, { new: true });
    if (!notification) return res.status(404).json({ error: 'Not found' });
    res.json({ status: 'success', data: notification });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update', details: error.message });
  }
});

router.put('/mark-all-read', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { status: 'unread', $or: [{ target_role: 'all' }, { target_role: req.user.role }] },
      { status: 'read' }
    );
    res.json({ status: 'success', message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update', details: error.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const notification = await Notification.create(req.body);
    res.status(201).json({ status: 'success', data: notification });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create', details: error.message });
  }
});

export { router as notificationRouter };
