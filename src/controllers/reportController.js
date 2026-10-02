/**
 * SetuSight — Report Controller
 */
const dbService = require('../services/dbService');

class ReportController {
  /**
   * GET /api/reports
   */
  async getAllReports(req, res, next) {
    try {
      const reports = await dbService.getAllReports();
      res.json({
        success: true,
        count: reports.length,
        data: reports
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reports/:id
   */
  async getReportById(req, res, next) {
    try {
      const report = await dbService.getReportById(req.params.id);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report record not found'
        });
      }

      // Fetch comprehensive bridge details & history for dossier rendering
      const bridge = await dbService.getBridgeById(report.bridge_id);
      const inspections = await dbService.getInspectionsByBridgeId(report.bridge_id);
      const maintenance = await dbService.getMaintenanceByBridgeId(report.bridge_id);

      res.json({
        success: true,
        data: {
          ...report,
          bridge_details: bridge,
          all_inspections: inspections,
          all_maintenance: maintenance
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/reports/generate
   * Admin & Inspector: Generate a structured dossier
   */
  async generateReport(req, res, next) {
    try {
      const { bridge_id, inspection_id, report_type } = req.body;

      if (!bridge_id || !report_type) {
        return res.status(400).json({
          success: false,
          error: 'bridge_id and report_type are mandatory'
        });
      }

      const bridge = await dbService.getBridgeById(bridge_id);
      if (!bridge) {
        return res.status(404).json({
          success: false,
          error: 'Bridge structure not found'
        });
      }

      const reportData = {
        bridge_id: bridge.id,
        inspection_id: inspection_id || null,
        report_type: report_type,
        file_url: `/report-view.html?bridge_id=${bridge.id}`
      };

      const created = await dbService.createReport(reportData);

      res.status(201).json({
        success: true,
        message: 'Report dossier generated successfully',
        data: created
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportController();
