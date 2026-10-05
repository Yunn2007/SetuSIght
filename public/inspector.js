/**
 * SetuSight — Inspector Portal Logic
 */

let currentUser = null;
let bridgesCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = SetuApp.checkAuth(['inspector', 'admin']);
  if (!currentUser) return;

  SetuApp.initHeader(currentUser);
  initSidebarTabs();
  initImageUpload();

  // Set default date to today
  document.getElementById('insp_date_input').value = new Date().toISOString().split('T')[0];

  await loadBridges();
  await loadHistory();
});

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
    'new-inspection': 'Log Bridge Inspection',
    'assigned-bridges': 'Bridge Network Inventory',
    'history': 'Field Inspection History'
  };

  const headerTitle = document.getElementById('pageHeaderTitle');
  if (headerTitle) headerTitle.textContent = titles[tabId] || 'Inspector Console';

  if (tabId === 'assigned-bridges') loadBridges();
  if (tabId === 'history') loadHistory();
}

let uploadedFiles = [];

function updatePreviews() {
  const grid = document.getElementById('multiPatchPreviewGrid');
  const submitBtn = document.getElementById('submitInspectionBtn');
  if (!grid) return;

  if (uploadedFiles.length === 0) {
    grid.style.display = 'none';
    grid.innerHTML = '';
    if (submitBtn) submitBtn.innerHTML = 'Analyze Inspection Session (YOLOv8) <span class="arrow">→</span>';
    return;
  }

  grid.style.display = 'grid';
  grid.innerHTML = uploadedFiles.map((file, idx) => `
    <div class="patch-thumb-card" style="position: relative; border: 1.5px solid var(--border); border-radius: var(--radius-s); overflow: hidden; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      <img src="${URL.createObjectURL(file)}" alt="Patch ${idx + 1}" style="width: 100%; height: 75px; object-fit: cover; display: block;">
      <div style="padding: 4px 6px; font-size: 0.7rem; font-weight: 600; color: var(--navy); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
        <span>Patch ${idx + 1}</span>
        <button type="button" onclick="removePatchFile(${idx})" title="Remove patch" style="background: none; border: none; color: #D9381E; cursor: pointer; font-size: 0.85rem; padding: 0; line-height: 1;">&times;</button>
      </div>
    </div>
  `).join('');

  if (submitBtn) {
    submitBtn.innerHTML = `Analyze Inspection Session (${uploadedFiles.length} Patches with YOLOv8) <span class="arrow">→</span>`;
  }
}

window.removePatchFile = function (idx) {
  uploadedFiles.splice(idx, 1);
  updatePreviews();
};

function initImageUpload() {
  const fileInput = document.getElementById('imageFileInput');
  const dropzone = document.getElementById('dropzoneBox');

  if (!fileInput || !dropzone) return;

  fileInput.addEventListener('change', () => {
    if (fileInput.files) {
      if (uploadedFiles.length + fileInput.files.length > 10) {
        SetuApp.showToast('Maximum 10 images allowed per inspection session. Excess files were ignored.', 'warning');
      }
      for (let i = 0; i < fileInput.files.length; i++) {
        if (uploadedFiles.length >= 10) break;
        uploadedFiles.push(fileInput.files[i]);
      }
      fileInput.value = '';
      updatePreviews();
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files) {
      if (uploadedFiles.length + e.dataTransfer.files.length > 10) {
        SetuApp.showToast('Maximum 10 images allowed per inspection session. Excess files were ignored.', 'warning');
      }
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        if (uploadedFiles.length >= 10) break;
        const file = e.dataTransfer.files[i];
        if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|jfif|avif)$/i.test(file.name)) {
          uploadedFiles.push(file);
        }
      }
      updatePreviews();
    }
  });
}

