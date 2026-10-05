/**
 * SetuSight — Contractor Partner Console Application Logic
 * Dedicated to maintenance execution, assigned bridge monitoring, and work order status updates
 */

let allMaintenanceCache = [];
let allBridgesCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = SetuApp.checkAuth(['contractor', 'admin']);
  if (!user) return;

  SetuApp.initHeader(user);
  initSidebar();
  initFormListeners();

  // Initial load
  await loadAssignedTasks();
  await loadAssignedBridges();
});

// ----------------------------------------------------------------------------
// SIDEBAR & TAB NAVIGATION
// ----------------------------------------------------------------------------
function initSidebar() {
  document.querySelectorAll('.sidebar__nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
    });
  });

  const toggle = document.getElementById('mobileNavToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.toggle('is-open');
    });
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.sidebar__nav .nav-item').forEach(item => {
    item.classList.toggle('is-active', item.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.style.display = pane.id === `tab-${tabId}` ? 'block' : 'none';
  });

  const titles = {
    'work-orders': 'Assigned Maintenance Tasks',
    'assigned-bridges': 'Assigned Monitored Bridges',
    'completed-repairs': 'Completed Repairs & Audit History'
  };

  const headerTitle = document.getElementById('pageHeaderTitle');
  if (headerTitle) headerTitle.textContent = titles[tabId] || 'Contractor Portal';

  if (tabId === 'work-orders') loadAssignedTasks();
  else if (tabId === 'assigned-bridges') loadAssignedBridges();
  else if (tabId === 'completed-repairs') loadCompletedRepairs();
}

