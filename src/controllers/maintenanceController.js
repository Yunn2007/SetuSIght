/**
 * SetuSight — Maintenance Controller
 * Manages Work Order Lifecycle, Strict State Transitions, Recalibration, and Repair Evidence
 */
const dbService = require('../services/dbService');
const healthService = require('../services/healthService');
const notificationService = require('../services/notificationService');
const { uploadImageBuffer } = require('../config/cloudinary');

class MaintenanceController {
  constructor() {
    this._resolveContractorId = this._resolveContractorId.bind(this);
    this.getAllMaintenance = this.getAllMaintenance.bind(this);
    this.getMaintenanceById = this.getMaintenanceById.bind(this);
    this.createMaintenance = this.createMaintenance.bind(this);
    this.updateMaintenance = this.updateMaintenance.bind(this);
    this.getMaintenanceEvidence = this.getMaintenanceEvidence.bind(this);
    this.uploadMaintenanceEvidence = this.uploadMaintenanceEvidence.bind(this);
    this.deleteMaintenanceEvidence = this.deleteMaintenanceEvidence.bind(this);
  }

  /**
   * Helper: Resolve contractorId for authenticated user
   */
  async _resolveContractorId(user) {
    if (!user || user.role !== 'contractor') return null;
    if (user.contractor_id) return user.contractor_id;

    const userRecord = await dbService.getUserById(user.id);
    if (userRecord?.contractor_id) return userRecord.contractor_id;

    if (user.email) {
      const cRecord = await dbService.getContractorByEmail(user.email);
      if (cRecord?.id) return cRecord.id;
    }
    return null;
  }

  /**
   * GET /api/maintenance
   * Automatically restricts maintenance work orders to contractor's account if role === 'contractor'
   */
  async getAllMaintenance(req, res, next) {
    try {
      const query = req.query || {};
      const filters = {
        status: query.status,
        priority: query.priority,
        contractor_id: query.contractor_id,
        bridge_id: query.bridge_id
      };

      // Strict Contractor Role Guard
      if (req.user && req.user.role === 'contractor') {
        const contractorId = await this._resolveContractorId(req.user);
        filters.contractor_id = contractorId || '00000000-0000-0000-0000-000000000000';
      }

      const records = await dbService.getAllMaintenance(filters);

      // Evaluate overdue state safely
      const todayStr = new Date().toISOString().split('T')[0];
      const enhanced = records.map(r => ({
        ...r,
        is_overdue: r.status !== 'Completed' && r.scheduled_date && r.scheduled_date < todayStr
      }));

      res.json({
        success: true,
        count: enhanced.length,
        data: enhanced
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
        const contractorId = await this._resolveContractorId(req.user);
        if (!contractorId || record.contractor_id !== contractorId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. This maintenance task is not assigned to your contractor account.'
          });
        }
      }

      // Attach evidence and overdue indicator
      const evidence = await dbService.getMaintenanceEvidence(record.id);
      const todayStr = new Date().toISOString().split('T')[0];

      res.json({
        success: true,
        data: {
          ...record,
          is_overdue: record.status !== 'Completed' && record.scheduled_date && record.scheduled_date < todayStr,
          evidence
        }
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
   * Contractor & Admin: Enforces strict lifecycle state machine and completion consistency
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

      const isContractor = req.user && req.user.role === 'contractor';
      const isAdmin = req.user && req.user.role === 'admin';

      // Strict Contractor Access Verification
      if (isContractor) {
        const contractorId = await this._resolveContractorId(req.user);
        if (!contractorId || existing.contractor_id !== contractorId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only update work orders assigned to your company.'
          });
        }

        // Contractors cannot modify administrative fields
        if (req.body.contractor_id !== undefined && req.body.contractor_id !== existing.contractor_id) {
          return res.status(403).json({
            success: false,
            error: 'Contractors are not permitted to reassign contractor_id.'
          });
        }
        if (req.body.bridge_id !== undefined && req.body.bridge_id !== existing.bridge_id) {
          return res.status(403).json({
            success: false,
            error: 'Contractors are not permitted to modify bridge_id.'
          });
        }
        if (req.body.priority !== undefined && req.body.priority !== existing.priority) {
          return res.status(403).json({
            success: false,
            error: 'Contractors are not permitted to change work order priority.'
          });
        }
        if (req.body.scheduled_date !== undefined && req.body.scheduled_date !== existing.scheduled_date) {
          return res.status(403).json({
            success: false,
            error: 'Contractors are not permitted to alter scheduled_date.'
          });
        }

        // Terminal status: Completed cannot be altered by contractor
        if (existing.status === 'Completed' && req.body.status !== undefined && req.body.status !== 'Completed') {
          return res.status(400).json({
            success: false,
            error: 'Work order is marked Completed and is terminal. Contact an administrator to reopen.'
          });
        }
      }

      const { status, completion_date, remarks, priority, contractor_id, scheduled_date } = req.body;

      // Strict State Machine Transitions
      if (status !== undefined && status !== existing.status) {
        const allowedTransitions = {
          'Scheduled': ['In Progress', 'Overdue'],
          'In Progress': ['Completed', 'Overdue'],
          'Overdue': ['In Progress', 'Completed'],
          'Completed': [] // Contractor cannot transition away from Completed
        };

        if (isAdmin) {
          // Admin has administrative override
          allowedTransitions['Scheduled'].push('Completed');
          allowedTransitions['Completed'] = ['Scheduled', 'In Progress', 'Overdue', 'Completed'];
        }

        const validNextStates = allowedTransitions[existing.status] || [];
        if (!validNextStates.includes(status)) {
          return res.status(400).json({
            success: false,
            error: `Invalid status transition: Cannot move work order from '${existing.status}' to '${status}'. Valid next states: ${validNextStates.length ? validNextStates.join(', ') : 'None (Terminal state)'}.`
          });
        }
      }

      const updateData = {};
      if (status !== undefined) updateData.status = status;
      if (remarks !== undefined) updateData.remarks = remarks;

      // Only admin can change priority, scheduled_date, or contractor_id
      if (isAdmin) {
        if (priority !== undefined) updateData.priority = priority;
        if (contractor_id !== undefined) updateData.contractor_id = contractor_id;
        if (scheduled_date !== undefined) updateData.scheduled_date = scheduled_date;
      }

      // Completion Date Consistency (Phase 7)
      const targetStatus = status !== undefined ? status : existing.status;
      if (targetStatus === 'Completed') {
        updateData.completion_date = completion_date || existing.completion_date || new Date().toISOString().split('T')[0];
      } else {
        // Enforce null completion_date if not completed
        updateData.completion_date = null;
      }

      const updated = await dbService.updateMaintenance(req.params.id, updateData);

      // Trigger status-specific actions and notifications (Phases 12 & 13)
      if (status !== undefined && status !== existing.status) {
        const bridge = existing.bridge_id ? await dbService.getBridgeById(existing.bridge_id) : null;
        const contractor = existing.contractor_id ? await dbService.getContractorById(existing.contractor_id) : null;

        if (status === 'In Progress' && existing.status === 'Scheduled') {
          await notificationService.notifyMaintenanceStarted(bridge, updated, contractor);
        } else if (status === 'Overdue') {
          await notificationService.notifyMaintenanceOverdue(bridge, updated, contractor);
        } else if (status === 'Completed' && bridge) {
          // Recalculate bridge health only via existing healthService
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

  // --------------------------------------------------------------------------
  // REPAIR EVIDENCE METHODS (PHASE 8)
  // --------------------------------------------------------------------------

  /**
   * GET /api/maintenance/:id/evidence
   */
  async getMaintenanceEvidence(req, res, next) {
    try {
      const record = await dbService.getMaintenanceById(req.params.id);
      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Maintenance record not found'
        });
      }

      // Access Guard: Admin or Assigned Contractor
      if (req.user && req.user.role === 'contractor') {
        const contractorId = await this._resolveContractorId(req.user);
        if (!contractorId || record.contractor_id !== contractorId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied: You are not authorized to view evidence for this work order'
          });
        }
      }

