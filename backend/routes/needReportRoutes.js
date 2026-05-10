import express from 'express';
import NeedReport from '../models/NeedReport.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST submit a report (Any authenticated user)
router.post('/', authenticate, async (req, res) => {
  try {
    const report = await NeedReport.create({
      ...req.body,
      created_by: req.user.id
    });
    res.status(201).json({ status: 'success', data: report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit report', details: error.message });
  }
});

// GET all reports (Staff only)
router.get('/', authenticate, authorize('admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'), async (req, res) => {
  try {
    const reports = await NeedReport.find().populate('created_by', 'name username').sort({ createdAt: -1 });
    res.json({ status: 'success', data: reports });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports', details: error.message });
  }
});

// GET my reports
router.get('/my-reports', authenticate, async (req, res) => {
  try {
    const reports = await NeedReport.find({ created_by: req.user.id }).sort({ createdAt: -1 });
    res.json({ status: 'success', data: reports });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your reports', details: error.message });
  }
});

// PUT update status (Staff only)
router.put('/:id/status', authenticate, authorize('admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'), async (req, res) => {
  try {
    const report = await NeedReport.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ status: 'success', data: report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report status', details: error.message });
  }
});

// PUT update report details (Creator or Admin)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Only creator can edit if Pending, or Admin anytime
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
    res.json({ status: 'success', data: updated });
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

export { router as needReportRouter };
