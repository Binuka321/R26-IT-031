import express from 'express';
import mongoose from 'mongoose';
import Distribution from '../models/Distribution.js';
import Camp from '../models/Camp.js';
import Resource from '../models/Resource.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { NotificationEngine } from '../utils/notificationEngine.js';
import { tryRecalculateCampPriority } from '../utils/campPriorityRecalculation.js';

const router = express.Router();

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * W9 Fix: Load all resources needed for an item_list in ONE query instead of N+1.
 * Returns a Map keyed by resource_name.
 */
async function fetchResourceMap(itemList, session = null) {
  const names = itemList.map(i => i.item_name);
  const query = Resource.find({ resource_name: { $in: names } });
  if (session) query.session(session);
  const resources = await query;
  return new Map(resources.map(r => [r.resource_name, r]));
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
    const { item_list } = req.body;
    const validationError = validateItemList(item_list);
    if (validationError) {
      await session.abortTransaction();
      return res.status(400).json({ error: validationError });
    }

    if (item_list && item_list.length > 0) {
      // W9 Fix: Single batch query for all resources
      const resourceMap = await fetchResourceMap(item_list, session);

      // Validate stock for ALL items before touching any
      for (const item of item_list) {
        const resource = resourceMap.get(item.item_name);
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
        const resource = resourceMap.get(item.item_name);
        resource.allocated_quantity += Number(item.quantity);
        await resource.save({ session });
      }
    }

    const distribution = await Distribution.create([req.body], { session });
    await session.commitTransaction();
    res.status(201).json({ status: 'success', data: distribution[0] });
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

// ─── GET single distribution ──────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const dist = await Distribution.findById(req.params.id)
      .populate('camp_id', 'camp_name latitude longitude')
      .populate('route_id')
      .populate('assigned_team_id', 'name');
    if (!dist) {
      await session.abortTransaction();
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
    const { status } = req.body;
    if (!['Pending', 'On the Way', 'Delivered', 'Partial', 'Failed'].includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid distribution status' });
    }
    const oldDist = await Distribution.findById(req.params.id).session(session);
    if (!oldDist) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Not found' });
    }

    const updateData = { status };
    if (status === 'On the Way') updateData.dispatched_at = new Date();
    if (status === 'Delivered' || status === 'Partial') updateData.completed_at = new Date();

    const dist = await Distribution.findByIdAndUpdate(req.params.id, updateData, { new: true, session })
      .populate('camp_id', 'camp_name');

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
        const resource = resourceMap.get(item.item_name);
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
        const resource = resourceMap.get(item.item_name);
        if (resource) {
          resource.allocated_quantity -= item.quantity;
          await resource.save({ session });
        }
        item.delivery_status = 'Unavailable';
      }
      await dist.save({ session });
      if (dist.camp_id) {
        await Camp.findByIdAndUpdate(
          dist.camp_id._id || dist.camp_id,
          {
            $max: { last_distribution_hours: 72 },
            $set: { last_updated: new Date() },
          },
          { session },
        );
      }
    }

    if (dist.camp_id) {
      await NotificationEngine.alertDeliveryStatus(dist, dist.camp_id, status);
    }

    await session.commitTransaction();
    const shouldRecalculate = ['Delivered', 'Partial', 'Failed'].includes(status);
    const priorityUpdate = shouldRecalculate && dist.camp_id
      ? await tryRecalculateCampPriority(
          dist.camp_id._id || dist.camp_id,
          `distribution_${status.toLowerCase().replaceAll(' ', '_')}`,
        )
      : null;
    res.json({ status: 'success', data: dist, priority_update: priorityUpdate });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Failed to update status', details: error.message });
  } finally {
    session.endSession();
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

        const resource = resourceMap.get(item.item_name);
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
    const dist = await Distribution.findByIdAndUpdate(req.params.id, { assigned_team_id: req.body.team_id }, { new: true });
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
        const resource = resourceMap.get(item.item_name);
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
