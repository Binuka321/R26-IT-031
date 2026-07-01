import express from 'express';
import NeedReport from '../models/NeedReport.js';
import Distribution from '../models/Distribution.js';
import Camp from '../models/Camp.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { tryRecalculateCampPriority } from '../utils/campPriorityRecalculation.js';
import { calculateNeedReportImpact } from '../utils/needReportImpact.js';

const router = express.Router();

async function applyNeedReportRealtimeUpdate(report, feedbackEvent) {
  if (!report?.camp_id) return null;

  if (
    report.need_type === 'Road Blockage' &&
    ['Pending', 'In Progress', 'Responded'].includes(report.status)
  ) {
    await Camp.findByIdAndUpdate(report.camp_id, {
      road_access_status: 'Blocked',
      last_updated: new Date(),
    });
  }

  const impact = await calculateNeedReportImpact(report.camp_id);
  await NeedReport.updateMany(
    {
      camp_id: report.camp_id,
      status: { $in: ['Pending', 'In Progress', 'Responded'] },
    },
    {
      impact_score: impact.impact_score,
      priority_boost_applied: Math.min(20, Math.round(impact.impact_score * 0.2)),
    },
  );

  return tryRecalculateCampPriority(report.camp_id, feedbackEvent);
}

// POST submit a report (Any authenticated user)
router.post('/', authenticate, async (req, res) => {
  try {
    const report = await NeedReport.create({
      ...req.body,
      created_by: req.user.id
    });
    const realtime_update = await applyNeedReportRealtimeUpdate(report, 'need_report_submitted');
    res.status(201).json({ status: 'success', data: report, realtime_update });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit report', details: error.message });
  }
});

// GET all reports (Staff only)
router.get('/', authenticate, authorize('admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'), async (req, res) => {
  try {
    const filter = req.query.include_demo === 'true' ? {} : { is_demo: { $ne: true } };
    const reports = await NeedReport.find(filter)
      .populate('created_by', 'name username')
      .populate('camp_id', 'camp_name')
      .populate('safe_zone_id', 'name')
      .populate('resolved_by', 'name')
      .sort({ createdAt: -1 });
    res.json({ status: 'success', data: reports });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports', details: error.message });
  }
});

// GET my reports
router.get('/my-reports', authenticate, async (req, res) => {
  try {
    const reports = await NeedReport.find({
      created_by: req.user.id,
      ...(req.query.include_demo === 'true' ? {} : { is_demo: { $ne: true } }),
    }).sort({ createdAt: -1 });
    res.json({ status: 'success', data: reports });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your reports', details: error.message });
  }
});

// PUT update status (Staff only)
// W2 Fix: record who resolved the report and when
router.put('/:id/status', authenticate, authorize('admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'), async (req, res) => {
  try {
    const { status } = req.body;
    const updatePayload = { status };

    if (status === 'Resolved') {
      updatePayload.resolved_by = req.user.id;
      updatePayload.resolved_at = new Date();
    }

    const report = await NeedReport.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const realtime_update = await applyNeedReportRealtimeUpdate(report, 'need_report_status_update');
    res.json({ status: 'success', data: report, realtime_update });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report status', details: error.message });
  }
});

// PUT update report details (Creator or Admin)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isCreator = String(report.created_by) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && (!isCreator || report.status !== 'Pending')) {
      return res.status(403).json({ error: 'Unauthorized to edit this report in its current state' });
    }

    const updated = await NeedReport.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    const realtime_update = await applyNeedReportRealtimeUpdate(updated, 'need_report_detail_update');
    res.json({ status: 'success', data: updated, realtime_update });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report', details: error.message });
  }
});

// DELETE report (Creator if Pending, or Admin)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isCreator = String(report.created_by) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && (!isCreator || report.status !== 'Pending')) {
      return res.status(403).json({ error: 'Unauthorized to delete this report' });
    }

    await NeedReport.findByIdAndDelete(req.params.id);
    res.json({ status: 'success', message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete report', details: error.message });
  }
});

// POST W15 Fix: Convert a NeedReport into a Distribution plan
// Accepts: { camp_id, priority_level, delivery_method, notes }
// This links the need report to a distribution and marks the report as "In Progress"
router.post('/:id/convert-to-distribution', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  try {
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.converted_distribution_id) {
      return res.status(400).json({ error: 'This report has already been converted to a distribution plan' });
    }

    const { camp_id, priority_level, delivery_method, notes } = req.body;
    const targetCampId = camp_id || report.camp_id;
    if (!targetCampId) {
      return res.status(400).json({ error: 'No camp linked to this report. Provide camp_id in request body.' });
    }

    // Map need_type to item_type
    const needTypeMap = {
      'Food':          'food',
      'Water':         'water',
      'Medical':       'medicine',
      'Shelter':       'emergency',
      'Rescue':        'emergency',
      'Road Blockage': 'emergency',
      'Other':         'emergency',
    };
    const itemType = needTypeMap[report.need_type] || 'emergency';

    const distribution = await Distribution.create({
      camp_id: targetCampId,
      priority_level: priority_level || (report.severity === 'Emergency' || report.severity === 'Critical' ? 'High' : 'Medium'),
      delivery_method: delivery_method || 'truck',
      item_list: [{
        item_name: report.need_type,
        item_type: itemType,
        quantity: report.people_count || 1,
        unit: 'units',
      }],
      notes: notes || `Auto-generated from Need Report #${report._id}. Reporter: ${report.reporter_name}. ${report.description}`,
      status: 'Pending',
    });

    // Link the distribution back to the report and update report status
    await NeedReport.findByIdAndUpdate(req.params.id, {
      converted_distribution_id: distribution._id,
      status: 'In Progress',
    });
    const realtime_update = await tryRecalculateCampPriority(targetCampId, 'need_report_converted_to_distribution');

    res.status(201).json({
      status: 'success',
      message: 'Distribution plan created from need report',
      data: { distribution, report_id: report._id },
      realtime_update,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to convert report to distribution', details: error.message });
  }
});

export { router as needReportRouter };
