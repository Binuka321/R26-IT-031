import express from 'express';
import mongoose from 'mongoose';
import Distribution from '../models/Distribution.js';
import Camp from '../models/Camp.js';
import Resource from '../models/Resource.js';
import Route from '../models/Route.js';
import DistributionCenter from '../models/DistributionCenter.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { NotificationEngine } from '../utils/notificationEngine.js';
import { tryRecalculateCampPriority } from '../utils/campPriorityRecalculation.js';

const router = express.Router();

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * W9 Fix: Load all resources needed for an item_list in ONE query instead of N+1.
 * Prefer resource_id so duplicate resource names cannot validate against the wrong stock row.
 */
async function fetchResourceMap(itemList, session = null) {
  const ids = itemList
    .map(i => i.resource_id)
    .filter(id => mongoose.Types.ObjectId.isValid(id));
  const names = itemList
    .filter(i => !i.resource_id)
    .map(i => i.item_name);
  const query = Resource.find({
    $or: [
      ...(ids.length ? [{ _id: { $in: ids } }] : []),
      ...(names.length ? [{ resource_name: { $in: names } }] : []),
    ],
  });
  if (session) query.session(session);
  const resources = await query;
  const resourceMap = new Map();
  for (const resource of resources) {
    resourceMap.set(String(resource._id), resource);
    if (!resourceMap.has(resource.resource_name)) {
      resourceMap.set(resource.resource_name, resource);
    }
  }
  return resourceMap;
}

function getResourceForItem(resourceMap, item) {
  return resourceMap.get(String(item.resource_id || '')) || resourceMap.get(item.item_name);
}

function addAudit(distribution, { action, from = '', to = '', note = '', userId = null }) {
  distribution.audit_trail.push({
    action,
    from,
    to,
    note,
    updated_by: userId,
    updated_at: new Date(),
  });
}

function validateItemList(itemList) {
  if (!Array.isArray(itemList) || itemList.length === 0) {
    return "At least one distribution item is required";
  }

  const seen = new Set();
  for (const item of itemList) {
    if (!item.item_name) return "Every distribution item must have a resource";
    if (seen.has(item.item_name)) {
      return `Duplicate item "${item.item_name}" is not allowed`;
    }
    seen.add(item.item_name);
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
      return `Quantity for "${item.item_name}" must be greater than 0`;
    }
  }

  return "";
}

/**
 * Map item_type → Camp stock field for W1 write-back.
 */
const ITEM_TYPE_TO_CAMP_FIELD = {
  food:     'food_available',
  water:    'water_available',
  medicine: 'medicine_available',
  sanitary: 'sanitary_available',
};

