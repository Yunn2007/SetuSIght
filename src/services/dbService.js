/**
 * SetuSight — Centralized Database Service
 * Exclusively communicates with Supabase PostgreSQL.
 * If Supabase is unavailable or returns an error, throws a clear Database Error.
 */
const { getSupabase } = require('../config/supabase');

class DbService {
  // --------------------------------------------------------------------------
  // USERS
  // --------------------------------------------------------------------------
  async getUserByEmail(email) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
      throw new Error(`Database error fetching user: ${error.message}`);
    }
    return data || null;
  }

  async getUserById(id) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, contractor_id, created_at')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error fetching user: ${error.message}`);
    }
    return data || null;
  }

  async createUser(userData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .insert([{
        name: userData.name,
        email: userData.email.trim().toLowerCase(),
        password_hash: userData.password_hash,
        role: userData.role,
        contractor_id: userData.contractor_id || null
      }])
      .select('id, name, email, role, contractor_id, created_at')
      .single();

    if (error) {
      throw new Error(`Database error creating user: ${error.message}`);
    }
    return data;
  }

  async getUsersByRole(role) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, contractor_id, created_at')
      .eq('role', role);

    if (error) {
      throw new Error(`Database error fetching users by role: ${error.message}`);
    }
    return data || [];
  }

  async getUsersByContractorId(contractorId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, contractor_id, created_at')
      .eq('contractor_id', contractorId);

    if (error) {
      throw new Error(`Database error fetching users by contractor: ${error.message}`);
    }
    return data || [];
  }

  async updateUser(id, updateData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, name, email, role, contractor_id, created_at')
      .single();

    if (error) {
      throw new Error(`Database error updating user: ${error.message}`);
    }
    return data;
  }

  async deleteUser(id) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database error deleting user: ${error.message}`);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // BRIDGES
  // --------------------------------------------------------------------------
  async getAllBridges(filters = {}) {
    const supabase = getSupabase();
    let query = supabase
      .from('bridges')
      .select(`
        *,
        contractor:contractors (
          id,
          company_name,
          contact_person,
          email,
          phone,
          flag_status
        )
      `)
      .order('created_at', { ascending: false });

    if (filters.contractor_id) {
      query = query.eq('contractor_id', filters.contractor_id);
    }
    if (filters.status) {
      query = query.eq('current_health_status', filters.status);
    }
    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }
    if (filters.material) {
      query = query.ilike('material', `%${filters.material}%`);
    }
    if (filters.search) {
      query = query.or(`bridge_name.ilike.%${filters.search}%,bridge_id.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Database error fetching bridges: ${error.message}`);
    }
    return data || [];
  }

  async getBridgeById(id) {
    const supabase = getSupabase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabase
      .from('bridges')
      .select(`
        *,
        contractor:contractors (
          id,
          company_name,
          contact_person,
          email,
          phone,
          flag_status
        )
      `);

    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('bridge_id', id);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error fetching bridge details: ${error.message}`);
    }
    return data || null;
  }

  async getBridgeByCode(bridgeId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bridges')
      .select('*')
      .eq('bridge_id', bridgeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error checking bridge ID: ${error.message}`);
    }
    return data || null;
  }

  async createBridge(bridgeData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bridges')
      .insert([bridgeData])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error creating bridge: ${error.message}`);
    }
    return data;
  }

  async updateBridge(id, updateData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bridges')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error updating bridge: ${error.message}`);
    }
    return data;
  }

  async deleteBridge(id) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('bridges')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database error deleting bridge: ${error.message}`);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // INSPECTIONS
  // --------------------------------------------------------------------------
  async getAllInspections(filters = {}) {
    const supabase = getSupabase();
    let query = supabase
      .from('inspections')
      .select(`
        *,
        bridge:bridges (
          id,
          bridge_id,
          bridge_name,
          location,
          material
        ),
        inspector:users (
          id,
          name,
          email
        )
      `)
      .order('inspection_date', { ascending: false });

    if (filters.bridge_id) {
      query = query.eq('bridge_id', filters.bridge_id);
    }
    if (filters.severity) {
      query = query.eq('crack_severity', filters.severity);
    }
    if (filters.inspector_id) {
      query = query.eq('inspector_id', filters.inspector_id);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Database error fetching inspections: ${error.message}`);
    }
    return (data || []).map(i => this._hydrateInspectionImages(i));
  }

  async getInspectionById(id) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('inspections')
      .select(`
        *,
        bridge:bridges (*),
        inspector:users (id, name, email)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error fetching inspection: ${error.message}`);
    }
    if (!data) return null;

    // Check if inspection_images table has records for this session
    try {
      const { data: imgRows, error: imgErr } = await supabase
        .from('inspection_images')
        .select('*')
        .eq('inspection_id', id)
        .order('created_at', { ascending: true });

      if (!imgErr && imgRows && imgRows.length > 0) {
        data.images = imgRows.map(r => ({
          id: r.id,
          image_url: r.image_url,
          cloudinary_public_id: r.cloudinary_public_id,
          patch_label: r.patch_label || 'Patch',
          image_dimensions: r.image_dimensions,
          crack_count: r.crack_count,
          crack_severity: r.crack_severity,
          confidence: r.detection_confidence,
          detections: r.detection_data?.detections || [],
          local_condition_score: r.local_condition_score
        }));
        return data;
      }
    } catch (_) {
      // Table may not exist yet; fall through to JSONB hydration
    }

    return this._hydrateInspectionImages(data);
  }

  async getInspectionsByBridgeId(bridgeId) {
    const supabase = getSupabase();
    let targetId = bridgeId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bridgeId);
    if (!isUuid) {
      const b = await this.getBridgeById(bridgeId);
      if (b) targetId = b.id;
      else return [];
    }

    const { data, error } = await supabase
      .from('inspections')
      .select(`
        *,
        inspector:users (id, name, email)
      `)
      .eq('bridge_id', targetId)
      .order('inspection_date', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching bridge inspections: ${error.message}`);
    }
    return (data || []).map(i => this._hydrateInspectionImages(i));
  }

  _hydrateInspectionImages(inspection) {
    if (!inspection) return inspection;
    if (inspection.images && Array.isArray(inspection.images) && inspection.images.length > 0) {
      return inspection;
    }
    if (inspection.detection_data && Array.isArray(inspection.detection_data.images) && inspection.detection_data.images.length > 0) {
      inspection.images = inspection.detection_data.images;
    } else {
      // Synthesize 1-patch structure for historical inspections
      inspection.images = [{
        id: (inspection.id || 'patch') + '-patch-1',
        image_url: inspection.image_url,
        cloudinary_public_id: inspection.cloudinary_public_id,
        patch_label: 'Patch 1 (Historical)',
        crack_count: inspection.crack_count || 0,
        crack_severity: inspection.crack_severity || 'none',
        confidence: inspection.detection_confidence || 0.0,
        detections: inspection.detection_data?.detections || [],
        image_dimensions: inspection.detection_data?.image_dimensions || null,
        local_condition_score: inspection.detection_data?.score_breakdown?.localScore || inspection.health_score || 100.0
      }];
    }
    return inspection;
  }

  async createInspection(inspectionData) {
    const supabase = getSupabase();
    let code = inspectionData.inspection_code;
    if (!code) {
      const { count } = await supabase.from('inspections').select('*', { count: 'exact', head: true });
      code = `INS${String((count || 0) + 1).padStart(3, '0')}`;
    }

    // Separate patch_images if present so it doesn't fail table schema insert
    const patchImages = inspectionData.patch_images || (inspectionData.detection_data && inspectionData.detection_data.images) || [];
    const { patch_images, ...dbInspectionData } = inspectionData;

    const { data, error } = await supabase
      .from('inspections')
      .insert([{
        ...dbInspectionData,
        inspection_code: code
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error saving inspection: ${error.message}`);
    }

    // Optionally persist into inspection_images table if patches exist
    if (patchImages.length > 0 && data && data.id) {
      try {
        const rowsToInsert = patchImages.map((p, idx) => ({
          inspection_id: data.id,
          image_url: p.image_url,
          cloudinary_public_id: p.cloudinary_public_id || '',
          patch_label: p.patch_label || `Patch ${idx + 1}`,
          image_dimensions: p.image_dimensions || {},
          crack_count: p.crack_count || 0,
          crack_severity: p.crack_severity || 'none',
          detection_confidence: p.confidence || 0.0,
          detection_data: { detections: p.detections || [] },
          local_condition_score: p.local_condition_score || 100.0
        }));

        await supabase.from('inspection_images').insert(rowsToInsert);
      } catch (imgErr) {
        console.warn('Note: inspection_images insert skipped or pending table migration:', imgErr.message);
      }
    }

    return this._hydrateInspectionImages(data);
  }

  // --------------------------------------------------------------------------
  // MAINTENANCE
  // --------------------------------------------------------------------------
  async getAllMaintenance(filters = {}) {
    const supabase = getSupabase();
    let query = supabase
      .from('maintenance')
      .select(`
        *,
        bridge:bridges (
          id,
          bridge_id,
          bridge_name,
          location
        ),
        contractor:contractors (
          id,
          company_name,
          contact_person,
          email,
          phone,
          flag_status
        )
      `)
      .order('scheduled_date', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.contractor_id) {
      query = query.eq('contractor_id', filters.contractor_id);
    }
    if (filters.bridge_id) {
      query = query.eq('bridge_id', filters.bridge_id);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Database error fetching maintenance records: ${error.message}`);
    }
    return data || [];
  }

  async getMaintenanceById(id) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('maintenance')
      .select(`
        *,
        bridge:bridges (*),
        contractor:contractors (*)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error fetching maintenance order: ${error.message}`);
    }
    return data || null;
  }

  async getMaintenanceByBridgeId(bridgeId) {
    const supabase = getSupabase();
    let targetId = bridgeId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bridgeId);
    if (!isUuid) {
      const b = await this.getBridgeById(bridgeId);
      if (b) targetId = b.id;
      else return [];
    }

    const { data, error } = await supabase
      .from('maintenance')
      .select(`
        *,
        contractor:contractors (id, company_name, contact_person, flag_status)
      `)
      .eq('bridge_id', targetId)
      .order('scheduled_date', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching bridge maintenance history: ${error.message}`);
    }
    return data || [];
  }

  async createMaintenance(maintenanceData) {
    const supabase = getSupabase();
    let code = maintenanceData.maintenance_code;
    if (!code) {
      const { count } = await supabase.from('maintenance').select('*', { count: 'exact', head: true });
      code = `MNT${String((count || 0) + 1).padStart(3, '0')}`;
    }

    const { data, error } = await supabase
      .from('maintenance')
      .insert([{
        ...maintenanceData,
        maintenance_code: code
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error creating maintenance record: ${error.message}`);
    }
    return data;
  }

  async updateMaintenance(id, updateData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('maintenance')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error updating maintenance: ${error.message}`);
    }
    return data;
  }

  // --------------------------------------------------------------------------
  // CONTRACTORS
  // --------------------------------------------------------------------------
  async getAllContractors() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('contractors')
      .select('*')
      .order('company_name', { ascending: true });

    if (error) {
      throw new Error(`Database error fetching contractors: ${error.message}`);
    }
    return data || [];
  }

  async getContractorById(id) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error fetching contractor: ${error.message}`);
    }
    return data || null;
  }

  async getContractorByEmail(email) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('contractors')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error fetching contractor: ${error.message}`);
    }
    return data || null;
  }

  async createContractor(contractorData) {
    const supabase = getSupabase();
    let code = contractorData.contractor_code;
    if (!code) {
      const { count } = await supabase.from('contractors').select('*', { count: 'exact', head: true });
      code = `C${String((count || 0) + 1).padStart(3, '0')}`;
    }

    const { data, error } = await supabase
      .from('contractors')
      .insert([{
        ...contractorData,
        contractor_code: code
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error creating contractor: ${error.message}`);
    }
    return data;
  }

  async updateContractor(id, updateData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('contractors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error updating contractor: ${error.message}`);
    }
    return data;
  }

  async deleteContractor(id) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('contractors')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database error deleting contractor: ${error.message}`);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // MAINTENANCE EVIDENCE
  // --------------------------------------------------------------------------
  async getMaintenanceEvidence(maintenanceId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('maintenance_evidence')
      .select(`
        *,
        uploader:users (id, name, email, role)
      `)
      .eq('maintenance_id', maintenanceId)
      .order('created_at', { ascending: true });

    if (error) {
      // If table doesn't exist yet before migration, return empty gracefully
      console.warn('Database note fetching maintenance evidence:', error.message);
      return [];
    }
    return data || [];
  }

  async getMaintenanceEvidenceById(id) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('maintenance_evidence')
      .select(`
        *,
        uploader:users (id, name, email, role)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error fetching evidence item: ${error.message}`);
    }
    return data || null;
  }

  async createMaintenanceEvidence(evidenceData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('maintenance_evidence')
      .insert([evidenceData])
      .select(`
        *,
        uploader:users (id, name, email, role)
      `)
      .single();

    if (error) {
      throw new Error(`Database error creating maintenance evidence: ${error.message}`);
    }
    return data;
  }

  async deleteMaintenanceEvidence(id) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('maintenance_evidence')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database error deleting maintenance evidence: ${error.message}`);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------------------------------
  async getNotifications(recipientId) {
    const supabase = getSupabase();
    let query = supabase
      .from('notifications')
      .select(`
        *,
        bridge:bridges (bridge_id, bridge_name)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (recipientId) {
      query = query.eq('recipient_id', recipientId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Database error fetching notifications: ${error.message}`);
    }
    return data || [];
  }

  async createNotification(notificationData) {
    const supabase = getSupabase();
    let code = notificationData.notification_code;
    if (!code) {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true });
      code = `NOTIF${String((count || 0) + 1).padStart(4, '0')}`;
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        ...notificationData,
        notification_code: code
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error creating notification: ${error.message}`);
    }
    return data;
  }

  async markNotificationRead(id, recipientId = null) {
    const supabase = getSupabase();
    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (recipientId) {
      query = query.eq('recipient_id', recipientId);
    }

    const { data, error } = await query
      .select()
      .single();

    if (error) {
      throw new Error(`Database error updating notification: ${error.message}`);
    }
    return data;
  }

  async markAllNotificationsRead(recipientId) {
    const supabase = getSupabase();
    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (recipientId) {
      query = query.eq('recipient_id', recipientId);
    }

    const { error } = await query;
    if (error) {
      throw new Error(`Database error marking notifications read: ${error.message}`);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // REPORTS
  // --------------------------------------------------------------------------
  async getAllReports() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        bridge:bridges (bridge_id, bridge_name, location),
        inspection:inspections (inspection_date, crack_severity, health_score)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching reports: ${error.message}`);
    }
    return data || [];
  }

  async getReportById(id) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        bridge:bridges (*),
        inspection:inspections (*, inspector:users (id, name, email))
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error fetching report: ${error.message}`);
    }
    return data || null;
  }

  async createReport(reportData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('reports')
      .insert([reportData])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error creating report record: ${error.message}`);
    }
    return data;
  }

  // --------------------------------------------------------------------------
  // TIMELINE COMPILER
  // --------------------------------------------------------------------------
  async getBridgeTimeline(bridgeId) {
    const bridge = await this.getBridgeById(bridgeId);
    if (!bridge) return null;

    const inspections = await this.getInspectionsByBridgeId(bridgeId);
    const maintenance = await this.getMaintenanceByBridgeId(bridgeId);

    const timeline = [];

    // 1. Initial Construction
    timeline.push({
      id: `const-${bridge.id}`,
      type: 'construction',
      date: `${bridge.construction_year}-01-01`,
      title: 'Structure Commissioned',
      description: `${bridge.bridge_name} (${bridge.bridge_type}) commissioned into service with a design life of ${bridge.design_life} years.`,
      badge: 'Commissioned',
      statusClass: 'status--good'
    });

    // 2. Add inspections
    inspections.forEach(insp => {
      let statusClass = 'status--good';
      if (insp.crack_severity === 'moderate') statusClass = 'status--moderate';
      if (insp.crack_severity === 'high' || insp.crack_severity === 'critical') statusClass = 'status--attention';

      const patchCount = (insp.images && insp.images.length) || 1;
      const affectedCount = (insp.images && insp.images.filter(p => p.crack_count > 0).length) || (insp.crack_count > 0 ? 1 : 0);

      timeline.push({
        id: `insp-${insp.id}`,
        inspectionId: insp.id,
        inspectionRecord: insp,
        type: 'inspection',
        date: insp.inspection_date,
        title: patchCount > 1 ? `Multi-Patch CV Inspection (${patchCount} Patches)` : `Visual & CV Inspection Logged`,
        description: `Inspection session analyzed ${patchCount} patch(es) (${affectedCount} affected, ${insp.crack_count} total cracks). Worst Severity: ${insp.crack_severity.toUpperCase()}. Holistic Bridge Health: ${insp.health_score}/100 (${insp.health_status}). ${insp.remarks || ''}`,
        badge: `Score: ${insp.health_score}`,
        imageUrl: insp.image_url,
        statusClass
      });
    });

    // 3. Add maintenance
    maintenance.forEach(maint => {
      let statusClass = maint.status === 'Completed' ? 'status--good' : (maint.status === 'In Progress' ? 'status--maintenance' : 'status--moderate');
      timeline.push({
        id: `maint-${maint.id}`,
        type: 'maintenance',
        date: maint.completion_date || maint.scheduled_date,
        title: `Maintenance Order: ${maint.status}`,
        description: `Priority: ${maint.priority}. Assigned to ${maint.contractor?.company_name || 'Designated Contractor'}. ${maint.remarks || ''}`,
        badge: maint.status,
        statusClass
      });
    });

    // Sort chronologically descending
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      bridge,
      timeline
    };
  }
}

module.exports = new DbService();