// ----------------------------------------------------------------------------
// 1. ASSIGNED TASKS TAB
// ----------------------------------------------------------------------------
async function loadAssignedTasks() {
  try {
    const res = await SetuApp.fetchApi('/api/maintenance');
    if (!res.success) return;

    allMaintenanceCache = res.data || [];

    // Calculate stats
    const active = allMaintenanceCache.filter(m => m.status === 'Scheduled' || m.status === 'In Progress' || m.status === 'Pending').length;
    const completed = allMaintenanceCache.filter(m => m.status === 'Completed').length;
    const overdue = allMaintenanceCache.filter(m => m.status === 'Overdue').length;

    document.getElementById('statActiveTasks').textContent = active;
    document.getElementById('statCompletedTasks').textContent = completed;
    document.getElementById('statOverdueTasks').textContent = overdue;

    const tbody = document.getElementById('contractorTasksTable');
    if (!tbody) return;

    if (allMaintenanceCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="notif-empty">No maintenance work orders assigned at this time</td></tr>';
      return;
    }

    tbody.innerHTML = allMaintenanceCache.map(m => {
      const priorityClass = m.priority === 'Urgent' || m.priority === 'High' ? 'status--attention' :
                            m.priority === 'Medium' ? 'status--moderate' : 'status--good';

      const statusClass = m.status === 'Completed' ? 'status--good' :
                          m.status === 'In Progress' ? 'status--moderate' :
                          m.status === 'Overdue' ? 'status--attention' : 'status--neutral';

      const maintCode = 'MNT-' + m.id.substring(0, 6).toUpperCase();
      const bridgeLabel = m.bridge ? `${m.bridge.bridge_name} (${m.bridge.bridge_id})` : 'Bridge Asset';
      const scheduledStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending';

      return `
        <tr>
          <td class="mono font-bold">${maintCode}</td>
          <td><strong>${bridgeLabel}</strong></td>
          <td><span class="status ${priorityClass}">${m.priority}</span></td>
          <td class="mono">${scheduledStr}</td>
          <td><span class="status ${statusClass}">${m.status}</span></td>
          <td style="text-align: right;">
            <button class="btn btn--primary btn--sm" onclick="openMaintenanceModal('${m.id}')" style="padding: 5px 12px; font-size: 0.78rem;">
              View Maintenance →
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {}
}

// ----------------------------------------------------------------------------
// 2. ASSIGNED BRIDGES TAB
// ----------------------------------------------------------------------------
async function loadAssignedBridges() {
  try {
    const res = await SetuApp.fetchApi('/api/bridges');
    if (!res.success) return;

    allBridgesCache = res.data || [];
    
    // Update badge in sidebar
    const badge = document.getElementById('contractorBridgeCount');
    if (badge) badge.textContent = allBridgesCache.length;

    const tbody = document.getElementById('contractorBridgesTable');
    if (!tbody) return;

    if (allBridgesCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="notif-empty">No bridges currently assigned to your contractor account</td></tr>';
      return;
    }

    tbody.innerHTML = allBridgesCache.map(b => {
      const statusClass = b.current_health_status === 'Good' ? 'status--good' :
                          b.current_health_status === 'Moderate' ? 'status--moderate' : 'status--attention';

      const priorityClass = b.maintenance_priority === 'Urgent' || b.maintenance_priority === 'High' ? 'status--attention' :
                            b.maintenance_priority === 'Medium' ? 'status--moderate' : 'status--good';

      return `
        <tr>
          <td class="mono font-bold">${b.bridge_id}</td>
          <td><strong>${b.bridge_name}</strong></td>
          <td>${b.location}</td>
          <td>${b.material}</td>
          <td class="mono font-bold text-center">${b.current_health_score || 100} / 100</td>
          <td><span class="status ${statusClass}">${b.current_health_status}</span></td>
          <td><span class="status ${priorityClass}">${b.maintenance_priority || 'Low'}</span></td>
          <td style="text-align: right;">
            <button class="btn btn--primary btn--sm" onclick="openBridgeMaintenanceModal('${b.id}')" style="padding: 5px 12px; font-size: 0.78rem;">
              View Maintenance →
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {}
}

// ----------------------------------------------------------------------------
// 3. COMPLETED REPAIRS TAB
// ----------------------------------------------------------------------------
async function loadCompletedRepairs() {
  try {
    const res = await SetuApp.fetchApi('/api/maintenance');
    if (!res.success) return;

    const completedList = (res.data || []).filter(m => m.status === 'Completed');
    const tbody = document.getElementById('contractorCompletedTable');
    if (!tbody) return;

    if (completedList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="notif-empty">No completed repair records found</td></tr>';
      return;
    }

    tbody.innerHTML = completedList.map(m => {
      const maintCode = 'MNT-' + m.id.substring(0, 6).toUpperCase();
      const bridgeLabel = m.bridge ? `${m.bridge.bridge_name} (${m.bridge.bridge_id})` : 'Bridge Asset';
      const scheduledStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
      const completedStr = m.completion_date ? new Date(m.completion_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

      return `
        <tr>
          <td class="mono font-bold">${maintCode}</td>
          <td><strong>${bridgeLabel}</strong></td>
          <td class="mono">${scheduledStr}</td>
          <td class="mono" style="color: var(--green-dark); font-weight: 700;">${completedStr}</td>
          <td><span class="status status--neutral">${m.priority}</span></td>
          <td style="max-width: 280px; font-size: 0.82rem; color: var(--navy-soft);">${m.remarks || 'Repairs completed as per engineering guidelines'}</td>
          <td><span class="status status--good">Completed</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {}
}

// ----------------------------------------------------------------------------
// VIEW / EDIT MAINTENANCE MODAL
// ----------------------------------------------------------------------------
async function openMaintenanceModal(maintId) {
  const item = allMaintenanceCache.find(m => m.id === maintId);
  if (!item) return;

  populateMaintenanceModal(item);
  openModal('viewMaintenanceModal');
}

async function openBridgeMaintenanceModal(bridgeId) {
  const bridge = allBridgesCache.find(b => b.id === bridgeId);
  if (!bridge) return;

  // Find real maintenance work order for this bridge
  let maintItem = allMaintenanceCache.find(m => m.bridge_id === bridge.id);
  if (!maintItem && bridge.maintenance_id) {
    try {
      const res = await SetuApp.fetchApi(`/api/maintenance/${bridge.maintenance_id}`);
      if (res.success && res.data) maintItem = res.data;
    } catch (e) {}
  }

  if (!maintItem) {
    SetuApp.showToast('No active maintenance work order assigned for this bridge.', 'info');
    return;
  }

  maintItem.bridge = maintItem.bridge || bridge;
  populateMaintenanceModal(maintItem);
  openModal('viewMaintenanceModal');
}

function populateMaintenanceModal(item) {
  document.getElementById('modalMaintId').value = item.id;
  const maintCode = item.id && item.id !== 'new' ? 'MNT-' + item.id.substring(0, 6).toUpperCase() : 'NEW';
  document.getElementById('viewMaintTitle').textContent = `Maintenance Work Order — ${maintCode}`;

  // Bridge details
  const b = item.bridge || {};
  document.getElementById('mBridgeName').textContent = b.bridge_name ? `${b.bridge_name} (${b.bridge_id || ''})` : '--';
  document.getElementById('mBridgeLocation').textContent = b.location || '--';
  document.getElementById('mBridgeMaterial').textContent = `${b.material || '--'} • ${b.bridge_type || '--'}`;
  document.getElementById('mBridgeScore').textContent = `${b.current_health_score || 100} / 100`;

  const statusEl = document.getElementById('mBridgeStatus');
  if (statusEl) {
    const status = b.current_health_status || 'Good';
    const sClass = status === 'Good' ? 'status--good' : status === 'Moderate' ? 'status--moderate' : 'status--attention';
    statusEl.innerHTML = `<span class="status ${sClass}">${status}</span>`;
  }

  // Maintenance details
  const priorityEl = document.getElementById('mMaintPriority');
  if (priorityEl) {
    const pClass = item.priority === 'Urgent' || item.priority === 'High' ? 'status--attention' :
                   item.priority === 'Medium' ? 'status--moderate' : 'status--good';
    priorityEl.innerHTML = `<span class="status ${pClass}">${item.priority || 'Medium'}</span>`;
  }

  const schedDateStr = item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Scheduled for upcoming cycle';
  document.getElementById('mMaintScheduledDate').textContent = schedDateStr;

  // Form inputs
  document.getElementById('mMaintStatusSelect').value = item.status || 'Scheduled';
  document.getElementById('mCompletionDateInput').value = item.completion_date ? item.completion_date.split('T')[0] : (item.status === 'Completed' ? new Date().toISOString().split('T')[0] : '');
  document.getElementById('mRemarksInput').value = item.remarks || '';
}

function initFormListeners() {
  const statusSelect = document.getElementById('mMaintStatusSelect');
  const compDateInput = document.getElementById('mCompletionDateInput');

  statusSelect?.addEventListener('change', () => {
    if (statusSelect.value === 'Completed' && !compDateInput.value) {
      compDateInput.value = new Date().toISOString().split('T')[0];
    }
  });

  document.getElementById('updateMaintenanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const maintId = document.getElementById('modalMaintId').value;
    if (!maintId || maintId === 'new') {
      SetuApp.showToast('Please select a valid scheduled work order to update.', 'warning');
      return;
    }

    const payload = {
      status: document.getElementById('mMaintStatusSelect').value,
      completion_date: document.getElementById('mCompletionDateInput').value || null,
      remarks: document.getElementById('mRemarksInput').value.trim()
    };

    try {
      await SetuApp.fetchApi(`/api/maintenance/${maintId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      SetuApp.showToast('Maintenance work order updated successfully', 'success');
      closeModal('viewMaintenanceModal');

      await loadAssignedTasks();
      await loadAssignedBridges();
      await loadCompletedRepairs();
    } catch (err) {}
  });
}


// ----------------------------------------------------------------------------
// MODAL HELPERS
// ----------------------------------------------------------------------------
function openModal(id) {
  document.getElementById(id)?.classList.add('is-open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('is-open');
}
