/**
 * SetuSight — Bridge Controller
 */
const dbService = require('../services/dbService');
const healthService = require('../services/healthService');

class BridgeController {
  /**
   * GET /api/bridges
   * Query params: status, location, material, search
   * Automatically restricts bridges to contractor's assigned bridges if role === 'contractor'
   */
  async getAllBridges(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        location: req.query.location,
        material: req.query.material,
        search: req.query.search
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

      const bridges = await dbService.getAllBridges(filters);
      const allMaintenance = await dbService.getAllMaintenance();

      // Enhance with computed age, maintenance priority & formatted data
      const currentYear = new Date().getFullYear();
      const formatted = bridges.map(b => {
        const bridgeMaint = allMaintenance.filter(m => m.bridge_id === b.id);
        const activeMaint = bridgeMaint.find(m => m.status !== 'Completed') || bridgeMaint[0];

        return {
          ...b,
          age: currentYear - (b.construction_year || currentYear),
          contractor_name: b.contractor ? b.contractor.company_name : 'Not Assigned',
          maintenance_priority: activeMaint ? activeMaint.priority : 'Low',
          maintenance_id: activeMaint ? activeMaint.id : null,
          maintenance_status: activeMaint ? activeMaint.status : 'No Active Tasks',
          maintenance_scheduled_date: activeMaint ? activeMaint.scheduled_date : null,
          maintenance_remarks: activeMaint ? activeMaint.remarks : 'Routine maintenance up to date'
        };
      });

      res.json({
        success: true,
        count: formatted.length,
        data: formatted
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/bridges/:id
   */
  async getBridgeById(req, res, next) {
    try {
      const bridge = await dbService.getBridgeById(req.params.id);
      if (!bridge) {
        return res.status(404).json({
          success: false,
          error: 'Bridge structure not found'
        });
      }

      // Strict Contractor Access Verification
      if (req.user && req.user.role === 'contractor') {
        let contractorId = req.user.contractor_id;
        if (!contractorId) {
          const userRecord = await dbService.getUserById(req.user.id);
          contractorId = userRecord?.contractor_id;
        }

        if (!contractorId || bridge.contractor_id !== contractorId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. This bridge is not assigned to your contractor account.'
          });
        }
      }

      const currentYear = new Date().getFullYear();
      const age = currentYear - (bridge.construction_year || currentYear);
      const inspections = await dbService.getInspectionsByBridgeId(bridge.id);
      const maintenance = await dbService.getMaintenanceByBridgeId(bridge.id);
      const activeMaint = maintenance.find(m => m.status !== 'Completed') || maintenance[0];

      res.json({
        success: true,
        data: {
          ...bridge,
          age,
          contractor_name: bridge.contractor ? bridge.contractor.company_name : 'Not Assigned',
          maintenance_priority: activeMaint ? activeMaint.priority : 'Low',
          maintenance_id: activeMaint ? activeMaint.id : null,
          maintenance_status: activeMaint ? activeMaint.status : 'No Active Tasks',
          maintenance_scheduled_date: activeMaint ? activeMaint.scheduled_date : null,
          maintenance_remarks: activeMaint ? activeMaint.remarks : 'Routine maintenance up to date',
          inspections_count: inspections.length,
          maintenance_count: maintenance.length,
          latest_inspection: inspections[0] || null
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/bridges
   * Admin only
   */
  async createBridge(req, res, next) {
    try {
      const {
        bridge_id,
        bridge_name,
        location,
        latitude,
        longitude,
        construction_year,
        design_life,
        material,
        bridge_type,
        length,
        width,
        contractor_id
      } = req.body;

      if (!bridge_id || !bridge_name || !location || !construction_year || !material || !bridge_type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required bridge parameters: bridge_id, bridge_name, location, construction_year, material, bridge_type are mandatory.'
        });
      }

      // Check unique bridge_id
      const existing = await dbService.getBridgeByCode(bridge_id.trim());
      if (existing) {
        return res.status(400).json({
          success: false,
          error: `A bridge structure with ID '${bridge_id}' already exists.`
        });
      }

      const constYear = parseInt(construction_year, 10);
      const life = parseInt(design_life || 50, 10);

      // Compute initial assessment
      const initialAssessment = healthService.calculateHealthAssessment(
        { construction_year: constYear, design_life: life, material, location, bridge_name },
        { crack_severity: 'none', crack_count: 0 }
      );

      const bridgeData = {
        bridge_id: bridge_id.trim().toUpperCase(),
        bridge_name: bridge_name.trim(),
        location: location.trim(),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        construction_year: constYear,
        design_life: life,
        material: material.trim(),
        bridge_type: bridge_type.trim(),
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        contractor_id: contractor_id || null,
        current_health_score: initialAssessment.healthScore,
        current_health_status: initialAssessment.healthStatus
      };

      const created = await dbService.createBridge(bridgeData);

      res.status(201).json({
        success: true,
        message: 'Bridge asset registered successfully',
        data: created
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/bridges/:id
   * Admin only
   */
  async updateBridge(req, res, next) {
    try {
      const existing = await dbService.getBridgeById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Bridge structure not found'
        });
      }

      const allowedFields = [
        'bridge_name', 'location', 'latitude', 'longitude',
        'construction_year', 'design_life', 'material', 'bridge_type',
        'length', 'width', 'contractor_id', 'current_health_score', 'current_health_status'
      ];

      const updateData = {};
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      if (updateData.construction_year) {
        updateData.construction_year = parseInt(updateData.construction_year, 10);
      }
      if (updateData.design_life) {
        updateData.design_life = parseInt(updateData.design_life, 10);
      }
      if (updateData.latitude) updateData.latitude = parseFloat(updateData.latitude);
      if (updateData.longitude) updateData.longitude = parseFloat(updateData.longitude);
      if (updateData.length) updateData.length = parseFloat(updateData.length);
      if (updateData.width) updateData.width = parseFloat(updateData.width);

      const updated = await dbService.updateBridge(req.params.id, updateData);

      res.json({
        success: true,
        message: 'Bridge asset updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/bridges/:id
   * Admin only
   */
  async deleteBridge(req, res, next) {
    try {
      const existing = await dbService.getBridgeById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Bridge structure not found'
        });
      }

      await dbService.deleteBridge(req.params.id);

      res.json({
        success: true,
        message: 'Bridge structure and associated records removed successfully'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/bridges/:id/timeline
   */
  async getBridgeTimeline(req, res, next) {
    try {
      const result = await dbService.getBridgeTimeline(req.params.id);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Bridge structure not found'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BridgeController();
