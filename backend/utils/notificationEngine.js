/**
 * Notification Engine — Auto-generates alerts for critical system events
 */
import Notification from '../models/Notification.js';
import NotificationDelivery from '../models/NotificationDelivery.js';

export class NotificationEngine {

  static async createNotification({ title, message, type, severity = 'info', target_role = 'all', related_camp_id = null, created_by = null, dedupe = true }) {
    try {
      // W12 Fix: Deduplication — suppress identical unread alerts within a 1-hour window
      // to prevent alert fatigue during repeated priority recalculations.
      if (dedupe) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const existing = await Notification.findOne({
          type,
          title,
          message,
          ...(related_camp_id ? { related_camp_id } : {}),
          status: 'unread',
          createdAt: { $gte: oneHourAgo }
        });
        if (existing) return existing; // Silently suppress the duplicate
      }

      const notification = await Notification.create({
        title,
        message,
        type,
        severity,
      target_role,
      related_camp_id,
      created_by
      });
      await this.queueExternalAlerts(notification);
      return notification;
    } catch (err) {
      console.error('Notification creation error:', err.message);
    }
  }

  static async queueExternalAlerts(notification) {
    if (!notification || !["critical", "warning"].includes(notification.severity)) return;
    const channels = notification.severity === "critical"
      ? ["sms", "email", "whatsapp"]
      : ["email"];
    await NotificationDelivery.insertMany(
      channels.map((channel) => ({
        notification_id: notification._id,
        channel,
        recipient_role: notification.target_role || "all",
        title: notification.title,
        message: notification.message,
        status: "queued",
        provider: process.env[`${channel.toUpperCase()}_PROVIDER`] || "manual_gateway_pending",
      })),
      { ordered: false },
    ).catch(() => {});
  }

  /**
   * Generic notification for accountable admin/staff changes.
   */
  static async alertAdminAction({ title, message, severity = 'info', target_role = 'all', related_camp_id = null, userId = null }) {
    await this.createNotification({
      title,
      message,
      type: 'system',
      severity,
      target_role,
      related_camp_id,
      created_by: userId,
      dedupe: false,
    });
  }

  /**
   * Alert when camp priority is High
   */
  static async alertHighPriorityCamp(camp, priorityResult, userId = null) {
    if (priorityResult.priority_level === 'High') {
      await this.createNotification({
        title: `High Priority Camp: ${camp.camp_name}`,
        message: `Camp "${camp.camp_name}" has been classified as HIGH priority with a score of ${priorityResult.priority_score}/100. Immediate support required.`,
        type: 'priority_alert',
        severity: 'critical',
        target_role: 'disaster_officer',
        related_camp_id: camp._id,
        created_by: userId
      });
    }
  }

  /**
   * Alert for disease risk
   */
  static async alertDiseaseRisk(camp, diseaseResult, userId = null) {
    if (diseaseResult.risk_level === 'High') {
      await this.createNotification({
        title: `Disease Alert: ${camp.camp_name}`,
        message: `High disease risk detected at "${camp.camp_name}". Disease: ${diseaseResult.disease_type}. Medicine urgency: ${diseaseResult.medicine_urgency}.`,
        type: 'disease_alert',
        severity: 'critical',
        target_role: 'all',
        related_camp_id: camp._id,
        created_by: userId
      });
    }
  }

  /**
   * Alert for low resource stock
   */
  static async alertLowStock(resource, userId = null) {
    if (resource.available_quantity <= resource.low_stock_threshold) {
      await this.createNotification({
        title: `Low Stock Alert: ${resource.resource_name}`,
        message: `${resource.resource_name} stock is critically low. Available: ${resource.available_quantity} ${resource.unit}. Threshold: ${resource.low_stock_threshold} ${resource.unit}.`,
        type: 'low_stock',
        severity: 'warning',
        target_role: 'admin',
        created_by: userId
      });
    }
  }

  /**
   * Alert for unsafe route
   */
  static async alertUnsafeRoute(route, camp, userId = null) {
    if (route.safety_score < 50) {
      await this.createNotification({
        title: `Unsafe Route Warning`,
        message: `Route to camp "${camp.camp_name}" has a low safety score of ${route.safety_score}/100. Consider alternative routes.`,
        type: 'route_alert',
        severity: 'warning',
        target_role: 'rescue_team',
        related_camp_id: camp._id,
        created_by: userId
      });
    }
  }

  /**
   * Alert for delivery status
   */
  static async alertDeliveryStatus(distribution, camp, status, userId = null) {
    const severityMap = { 'Failed': 'critical', 'On the Way': 'info', 'Delivered': 'info' };
    await this.createNotification({
      title: `Delivery ${status}: ${camp.camp_name}`,
      message: `Distribution #${distribution._id} to "${camp.camp_name}" status updated to: ${status}.`,
      type: 'delivery_alert',
      severity: severityMap[status] || 'info',
      target_role: 'disaster_officer',
      related_camp_id: camp._id,
      created_by: userId
    });
  }
}

export default NotificationEngine;
