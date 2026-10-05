/**
 * SetuSight — Notification Service (Phase 3A Full Logic Fix)
 * 
 * Rules:
 * 1. Admin notifications MUST be delivered to real users where users.role = 'admin'
 * 2. Contractor notifications MUST be delivered to real users associated with the contractor
 * 3. Notifications MUST be idempotent within a 10-minute window to avoid duplicate spam
 *    from dashboard polling, page refreshes, and retries.
 * 4. Allowed types per Supabase schema:
 *    'inspection_due' | 'critical_finding' | 'maintenance_required' | 'maintenance_due' | 'maintenance_completed' | 'contractor_assigned'
 */
const dbService = require('./dbService');

class NotificationService {
  /**
   * Internal deduplication cache: key -> timestamp
   */
  static _dedupCache = new Map();

  /**
   * Dispatches an idempotent notification to Supabase
   */
  async notify({ recipientId, bridgeId, type, title, message }) {
    try {
      // 10-minute deduplication key: recipient + bridge + type + title
      const dedupKey = `${recipientId || 'broadcast'}:${bridgeId || 'global'}:${type}:${title}`;
      const now = Date.now();
      const lastSent = NotificationService._dedupCache.get(dedupKey);

      if (lastSent && (now - lastSent) < 10 * 60 * 1000) {
        console.log(`[NotificationService] Suppressed duplicate alert: ${dedupKey}`);
        return null;
      }

      const payload = {
        recipient_id: recipientId || null,
        bridge_id: bridgeId || null,
        type: type,
        title: title,
        message: message,
        is_read: false
      };

      const result = await dbService.createNotification(payload);
      NotificationService._dedupCache.set(dedupKey, now);

      // Clean old cache entries occasionally
      if (NotificationService._dedupCache.size > 200) {
        for (const [k, v] of NotificationService._dedupCache.entries()) {
          if (now - v > 30 * 60 * 1000) {
            NotificationService._dedupCache.delete(k);
          }
        }
      }

      return result;
    } catch (err) {
      console.warn('[NotificationService] Failed to record notification in database:', err.message);
      return null;
    }
  }

  /**
   * Dispatches notification to ALL active system administrators
   */
  async notifyAdmins({ bridgeId, type, title, message }) {
    try {
      const admins = await dbService.getUsersByRole('admin');
      if (admins && admins.length > 0) {
        const promises = admins.map(admin =>
          this.notify({
            recipientId: admin.id,
            bridgeId,
            type,
            title,
            message
          })
        );
        return await Promise.all(promises);
      } else {
        // Fallback broadcast if no explicit admin account found
        return [await this.notify({ recipientId: null, bridgeId, type, title, message })];
      }
    } catch (err) {
      console.warn('[NotificationService] Error notifying admins:', err.message);
      return null;
    }
  }

  /**
   * Helper: Alert all admins on critical / attention-required inspection findings
   */
  async notifyCriticalFinding(bridge, inspection, sessionMetrics = {}) {
    const bridgeName = bridge?.bridge_name || 'Bridge Asset';
    const worstSev = (inspection?.crack_severity || sessionMetrics?.worstSeverity || 'high').toUpperCase();
    const count = inspection?.crack_count ?? sessionMetrics?.totalCrackCount ?? 0;
    const score = inspection?.health_score ?? bridge?.current_health_score ?? 50;
    const patches = sessionMetrics?.totalPatches ? ` (${sessionMetrics.affectedPatchCount || 0}/${sessionMetrics.totalPatches} patches affected)` : '';

    return this.notifyAdmins({
      bridgeId: bridge.id,
      type: 'critical_finding',
      title: `Critical Alert: ${bridgeName}`,
      message: `Inspection detected ${worstSev} severity cracks (${count} cracks observed${patches}). Bridge health score adjusted to ${score} (${inspection?.health_status || 'Attention Required'}). Immediate review required.`
    });
  }

  /**
   * Helper: Alert all admins when bridge health requires maintenance intervention
   */
  async notifyMaintenanceRequired(bridge, priority = 'High', reason = '') {
    const bridgeName = bridge?.bridge_name || 'Bridge Asset';
    return this.notifyAdmins({
      bridgeId: bridge.id,
      type: 'maintenance_required',
      title: `Maintenance Required: ${bridgeName}`,
      message: `Bridge ${bridgeName} has been flagged for ${priority} priority maintenance. Health score: ${bridge.current_health_score} (${bridge.current_health_status}). ${reason}`
    });
  }

  /**
   * Helper: Notify contractor upon work order assignment
   */
  async notifyContractorAssigned(contractor, bridge, maintenance) {
    try {
      const bridgeName = bridge?.bridge_name || 'Bridge Asset';
      let contractorUsers = [];

      if (contractor && contractor.id) {
        contractorUsers = await dbService.getUsersByContractorId(contractor.id);
      }

      // Also check by contractor email if no users returned by contractor_id
      if (contractorUsers.length === 0 && contractor && contractor.email) {
        const u = await dbService.getUserByEmail(contractor.email);
        if (u) contractorUsers.push(u);
      }

      const title = `Maintenance Assignment: ${bridgeName}`;
      const message = `Work order (${maintenance.priority || 'Medium'} priority) scheduled for ${maintenance.scheduled_date}. Scope: ${maintenance.remarks || 'Structural crack repair'}.`;

      if (contractorUsers.length > 0) {
        const promises = contractorUsers.map(user =>
          this.notify({
            recipientId: user.id,
            bridgeId: bridge.id,
            type: 'contractor_assigned',
            title,
            message
          })
        );
        return await Promise.all(promises);
      } else {
        // If contractor has no linked user account, notify admins
        return this.notifyAdmins({
          bridgeId: bridge.id,
          type: 'contractor_assigned',
          title,
          message: `${message} (Assigned to firm: ${contractor?.company_name || 'Contractor'})`
        });
      }
    } catch (err) {
      console.warn('[NotificationService] Error notifying contractor:', err.message);
      return null;
    }
  }

  /**
   * Helper: Notify admins upon maintenance completion
   */
  async notifyMaintenanceCompleted(bridge, maintenance) {
    const bridgeName = bridge?.bridge_name || 'Bridge Asset';
    return this.notifyAdmins({
      bridgeId: bridge.id,
      type: 'maintenance_completed',
      title: `Maintenance Completed: ${bridgeName}`,
      message: `Work order for ${bridgeName} marked Completed on ${maintenance.completion_date || new Date().toISOString().split('T')[0]}. Bridge structural health reassessed.`
    });
  }
}

module.exports = new NotificationService();
