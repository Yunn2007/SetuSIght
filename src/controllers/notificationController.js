/**
 * SetuSight — Notification Controller
 */
const dbService = require('../services/dbService');

class NotificationController {
  /**
   * GET /api/notifications
   */
  async getNotifications(req, res, next) {
    try {
      const recipientId = req.user ? req.user.id : null;
      const notifications = await dbService.getNotifications(req.user?.role === 'admin' ? null : recipientId);

      const unreadCount = notifications.filter(n => !n.is_read).length;

      res.json({
        success: true,
        unreadCount,
        data: notifications
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/notifications/:id/read
   */
  async markRead(req, res, next) {
    try {
      const recipientId = req.user?.role === 'admin' ? null : req.user.id;
      const updated = await dbService.markNotificationRead(req.params.id, recipientId);
      res.json({
        success: true,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/notifications/read-all
   */
  async markAllRead(req, res, next) {
    try {
      const recipientId = req.user?.role === 'admin' ? null : req.user.id;
      await dbService.markAllNotificationsRead(recipientId);
      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