// ─── POST create distribution ─────────────────────────────────────────────────
router.post('/', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  // W10 Fix: Wrap validation + allocation in a MongoDB session transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { item_list, route_id, camp_id, distribution_center_id } = req.body;
    const validationError = validateItemList(item_list);
    if (validationError) {
      await session.abortTransaction();
      return res.status(400).json({ error: validationError });
    }

    const camp = await Camp.findById(camp_id).session(session);
    if (!camp) {
      await session.abortTransaction();
      return res.status(400).json({ error: "Selected camp was not found" });
    }

    if (route_id) {
      const route = await Route.findById(route_id).session(session);
      if (!route) {
        await session.abortTransaction();
        return res.status(400).json({ error: "Selected route was not found" });
      }
      if (String(route.camp_id) !== String(camp_id)) {
        await session.abortTransaction();
        return res.status(400).json({ error: "Selected route does not belong to this camp" });
      }
      if (['Blocked', 'Flooded'].includes(route.route_status)) {
        await session.abortTransaction();
        return res.status(400).json({ error: "Cannot create a distribution plan on a blocked or flooded route" });
      }
    }

    if (distribution_center_id) {
      const center = await DistributionCenter.findById(distribution_center_id).session(session);
      if (!center) {
        await session.abortTransaction();
        return res.status(400).json({ error: "Selected distribution center was not found" });
      }
      if (center.operating_status === "Closed") {
        await session.abortTransaction();
        return res.status(400).json({ error: "Selected distribution center is closed" });
      }
    }

    if (item_list && item_list.length > 0) {
      // W9 Fix: Single batch query for all resources
      const resourceMap = await fetchResourceMap(item_list, session);

      // Validate stock for ALL items before touching any
      for (const item of item_list) {
        const resource = getResourceForItem(resourceMap, item);
        if (!resource) {
          await session.abortTransaction();
          return res.status(400).json({ error: `Resource "${item.item_name}" not found in inventory` });
        }
        if (resource.available_quantity < Number(item.quantity)) {
          await session.abortTransaction();
          return res.status(400).json({
            error: `Insufficient stock for "${item.item_name}"`,
            available: resource.available_quantity,
          });
        }
      }

      // Allocate atomically within the transaction
      for (const item of item_list) {
        const resource = getResourceForItem(resourceMap, item);
        resource.allocated_quantity += Number(item.quantity);
        await resource.save({ session });
      }
    }

    const [distribution] = await Distribution.create([{
      ...req.body,
      distribution_center_id: distribution_center_id || null,
      approval_status: 'Pending Approval',
      audit_trail: [{
        action: 'created',
        from: '',
        to: 'Pending Approval',
        note: 'Distribution plan created and waiting for approval',
        updated_by: req.user.id,
        updated_at: new Date(),
      }],
    }], { session });
    await session.commitTransaction();
    const realtime_update = req.body.camp_id
      ? await tryRecalculateCampPriority(req.body.camp_id, 'distribution_plan_created')
      : null;
    await NotificationEngine.alertAdminAction({
      title: 'Distribution Plan Created',
      message: `Distribution #${distribution._id} was created and is waiting for approval.`,
      severity: 'info',
      target_role: 'disaster_officer',
      related_camp_id: distribution.camp_id,
      userId: req.user.id,
    });
    res.status(201).json({ status: 'success', data: distribution, realtime_update });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Failed to create distribution', details: error.message });
  } finally {
    session.endSession();
  }
});

// ─── GET all distributions ────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority_level, include_demo } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority_level) filter.priority_level = priority_level;
    if (include_demo !== "true") filter.is_demo = { $ne: true };

    const distributions = await Distribution.find(filter)
      .populate('camp_id', 'camp_name priority_level')
      .populate('route_id', 'route_name route_status safety_score distance estimated_time vehicle_type')
      .populate('distribution_center_id', 'name latitude longitude operating_status')
      .populate('assigned_team_id', 'name')
      .populate('approved_by', 'name username')
      .populate('audit_trail.updated_by', 'name username')
      .sort({ created_at: -1 });
    res.json({ status: 'success', data: distributions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch', details: error.message });
  }
});

// ─── GET single distribution ──────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const dist = await Distribution.findById(req.params.id)
      .populate('camp_id', 'camp_name latitude longitude')
      .populate('route_id')
      .populate('distribution_center_id')
      .populate('assigned_team_id', 'name')
      .populate('approved_by', 'name username')
      .populate('audit_trail.updated_by', 'name username');
    if (!dist) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ status: 'success', data: dist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch', details: error.message });
  }
});

