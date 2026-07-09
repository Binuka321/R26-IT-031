import express from 'express';
import fetch from 'node-fetch';
import NeedReport from '../models/NeedReport.js';
import Distribution from '../models/Distribution.js';
import Camp from '../models/Camp.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { tryRecalculateCampPriority } from '../utils/campPriorityRecalculation.js';
import { calculateNeedReportImpact } from '../utils/needReportImpact.js';
import { NotificationEngine } from '../utils/notificationEngine.js';

const router = express.Router();
const NEED_TYPES = ['Food', 'Water', 'Medical', 'Rescue', 'Shelter', 'Road Blockage', 'Flood Level', 'Other'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical', 'Emergency'];
const REPORT_STATUSES = ['Pending', 'In Progress', 'Responded', 'Resolved'];

function validateNeedReportPayload(data, { partial = false } = {}) {
  const errors = [];
  const check = (condition, message) => {
    if (condition) errors.push(message);
  };

  if (!partial || data.reporter_name !== undefined) {
    check(!String(data.reporter_name || '').trim(), 'Reporter name is required');
    check(String(data.reporter_name || '').trim().length > 80, 'Reporter name is too long');
  }
  if (!partial || data.contact_phone !== undefined) {
    const phone = String(data.contact_phone || '').replace(/\s/g, '');
    check(!/^(?:\+94|0)[0-9]{9}$/.test(phone), 'Contact phone must be a valid Sri Lankan number');
  }
  if (!partial || data.latitude !== undefined) {
    const latitude = Number(data.latitude);
    check(!Number.isFinite(latitude) || latitude < 5 || latitude > 10, 'Latitude must be inside Sri Lanka');
  }
  if (!partial || data.longitude !== undefined) {
    const longitude = Number(data.longitude);
    check(!Number.isFinite(longitude) || longitude < 79 || longitude > 82, 'Longitude must be inside Sri Lanka');
  }
  if (!partial || data.need_type !== undefined) {
    check(!NEED_TYPES.includes(data.need_type), 'Invalid need type');
  }
  if (!partial || data.severity !== undefined) {
    check(!SEVERITIES.includes(data.severity), 'Invalid severity');
  }
  if (!partial || data.people_count !== undefined) {
    const people = Number(data.people_count);
    check(!Number.isFinite(people) || people < 1, 'People count must be at least 1');
    check(people > 1000, 'People count looks too large for one report');
  }
  if (data.description !== undefined) {
    check(String(data.description || '').length > 500, 'Description is too long');
  }
  if (data.status !== undefined) {
    check(!REPORT_STATUSES.includes(data.status), 'Invalid report status');
  }

  return errors;
}

async function findDuplicateReport(data, userId, excludeId = null) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const filter = {
    createdAt: { $gte: since },
    status: { $in: ['Pending', 'In Progress', 'Responded'] },
    need_type: data.need_type,
    contact_phone: String(data.contact_phone || '').replace(/\s/g, ''),
  };
  if (excludeId) filter._id = { $ne: excludeId };
  if (userId) filter.created_by = userId;

  const candidates = await NeedReport.find(filter).lean();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  return candidates.find((report) => {
    const latDiff = Math.abs(Number(report.latitude) - latitude);
    const lngDiff = Math.abs(Number(report.longitude) - longitude);
    return latDiff <= 0.01 && lngDiff <= 0.01;
  }) || null;
}

function parseCoordinatesFromGoogleMapsText(text = '') {
  const decoded = decodeURIComponent(String(text));
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|destination|origin|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return { latitude, longitude };
    }
  }

  return null;
}

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