async function loadBridges() {
  try {
    const res = await SetuApp.fetchApi('/api/bridges');
    if (!res.success) return;

    bridgesCache = res.data || [];

    // Populate dropdown
    const select = document.getElementById('insp_bridge_select');
    if (select) {
      select.innerHTML = '<option value="">-- Choose Bridge from Network --</option>' +
        bridgesCache.map(b => `<option value="${b.id}">${b.bridge_name} (${b.bridge_id} • ${b.location})</option>`).join('');
    }

    // Populate assigned bridges table
    const tbody = document.getElementById('inspectorBridgesTable');
    if (tbody) {
      tbody.innerHTML = bridgesCache.map(b => `
        <tr>
          <td class="mono font-bold">${b.bridge_id}</td>
          <td><strong>${b.bridge_name}</strong></td>
          <td>${b.location}</td>
          <td>${b.material}</td>
          <td class="mono font-bold">${b.current_health_score}/100</td>
          <td><span class="status ${SetuApp.getStatusClass(b.current_health_status)}">${b.current_health_status}</span></td>
          <td>
            <a href="/bridge-details?id=${b.id}" class="btn btn--ghost btn--sm" style="padding: 4px 8px; font-size: 0.76rem;">View Dossier →</a>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {}
}

let inspectionsHistoryCache = [];

async function loadHistory() {
  try {
    const res = await SetuApp.fetchApi('/api/inspections');
    if (!res.success) return;

    inspectionsHistoryCache = res.data || [];
    const tbody = document.getElementById('inspectorHistoryTable');
    if (!tbody) return;

    if (inspectionsHistoryCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="notif-empty">No inspection records logged yet</td></tr>';
      return;
    }

    tbody.innerHTML = inspectionsHistoryCache.map((i, idx) => `
      <tr>
        <td>
          <button type="button" class="btn-canvas-preview" onclick="openHistoricalInspection(${idx})" title="Click to view AI Detection Canvas" style="background: none; border: none; padding: 0; cursor: pointer; position: relative; display: block;">
            <img src="${i.image_url}" alt="Evidence" style="width: 58px; height: 40px; object-fit: cover; border-radius: var(--radius-s); border: 1px solid var(--border); display: block;">
            <span style="position: absolute; bottom: 2px; right: 2px; background: rgba(16,35,61,0.85); color: #fff; font-size: 0.6rem; padding: 1px 3px; border-radius: 2px; font-family: var(--font-mono);">AI</span>
          </button>
        </td>
        <td><strong>${i.bridge ? i.bridge.bridge_name : 'Structure'}</strong></td>
        <td class="mono">${i.inspection_date}</td>
        <td class="mono">${i.crack_count}</td>
        <td><span class="status ${SetuApp.getStatusClass(i.crack_severity)}">${i.crack_severity}</span></td>
        <td class="mono font-bold">${i.health_score}</td>
        <td><span class="status ${SetuApp.getStatusClass(i.health_status)}">${i.health_status}</span></td>
        <td style="font-size: 0.8rem; color: var(--navy-soft); max-width: 180px;">${i.remarks || '—'}</td>
        <td>
          <button type="button" onclick="openHistoricalInspection(${idx})" class="btn btn--ghost btn--sm" style="padding: 4px 8px; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Inspect AI
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {}
}

window.openHistoricalInspection = function (index) {
  const item = inspectionsHistoryCache[index];
  if (item && window.SetuVisualAI) {
    SetuVisualAI.openInspectionModal(item);
  }
};

// ----------------------------------------------------------------------------
// CREATE INSPECTION SUBMISSION
// ----------------------------------------------------------------------------
document.getElementById('createInspectionForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('submitInspectionBtn');
  const fileInput = document.getElementById('imageFileInput');
  const formCard = document.querySelector('#tab-new-inspection > div:first-child');
  const resultContainer = document.getElementById('inspectionResultContainer');
  const resultMount = document.getElementById('inspectionResultMount');
  const dossierLinkWrap = document.getElementById('resultDossierLinkWrap');

  if (uploadedFiles.length === 0) {
    SetuApp.showToast('Please select or drop at least 1 concrete patch photo (1 to 10 patches required)', 'warning');
    return;
  }
  if (uploadedFiles.length > 10) {
    SetuApp.showToast('Maximum 10 images allowed per inspection session. Please remove excess patches.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('bridge_id', document.getElementById('insp_bridge_select').value);
  formData.append('inspection_date', document.getElementById('insp_date_input').value);
  formData.append('crack_severity', document.getElementById('insp_severity_input').value);
  const countVal = document.getElementById('insp_crack_count').value.trim();
  if (countVal !== '') {
    formData.append('crack_count', countVal);
  }
  formData.append('remarks', document.getElementById('insp_remarks').value);

  // Append each patch image to FormData
  uploadedFiles.forEach(file => {
    formData.append('images', file);
  });
  formData.append('image', uploadedFiles[0]); // Backward compatibility

  submitBtn.disabled = true;
  submitBtn.innerHTML = `Uploading ${uploadedFiles.length} Patch(es) &amp; Running YOLOv8 Detection...`;

  try {
    const res = await SetuApp.fetchApi('/api/inspections', {
      method: 'POST',
      body: formData
    });

    if (!res.success) {
      throw new Error(res.error || 'AI inspection inference failed');
    }

    SetuApp.showToast(`Inspection session created with ${uploadedFiles.length} patches analyzed!`, 'success');

    const insp = res.data;

    // Render full Phase 2B/3A Visual AI Inspection Result View with patch switcher
    if (resultContainer && resultMount && window.SetuVisualAI) {
      SetuVisualAI.renderInspectionView(resultMount, insp, {
        onConfirm: () => {
          loadHistory();
        }
      });

      if (dossierLinkWrap) {
        dossierLinkWrap.innerHTML = `
          <a href="/bridge-details?id=${insp.bridge_id}" class="btn btn--primary btn--sm">
            View Updated Bridge Dossier →
          </a>
        `;
      }

      // Hide form grid and display result workbench
      if (formCard) formCard.style.display = 'none';
      resultContainer.style.display = 'block';
      resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Reset form for next use
    document.getElementById('createInspectionForm').reset();
    uploadedFiles = [];
    updatePreviews();
    document.getElementById('insp_date_input').value = new Date().toISOString().split('T')[0];

    loadHistory();
    loadBridges();
  } catch (err) {
    console.error('Inspection submission error:', err);
    // Render clean failure state
    if (resultContainer && resultMount && window.SetuVisualAI) {
      if (formCard) formCard.style.display = 'none';
      resultContainer.style.display = 'block';
      SetuVisualAI.renderInferenceFailure(resultMount, {
        errorMessage: err.message || 'Unable to complete crack detection on the uploaded bridge image.',
        onRetry: () => {
          resultContainer.style.display = 'none';
          if (formCard) formCard.style.display = 'grid';
        }
      });
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Submit Inspection &amp; Calculate Health <span class="arrow">→</span>';
  }
});

// Wire back button to return to form
document.getElementById('btnBackToForm')?.addEventListener('click', () => {
  const formCard = document.querySelector('#tab-new-inspection > div:first-child');
  const resultContainer = document.getElementById('inspectionResultContainer');
  if (resultContainer) resultContainer.style.display = 'none';
  if (formCard) formCard.style.display = 'grid';
});

