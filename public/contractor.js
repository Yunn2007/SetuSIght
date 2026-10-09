/**
 * SetuSight — Contractor Partner Console Application Logic
 * Dedicated to maintenance execution, assigned bridge monitoring, and work order status updates
 */

let allMaintenanceCache = [];
let allBridgesCache = [];
let currentOpenMaintId = null;

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
    if (!res.success) {
      SetuApp.showToast(res.error || 'Failed to load maintenance tasks', 'error');
      return;
    }

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
      tbody.innerHTML = '<tr><td colspan="8" class="notif-empty">No maintenance work orders assigned to your contractor account at this time</td></tr>';
      return;
    }

    tbody.innerHTML = allMaintenanceCache.map(m => {
      const priorityClass = m.priority === 'Urgent' || m.priority === 'High' ? 'status--attention' :
                            m.priority === 'Medium' ? 'status--moderate' : 'status--good';

      const statusClass = m.status === 'Completed' ? 'status--good' :
                          m.status === 'In Progress' ? 'status--moderate' :
                          m.status === 'Overdue' ? 'status--attention' : 'status--neutral';

      const maintCode = 'MNT-' + m.id.substring(0, 6).toUpperCase();
      const b = m.bridge || {};
      const bridgeLabel = b.bridge_name ? `${b.bridge_name} <span class="mono" style="font-size: 0.78rem; color: var(--navy-soft);">(${b.bridge_id || ''})</span>` : 'Bridge Asset';
      const scheduledStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending';

      const hScore = b.current_health_score != null ? b.current_health_score : '--';
      const hStatus = b.current_health_status || 'Unknown';
      const hStatusClass = hStatus === 'Good' ? 'status--good' : (hStatus === 'Moderate' ? 'status--moderate' : 'status--attention');

      return `
        <tr>
          <td class="mono font-bold">${maintCode}</td>
          <td><strong>${bridgeLabel}</strong></td>
          <td><span class="status ${priorityClass}">${m.priority}</span></td>
          <td>
            <div style="font-size: 0.85rem;"><span class="mono font-bold">${hScore}</span>/100</div>
            <span class="status ${hStatusClass}" style="font-size: 0.72rem; padding: 2px 6px;">${hStatus}</span>
          </td>
          <td class="mono">${scheduledStr}</td>
          <td><span class="status ${statusClass}">${m.status}</span></td>
          <td style="max-width: 220px; font-size: 0.82rem; color: var(--navy-soft);">${m.remarks || '—'}</td>
          <td style="text-align: right;">
            <button class="btn btn--primary btn--sm" onclick="openMaintenanceModal('${m.id}')" style="padding: 5px 12px; font-size: 0.78rem;">
              Open Order →
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    SetuApp.showToast('Unable to connect to server', 'error');
  }
}

// ----------------------------------------------------------------------------
// 2. ASSIGNED BRIDGES TAB
// ----------------------------------------------------------------------------
async function loadAssignedBridges() {
  try {
    const res = await SetuApp.fetchApi('/api/bridges');
    if (!res.success) {
      SetuApp.showToast(res.error || 'Failed to load assigned bridges', 'error');
      return;
    }

    allBridgesCache = res.data || [];
    
    // Update badge in sidebar
    const badge = document.getElementById('contractorBridgeCount');
    if (badge) badge.textContent = allBridgesCache.length;

    const tbody = document.getElementById('contractorBridgesTable');
    if (!tbody) return;

    if (allBridgesCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="notif-empty">No bridges currently assigned to your contractor account</td></tr>';
      return;
    }

    const currentYear = new Date().getFullYear();

    tbody.innerHTML = allBridgesCache.map(b => {
      const statusClass = b.current_health_status === 'Good' ? 'status--good' :
                          b.current_health_status === 'Moderate' ? 'status--moderate' : 'status--attention';

      const priorityClass = b.maintenance_priority === 'Urgent' || b.maintenance_priority === 'High' ? 'status--attention' :
                            b.maintenance_priority === 'Medium' ? 'status--moderate' : 'status--good';

      const ageText = b.construction_year ? `${b.construction_year} (${currentYear - b.construction_year}y)` : '—';

      return `
        <tr>
          <td class="mono font-bold">${b.bridge_id}</td>
          <td><strong>${b.bridge_name}</strong></td>
          <td>${b.location}</td>
          <td>${b.material || '—'} • ${b.bridge_type || '—'}</td>
          <td class="mono text-center">${ageText}</td>
          <td class="mono font-bold text-center" style="font-size: 0.95rem;">${b.current_health_score || 100} / 100</td>
          <td><span class="status ${statusClass}">${b.current_health_status}</span></td>
          <td><span class="status ${priorityClass}">${b.maintenance_priority || 'Low'}</span></td>
          <td style="text-align: right;">
            <button class="btn btn--outline btn--sm" onclick="openContractorBridgeDetailsModal('${b.id}')" style="padding: 5px 10px; font-size: 0.78rem;">
              View Details
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    SetuApp.showToast('Unable to load assigned bridges', 'error');
  }
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
      tbody.innerHTML = '<tr><td colspan="8" class="notif-empty">No completed repair records found in work history</td></tr>';
      return;
    }

    tbody.innerHTML = completedList.map(m => {
      const maintCode = 'MNT-' + m.id.substring(0, 6).toUpperCase();
      const b = m.bridge || {};
      const bridgeLabel = b.bridge_name ? `${b.bridge_name} (${b.bridge_id || ''})` : 'Bridge Asset';
      const scheduledStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
      const completedStr = m.completion_date ? new Date(m.completion_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

      return `
        <tr>
          <td class="mono font-bold">${maintCode}</td>
          <td><strong>${bridgeLabel}</strong></td>
          <td class="mono">${scheduledStr}</td>
          <td class="mono" style="color: var(--green-dark); font-weight: 700;">${completedStr}</td>
          <td><span class="status status--neutral">${m.priority}</span></td>
          <td style="max-width: 260px; font-size: 0.82rem; color: var(--navy-soft);">${m.remarks || 'Repairs completed as per engineering scope'}</td>
          <td><span class="badge-tag" style="background: var(--green-tint); color: var(--green-dark);">Verified</span></td>
          <td style="text-align: right;">
            <button class="btn btn--ghost btn--sm" onclick="openMaintenanceModal('${m.id}')" style="padding: 4px 10px; font-size: 0.76rem;">
              View Record →
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    SetuApp.showToast('Failed to load completed repair records', 'error');
  }
}

// ----------------------------------------------------------------------------
// VIEW / EDIT MAINTENANCE MODAL & WORK ORDER LIFECYCLE
// ----------------------------------------------------------------------------
async function openMaintenanceModal(maintId) {
  currentOpenMaintId = maintId;
  const item = allMaintenanceCache.find(m => m.id === maintId);
  if (!item) return;

  populateMaintenanceModal(item);
  loadWorkOrderEvidence(maintId);
  openModal('viewMaintenanceModal');
}

function populateMaintenanceModal(item) {
  document.getElementById('modalMaintId').value = item.id;
  const maintCode = item.id ? 'MNT-' + item.id.substring(0, 6).toUpperCase() : 'NEW';
  document.getElementById('viewMaintTitle').textContent = `Maintenance Work Order — ${maintCode}`;

  // Bridge details
  const b = item.bridge || {};
  document.getElementById('mBridgeName').textContent = b.bridge_name ? `${b.bridge_name} (${b.bridge_id || ''})` : '--';
  document.getElementById('mBridgeLocation').textContent = b.location || '--';
  document.getElementById('mBridgeMaterial').textContent = `${b.material || '--'} • ${b.bridge_type || '--'}`;
  document.getElementById('mBridgeScore').textContent = `${b.current_health_score != null ? b.current_health_score : '--'} / 100`;

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

  const currentBadge = document.getElementById('mMaintCurrentStatusBadge');
  if (currentBadge) {
    const sClass = SetuApp.getStatusClass(item.status);
    currentBadge.innerHTML = `<span class="status ${sClass}">${item.status}</span>`;
  }

  // Form inputs
  const statusSelect = document.getElementById('mMaintStatusSelect');
  const compDateInput = document.getElementById('mCompletionDateInput');
  const remarksInput = document.getElementById('mRemarksInput');
  const saveBtn = document.getElementById('saveMaintBtn');

  statusSelect.value = item.status || 'Scheduled';
  compDateInput.value = item.completion_date ? item.completion_date.split('T')[0] : (item.status === 'Completed' ? new Date().toISOString().split('T')[0] : '');
  remarksInput.value = item.remarks || '';

  // Lifecycle control enforcement
  const isCompleted = item.status === 'Completed';
  statusSelect.disabled = isCompleted;
  compDateInput.disabled = isCompleted;
  remarksInput.disabled = isCompleted;
  if (saveBtn) saveBtn.disabled = isCompleted;

  // Quick Action Buttons visibility/state
  const btnStart = document.getElementById('btnQuickStart');
  const btnOverdue = document.getElementById('btnQuickOverdue');
  const btnComplete = document.getElementById('btnQuickComplete');
  const uploadCard = document.getElementById('mEvidenceUploadCard');

  if (isCompleted) {
    if (btnStart) btnStart.disabled = true;
    if (btnOverdue) btnOverdue.disabled = true;
    if (btnComplete) btnComplete.disabled = true;
    if (uploadCard) uploadCard.style.opacity = '0.7';
  } else {
    if (btnStart) btnStart.disabled = (item.status === 'In Progress');
    if (btnOverdue) btnOverdue.disabled = (item.status === 'Overdue');
    if (btnComplete) btnComplete.disabled = false;
    if (uploadCard) uploadCard.style.opacity = '1';
  }
}

async function setQuickStatus(newStatus) {
  const statusSelect = document.getElementById('mMaintStatusSelect');
  const compDateInput = document.getElementById('mCompletionDateInput');

  statusSelect.value = newStatus;
  if (newStatus === 'Completed' && !compDateInput.value) {
    compDateInput.value = new Date().toISOString().split('T')[0];
  } else if (newStatus !== 'Completed') {
    compDateInput.value = '';
  }

  // Trigger form submit
  document.getElementById('updateMaintenanceForm')?.requestSubmit();
}

function initFormListeners() {
  const statusSelect = document.getElementById('mMaintStatusSelect');
  const compDateInput = document.getElementById('mCompletionDateInput');

  statusSelect?.addEventListener('change', () => {
    if (statusSelect.value === 'Completed') {
      if (!compDateInput.value) compDateInput.value = new Date().toISOString().split('T')[0];
    } else {
      compDateInput.value = '';
    }
  });

  document.getElementById('updateMaintenanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const maintId = document.getElementById('modalMaintId').value;
    if (!maintId || maintId === 'new') {
      SetuApp.showToast('Please select a valid scheduled work order to update.', 'warning');
      return;
    }

    const newStatus = document.getElementById('mMaintStatusSelect').value;
    const compDate = document.getElementById('mCompletionDateInput').value;
    const remarks = document.getElementById('mRemarksInput').value.trim();

    if (newStatus === 'Completed' && !compDate) {
      SetuApp.showToast('Completion date is required when completing a work order', 'warning');
      return;
    }

    const payload = {
      status: newStatus,
      completion_date: newStatus === 'Completed' ? compDate : null,
      remarks: remarks
    };

    const saveBtn = document.getElementById('saveMaintBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Updating...';
    }

    try {
      const res = await SetuApp.fetchApi(`/api/maintenance/${maintId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (!res.success) {
        SetuApp.showToast(res.error || 'Failed to update maintenance order', 'error');
        return;
      }

      SetuApp.showToast(`Work order status updated to ${newStatus}`, 'success');
      closeModal('viewMaintenanceModal');

      await loadAssignedTasks();
      await loadAssignedBridges();
      await loadCompletedRepairs();
    } catch (err) {
      SetuApp.showToast(err.message || 'Network error updating work order', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Work Order Changes';
      }
    }
  });
}

