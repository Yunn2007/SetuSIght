/**
 * SetuSight — Maintenance Controller
 */
const dbService = require('../services/dbService');
const healthService = require('../services/healthService');
const notificationService = require('../services/notificationService');

class MaintenanceController {
  /**
   * GET /api/maintenance
   * Automatically restricts maintenance work orders to contractor's account if role === 'contractor'
   */
  async getAllMaintenance(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        priority: req.query.priority,
        contractor_id: req.query.contractor_id,
        bridge_id: req.query.bridge_id
      };

      // Strict Contractor Role Guard
      if (req.user && req.user.role === 'contractor') {
        let contractorId = req.user.contractor_id;
        if (!contractorId) {
          const userRecord = await dbService.getUserById(req.user.id);
          contractorId = userRecord?.contractor_id;
          if (!contractorId && req.user.email) {
            const cRecord = await dbService.getContractorByEmail(req.user.email);
            contractorId = cRecord?.id;
          }
        }
        filters.contractor_id = contractorId || '00000000-0000-0000-0000-000000000000';
      }

      const records = await dbService.getAllMaintenance(filters);

      res.json({
        success: true,
        count: records.length,
        data: records
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/maintenance/:id
   */
  async getMaintenanceById(req, res, next) {
    try {
      const record = await dbService.getMaintenanceById(req.params.id);
      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Maintenance record not found'
        });
      }

      // Strict Contractor Access Verification
      if (req.user && req.user.role === 'contractor') {
        let contractorId = req.user.contractor_id;
        if (!contractorId) {
          const userRecord = await dbService.getUserById(req.user.id);
          contractorId = userRecord?.contractor_id;
        }

        if (!contractorId || record.contractor_id !== contractorId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. This maintenance task is not assigned to your contractor account.'
          });
        }
      }

      res.json({
        success: true,
        data: record
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/maintenance
   * Admin: Schedule maintenance task
   */
  async createMaintenance(req, res, next) {
    try {
      const {
        bridge_id,
        contractor_id,
        scheduled_date,
        priority,
        remarks
      } = req.body;

      if (!bridge_id || !scheduled_date) {
        return res.status(400).json({
          success: false,
          error: 'bridge_id and scheduled_date are required'
        });
      }

      const bridge = await dbService.getBridgeById(bridge_id);
      if (!bridge) {
        return res.status(404).json({
          success: false,
          error: 'Bridge structure not found'
        });
      }

      const maintenanceData = {
        bridge_id: bridge.id,
        contractor_id: contractor_id || bridge.contractor_id || null,
        scheduled_date: scheduled_date,
        priority: priority || 'Medium',
        status: 'Scheduled',
        remarks: remarks || ''
      };

      const created = await dbService.createMaintenance(maintenanceData);

      // Notify contractor if assigned
      if (maintenanceData.contractor_id) {
        const contractor = await dbService.getContractorById(maintenanceData.contractor_id);
        if (contractor) {
          await notificationService.notifyContractorAssigned(contractor, bridge, created);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Maintenance task scheduled successfully',
        data: created
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/maintenance/:id
   * Contractor & Admin: Update status, completion date, remarks
   */
  async updateMaintenance(req, res, next) {
    try {
      const existing = await dbService.getMaintenanceById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Maintenance record not found'
        });
      }

      // Strict Contractor Access Verification
      if (req.user && req.user.role === 'contractor') {
        let contractorId = req.user.contractor_id;
        if (!contractorId) {
          const userRecord = await dbService.getUserById(req.user.id);
          contractorId = userRecord?.contractor_id;
        }

        if (!contractorId || existing.contractor_id !== contractorId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only update work orders assigned to your company.'
          });
        }
      }

      const { status, completion_date, remarks, priority, contractor_id } = req.body;

      const updateData = {};
      if (status !== undefined) updateData.status = status;
      if (remarks !== undefined) updateData.remarks = remarks;

      // Only admin can change priority or re-assign contractor
      if (req.user && req.user.role === 'admin') {
        if (priority !== undefined) updateData.priority = priority;
        if (contractor_id !== undefined) updateData.contractor_id = contractor_id;
      }
      
      if (status === 'Completed') {
        updateData.completion_date = completion_date || new Date().toISOString().split('T')[0];
      } else if (completion_date !== undefined) {
        updateData.completion_date = completion_date;
      }

      const updated = await dbService.updateMaintenance(req.params.id, updateData);

      // If status completed, recalculate bridge health
      if (status === 'Completed' && existing.bridge_id) {
        const bridge = await dbService.getBridgeById(existing.bridge_id);
        if (bridge) {
          const pastMaintenance = await dbService.getMaintenanceByBridgeId(bridge.id);
          const inspections = await dbService.getInspectionsByBridgeId(bridge.id);
          const latestInsp = inspections[0] || {};

          const assessment = healthService.calculateHealthAssessment(
            bridge,
            latestInsp.images && latestInsp.images.length > 0 ? latestInsp.images : { crack_severity: latestInsp.crack_severity || 'none', crack_count: latestInsp.crack_count || 0 },
            { recentMaintenance: pastMaintenance, pastInspections: inspections }
          );

          await dbService.updateBridge(bridge.id, {
            current_health_score: assessment.healthScore,
            current_health_status: assessment.healthStatus
          });

          // Alert notification dispatched to all real admins
          await notificationService.notifyMaintenanceCompleted(bridge, updated);
        }
      }

      res.json({
        success: true,
        message: 'Maintenance record updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MaintenanceController();
