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

function initImageUpload() {
  const fileInput = document.getElementById('imageFileInput');
  const preview = document.getElementById('imagePreview');
  const dropzone = document.getElementById('dropzoneBox');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
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

async function loadHistory() {
  try {
    const res = await SetuApp.fetchApi('/api/inspections');
    if (!res.success) return;

    const tbody = document.getElementById('inspectorHistoryTable');
    if (!tbody) return;

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="notif-empty">No inspection records logged yet</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(i => `
      <tr>
        <td>
          <a href="${i.image_url}" target="_blank" rel="noopener">
            <img src="${i.image_url}" alt="Evidence" style="width: 56px; height: 38px; object-fit: cover; border-radius: var(--radius-s); border: 1px solid var(--border);">
          </a>
        </td>
        <td><strong>${i.bridge ? i.bridge.bridge_name : 'Structure'}</strong></td>
        <td class="mono">${i.inspection_date}</td>
        <td class="mono">${i.crack_count}</td>
        <td><span class="status ${SetuApp.getStatusClass(i.crack_severity)}">${i.crack_severity}</span></td>
        <td class="mono font-bold">${i.health_score}</td>
        <td><span class="status ${SetuApp.getStatusClass(i.health_status)}">${i.health_status}</span></td>
        <td style="font-size: 0.8rem; color: var(--navy-soft); max-width: 200px;">${i.remarks || '—'}</td>
      </tr>
    `).join('');
  } catch (err) {}
}

// ----------------------------------------------------------------------------
// CREATE INSPECTION SUBMISSION
// ----------------------------------------------------------------------------
document.getElementById('createInspectionForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('submitInspectionBtn');
  const fileInput = document.getElementById('imageFileInput');

  if (!fileInput.files[0]) {
    SetuApp.showToast('Please select or drop an inspection photo', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('bridge_id', document.getElementById('insp_bridge_select').value);
  formData.append('inspection_date', document.getElementById('insp_date_input').value);
  formData.append('crack_severity', document.getElementById('insp_severity_input').value);
  formData.append('crack_count', document.getElementById('insp_crack_count').value);
  formData.append('remarks', document.getElementById('insp_remarks').value);
  formData.append('image', fileInput.files[0]);

  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Uploading to Cloudinary &amp; Running Health Assessment...';

  try {
    const res = await SetuApp.fetchApi('/api/inspections', {
      method: 'POST',
      body: formData
    });

    SetuApp.showToast('Inspection saved & structural health score updated in Supabase!', 'success');

    // Display result card
    const lastCard = document.getElementById('lastResultCard');
    const lastBody = document.getElementById('lastResultBody');
    const insp = res.data;

    lastBody.innerHTML = `
      <div style="display: flex; gap: 14px; align-items: flex-start; margin-bottom: 14px;">
        <img src="${insp.image_url}" alt="Inspection Evidence" style="width: 120px; height: 80px; object-fit: cover; border-radius: var(--radius-s); border: 1px solid var(--border);">
        <div>
          <div style="font-size: 0.8rem; color: var(--navy-faint); font-family: var(--font-mono);">Date: ${insp.inspection_date}</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--navy); margin: 2px 0;">Health Score: ${insp.health_score} / 100</div>
          <div><span class="status ${SetuApp.getStatusClass(insp.health_status)}">${insp.health_status}</span></div>
        </div>
      </div>
      <div style="font-size: 0.8rem; color: var(--navy-soft); background: var(--bg-alt); padding: 10px; border-radius: var(--radius-s); font-family: var(--font-mono);">
        Cloudinary ID: ${insp.cloudinary_public_id}<br>
        ML Status: ${insp.detection_data?.ml_status || 'Pending YOLOv8 Integration'}
      </div>
      <div style="margin-top: 12px; display: flex; gap: 10px;">
        <a href="/bridge-details?id=${insp.bridge_id}" class="btn btn--ghost btn--sm" style="flex:1;">View Updated Bridge Dossier →</a>
      </div>
    `;
    lastCard.style.display = 'block';

    // Reset form
    document.getElementById('createInspectionForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('insp_date_input').value = new Date().toISOString().split('T')[0];

    loadHistory();
    loadBridges();
  } catch (err) {
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Submit Inspection &amp; Calculate Health <span class="arrow">→</span>';
  }
});
