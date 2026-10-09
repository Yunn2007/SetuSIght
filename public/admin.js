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
  const reassignGroup = document.getElementById('reassignTasksGroup');
  if (reassignGroup) reassignGroup.style.display = 'none';
  const reassignInput = document.getElementById('reassign_active_tasks_input');
  if (reassignInput) reassignInput.checked = false;
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

  const reassignGroup = document.getElementById('reassignTasksGroup');
  if (reassignGroup) reassignGroup.style.display = 'block';
  const reassignInput = document.getElementById('reassign_active_tasks_input');
  if (reassignInput) reassignInput.checked = false;

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
    width: document.getElementById('width_input').value || null,
    reassign_active_maintenance: document.getElementById('reassign_active_tasks_input')?.checked || false
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
          <div style="display: flex; gap: 4px;">
            <button onclick="openEditMaintenancePrompt('${m.id}', '${m.status}')" class="btn btn--ghost btn--sm" style="padding: 4px 8px; font-size: 0.76rem;">Update</button>
            <button onclick="openAdminEvidenceModal('${m.id}')" class="btn btn--outline btn--sm" style="padding: 4px 8px; font-size: 0.76rem;">Evidence</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    SetuApp.showToast('Failed to load maintenance records', 'error');
  }
}

async function openAdminEvidenceModal(maintId) {
  const detailsEl = document.getElementById('adminEvidenceDetails');
  const galleryEl = document.getElementById('adminEvidenceGallery');
  if (!detailsEl || !galleryEl) return;

  detailsEl.innerHTML = '<div style="color: var(--navy-soft);">Loading work order details...</div>';
  galleryEl.innerHTML = '<div style="color: var(--navy-soft);">Loading evidence photos...</div>';
  openModal('adminEvidenceModal');

  try {
    const [maintRes, evidenceRes] = await Promise.all([
      SetuApp.fetchApi(`/api/maintenance/${maintId}`),
      SetuApp.fetchApi(`/api/maintenance/${maintId}/evidence`)
    ]);

    const m = maintRes.data;
    if (m) {
      detailsEl.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 8px;">
          <div><span style="color: var(--navy-soft); font-size: 0.78rem;">Bridge</span><br><strong>${m.bridge?.bridge_name || '—'}</strong> (${m.bridge?.bridge_id || '—'})</div>
          <div><span style="color: var(--navy-soft); font-size: 0.78rem;">Contractor</span><br><strong>${m.contractor?.company_name || 'Unassigned'}</strong></div>
          <div><span style="color: var(--navy-soft); font-size: 0.78rem;">Status</span><br><span class="status ${SetuApp.getStatusClass(m.status)}">${m.status}</span></div>
          <div><span style="color: var(--navy-soft); font-size: 0.78rem;">Scheduled / Completed</span><br><span class="mono">${m.scheduled_date || '—'}</span> / <span class="mono">${m.completion_date || '—'}</span></div>
        </div>
        ${m.remarks ? `<div style="font-size: 0.85rem; color: var(--navy-soft); padding: 8px; background: rgba(0,0,0,0.03); border-radius: 6px;"><strong>Scope / Remarks:</strong> ${m.remarks}</div>` : ''}
      `;
    }

    const items = evidenceRes.data || [];
    if (items.length === 0) {
      galleryEl.innerHTML = '<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--navy-soft); background: var(--bg-soft); border-radius: 8px;">No repair or completion evidence uploaded yet for this work order.</div>';
      return;
    }

    galleryEl.innerHTML = items.map(item => `
      <div class="card" style="margin: 0; padding: 0; overflow: hidden; border: 1px solid var(--border-color);">
        <div style="position: relative; height: 160px; background: #111;">
          <img src="${item.image_url}" alt="${item.caption || 'Evidence'}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('${item.image_url}', '_blank')">
          <span class="badge-tag" style="position: absolute; top: 8px; left: 8px; text-transform: uppercase; font-size: 0.7rem; background: ${item.evidence_type === 'after' ? 'var(--green)' : (item.evidence_type === 'progress' ? 'var(--blue)' : 'var(--gold)')}; color: #fff;">
            ${item.evidence_type}
          </span>
        </div>
        <div style="padding: 10px;">
          <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">${item.caption || 'Photo Evidence'}</div>
          <div style="font-size: 0.75rem; color: var(--navy-soft);">By: ${item.uploader?.name || 'Contractor'} &bull; ${new Date(item.created_at).toLocaleDateString()}</div>
          <div style="margin-top: 8px; text-align: right;">
            <button onclick="deleteAdminEvidence('${maintId}', '${item.id}')" class="btn btn--ghost btn--sm" style="color: var(--red); padding: 2px 6px; font-size: 0.72rem;">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    detailsEl.innerHTML = '<div style="color: var(--red);">Failed to load work order details.</div>';
    galleryEl.innerHTML = '';
  }
}

async function deleteAdminEvidence(maintId, evidenceId) {
  if (!confirm('Are you sure you want to delete this evidence record?')) return;
  try {
    const res = await SetuApp.fetchApi(`/api/maintenance/${maintId}/evidence/${evidenceId}`, {
      method: 'DELETE'
    });
    if (res.success) {
      SetuApp.showToast('Evidence deleted', 'success');
      openAdminEvidenceModal(maintId);
    } else {
      SetuApp.showToast(res.error || 'Failed to delete evidence', 'error');
    }
  } catch (err) {
    SetuApp.showToast(err.message || 'Failed to delete evidence', 'error');
  }
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
  } catch (err) {
    SetuApp.showToast('Failed to schedule maintenance', 'error');
  }
});

