/**
 * SetuSight — Contractor Controller
 */
const dbService = require('../services/dbService');

class ContractorController {
  /**
   * GET /api/contractors
   * Includes performance indicators
   */
  async getAllContractors(req, res, next) {
    try {
      let contractors = await dbService.getAllContractors();

      // Strict Contractor Role Guard: Contractor only sees their own firm
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
        contractors = contractors.filter(c => c.id === contractorId);
      }

      const allBridges = await dbService.getAllBridges();
      const allMaintenance = await dbService.getAllMaintenance();

      const enhanced = contractors.map(c => {
        const assignedBridges = allBridges.filter(b => b.contractor_id === c.id);
        const assignedMaintenance = allMaintenance.filter(m => m.contractor_id === c.id);
        const completedMaintenance = assignedMaintenance.filter(m => m.status === 'Completed');
        const overdueMaintenance = assignedMaintenance.filter(m => m.status === 'Overdue');
        const inProgressMaintenance = assignedMaintenance.filter(m => m.status === 'In Progress');

        return {
          ...c,
          assigned_bridges_count: assignedBridges.length,
          total_tasks: assignedMaintenance.length,
          completed_tasks: completedMaintenance.length,
          overdue_tasks: overdueMaintenance.length,
          in_progress_tasks: inProgressMaintenance.length,
          completion_rate: assignedMaintenance.length > 0 ? Math.round((completedMaintenance.length / assignedMaintenance.length) * 100) : 100
        };
      });

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
   * GET /api/contractors/:id
   */
  async getContractorById(req, res, next) {
    try {
      // Strict Contractor Access Guard
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
        if (!contractorId || contractorId !== req.params.id) {
          return res.status(403).json({
            success: false,
            error: 'Access denied: You are only authorized to view your own contractor record'
          });
        }
      }

      const contractor = await dbService.getContractorById(req.params.id);
      if (!contractor) {
        return res.status(404).json({
          success: false,
          error: 'Contractor not found'
        });
      }

      const allBridges = await dbService.getAllBridges();
      const assignedBridges = allBridges.filter(b => b.contractor_id === contractor.id);
      const maintenance = await dbService.getAllMaintenance({ contractor_id: contractor.id });

      res.json({
        success: true,
        data: {
          ...contractor,
          assigned_bridges: assignedBridges,
          maintenance_tasks: maintenance
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/contractors
   * Admin only
   */
  async createContractor(req, res, next) {
    try {
      const { company_name, contact_person, email, phone, flag_status } = req.body;

      if (!company_name || !contact_person || !email || !phone) {
        return res.status(400).json({
          success: false,
          error: 'company_name, contact_person, email, and phone are mandatory'
        });
      }

      const contractorData = {
        company_name: company_name.trim(),
        contact_person: contact_person.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        flag_status: flag_status || 'Normal'
      };

      const created = await dbService.createContractor(contractorData);

      res.status(201).json({
        success: true,
        message: 'Contractor registered successfully',
        data: created
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/contractors/:id
   * Admin only: Update details or change flag status
   */
  async updateContractor(req, res, next) {
    try {
      const existing = await dbService.getContractorById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Contractor not found'
        });
      }

      const allowedFields = ['company_name', 'contact_person', 'email', 'phone', 'flag_status'];
      const updateData = {};
      allowedFields.forEach(f => {
        if (req.body[f] !== undefined) updateData[f] = req.body[f];
      });

      const updated = await dbService.updateContractor(req.params.id, updateData);

      res.json({
        success: true,
        message: 'Contractor profile updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ContractorController();