// POST resolve Google Maps link into coordinates
router.post('/resolve-map-link', authenticate, async (req, res) => {
  try {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) return res.status(400).json({ error: 'Google Maps link is required' });

    const directCoordinates = parseCoordinatesFromGoogleMapsText(rawUrl);
    if (directCoordinates) {
      return res.json({ status: 'success', data: directCoordinates, source: 'direct' });
    }

    if (!/^https?:\/\//i.test(rawUrl)) {
      return res.status(400).json({ error: 'Please paste a valid Google Maps URL' });
    }

    const response = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FloodManager/1.0)',
      },
    });
    const finalUrl = response.url || rawUrl;
    const redirectedCoordinates = parseCoordinatesFromGoogleMapsText(finalUrl);

    if (redirectedCoordinates) {
      return res.json({
        status: 'success',
        data: redirectedCoordinates,
        source: 'redirect',
      });
    }

    const bodyText = await response.text().catch(() => '');
    const bodyCoordinates = parseCoordinatesFromGoogleMapsText(bodyText);
    if (bodyCoordinates) {
      return res.json({ status: 'success', data: bodyCoordinates, source: 'page' });
    }

    return res.status(422).json({
      error: 'Could not find coordinates in this map link',
      message: 'Open Google Maps, choose the place, then copy a link that contains the pin location.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve map link', details: error.message });
  }
});

// POST submit a report (Any authenticated user)
router.post('/', authenticate, async (req, res) => {
  try {
    const validationErrors = validateNeedReportPayload(req.body);
    if (validationErrors.length) {
      return res.status(400).json({ error: validationErrors[0], errors: validationErrors });
    }

    const duplicate = await findDuplicateReport(req.body, req.user.id);
    const duplicateGroupKey = duplicate
      ? `${req.user.id}:${req.body.need_type}:${String(req.body.contact_phone || '').replace(/\s/g, '')}`
      : '';
    const report = await NeedReport.create({
      ...req.body,
      contact_phone: String(req.body.contact_phone || '').replace(/\s/g, ''),
      possible_duplicate: Boolean(duplicate),
      duplicate_group_key: duplicateGroupKey,
      validation_notes: duplicate ? ['Possible duplicate report submitted within 24 hours near the same location'] : [],
      created_by: req.user.id
    });
    if (duplicate) {
      await NotificationEngine.createNotification({
        title: 'Possible duplicate need report',
        message: `A similar ${report.need_type} report was submitted near the same location within 24 hours.`,
        type: 'system',
        severity: 'warning',
        target_role: 'disaster_officer',
        related_camp_id: report.camp_id || null,
        created_by: req.user.id,
      });
    }
    const realtime_update = await applyNeedReportRealtimeUpdate(report, 'need_report_submitted');
    res.status(201).json({ status: 'success', data: report, realtime_update, duplicate_warning: Boolean(duplicate) });
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
      .populate('assigned_rescue_team_id', 'name username role')
      .populate('rescue_history.updated_by', 'name username')
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

// GET rescue operations queue (Staff only)
router.get('/rescue-operations', authenticate, authorize('admin', 'disaster_officer', 'rescue_team'), async (req, res) => {
  try {
    const filter = {
      need_type: 'Rescue',
      ...(req.query.include_demo === 'true' ? {} : { is_demo: { $ne: true } }),
    };
    if (req.query.status) filter.rescue_status = req.query.status;

    const reports = await NeedReport.find(filter)
      .populate('created_by', 'name username')
      .populate('camp_id', 'camp_name latitude longitude road_access_status priority_level')
      .populate('safe_zone_id', 'name latitude longitude safety_status')
      .populate('resolved_by', 'name username')
      .populate('assigned_rescue_team_id', 'name username role')
      .populate('rescue_history.updated_by', 'name username')
      .sort({ rescue_status: 1, severity: -1, createdAt: -1 });

    res.json({ status: 'success', data: reports });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rescue operations', details: error.message });
  }
});

// PUT assign a rescue team to a rescue report
router.put('/:id/rescue-assignment', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  try {
    const { assigned_rescue_team_id, note = '', rescue_transport_mode = 'truck' } = req.body;
    const transportMode = ['truck', 'boat'].includes(rescue_transport_mode)
      ? rescue_transport_mode
      : 'truck';
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.need_type !== 'Rescue') {
      return res.status(400).json({ error: 'Only Rescue reports can be assigned to rescue teams' });
    }

    const status = assigned_rescue_team_id ? 'Assigned' : 'Unassigned';
    report.assigned_rescue_team_id = assigned_rescue_team_id || null;
    report.rescue_status = status;
    report.rescue_transport_mode = transportMode;
    report.status = assigned_rescue_team_id ? 'In Progress' : 'Pending';
    report.rescue_assigned_at = assigned_rescue_team_id ? new Date() : null;
    report.rescue_history.push({
      status,
      note: note || (assigned_rescue_team_id ? `Rescue team assigned by ${transportMode}` : 'Rescue team assignment cleared'),
      updated_by: req.user.id,
      updated_at: new Date(),
    });

    await report.save();
    res.json({ status: 'success', data: report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign rescue team', details: error.message });
  }
});

// PUT update rescue mission progress
router.put('/:id/rescue-status', authenticate, authorize('admin', 'disaster_officer', 'rescue_team'), async (req, res) => {
  try {
    const { rescue_status, note = '', rescue_transport_mode } = req.body;
    const allowedStatuses = ['Unassigned', 'Assigned', 'En Route', 'Rescuing', 'Rescued', 'Closed'];
    if (!allowedStatuses.includes(rescue_status)) {
      return res.status(400).json({ error: 'Invalid rescue status' });
    }

    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.need_type !== 'Rescue') {
      return res.status(400).json({ error: 'Only Rescue reports can use rescue status updates' });
    }

    report.rescue_status = rescue_status;
    if (['truck', 'boat'].includes(rescue_transport_mode)) {
      report.rescue_transport_mode = rescue_transport_mode;
    }
    report.rescue_notes = note || report.rescue_notes;
    if (rescue_status === 'Unassigned') report.status = 'Pending';
    if (['Assigned', 'En Route', 'Rescuing'].includes(rescue_status)) report.status = 'In Progress';
    if (rescue_status === 'Rescued') report.status = 'Responded';
    if (rescue_status === 'Closed') {
      report.status = 'Resolved';
      report.resolved_by = req.user.id;
      report.resolved_at = new Date();
      report.rescue_completed_at = new Date();
    }
    report.rescue_history.push({
      status: rescue_status,
      note,
      updated_by: req.user.id,
      updated_at: new Date(),
    });

    await report.save();
    const realtime_update = await applyNeedReportRealtimeUpdate(report, 'rescue_status_update');
    res.json({ status: 'success', data: report, realtime_update });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update rescue status', details: error.message });
  }
});

// PUT update status (Staff only)
// W2 Fix: record who resolved the report and when
router.put('/:id/status', authenticate, authorize('admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid report status' });
    }
    const updatePayload = { status };

    if (status === 'Resolved') {
      updatePayload.resolved_by = req.user.id;
      updatePayload.resolved_at = new Date();
    }

    const report = await NeedReport.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { returnDocument: "after" }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const realtime_update = await applyNeedReportRealtimeUpdate(report, 'need_report_status_update');
    res.json({ status: 'success', data: report, realtime_update });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report status', details: error.message });
  }
});

