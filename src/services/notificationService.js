/**
 * SetuSight — Notification Service
 * Dispatches database-backed alerts for critical findings, inspection schedules, and maintenance tasks.
 */
const dbService = require('./dbService');

class NotificationService {
  /**
   * Dispatches a notification to Supabase
   */
  async notify({ recipientId, bridgeId, type, title, message }) {
    try {
      const payload = {
        recipient_id: recipientId || null,
        bridge_id: bridgeId || null,
        type: type, // 'inspection_due' | 'critical_finding' | 'maintenance_required' | 'maintenance_due' | 'maintenance_completed' | 'contractor_assigned'
        title: title,
        message: message,
        is_read: false
      };

      return await dbService.createNotification(payload);
    } catch (err) {
      console.warn('Failed to record notification in database:', err.message);
      // Non-blocking for primary transaction
      return null;
    }
  }

  /**
   * Helper: Alert admins on critical crack findings
   */
  async notifyCriticalFinding(bridge, inspection) {
    return this.notify({
      bridgeId: bridge.id,
      type: 'critical_finding',
      title: `Critical Alert: ${bridge.bridge_name}`,
      message: `Inspection detected ${inspection.crack_severity.toUpperCase()} severity cracks (${inspection.crack_count} detected). Bridge health score adjusted to ${inspection.health_score}.`
    });
  }

  /**
   * Helper: Notify contractor upon work order assignment
   */
  async notifyContractorAssigned(contractor, bridge, maintenance) {
    return this.notify({
      bridgeId: bridge.id,
      type: 'contractor_assigned',
      title: `Maintenance Assignment: ${bridge.bridge_name}`,
      message: `Work order (${maintenance.priority} priority) scheduled for ${maintenance.scheduled_date}. Please review required repair scope.`
    });
  }
}

module.exports = new NotificationService();
