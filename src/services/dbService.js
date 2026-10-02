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
    return data || [];
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
    return data || null;
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
    return data || [];
  }

  async createInspection(inspectionData) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('inspections')
      .insert([inspectionData])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error saving inspection: ${error.message}`);
    }
    return data;
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
    const { data, error } = await supabase
      .from('maintenance')
      .insert([maintenanceData])
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
    const { data, error } = await supabase
      .from('contractors')
      .insert([contractorData])
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
      .limit(30);

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
    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error creating notification: ${error.message}`);
    }
    return data;
  }

  async markNotificationRead(id) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
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

      timeline.push({
        id: `insp-${insp.id}`,
        type: 'inspection',
        date: insp.inspection_date,
        title: `Visual & CV Inspection Logged`,
        description: `Inspection recorded ${insp.crack_count} visible crack(s). Severity: ${insp.crack_severity.toUpperCase()}. Calculated Health Score: ${insp.health_score}/100. ${insp.remarks || ''}`,
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
