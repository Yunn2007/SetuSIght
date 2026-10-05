/**
 * SetuSight — Bridge Dossier & Timeline Logic
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = SetuApp.checkAuth();
  if (!currentUser) return;

  SetuApp.initHeader(currentUser);

  const urlParams = new URLSearchParams(window.location.search);
  const bridgeId = urlParams.get('id');

  if (!bridgeId) {
    SetuApp.showToast('No bridge ID specified', 'warning');
    setTimeout(() => history.back(), 1200);
    return;
  }

  await loadBridgeDossier(bridgeId);
});

async function loadBridgeDossier(id) {
  try {
    const res = await SetuApp.fetchApi(`/api/bridges/${id}/timeline`);
    if (!res.success || !res.data) return;

    const { bridge, timeline } = res.data;
    const currentYear = new Date().getFullYear();
    const age = currentYear - (bridge.construction_year || currentYear);

    // Header info
    document.getElementById('dossierBridgeId').textContent = bridge.bridge_id;
    document.getElementById('dossierBridgeName').textContent = bridge.bridge_name;
    const coordStr = (bridge.latitude != null && bridge.longitude != null) ? ` • Lat: ${bridge.latitude}, Long: ${bridge.longitude}` : '';
    document.getElementById('dossierLocation').textContent = `${bridge.location || ''}${coordStr}`;
    document.getElementById('dossierHeaderTitle').textContent = `${bridge.bridge_name} (${bridge.bridge_id})`;

    const statusPill = document.getElementById('dossierStatusPill');
    statusPill.textContent = bridge.current_health_status;
    statusPill.className = `status ${SetuApp.getStatusClass(bridge.current_health_status)}`;

    // Score & Breakdown
    document.getElementById('dossierScoreVal').textContent = bridge.current_health_score;
    document.getElementById('breakdownAge').textContent = `${age} yrs / ${bridge.design_life || 50} yrs`;
    document.getElementById('breakdownMaterial').textContent = bridge.material;
    document.getElementById('breakdownExposure').textContent = bridge.location;
    document.getElementById('breakdownCracks').textContent = bridge.current_health_status === 'Good' ? 'Low / None' : 'Active Monitoring';

    // Specs
    document.getElementById('specType').textContent = bridge.bridge_type;
    document.getElementById('specMaterial').textContent = bridge.material;
    document.getElementById('specAge').textContent = `${bridge.construction_year} (${age} years in service)`;
    document.getElementById('specDesignLife').textContent = `${bridge.design_life || 50} Years`;
    document.getElementById('specDimensions').textContent = `Length: ${bridge.length ? bridge.length + ' m' : '—'} | Width: ${bridge.width ? bridge.width + ' m' : '—'}`;
    document.getElementById('specContractor').textContent = bridge.contractor ? `${bridge.contractor.company_name} (${bridge.contractor.contact_person})` : 'Not Designated';

    // Export button
    const exportBtn = document.getElementById('btnExportReport');
    if (exportBtn) {
      exportBtn.href = `/report-view.html?bridge_id=${bridge.id}`;
    }

    // Timeline Rendering
    const timelineFeed = document.getElementById('timelineFeed');
    window.currentTimelineNodes = timeline || [];

    if (timelineFeed) {
      if (!timeline || timeline.length === 0) {
        timelineFeed.innerHTML = '<div class="notif-empty">No lifecycle events recorded yet</div>';
        return;
      }

      timelineFeed.innerHTML = timeline.map((node, idx) => `
        <div class="timeline-node timeline-node--${node.type}">
          <div class="timeline-node__dot"></div>
          <div class="timeline-node__date">${new Date(node.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          <div class="timeline-node__title">
            ${node.title}
            <span class="status ${node.statusClass}" style="font-size: 0.72rem; padding: 2px 8px;">${node.badge}</span>
          </div>
          <div class="timeline-node__desc">${node.description}</div>
          ${node.imageUrl ? `
            <div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 12px;">
              <button type="button" onclick="openDossierInspectionModal(${idx})" title="Click to view AI Detection Canvas" style="background: none; border: none; padding: 0; cursor: pointer; position: relative;">
                <img src="${node.imageUrl}" class="timeline-node__img" alt="Inspection Visual Record">
                <span style="position: absolute; bottom: 4px; right: 4px; background: rgba(16,35,61,0.85); color: #fff; font-size: 0.65rem; padding: 1px 4px; border-radius: 2px; font-family: var(--font-mono);">AI Overlay</span>
              </button>
              ${node.type === 'inspection' ? `
                <button type="button" onclick="openDossierInspectionModal(${idx})" class="btn btn--primary btn--sm" style="padding: 4px 10px; font-size: 0.74rem;">
                  Inspect AI Canvas →
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load dossier:', err);
  }
}

window.openDossierInspectionModal = function (idx) {
  const node = window.currentTimelineNodes && window.currentTimelineNodes[idx];
  if (!node) return;
  if (node.inspectionRecord && window.SetuVisualAI) {
    SetuVisualAI.openInspectionModal(node.inspectionRecord);
  } else if (node.imageUrl && window.SetuVisualAI) {
    // If partial record, open modal with image
    SetuVisualAI.openInspectionModal({
      id: node.id,
      image_url: node.imageUrl,
      inspection_date: node.date,
      crack_count: 0,
      crack_severity: 'none',
      detection_confidence: 0,
      health_score: 100,
      health_status: 'Good'
    });
  }
};