// ----------------------------------------------------------------------------
// REPAIR EVIDENCE HANDLING
// ----------------------------------------------------------------------------
async function loadWorkOrderEvidence(maintId) {
  const gallery = document.getElementById('mEvidenceGallery');
  if (!gallery) return;

  gallery.innerHTML = '<div style="grid-column: 1 / -1; color: var(--navy-soft); font-size: 0.82rem;">Loading evidence...</div>';

  try {
    const res = await SetuApp.fetchApi(`/api/maintenance/${maintId}/evidence`);
    if (!res.success) {
      gallery.innerHTML = '<div style="grid-column: 1 / -1; color: var(--navy-soft); font-size: 0.82rem;">No evidence records found.</div>';
      return;
    }

    const items = res.data || [];
    if (items.length === 0) {
      gallery.innerHTML = '<div style="grid-column: 1 / -1; padding: 14px; text-align: center; color: var(--navy-soft); background: var(--bg-alt); border-radius: var(--radius-s); font-size: 0.82rem;">No photographic evidence uploaded yet for this work order. Upload before, during, or after repair photos below.</div>';
      return;
    }

    gallery.innerHTML = items.map(ev => {
      const stageColor = ev.evidence_type === 'after' ? 'var(--green)' :
                         ev.evidence_type === 'progress' ? 'var(--blue)' : 'var(--amber)';

      const dateStr = ev.created_at ? new Date(ev.created_at).toLocaleDateString() : '';

      return `
        <div class="card" style="margin: 0; padding: 0; overflow: hidden; border: 1px solid var(--border);">
          <div style="position: relative; height: 130px; background: #111;">
            <img src="${ev.image_url}" alt="${ev.caption || 'Evidence'}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('${ev.image_url}', '_blank')">
            <span class="badge-tag" style="position: absolute; top: 6px; left: 6px; text-transform: uppercase; font-size: 0.68rem; background: ${stageColor}; color: #fff;">
              ${ev.evidence_type}
            </span>
          </div>
          <div style="padding: 8px;">
            <div style="font-size: 0.8rem; font-weight: 600; line-height: 1.3;">${ev.caption || 'Photo Evidence'}</div>
            <div style="font-size: 0.72rem; color: var(--navy-faint); margin-top: 4px;">${dateStr}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    gallery.innerHTML = '<div style="grid-column: 1 / -1; color: var(--red); font-size: 0.82rem;">Failed to load evidence records.</div>';
  }
}

async function uploadEvidencePhoto() {
  const maintId = currentOpenMaintId || document.getElementById('modalMaintId')?.value;
  if (!maintId) {
    SetuApp.showToast('No active work order selected', 'warning');
    return;
  }

  const fileInput = document.getElementById('evidenceFileInput');
  const stageSelect = document.getElementById('evidenceStageSelect');
  const captionInput = document.getElementById('evidenceCaptionInput');
  const msgEl = document.getElementById('evidenceUploadMsg');
  const btn = document.getElementById('btnUploadEvidence');

  if (!fileInput?.files || fileInput.files.length === 0) {
    SetuApp.showToast('Please select an image file to upload', 'warning');
    return;
  }

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('image', file);
  formData.append('evidence_type', stageSelect.value);
  formData.append('caption', captionInput.value.trim() || `${stageSelect.value} repair evidence`);

  btn.disabled = true;
  btn.textContent = 'Uploading...';
  if (msgEl) msgEl.innerHTML = '<span style="color: var(--blue);">Uploading to Cloudinary...</span>';

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/maintenance/${maintId}/evidence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    SetuApp.showToast('Evidence uploaded successfully', 'success');
    if (msgEl) msgEl.innerHTML = '<span style="color: var(--green);">Evidence photo uploaded successfully!</span>';

    // Clear inputs
    fileInput.value = '';
    captionInput.value = '';

    // Reload gallery
    await loadWorkOrderEvidence(maintId);
  } catch (err) {
    SetuApp.showToast(err.message || 'Failed to upload photo evidence', 'error');
    if (msgEl) msgEl.innerHTML = `<span style="color: var(--red);">${err.message || 'Upload failed'}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload Evidence Photo';
  }
}

// ----------------------------------------------------------------------------
// CONTRACTOR READ-ONLY BRIDGE DETAILS MODAL
// ----------------------------------------------------------------------------
async function openContractorBridgeDetailsModal(bridgeId) {
  let bridge = allBridgesCache.find(b => b.id === bridgeId);
  if (!bridge) {
    try {
      const res = await SetuApp.fetchApi(`/api/bridges/${bridgeId}`);
      if (res.success) bridge = res.data;
    } catch (e) {}
  }

  if (!bridge) {
    SetuApp.showToast('Bridge details not available', 'error');
    return;
  }

  const titleEl = document.getElementById('contractorBridgeModalTitle');
  const bodyEl = document.getElementById('contractorBridgeModalBody');
  if (titleEl) titleEl.textContent = `Bridge Specifications — ${bridge.bridge_name} (${bridge.bridge_id})`;

  const statusClass = bridge.current_health_status === 'Good' ? 'status--good' :
                      bridge.current_health_status === 'Moderate' ? 'status--moderate' : 'status--attention';

  const priorityClass = bridge.maintenance_priority === 'Urgent' || bridge.maintenance_priority === 'High' ? 'status--attention' :
                        bridge.maintenance_priority === 'Medium' ? 'status--moderate' : 'status--good';

  const currentYear = new Date().getFullYear();
  const age = bridge.construction_year ? `${currentYear - bridge.construction_year} years` : '—';

  bodyEl.innerHTML = `
    <!-- Top Health Summary Card -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; background: var(--bg-alt); padding: 16px; border-radius: var(--radius-m); margin-bottom: 20px;">
      <div>
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--navy-faint);">Structural Health Score</div>
        <div class="mono font-bold" style="font-size: 1.4rem; color: var(--navy); margin-top: 2px;">${bridge.current_health_score || 100} / 100</div>
      </div>
      <div>
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--navy-faint);">Health Condition</div>
        <div style="margin-top: 6px;"><span class="status ${statusClass}">${bridge.current_health_status}</span></div>
      </div>
      <div>
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--navy-faint);">Maintenance Priority</div>
        <div style="margin-top: 6px;"><span class="status ${priorityClass}">${bridge.maintenance_priority || 'Low'}</span></div>
      </div>
      <div>
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--navy-faint);">Last Inspected</div>
        <div class="mono font-bold" style="margin-top: 6px;">${bridge.last_inspection_date ? new Date(bridge.last_inspection_date).toLocaleDateString() : 'Never'}</div>
      </div>
    </div>

    <!-- Master Specifications -->
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--navy-soft);">Asset Specifications</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.86rem;">
        <div style="padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s);">
          <span style="color: var(--navy-faint); font-size: 0.75rem;">Asset ID:</span> <strong>${bridge.bridge_id}</strong>
        </div>
        <div style="padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s);">
          <span style="color: var(--navy-faint); font-size: 0.75rem;">Structure Name:</span> <strong>${bridge.bridge_name}</strong>
        </div>
        <div style="padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s);">
          <span style="color: var(--navy-faint); font-size: 0.75rem;">Geographic Location:</span> <strong>${bridge.location}</strong>
        </div>
        <div style="padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s);">
          <span style="color: var(--navy-faint); font-size: 0.75rem;">Structural Material:</span> <strong>${bridge.material || 'Reinforced Concrete'}</strong>
        </div>
        <div style="padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s);">
          <span style="color: var(--navy-faint); font-size: 0.75rem;">Bridge Type:</span> <strong>${bridge.bridge_type || 'Girder Bridge'}</strong>
        </div>
        <div style="padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s);">
          <span style="color: var(--navy-faint); font-size: 0.75rem;">Construction Year:</span> <strong>${bridge.construction_year || '—'} (${age})</strong>
        </div>
        <div style="padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s);">
          <span style="color: var(--navy-faint); font-size: 0.75rem;">Design Service Life:</span> <strong>${bridge.design_life || 50} years</strong>
        </div>
        <div style="padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s);">
          <span style="color: var(--navy-faint); font-size: 0.75rem;">Dimensions:</span> <strong>${bridge.length ? bridge.length + 'm length' : '—'} &times; ${bridge.width ? bridge.width + 'm width' : '—'}</strong>
        </div>
      </div>
    </div>

    <!-- Active / Past Maintenance for this Bridge -->
    <div>
      <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--navy-soft);">Assigned Maintenance History</h4>
      <div id="bridgeHistoryContainer">
        <div style="font-size: 0.82rem; color: var(--navy-soft);">Loading bridge work order history...</div>
      </div>
    </div>
  `;

  openModal('contractorBridgeModal');

  // Load timeline or filter from maintenance cache
  try {
    const bridgeTasks = allMaintenanceCache.filter(m => m.bridge_id === bridge.id);
    const container = document.getElementById('bridgeHistoryContainer');
    if (!container) return;

    if (bridgeTasks.length === 0) {
      container.innerHTML = '<div style="padding: 12px; background: var(--bg-alt); border-radius: var(--radius-s); font-size: 0.82rem; color: var(--navy-soft);">No maintenance orders recorded for this structure.</div>';
    } else {
      container.innerHTML = bridgeTasks.map(m => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s); margin-bottom: 8px;">
          <div>
            <span class="mono font-bold" style="font-size: 0.85rem;">MNT-${m.id.substring(0, 6).toUpperCase()}</span>
            <span class="badge-tag" style="margin-left: 8px;">${m.priority}</span>
            <div style="font-size: 0.8rem; color: var(--navy-soft); margin-top: 3px;">${m.remarks || 'Standard repair scope'}</div>
          </div>
          <div style="text-align: right;">
            <span class="status ${SetuApp.getStatusClass(m.status)}">${m.status}</span>
            <div class="mono" style="font-size: 0.74rem; color: var(--navy-faint); margin-top: 3px;">Sched: ${m.scheduled_date || '—'}</div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {}
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