// ─── PUT update delivery status ───────────────────────────────────────────────
router.put('/:id/status', authenticate, authorize('admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { status, failure_reason } = req.body;
    if (!['Pending', 'On the Way', 'Delivered', 'Partial', 'Failed'].includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid distribution status' });
    }
    const oldDist = await Distribution.findById(req.params.id).session(session);
    if (!oldDist) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Not found' });
    }
    if (status === 'On the Way' && oldDist.approval_status !== 'Approved') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Distribution must be approved before dispatch' });
    }
    const campBefore = oldDist.camp_id
      ? await Camp.findById(oldDist.camp_id).session(session)
      : null;
    const priorityBeforeDelivery = campBefore?.priority_score ?? null;

    const updateData = { status };
    if (failure_reason) updateData.failure_reason = failure_reason;
    if (status === 'On the Way') updateData.dispatched_at = new Date();
    if (status === 'Delivered' || status === 'Partial') updateData.completed_at = new Date();

    const dist = await Distribution.findByIdAndUpdate(req.params.id, updateData, { returnDocument: "after", session })
      .populate('camp_id', 'camp_name');
    addAudit(dist, {
      action: 'status_updated',
      from: oldDist.status,
      to: status,
      note: failure_reason || '',
      userId: req.user.id,
    });
    await dist.save({ session });

    // W9 Fix: Single batch resource lookup
    const resourceMap = await fetchResourceMap(dist.item_list, session);

    if ((status === 'Delivered' || status === 'Partial') &&
        oldDist.status !== 'Delivered' && oldDist.status !== 'Partial') {

      const campStockDelta = {};

      for (const item of dist.item_list) {
        // For Partial status, use delivered_quantity if set, else full quantity
        const qty = (status === 'Partial' && item.delivered_quantity != null)
          ? item.delivered_quantity
          : item.quantity;
        item.delivered_quantity = qty;
        item.delivery_status = qty >= item.quantity ? 'Delivered' : qty > 0 ? 'Partial' : 'Unavailable';

        // W9: use batch-loaded resourceMap
        const resource = getResourceForItem(resourceMap, item);
        if (resource) {
          resource.total_quantity     -= qty;
          resource.allocated_quantity -= item.quantity; // release original allocation
          await resource.save({ session });
        }

        // W1 Fix: Accumulate the delivered quantities per camp stock field
        const campField = ITEM_TYPE_TO_CAMP_FIELD[item.item_type];
        if (campField) {
          campStockDelta[campField] = (campStockDelta[campField] || 0) + qty;
        }
      }
      await dist.save({ session });

      // W1 Fix: Write delivered quantities back to the camp's stock fields
      if (dist.camp_id && Object.keys(campStockDelta).length > 0) {
        const campIncrements = {};
        for (const [field, delta] of Object.entries(campStockDelta)) {
          campIncrements[field] = delta;
        }
        const campUpdate = {
          $inc: campIncrements,
          $set: {
            last_distribution_hours: status === 'Delivered' ? 0 : 24,
            last_updated: new Date(),
          },
        };
        await Camp.findByIdAndUpdate(dist.camp_id._id || dist.camp_id, campUpdate, { session });
      }

    } else if (status === 'Failed' && oldDist.status !== 'Failed' && oldDist.status !== 'Delivered') {
      // Release allocations without deducting stock
      for (const item of dist.item_list) {
        const resource = getResourceForItem(resourceMap, item);
        if (resource) {
          resource.allocated_quantity -= item.quantity;
          await resource.save({ session });
        }
        item.delivery_status = 'Unavailable';
      }
      await dist.save({ session });
      if (dist.camp_id) {
        const reason = String(failure_reason || '').toLowerCase();
        const routeOrBridgeFailure =
          reason.includes('road') ||
          reason.includes('bridge') ||
          reason.includes('blocked') ||
          reason.includes('flood');
        await Camp.findByIdAndUpdate(
          dist.camp_id._id || dist.camp_id,
          {
            $max: { last_distribution_hours: 72 },
            $set: {
              ...(routeOrBridgeFailure ? { road_access_status: 'Blocked' } : {}),
              last_updated: new Date(),
            },
          },
          { session },
        );
        if (routeOrBridgeFailure && dist.route_id) {
          await Route.findByIdAndUpdate(
            dist.route_id,
            {
              route_status: 'Blocked',
              safety_score: 0,
              $push: {
                warnings: failure_reason || 'Route blocked after failed delivery feedback',
              },
            },
            { session },
          );
        }
      }
    }

    if (dist.camp_id) {
      await NotificationEngine.alertDeliveryStatus(dist, dist.camp_id, status, req.user.id);
    }

    await session.commitTransaction();
    const shouldRecalculate = ['Delivered', 'Partial', 'Failed'].includes(status);
    const priorityUpdate = shouldRecalculate && dist.camp_id
      ? await tryRecalculateCampPriority(
          dist.camp_id._id || dist.camp_id,
          `distribution_${status.toLowerCase().replaceAll(' ', '_')}`,
        )
      : null;
    if (shouldRecalculate && priorityUpdate?.recalculated) {
      await Distribution.findByIdAndUpdate(dist._id, {
        priority_before_delivery: priorityBeforeDelivery,
        priority_after_delivery: priorityUpdate.priority_score,
        relief_impact_score:
          priorityBeforeDelivery == null
            ? null
            : Math.max(0, Number(priorityBeforeDelivery) - Number(priorityUpdate.priority_score)),
      });
    }
    res.json({ status: 'success', data: dist, priority_update: priorityUpdate });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Failed to update status', details: error.message });
  } finally {
    session.endSession();
  }
});

