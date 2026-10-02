/**
 * SetuSight — Analytics Controller
 */
const dbService = require('../services/dbService');

class AnalyticsController {
  /**
   * GET /api/analytics/overview
   * Consolidated statistics for Admin Dashboard
   */
  async getOverview(req, res, next) {
    try {
      const bridges = await dbService.getAllBridges();
      const inspections = await dbService.getAllInspections();
      const maintenance = await dbService.getAllMaintenance();
      const contractors = await dbService.getAllContractors();

      // Counts
      const totalBridges = bridges.length;
      const healthyBridges = bridges.filter(b => b.current_health_status === 'Good').length;
      const warningBridges = bridges.filter(b => b.current_health_status === 'Moderate').length;
      const criticalBridges = bridges.filter(b => b.current_health_status === 'Attention Required').length;

      const totalInspections = inspections.length;
      const maintenanceDue = maintenance.filter(m => m.status === 'Scheduled' || m.status === 'In Progress' || m.status === 'Overdue').length;

      // Health Distribution
      const healthDistribution = {
        good: healthyBridges,
        moderate: warningBridges,
        attention: criticalBridges
      };

      // Severity Distribution of inspections
      const severityDistribution = {
        none: inspections.filter(i => i.crack_severity === 'none').length,
        low: inspections.filter(i => i.crack_severity === 'low').length,
        moderate: inspections.filter(i => i.crack_severity === 'moderate').length,
        high: inspections.filter(i => i.crack_severity === 'high').length,
        critical: inspections.filter(i => i.crack_severity === 'critical').length,
        pending: inspections.filter(i => i.crack_severity === 'pending').length
      };

      // Maintenance Status Distribution
      const maintenanceStatus = {
        scheduled: maintenance.filter(m => m.status === 'Scheduled').length,
        in_progress: maintenance.filter(m => m.status === 'In Progress').length,
        completed: maintenance.filter(m => m.status === 'Completed').length,
        overdue: maintenance.filter(m => m.status === 'Overdue').length
      };

      // Contractor Performance
      const contractorStats = contractors.map(c => {
        const cMaint = maintenance.filter(m => m.contractor_id === c.id);
        const completed = cMaint.filter(m => m.status === 'Completed').length;
        const overdue = cMaint.filter(m => m.status === 'Overdue').length;
        return {
          id: c.id,
          name: c.company_name,
          flag: c.flag_status,
          total: cMaint.length,
          completed,
          overdue,
          score: cMaint.length > 0 ? Math.round((completed / cMaint.length) * 100) : 100
        };
      });

      // Recent inspections
      const recentInspections = inspections.slice(0, 5);

      // Maintenance Due list
      const upcomingMaintenance = maintenance
        .filter(m => m.status !== 'Completed')
        .slice(0, 5);

      res.json({
        success: true,
        data: {
          metrics: {
            totalBridges,
            healthyBridges,
            warningBridges,
            criticalBridges,
            totalInspections,
            maintenanceDue
          },
          healthDistribution,
          severityDistribution,
          maintenanceStatus,
          contractorStats,
          recentInspections,
          upcomingMaintenance
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