const EDITABLE_REPORT_FIELDS = [
  'reporter_name',
  'latitude',
  'longitude',
  'location_name',
  'gps_accuracy_meters',
  'need_type',
  'severity',
  'people_count',
  'contact_phone',
  'description',
];

function pickEditableReportFields(data) {
  return EDITABLE_REPORT_FIELDS.reduce((payload, field) => {
    if (data[field] !== undefined) payload[field] = data[field];
    return payload;
  }, {});
}

// PUT update report details (Creator only while Pending)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isCreator = String(report.created_by) === String(req.user.id);

    if (!isCreator || report.status !== 'Pending') {
      return res.status(403).json({ error: 'Only the original requester can edit a pending report' });
    }

    const updatePayload = pickEditableReportFields(req.body);
    if (!Object.keys(updatePayload).length) {
      return res.status(400).json({ error: 'No editable report fields provided' });
    }

    const validationErrors = validateNeedReportPayload(updatePayload, { partial: true });
    if (validationErrors.length) {
      return res.status(400).json({ error: validationErrors[0], errors: validationErrors });
    }

    const updated = await NeedReport.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { returnDocument: "after" }
    );
    const realtime_update = await applyNeedReportRealtimeUpdate(updated, 'need_report_detail_update');
    res.json({ status: 'success', data: updated, realtime_update });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report', details: error.message });
  }
});

// DELETE report (Creator only while Pending)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isCreator = String(report.created_by) === String(req.user.id);

    if (!isCreator || report.status !== 'Pending') {
      return res.status(403).json({ error: 'Only the original requester can delete a pending report' });
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