// PUT approve/reject a distribution plan before dispatch
router.put('/:id/approval', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  try {
    const { approval_status, note = '' } = req.body;
    if (!['Approved', 'Rejected', 'Pending Approval'].includes(approval_status)) {
      return res.status(400).json({ error: 'Invalid approval status' });
    }

    const dist = await Distribution.findById(req.params.id);
    if (!dist) return res.status(404).json({ error: 'Not found' });
    if (dist.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending distributions can be approved or rejected' });
    }

    const previous = dist.approval_status;
    dist.approval_status = approval_status;
    dist.approved_by = approval_status === 'Approved' ? req.user.id : null;
    dist.approved_at = approval_status === 'Approved' ? new Date() : null;
    addAudit(dist, {
      action: 'approval_updated',
      from: previous,
      to: approval_status,
      note,
      userId: req.user.id,
    });
    await dist.save();

    await NotificationEngine.alertAdminAction({
      title: `Distribution ${approval_status}`,
      message: `Distribution #${dist._id} approval changed from ${previous} to ${approval_status}${note ? `: ${note}` : ''}.`,
      severity: approval_status === 'Rejected' ? 'warning' : 'info',
      target_role: 'disaster_officer',
      related_camp_id: dist.camp_id,
      userId: req.user.id,
    });

    res.json({ status: 'success', data: dist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update approval', details: error.message });
  }
});

// ─── PUT W13: Per-item delivery confirmation ──────────────────────────────────
// Allows field teams to confirm delivery of individual items (partial delivery support).
// Body: { items: [{ item_name, delivered_quantity }], partial_reason }
router.put('/:id/confirm-items', authenticate, authorize('admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, partial_reason } = req.body;
    const dist = await Distribution.findById(req.params.id).session(session);
    if (!dist) return res.status(404).json({ error: 'Not found' });
    const campBefore = dist.camp_id
      ? await Camp.findById(dist.camp_id).session(session)
      : null;
    const priorityBeforeDelivery = campBefore?.priority_score ?? null;
    if (dist.status === 'Delivered') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Distribution is already fully delivered' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Confirmed items are required' });
    }

    const confirmMap = new Map((items || []).map(i => [i.item_name, i.delivered_quantity]));
    const resourceMap = await fetchResourceMap(dist.item_list, session);
    const campStockDelta = {};

    // Update each item's delivered_quantity and delivery_status
    for (const item of dist.item_list) {
      if (confirmMap.has(item.item_name)) {
        const deliveredQty = Number(confirmMap.get(item.item_name));
        if (!Number.isFinite(deliveredQty) || deliveredQty < 0 || deliveredQty > item.quantity) {
          await session.abortTransaction();
          return res.status(400).json({
            error: `Delivered quantity for "${item.item_name}" must be between 0 and ${item.quantity}`,
          });
        }
        item.delivered_quantity = deliveredQty;
        if (deliveredQty <= 0) {
          item.delivery_status = 'Unavailable';
        } else if (deliveredQty < item.quantity) {
          item.delivery_status = 'Partial';
        } else {
          item.delivery_status = 'Delivered';
        }

        const resource = getResourceForItem(resourceMap, item);
        if (resource) {
          resource.total_quantity -= deliveredQty;
          resource.allocated_quantity -= item.quantity;
          if (resource.total_quantity < 0) resource.total_quantity = 0;
          if (resource.allocated_quantity < 0) resource.allocated_quantity = 0;
          await resource.save({ session });
        }

        const campField = ITEM_TYPE_TO_CAMP_FIELD[item.item_type];
        if (campField && deliveredQty > 0) {
          campStockDelta[campField] = (campStockDelta[campField] || 0) + deliveredQty;
        }
      }
    }

    // Compute overall status from item-level statuses
    const statuses = dist.item_list.map(i => i.delivery_status);
    const allDelivered  = statuses.every(s => s === 'Delivered');
    const anyDelivered  = statuses.some(s => s === 'Delivered' || s === 'Partial');
    const newStatus = allDelivered ? 'Delivered' : anyDelivered ? 'Partial' : 'Pending';

    dist.status = newStatus;
    if (newStatus !== 'Pending') dist.completed_at = new Date();
    if (partial_reason) dist.partial_reason = partial_reason;

    await dist.save({ session });
    if (dist.camp_id && Object.keys(campStockDelta).length > 0) {
      await Camp.findByIdAndUpdate(
        dist.camp_id,
        {
          $inc: campStockDelta,
          $set: {
            last_distribution_hours: newStatus === 'Delivered' ? 0 : 24,
            last_updated: new Date(),
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    const priorityUpdate = dist.camp_id
      ? await tryRecalculateCampPriority(
          dist.camp_id,
          `item_confirmation_${newStatus.toLowerCase()}`,
        )
      : null;
    if (priorityUpdate?.recalculated) {
      await Distribution.findByIdAndUpdate(dist._id, {
        priority_before_delivery: priorityBeforeDelivery,
        priority_after_delivery: priorityUpdate.priority_score,
        relief_impact_score:
          priorityBeforeDelivery == null
            ? null
            : Math.max(0, Number(priorityBeforeDelivery) - Number(priorityUpdate.priority_score)),
      });
    }
    res.json({ status: 'success', data: dist, priority_update: priorityUpdate });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Failed to confirm items', details: error.message });
  } finally {
    session.endSession();
  }
});

// ─── PUT assign team ──────────────────────────────────────────────────────────
router.put('/:id/assign-team', authenticate, authorize('admin', 'disaster_officer'), async (req, res) => {
  try {
    const dist = await Distribution.findByIdAndUpdate(req.params.id, { assigned_team_id: req.body.team_id }, { returnDocument: "after" });
    if (!dist) return res.status(404).json({ error: 'Not found' });
    res.json({ status: 'success', data: dist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign team', details: error.message });
  }
});

// ─── DELETE distribution ──────────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const dist = await Distribution.findById(req.params.id).session(session);
    if (!dist) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Not found' });
    }
    if (dist.status !== 'Delivered' && dist.status !== 'Failed') {
      // W9: Batch fetch resources for release
      const resourceMap = await fetchResourceMap(dist.item_list, session);
      for (const item of dist.item_list) {
        const resource = getResourceForItem(resourceMap, item);
        if (resource) {
          resource.allocated_quantity -= item.quantity;
          await resource.save({ session });
        }
      }
    }
    await Distribution.findByIdAndDelete(req.params.id).session(session);
    await session.commitTransaction();
    res.json({ status: 'success', message: 'Distribution deleted' });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Failed to delete', details: error.message });
  } finally {
    session.endSession();
  }
});

// ─── GET stats ────────────────────────────────────────────────────────────────
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const total    = await Distribution.countDocuments();
    const pending  = await Distribution.countDocuments({ status: 'Pending' });
    const onTheWay = await Distribution.countDocuments({ status: 'On the Way' });
    const delivered = await Distribution.countDocuments({ status: 'Delivered' });
    const partial  = await Distribution.countDocuments({ status: 'Partial' });
    const failed   = await Distribution.countDocuments({ status: 'Failed' });
    res.json({ status: 'success', data: { total, pending, onTheWay, delivered, partial, failed } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

export { router as distributionRouter };

