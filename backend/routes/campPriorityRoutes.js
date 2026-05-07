import express from 'express';
import Camp from '../models/Camp.js';
import PriorityPrediction from '../models/PriorityPrediction.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { CampPriorityEngine } from '../utils/campPriorityEngine.js';
import { NotificationEngine } from '../utils/notificationEngine.js';

const router = express.Router();

// POST predict priority for a camp
router.post('/camp-priority', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  try {
    const { camp_id } = req.body;
    const camp = await Camp.findById(camp_id);
    if (!camp) return res.status(404).json({ error: 'Camp not found' });

    const result = CampPriorityEngine.calculatePriority(camp);

    const prediction = await PriorityPrediction.findOneAndUpdate(
      { camp_id },
      { camp_id, ...result, predicted_at: new Date(), prediction_source: 'rule_based', model_version: 'rule_based_v1' },
      { upsert: true, new: true }
    );

    // Update camp priority
    await Camp.findByIdAndUpdate(camp_id, {
      priority_level: result.priority_level,
      priority_score: result.priority_score
    });

    await NotificationEngine.alertHighPriorityCamp(camp, result);

    res.json({ status: 'success', data: prediction });
  } catch (error) {
    res.status(500).json({ error: 'Failed to predict priority', details: error.message });
  }
});

// GET prediction for a camp
router.get('/camp/:campId', authenticate, async (req, res) => {
  try {
    const prediction = await PriorityPrediction.findOne({ camp_id: req.params.campId })
      .sort({ predicted_at: -1 });
    if (!prediction) return res.status(404).json({ error: 'No prediction found' });
    res.json({ status: 'success', data: prediction });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prediction', details: error.message });
  }
});

// POST recalculate all camps
router.post('/recalculate-all', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  try {
    const camps = await Camp.find({ status: 'Active' });
    const results = [];

    for (const camp of camps) {
      const result = CampPriorityEngine.calculatePriority(camp);
      const prediction = await PriorityPrediction.findOneAndUpdate(
        { camp_id: camp._id },
        { camp_id: camp._id, ...result, predicted_at: new Date(), prediction_source: 'rule_based', model_version: 'rule_based_v1' },
        { upsert: true, new: true }
      );
      await Camp.findByIdAndUpdate(camp._id, {
        priority_level: result.priority_level,
        priority_score: result.priority_score
      });
      results.push({ camp_name: camp.camp_name, ...result });
    }

    const ranked = CampPriorityEngine.rankCamps(results);
    res.json({ status: 'success', data: ranked, total: ranked.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to recalculate', details: error.message });
  }
});

// GET all predictions
router.get('/', authenticate, async (req, res) => {
  try {
    const predictions = await PriorityPrediction.find()
      .populate('camp_id', 'camp_name population priority_level')
      .sort({ priority_score: -1 });
    res.json({ status: 'success', data: predictions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch predictions', details: error.message });
  }
});

export { router as campPriorityRouter };
