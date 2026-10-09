/**
 * SetuSight — Contractor Controller
 * Manages Contractor Firms, Linked Authentication Accounts, and Performance Metrics
 */
const bcrypt = require('bcryptjs');
const dbService = require('../services/dbService');

class ContractorController {
  /**
   * GET /api/contractors
   * Includes performance indicators and linked login account metadata
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
      const allContractorUsers = await dbService.getUsersByRole('contractor');

      const enhanced = contractors.map(c => {
        const assignedBridges = allBridges.filter(b => b.contractor_id === c.id);
        const assignedMaintenance = allMaintenance.filter(m => m.contractor_id === c.id);
        const completedMaintenance = assignedMaintenance.filter(m => m.status === 'Completed');
        const overdueMaintenance = assignedMaintenance.filter(m => m.status === 'Overdue');
        const inProgressMaintenance = assignedMaintenance.filter(m => m.status === 'In Progress');

        // Find linked user for login metadata
        const linkedUser = allContractorUsers.find(u => u.contractor_id === c.id) ||
                           allContractorUsers.find(u => u.email === c.email);

        return {
          ...c,
          assigned_bridges_count: assignedBridges.length,
          total_tasks: assignedMaintenance.length,
          completed_tasks: completedMaintenance.length,
          overdue_tasks: overdueMaintenance.length,
          in_progress_tasks: inProgressMaintenance.length,
          completion_rate: assignedMaintenance.length > 0
            ? Math.round((completedMaintenance.length / assignedMaintenance.length) * 100)
            : 100,
          login_account_status: linkedUser ? 'Active' : 'Unlinked',
          login_user: linkedUser ? {
            id: linkedUser.id,
            name: linkedUser.name,
            email: linkedUser.email
          } : null
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
      const linkedUsers = await dbService.getUsersByContractorId(contractor.id);
      const primaryUser = linkedUsers[0] || (contractor.email ? await dbService.getUserByEmail(contractor.email) : null);

      const completed = maintenance.filter(m => m.status === 'Completed').length;
      const inProgress = maintenance.filter(m => m.status === 'In Progress').length;
      const overdue = maintenance.filter(m => m.status === 'Overdue').length;

      res.json({
        success: true,
        data: {
          ...contractor,
          assigned_bridges: assignedBridges,
          assigned_bridges_count: assignedBridges.length,
          maintenance_tasks: maintenance,
          summary: {
            total_tasks: maintenance.length,
            in_progress: inProgress,
            completed: completed,
            overdue: overdue,
            completion_rate: maintenance.length > 0 ? Math.round((completed / maintenance.length) * 100) : 100
          },
          login_account_status: primaryUser ? 'Active' : 'Unlinked',
          login_user: primaryUser ? {
            id: primaryUser.id,
            name: primaryUser.name,
            email: primaryUser.email
          } : null
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/contractors
   * Admin only: Creates contractor firm AND links authentication login account
   */
  async createContractor(req, res, next) {
    try {
      const {
        company_name,
        contact_person,
        email,
        phone,
        flag_status,
        login_name,
        login_email,
        login_password
      } = req.body;

      if (!company_name || !contact_person || !email || !phone) {
        return res.status(400).json({
          success: false,
          error: 'company_name, contact_person, email, and phone are mandatory'
        });
      }

      const normCompanyEmail = email.trim().toLowerCase();
      const normLoginEmail = (login_email || normCompanyEmail).trim().toLowerCase();
      const normLoginName = (login_name || contact_person || company_name).trim();

      // Check for duplicate company email
      const existingContractor = await dbService.getContractorByEmail(normCompanyEmail);
      if (existingContractor) {
        return res.status(400).json({
          success: false,
          error: `A contractor firm with email '${normCompanyEmail}' already exists.`
        });
      }

      // Check if login email is already registered to an existing user
      const existingUser = await dbService.getUserByEmail(normLoginEmail);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: `Contractor login email '${normLoginEmail}' is already registered to an existing user account.`
        });
      }

      // 1. Insert Contractor Firm
      const contractorData = {
        company_name: company_name.trim(),
        contact_person: contact_person.trim(),
        email: normCompanyEmail,
        phone: phone.trim(),
        flag_status: flag_status || 'Normal'
      };

      const created = await dbService.createContractor(contractorData);

      // 2. Insert Linked Login User if password provided
      let linkedUser = null;
      if (login_password) {
        try {
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(login_password, salt);

          linkedUser = await dbService.createUser({
            name: normLoginName,
            email: normLoginEmail,
            password_hash: passwordHash,
            role: 'contractor',
            contractor_id: created.id
          });
        } catch (userErr) {
          // Transactional rollback: Clean up created contractor firm so no broken orphan record remains
          try {
            await dbService.deleteContractor(created.id);
          } catch (_) {}
          return res.status(400).json({
            success: false,
            error: `Failed to create linked contractor login account: ${userErr.message}`
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Contractor registered and login account linked successfully',
        data: {
          ...created,
          login_account_status: linkedUser ? 'Active' : 'Unlinked',
          login_user: linkedUser ? {
            id: linkedUser.id,
            name: linkedUser.name,
            email: linkedUser.email,
            role: linkedUser.role
          } : null
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/contractors/:id
   * Admin only: Update details or change flag status, synchronize linked user if needed
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

      // Synchronize linked user credentials/profile if requested
      const { login_name, login_email, login_password } = req.body;
      const linkedUsers = await dbService.getUsersByContractorId(req.params.id);
      let linkedUser = linkedUsers[0] || (existing.email ? await dbService.getUserByEmail(existing.email) : null);

      if (linkedUser && (login_name || login_email || login_password)) {
        const userUpdates = {};
        if (login_name) userUpdates.name = login_name.trim();

        if (login_email) {
          const newEmail = login_email.trim().toLowerCase();
          if (newEmail !== linkedUser.email) {
            const emailInUse = await dbService.getUserByEmail(newEmail);
            if (emailInUse && emailInUse.id !== linkedUser.id) {
              return res.status(400).json({
                success: false,
                error: `User email '${newEmail}' is already taken by another account.`
              });
            }
            userUpdates.email = newEmail;
          }
        }

        if (login_password) {
          const salt = await bcrypt.genSalt(10);
          userUpdates.password_hash = await bcrypt.hash(login_password, salt);
        }

        if (Object.keys(userUpdates).length > 0) {
          linkedUser = await dbService.updateUser(linkedUser.id, userUpdates);
        }
      } else if (!linkedUser && login_password) {
        // Create user for contractor that previously lacked one
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(login_password, salt);
        linkedUser = await dbService.createUser({
          name: (login_name || updated.contact_person || updated.company_name).trim(),
          email: (login_email || updated.email).trim().toLowerCase(),
          password_hash: passwordHash,
          role: 'contractor',
          contractor_id: updated.id
        });
      }

      res.json({
        success: true,
        message: 'Contractor profile updated successfully',
        data: {
          ...updated,
          login_account_status: linkedUser ? 'Active' : 'Unlinked',
          login_user: linkedUser ? {
            id: linkedUser.id,
            name: linkedUser.name,
            email: linkedUser.email
          } : null
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ContractorController();