async function openEditMaintenancePrompt(id, currentStatus) {
  const newStatus = prompt(`Update Maintenance Status:\n(Scheduled | In Progress | Completed | Overdue)`, currentStatus);
  if (!newStatus || newStatus === currentStatus) return;

  try {
    const res = await SetuApp.fetchApi(`/api/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    if (res && res.success === false) {
      SetuApp.showToast(res.error || `Failed to update status to ${newStatus}`, 'error');
      return;
    }
    SetuApp.showToast(`Maintenance status updated to ${newStatus}`, 'success');
    loadMaintenance();
    loadOverview();
  } catch (err) {
    SetuApp.showToast(err.message || 'Failed to update status', 'error');
  }
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
        <td class="mono font-bold">${c.contractor_code || '—'}</td>
        <td><strong>${c.company_name}</strong></td>
        <td>${c.contact_person}</td>
        <td>
          <div class="mono" style="font-size: 0.82rem;">${c.email}</div>
          <div class="mono" style="font-size: 0.76rem; color: var(--navy-soft);">${c.phone}</div>
        </td>
        <td>
          <span class="status ${c.login_account_status === 'Active' ? 'status--good' : 'status--attention'}">${c.login_account_status || 'Unlinked'}</span>
          ${c.login_user ? `<div class="mono" style="font-size: 0.72rem; color: var(--navy-soft);">${c.login_user.email}</div>` : ''}
        </td>
        <td class="mono text-center font-bold">${c.assigned_bridges_count || 0}</td>
        <td class="mono text-center" style="font-size: 0.82rem;">
          <strong>${c.total_tasks || 0}</strong> / 
          <span style="color: var(--blue);">${c.in_progress_tasks || 0}</span> / 
          <span style="color: var(--green);">${c.completed_tasks || 0}</span> / 
          <span style="color: var(--red);">${c.overdue_tasks || 0}</span>
        </td>
        <td class="mono text-center font-bold" style="color: ${c.completion_rate >= 80 ? 'var(--green)' : (c.completion_rate >= 50 ? 'var(--gold)' : 'var(--red)')};">
          ${c.completion_rate != null ? c.completion_rate + '%' : '—'}
        </td>
        <td>
          <span class="status ${c.flag_status === 'Normal' ? 'status--good' : (c.flag_status && c.flag_status.includes('Yellow') ? 'status--moderate' : 'status--attention')}">${c.flag_status}</span>
        </td>
        <td>
          <button onclick="openEditContractorModal('${c.id}')" class="btn btn--ghost btn--sm" style="padding: 4px 8px; font-size: 0.76rem;">Edit</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    SetuApp.showToast('Failed to load contractors', 'error');
  }
}

function openAddContractorModal() {
  document.getElementById('contractorModalTitle').textContent = 'Add Contractor Firm & Portal Account';
  document.getElementById('contractorForm').reset();
  document.getElementById('editContractorId').value = '';
  const pwdInput = document.getElementById('contractor_password_input');
  if (pwdInput) pwdInput.required = true;
  const helpText = document.getElementById('contractor_password_help');
  if (helpText) helpText.textContent = 'Required for new contractor login (minimum 6 characters).';
  openModal('contractorModal');
}

function openEditContractorModal(id) {
  const c = allContractorsCache.find(x => x.id === id);
  if (!c) return;

  document.getElementById('contractorModalTitle').textContent = `Edit Contractor: ${c.company_name}`;
  document.getElementById('editContractorId').value = c.id;
  document.getElementById('company_name_input').value = c.company_name || '';
  document.getElementById('contact_person_input').value = c.contact_person || '';
  document.getElementById('contractor_email_input').value = c.email || '';
  document.getElementById('contractor_phone_input').value = c.phone || '';
  document.getElementById('contractor_flag_input').value = c.flag_status || 'Normal';

  if (document.getElementById('contractor_login_name_input')) {
    document.getElementById('contractor_login_name_input').value = c.login_user?.name || c.contact_person || '';
  }
  if (document.getElementById('contractor_login_email_input')) {
    document.getElementById('contractor_login_email_input').value = c.login_user?.email || c.email || '';
  }
  const pwdInput = document.getElementById('contractor_password_input');
  if (pwdInput) {
    pwdInput.value = '';
    pwdInput.required = false;
  }
  const helpText = document.getElementById('contractor_password_help');
  if (helpText) helpText.textContent = 'Leave blank to preserve current login password.';

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
    flag_status: document.getElementById('contractor_flag_input').value,
    login_name: document.getElementById('contractor_login_name_input')?.value.trim() || undefined,
    login_email: document.getElementById('contractor_login_email_input')?.value.trim() || undefined,
    login_password: document.getElementById('contractor_password_input')?.value || undefined
  };

  try {
    let res;
    if (editId) {
      res = await SetuApp.fetchApi(`/api/contractors/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res && res.success === false) {
        SetuApp.showToast(res.error || 'Failed to update contractor', 'error');
        return;
      }
      SetuApp.showToast('Contractor updated successfully', 'success');
    } else {
      res = await SetuApp.fetchApi('/api/contractors', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && res.success === false) {
        SetuApp.showToast(res.error || 'Failed to create contractor', 'error');
        return;
      }
      SetuApp.showToast('Contractor & login account registered successfully', 'success');
    }
    closeModal('contractorModal');
    loadContractors();
  } catch (err) {
    SetuApp.showToast(err.message || 'Operation failed', 'error');
  }
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