      const evidence = await dbService.getMaintenanceEvidence(record.id);

      res.json({
        success: true,
        count: evidence.length,
        data: evidence
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/maintenance/:id/evidence
   * Upload repair photo (before / progress / after) to Cloudinary and link to work order
   */
  async uploadMaintenanceEvidence(req, res, next) {
    try {
      const record = await dbService.getMaintenanceById(req.params.id);
      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Maintenance record not found'
        });
      }

      // Access Guard: Admin or Assigned Contractor
      if (req.user && req.user.role === 'contractor') {
        const contractorId = await this._resolveContractorId(req.user);
        if (!contractorId || record.contractor_id !== contractorId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied: You can only upload repair evidence for work orders assigned to your firm'
          });
        }
      }

      // Collect file from multer memory storage
      const file = req.file || (req.files && req.files[0]);
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'An image file (JPEG, PNG, or WebP) is required for evidence submission'
        });
      }

      const { evidence_type, caption } = req.body;
      const validTypes = ['before', 'progress', 'after'];
      const resolvedType = (evidence_type || 'progress').toLowerCase();

      if (!validTypes.includes(resolvedType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid evidence_type. Allowed values: ${validTypes.join(', ')}`
        });
      }

      // Stream to Cloudinary
      const uploadRes = await uploadImageBuffer(file.buffer, {
        folder: 'setusight/maintenance'
      });

      // Save to Supabase
      const evidence = await dbService.createMaintenanceEvidence({
        maintenance_id: record.id,
        uploaded_by: req.user.id,
        image_url: uploadRes.secure_url,
        cloudinary_public_id: uploadRes.public_id,
        evidence_type: resolvedType,
        caption: caption ? caption.trim() : ''
      });

      res.status(201).json({
        success: true,
        message: 'Maintenance evidence uploaded successfully',
        data: evidence
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/maintenance/:id/evidence/:evidenceId
   * Admin only: Delete erroneous evidence
   */
  async deleteMaintenanceEvidence(req, res, next) {
    try {
      const { id, evidenceId } = req.params;
      const record = await dbService.getMaintenanceById(id);
      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Maintenance record not found'
        });
      }

      const evidenceItem = await dbService.getMaintenanceEvidenceById(evidenceId);
      if (!evidenceItem || evidenceItem.maintenance_id !== record.id) {
        return res.status(404).json({
          success: false,
          error: 'Evidence record not found for this work order'
        });
      }

      await dbService.deleteMaintenanceEvidence(evidenceId);

      res.json({
        success: true,
        message: 'Evidence record removed successfully'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MaintenanceController();
