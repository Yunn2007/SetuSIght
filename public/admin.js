/**
 * SetuSight — Admin Portal Logic
 */

let currentUser = null;
let allBridgesCache = [];
let allContractorsCache = [];
let healthChartInstance = null;
let severityChartInstance = null;
let maintStatusChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = SetuApp.checkAuth(['admin']);
  if (!currentUser) return;

  SetuApp.initHeader(currentUser);
  initSidebarTabs();

  // Load initial overview data
  await loadOverview();
  await loadBridges();
  await loadContractors();
});

// ----------------------------------------------------------------------------
// TABS NAVIGATION
// ----------------------------------------------------------------------------
function initSidebarTabs() {
  const navItems = document.querySelectorAll('.sidebar__nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.sidebar__nav .nav-item').forEach(item => {
    item.classList.toggle('is-active', item.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.style.display = pane.id === `tab-${tabId}` ? 'block' : 'none';
  });

  const titles = {
    overview: 'Executive Dashboard Overview',
    bridges: 'Bridge Infrastructure Inventory',
    inspections: 'Computer Vision & Inspection Records',
    maintenance: 'Maintenance Work Order Management',
    contractors: 'Contractor Directory & Performance Audit',
    analytics: 'Network Health & Deterioration Analytics',
    reports: 'Official Structural Health Dossiers'
  };

  const headerTitle = document.getElementById('pageHeaderTitle');
  if (headerTitle) headerTitle.textContent = titles[tabId] || 'Admin Console';

  // Trigger tab specific loads
  if (tabId === 'overview') loadOverview();
  else if (tabId === 'bridges') loadBridges();
  else if (tabId === 'inspections') loadInspections();
  else if (tabId === 'maintenance') loadMaintenance();
  else if (tabId === 'contractors') loadContractors();
  else if (tabId === 'analytics') loadAnalytics();
  else if (tabId === 'reports') loadReports();
}

// ----------------------------------------------------------------------------
// OVERVIEW TAB
// ----------------------------------------------------------------------------
async function loadOverview() {
  try {
    const res = await SetuApp.fetchApi('/api/analytics/overview');
    if (!res.success) return;

    const { metrics, healthDistribution, recentInspections, upcomingMaintenance } = res.data;

    // Stat numbers
    document.getElementById('statTotalBridges').textContent = metrics.totalBridges;
    document.getElementById('statHealthyBridges').textContent = metrics.healthyBridges;
    document.getElementById('statWarningBridges').textContent = metrics.warningBridges;
    document.getElementById('statCriticalBridges').textContent = metrics.criticalBridges;
    document.getElementById('statTotalInspections').textContent = metrics.totalInspections;
    document.getElementById('statMaintenanceDue').textContent = metrics.maintenanceDue;

    const navCount = document.getElementById('navBridgeCount');
    if (navCount) navCount.textContent = metrics.totalBridges;

    // Chart.js Health Distribution Doughnut
    renderHealthDoughnut(healthDistribution);

    // Recent Inspections table
    const inspTbody = document.getElementById('overviewRecentInspections');
    if (inspTbody) {
      if (!recentInspections || recentInspections.length === 0) {
        inspTbody.innerHTML = '<tr><td colspan="5" class="notif-empty">No recent inspections logged</td></tr>';
      } else {
        inspTbody.innerHTML = recentInspections.map(i => `
          <tr>
            <td><strong>${i.bridge ? i.bridge.bridge_name : 'Structure'}</strong></td>
            <td class="mono">${i.inspection_date}</td>
            <td class="mono">${i.crack_count}</td>
            <td><span class="status ${SetuApp.getStatusClass(i.crack_severity)}">${i.crack_severity}</span></td>
            <td class="mono font-bold">${i.health_score}</td>
          </tr>
        `).join('');
      }
    }

    // Maintenance Due table
    const maintTbody = document.getElementById('overviewMaintenanceDue');
    if (maintTbody) {
      if (!upcomingMaintenance || upcomingMaintenance.length === 0) {
        maintTbody.innerHTML = '<tr><td colspan="4" class="notif-empty">No active maintenance orders due</td></tr>';
      } else {
        maintTbody.innerHTML = upcomingMaintenance.map(m => `
          <tr>
            <td><strong>${m.bridge ? m.bridge.bridge_name : 'Structure'}</strong></td>
            <td><span class="badge-tag">${m.priority}</span></td>
            <td class="mono">${m.scheduled_date}</td>
            <td><span class="status ${SetuApp.getStatusClass(m.status)}">${m.status}</span></td>
          </tr>
        `).join('');
      }
    }

    // Critical Alerts Feed
    const alertsFeed = document.getElementById('criticalAlertsFeed');
    if (alertsFeed) {
      const criticals = (allBridgesCache || []).filter(b => b.current_health_status === 'Attention Required');
      if (criticals.length === 0) {
        alertsFeed.innerHTML = '<div class="notif-empty">All bridge structures within safe baseline tolerances.</div>';
      } else {
        alertsFeed.innerHTML = criticals.map(b => `
          <div style="padding: 10px 12px; background: var(--red-tint); border: 1px solid rgba(181,67,46,0.2); border-radius: var(--radius-s); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 700; color: var(--red); font-size: 0.88rem;">${b.bridge_name} (${b.bridge_id})</div>
              <div style="font-size: 0.76rem; color: var(--navy-soft);">Health Score: ${b.current_health_score}/100 • ${b.location}</div>
            </div>
            <a href="/bridge-details?id=${b.id}" class="btn btn--ghost btn--sm" style="background:#fff;">Dossier →</a>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load overview:', err);
  }
}

function renderHealthDoughnut(dist) {
  const ctx = document.getElementById('healthDistChart');
  if (!ctx) return;

  if (healthChartInstance) healthChartInstance.destroy();

  healthChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Healthy (Good)', 'Moderate Warning', 'Critical Attention'],
      datasets: [{
        data: [dist.good || 0, dist.moderate || 0, dist.attention || 0],
        backgroundColor: ['#1F7A4D', '#B07A12', '#B5432E'],
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 } } }
      },
      cutout: '70%'
    }
  });
}

// ----------------------------------------------------------------------------
// BRIDGES TAB & CRUD
// ----------------------------------------------------------------------------
async function loadBridges() {
  try {
    const res = await SetuApp.fetchApi('/api/bridges');
    if (!res.success) return;

    allBridgesCache = res.data || [];
    renderBridgesTable(allBridgesCache);
    populateBridgeDropdowns(allBridgesCache);

    const navCount = document.getElementById('navBridgeCount');
    if (navCount) navCount.textContent = allBridgesCache.length;
  } catch (err) {}
}

function renderBridgesTable(bridges) {
  const tbody = document.getElementById('bridgesTableBody');
  if (!tbody) return;

  if (bridges.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="notif-empty">No bridge assets found matching filter criteria</td></tr>';
    return;
  }

  tbody.innerHTML = bridges.map(b => `
    <tr>
      <td class="mono font-bold">${b.bridge_id}</td>
      <td><strong>${b.bridge_name}</strong></td>
      <td>${b.location}</td>
      <td class="mono">${b.construction_year} (${b.age} yrs)</td>
      <td>${b.material}</td>
      <td class="mono font-bold">${b.current_health_score}/100</td>
      <td><span class="status ${SetuApp.getStatusClass(b.current_health_status)}">${b.current_health_status}</span></td>
      <td>${b.contractor_name}</td>
      <td style="text-align: right; white-space: nowrap;">
        <a href="/bridge-details?id=${b.id}" class="btn btn--ghost btn--sm" style="padding: 5px 9px; font-size: 0.78rem;">Dossier</a>
        <button onclick="openEditBridgeModal('${b.id}')" class="btn btn--ghost btn--sm" style="padding: 5px 9px; font-size: 0.78rem;">Edit</button>
        <button onclick="deleteBridge('${b.id}', '${b.bridge_name}')" class="btn btn--ghost btn--sm" style="padding: 5px 9px; font-size: 0.78rem; color: var(--red);">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Live filtering on bridges
document.getElementById('bridgeSearchInput')?.addEventListener('input', applyBridgeFilters);
document.getElementById('bridgeStatusFilter')?.addEventListener('change', applyBridgeFilters);
document.getElementById('bridgeAreaFilter')?.addEventListener('change', applyBridgeFilters);

function applyBridgeFilters() {
  const search = document.getElementById('bridgeSearchInput').value.toLowerCase();
  const status = document.getElementById('bridgeStatusFilter').value;
  const area = document.getElementById('bridgeAreaFilter').value;

  const filtered = allBridgesCache.filter(b => {
    const matchesSearch = !search || b.bridge_name.toLowerCase().includes(search) || b.bridge_id.toLowerCase().includes(search) || b.location.toLowerCase().includes(search);
    const matchesStatus = !status || b.current_health_status === status;
    const matchesArea = !area || b.location.toLowerCase().includes(area.toLowerCase());
    return matchesSearch && matchesStatus && matchesArea;
  });

  renderBridgesTable(filtered);
}

function openAddBridgeModal() {
  document.getElementById('bridgeModalTitle').textContent = 'Register New Bridge Asset';
  document.getElementById('bridgeForm').reset();
  document.getElementById('editBridgeId').value = '';
  document.getElementById('bridge_id_input').disabled = false;
  openModal('bridgeModal');
}

function openEditBridgeModal(id) {
  const bridge = allBridgesCache.find(b => b.id === id);
  if (!bridge) return;

  document.getElementById('bridgeModalTitle').textContent = `Edit Bridge: ${bridge.bridge_name}`;
  document.getElementById('editBridgeId').value = bridge.id;
  document.getElementById('bridge_id_input').value = bridge.bridge_id;
  document.getElementById('bridge_id_input').disabled = true;
  document.getElementById('bridge_name_input').value = bridge.bridge_name;
  document.getElementById('location_input').value = bridge.location;
  document.getElementById('bridge_type_input').value = bridge.bridge_type;
  document.getElementById('material_input').value = bridge.material;
  document.getElementById('construction_year_input').value = bridge.construction_year;
  document.getElementById('design_life_input').value = bridge.design_life || 50;
  document.getElementById('contractor_select_input').value = bridge.contractor_id || '';
  document.getElementById('length_input').value = bridge.length || '';
  document.getElementById('width_input').value = bridge.width || '';

  openModal('bridgeModal');
}

document.getElementById('bridgeForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('editBridgeId').value;
  const saveBtn = document.getElementById('saveBridgeBtn');

  const payload = {
    bridge_id: document.getElementById('bridge_id_input').value.trim(),
    bridge_name: document.getElementById('bridge_name_input').value.trim(),
    location: document.getElementById('location_input').value.trim(),
    bridge_type: document.getElementById('bridge_type_input').value,
    material: document.getElementById('material_input').value,
    construction_year: document.getElementById('construction_year_input').value,
    design_life: document.getElementById('design_life_input').value,
    contractor_id: document.getElementById('contractor_select_input').value || null,
    length: document.getElementById('length_input').value || null,
    width: document.getElementById('width_input').value || null
  };

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    if (editId) {
      await SetuApp.fetchApi(`/api/bridges/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      SetuApp.showToast('Bridge updated successfully', 'success');
    } else {
      await SetuApp.fetchApi('/api/bridges', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      SetuApp.showToast('Bridge registered successfully in Supabase', 'success');
    }

    closeModal('bridgeModal');
    loadBridges();
    loadOverview();
  } catch (err) {
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Bridge Asset';
  }
});

async function deleteBridge(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}" and all associated inspection/maintenance records?`)) {
    return;
  }

  try {
    await SetuApp.fetchApi(`/api/bridges/${id}`, { method: 'DELETE' });
    SetuApp.showToast('Bridge structure deleted', 'success');
    loadBridges();
    loadOverview();
  } catch (err) {}
}

// ----------------------------------------------------------------------------
// INSPECTIONS TAB
// ----------------------------------------------------------------------------
let adminInspectionsCache = [];

async function loadInspections() {
  try {
    const res = await SetuApp.fetchApi('/api/inspections');
    if (!res.success) return;

    adminInspectionsCache = res.data || [];
    const tbody = document.getElementById('inspectionsTableBody');
    if (!tbody) return;

    if (adminInspectionsCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="notif-empty">No inspection records logged yet</td></tr>';
      return;
    }

    tbody.innerHTML = adminInspectionsCache.map((i, idx) => `
      <tr>
        <td>
          <button type="button" onclick="openAdminInspectionModal(${idx})" title="Click to view AI Detection Canvas" style="background: none; border: none; padding: 0; cursor: pointer; position: relative; display: block;">
            <img src="${i.image_url}" alt="Inspection" style="width: 64px; height: 44px; object-fit: cover; border-radius: var(--radius-s); border: 1px solid var(--border); display: block;">
            <span style="position: absolute; bottom: 2px; right: 2px; background: rgba(16,35,61,0.85); color: #fff; font-size: 0.6rem; padding: 1px 3px; border-radius: 2px; font-family: var(--font-mono);">AI</span>
          </button>
        </td>
        <td>
          <strong>${i.bridge ? i.bridge.bridge_name : 'Unknown'}</strong>
          <div class="mono" style="font-size: 0.72rem; color: var(--navy-faint);">${i.bridge ? i.bridge.bridge_id : ''}</div>
        </td>
        <td class="mono">${i.inspection_date}</td>
        <td class="mono">
          <div>${i.crack_count} cracks</div>
          <div style="font-size: 0.72rem; color: var(--navy-soft);">${(i.images && i.images.length > 1) ? `${i.images.length} patches` : '1 patch'}</div>
        </td>
        <td><span class="status ${SetuApp.getStatusClass(i.crack_severity)}">${i.crack_severity}</span></td>
        <td class="mono font-bold">${i.health_score}/100</td>
        <td><span class="status ${SetuApp.getStatusClass(i.health_status)}">${i.health_status}</span></td>
        <td style="max-width: 200px; font-size: 0.8rem; color: var(--navy-soft);">${i.remarks || '—'}</td>
        <td style="white-space: nowrap;">
          <button type="button" onclick="openAdminInspectionModal(${idx})" class="btn btn--primary btn--sm" style="padding: 4px 8px; font-size: 0.74rem; margin-right: 4px;">
            Inspect AI (${(i.images && i.images.length) || 1})
          </button>
          <a href="/bridge-details?id=${i.bridge_id}" class="btn btn--ghost btn--sm" style="padding: 4px 8px; font-size: 0.74rem;">Dossier</a>
        </td>
      </tr>
    `).join('');
  } catch (err) {}
}

window.openAdminInspectionModal = function (idx) {
  const item = adminInspectionsCache[idx];
  if (item && window.SetuVisualAI) {
    SetuVisualAI.openInspectionModal(item);
  }
};


// ----------------------------------------------------------------------------
// MAINTENANCE TAB
// ----------------------------------------------------------------------------
async function loadMaintenance() {
  try {
    const res = await SetuApp.fetchApi('/api/maintenance');
    if (!res.success) return;

    const tbody = document.getElementById('maintenanceTableBody');
    if (!tbody) return;

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="notif-empty">No maintenance work orders found</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(m => `
      <tr>
        <td><strong>${m.bridge ? m.bridge.bridge_name : 'Structure'}</strong></td>
        <td>${m.contractor ? m.contractor.company_name : 'Not Assigned'}</td>
        <td class="mono">${m.scheduled_date}</td>
        <td class="mono">${m.completion_date || '—'}</td>
        <td><span class="badge-tag">${m.priority}</span></td>
        <td><span class="status ${SetuApp.getStatusClass(m.status)}">${m.status}</span></td>
        <td style="max-width: 220px; font-size: 0.82rem; color: var(--navy-soft);">${m.remarks || '—'}</td>
        <td>
          <button onclick="openEditMaintenancePrompt('${m.id}', '${m.status}')" class="btn btn--ghost btn--sm" style="padding: 4px 8px; font-size: 0.76rem;">Update</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {}
}

function openScheduleMaintenanceModal() {
  document.getElementById('maintenanceForm').reset();
  document.getElementById('maint_date_input').value = new Date().toISOString().split('T')[0];
  openModal('maintenanceModal');
}

document.getElementById('maintenanceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    bridge_id: document.getElementById('maint_bridge_select').value,
    contractor_id: document.getElementById('maint_contractor_select').value || null,
    scheduled_date: document.getElementById('maint_date_input').value,
    priority: document.getElementById('maint_priority_select').value,
    remarks: document.getElementById('maint_remarks_input').value
  };

  try {
    await SetuApp.fetchApi('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    SetuApp.showToast('Maintenance task scheduled and contractor notified', 'success');
    closeModal('maintenanceModal');
    loadMaintenance();
    loadOverview();
  } catch (err) {}
});

async function openEditMaintenancePrompt(id, currentStatus) {
  const newStatus = prompt(`Update Maintenance Status:\n(Scheduled | In Progress | Completed | Overdue)`, currentStatus);
  if (!newStatus || newStatus === currentStatus) return;

  try {
    await SetuApp.fetchApi(`/api/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    SetuApp.showToast(`Maintenance status updated to ${newStatus}`, 'success');
    loadMaintenance();
    loadOverview();
  } catch (err) {}
}

// ----------------------------------------------------------------------------
// CONTRACTORS TAB
// ----------------------------------------------------------------------------
async function loadContractors() {
  try {
    const res = await SetuApp.fetchApi('/api/contractors');
    if (!res.success) return;

    allContractorsCache = res.data || [];
    populateContractorDropdowns(allContractorsCache);

    const tbody = document.getElementById('contractorsTableBody');
    if (!tbody) return;

    if (allContractorsCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="notif-empty">No contractor firms registered</td></tr>';
      return;
    }

    tbody.innerHTML = allContractorsCache.map(c => `
      <tr>
        <td><strong>${c.company_name}</strong></td>
        <td>${c.contact_person}</td>
        <td class="mono">${c.email}</td>
        <td class="mono">${c.phone}</td>
        <td class="mono text-center">${c.assigned_bridges_count || 0}</td>
        <td class="mono text-center" style="color: var(--green);">${c.completed_tasks || 0}</td>
        <td class="mono text-center" style="color: var(--red);">${c.overdue_tasks || 0}</td>
        <td>
          <span class="status ${c.flag_status === 'Normal' ? 'status--good' : (c.flag_status.includes('Yellow') ? 'status--moderate' : 'status--attention')}">${c.flag_status}</span>
        </td>
        <td>
          <button onclick="openEditContractorModal('${c.id}')" class="btn btn--ghost btn--sm" style="padding: 4px 8px; font-size: 0.76rem;">Edit</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {}
}

function openAddContractorModal() {
  document.getElementById('contractorModalTitle').textContent = 'Add Contractor Firm';
  document.getElementById('contractorForm').reset();
  document.getElementById('editContractorId').value = '';
  openModal('contractorModal');
}

function openEditContractorModal(id) {
  const c = allContractorsCache.find(x => x.id === id);
  if (!c) return;

  document.getElementById('contractorModalTitle').textContent = `Edit Contractor: ${c.company_name}`;
  document.getElementById('editContractorId').value = c.id;
  document.getElementById('company_name_input').value = c.company_name;
  document.getElementById('contact_person_input').value = c.contact_person;
  document.getElementById('contractor_email_input').value = c.email;
  document.getElementById('contractor_phone_input').value = c.phone;
  document.getElementById('contractor_flag_input').value = c.flag_status;

  openModal('contractorModal');
}

document.getElementById('contractorForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('editContractorId').value;
  const payload = {
    company_name: document.getElementById('company_name_input').value.trim(),
    contact_person: document.getElementById('contact_person_input').value.trim(),
    email: document.getElementById('contractor_email_input').value.trim(),
    phone: document.getElementById('contractor_phone_input').value.trim(),
    flag_status: document.getElementById('contractor_flag_input').value
  };

  try {
    if (editId) {
      await SetuApp.fetchApi(`/api/contractors/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      SetuApp.showToast('Contractor updated successfully', 'success');
    } else {
      await SetuApp.fetchApi('/api/contractors', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      SetuApp.showToast('Contractor registered successfully', 'success');
    }
    closeModal('contractorModal');
    loadContractors();
  } catch (err) {}
});

// ----------------------------------------------------------------------------
// ANALYTICS TAB
// ----------------------------------------------------------------------------
async function loadAnalytics() {
  try {
    const res = await SetuApp.fetchApi('/api/analytics/overview');
    if (!res.success) return;

    const { severityDistribution, maintenanceStatus, contractorStats } = res.data;

    // 1. Severity Distribution Chart
    const ctxSev = document.getElementById('severityChart');
    if (ctxSev) {
      if (severityChartInstance) severityChartInstance.destroy();
      severityChartInstance = new Chart(ctxSev, {
        type: 'bar',
        data: {
          labels: ['None', 'Low', 'Moderate', 'High', 'Critical'],
          datasets: [{
            label: 'Inspection Findings',
            data: [
              severityDistribution.none || 0,
              severityDistribution.low || 0,
              severityDistribution.moderate || 0,
              severityDistribution.high || 0,
              severityDistribution.critical || 0
            ],
            backgroundColor: ['#CBD3CA', '#1F7A4D', '#B07A12', '#B5432E', '#731E12']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }

    // 2. Maintenance Status Breakdown
    const ctxMaint = document.getElementById('maintStatusChart');
    if (ctxMaint) {
      if (maintStatusChartInstance) maintStatusChartInstance.destroy();
      maintStatusChartInstance = new Chart(ctxMaint, {
        type: 'doughnut',
        data: {
          labels: ['Scheduled', 'In Progress', 'Completed', 'Overdue'],
          datasets: [{
            data: [
              maintenanceStatus.scheduled || 0,
              maintenanceStatus.in_progress || 0,
              maintenanceStatus.completed || 0,
              maintenanceStatus.overdue || 0
            ],
            backgroundColor: ['#2C5F8A', '#B07A12', '#1F7A4D', '#B5432E']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

    // 3. Contractor Velocity Table
    const cTable = document.getElementById('analyticsContractorTable');
    if (cTable) {
      cTable.innerHTML = contractorStats.map(c => `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td><span class="status ${c.flag === 'Normal' ? 'status--good' : (c.flag.includes('Yellow') ? 'status--moderate' : 'status--attention')}">${c.flag}</span></td>
          <td class="mono font-bold">${c.total}</td>
          <td class="mono" style="color: var(--green);">${c.completed}</td>
          <td class="mono" style="color: var(--red);">${c.overdue}</td>
          <td class="mono font-bold">${c.score}%</td>
        </tr>
      `).join('');
    }
  } catch (err) {}
}

// ----------------------------------------------------------------------------
// REPORTS TAB
// ----------------------------------------------------------------------------
async function loadReports() {
  try {
    const res = await SetuApp.fetchApi('/api/reports');
    if (!res.success) return;

    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="notif-empty">No engineering reports generated yet</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(r => `
      <tr>
        <td><strong>${r.report_type}</strong></td>
        <td>${r.bridge ? `${r.bridge.bridge_name} (${r.bridge.bridge_id})` : 'Bridge Asset'}</td>
        <td class="mono">${new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>
          <a href="${r.file_url}" class="btn btn--primary btn--sm" style="padding: 5px 12px; font-size: 0.78rem;">Open Dossier →</a>
        </td>
      </tr>
    `).join('');
  } catch (err) {}
}

function openGenerateReportModal() {
  document.getElementById('reportForm').reset();
  openModal('reportModal');
}

document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    bridge_id: document.getElementById('report_bridge_select').value,
    report_type: document.getElementById('report_type_select').value
  };

  try {
    const res = await SetuApp.fetchApi('/api/reports/generate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    SetuApp.showToast('Engineering report dossier generated', 'success');
    closeModal('reportModal');
    loadReports();
    window.open(res.data.file_url, '_blank');
  } catch (err) {}
});

// ----------------------------------------------------------------------------
// MODAL HELPERS & DROPDOWNS
// ----------------------------------------------------------------------------
function openModal(id) {
  document.getElementById(id)?.classList.add('is-open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('is-open');
}

function populateContractorDropdowns(contractors) {
  const selects = [document.getElementById('contractor_select_input'), document.getElementById('maint_contractor_select')];
  selects.forEach(sel => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Select Contractor --</option>' +
      contractors.map(c => `<option value="${c.id}">${c.company_name} (${c.flag_status})</option>`).join('');
    if (current) sel.value = current;
  });
}

function populateBridgeDropdowns(bridges) {
  const selects = [document.getElementById('maint_bridge_select'), document.getElementById('report_bridge_select')];
  selects.forEach(sel => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Select Bridge --</option>' +
      bridges.map(b => `<option value="${b.id}">${b.bridge_name} (${b.bridge_id} • ${b.location})</option>`).join('');
    if (current) sel.value = current;
  });
}
