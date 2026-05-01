/**
 * Notification Engine — Auto-generates alerts for critical system events
 */
import Notification from '../models/Notification.js';

export class NotificationEngine {

  static async createNotification({ title, message, type, severity = 'info', target_role = 'all', related_camp_id = null }) {
    try {
      return await Notification.create({
        title,
        message,
        type,
        severity,
        target_role,
        related_camp_id
      });
    } catch (err) {
      console.error('Notification creation error:', err.message);
    }
  }

  /**
   * Alert when camp priority is High
   */
  static async alertHighPriorityCamp(camp, priorityResult) {
    if (priorityResult.priority_level === 'High') {
      await this.createNotification({
        title: `High Priority Camp: ${camp.camp_name}`,
        message: `Camp "${camp.camp_name}" has been classified as HIGH priority with a score of ${priorityResult.priority_score}/100. Immediate support required.`,
        type: 'priority_alert',
        severity: 'critical',
        target_role: 'disaster_officer',
        related_camp_id: camp._id
      });
    }
  }

  /**
   * Alert for disease risk
   */
  static async alertDiseaseRisk(camp, diseaseResult) {
    if (diseaseResult.risk_level === 'High') {
      await this.createNotification({
        title: `Disease Alert: ${camp.camp_name}`,
        message: `High disease risk detected at "${camp.camp_name}". Disease: ${diseaseResult.disease_type}. Medicine urgency: ${diseaseResult.medicine_urgency}.`,
        type: 'disease_alert',
        severity: 'critical',
        target_role: 'all',
        related_camp_id: camp._id
      });
    }
  }

  /**
   * Alert for low resource stock
   */
  static async alertLowStock(resource) {
    if (resource.available_quantity <= resource.low_stock_threshold) {
      await this.createNotification({
        title: `Low Stock Alert: ${resource.resource_name}`,
        message: `${resource.resource_name} stock is critically low. Available: ${resource.available_quantity} ${resource.unit}. Threshold: ${resource.low_stock_threshold} ${resource.unit}.`,
        type: 'low_stock',
        severity: 'warning',
        target_role: 'admin'
      });
    }
  }

  /**
   * Alert for unsafe route
   */
  static async alertUnsafeRoute(route, camp) {
    if (route.safety_score < 50) {
      await this.createNotification({
        title: `Unsafe Route Warning`,
        message: `Route to camp "${camp.camp_name}" has a low safety score of ${route.safety_score}/100. Consider alternative routes.`,
        type: 'route_alert',
        severity: 'warning',
        target_role: 'rescue_team',
        related_camp_id: camp._id
      });
    }
  }

  /**
   * Alert for delivery status
   */
  static async alertDeliveryStatus(distribution, camp, status) {
    const severityMap = { 'Failed': 'critical', 'On the Way': 'info', 'Delivered': 'info' };
    await this.createNotification({
      title: `Delivery ${status}: ${camp.camp_name}`,
      message: `Distribution #${distribution._id} to "${camp.camp_name}" status updated to: ${status}.`,
      type: 'delivery_alert',
      severity: severityMap[status] || 'info',
      target_role: 'disaster_officer',
      related_camp_id: camp._id
    });
  }
}

export default NotificationEngine;
