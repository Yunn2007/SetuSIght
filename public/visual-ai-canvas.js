/**
 * SetuSight — Phase 2B Visual AI Detection Canvas & Interactive Bounding Box Overlay
 * 
 * Provides responsive, pixel-perfect bounding box overlays for YOLOv8 crack detections.
 * Supports:
 * - Responsive dynamic scaling (ResizeObserver + window resize) across all image resolutions
 * - Multiple crack detections with confidence badges
 * - Clear separation of YOLO Detection Confidence vs Structural Crack Severity
 * - Clean "NO CRACK DETECTED" state
 * - Clean "AI ANALYSIS UNAVAILABLE" failure state (no fake results)
 * - Inspector Review & Confirmation decision-support workflow
 * - Modal viewer for historical inspection audit without re-running inference
 */

const SetuVisualAI = (function () {
  'use strict';

  let activeModal = null;
  let activeResizeObservers = new Map();

  /**
   * Helper: Formats confidence percentage
   */
  function formatConf(val) {
    if (val == null || isNaN(val)) return '0.0%';
    const num = Number(val);
    if (num <= 1.0) return `${(num * 100).toFixed(1)}%`;
    return `${num.toFixed(1)}%`;
  }

  /**
   * Mounts the responsive visual detection canvas onto a DOM container.
   * 
   * @param {HTMLElement} container - The wrapper element
   * @param {Object} config - { imageUrl, detections, imageDimensions, crackDetected }
   * @returns {Object} Canvas controller with zoom, toggle, and cleanup methods
   */
  function mountCanvas(container, config) {
    if (!container) return null;

    const {
      imageUrl,
      detections = [],
      imageDimensions = null,
      crackDetected = (detections.length > 0)
    } = config;

    // Clear previous contents & observer
    if (activeResizeObservers.has(container)) {
      activeResizeObservers.get(container).disconnect();
      activeResizeObservers.delete(container);
    }
    container.innerHTML = '';

    // Create Viewport
    const viewport = document.createElement('div');
    viewport.className = 'ai-canvas-viewport';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'ai-canvas-toolbar';
    toolbar.innerHTML = `
      <div class="ai-canvas-toolbar__group">
        <button type="button" class="ai-canvas-btn" data-action="zoom-in" title="Zoom In">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          <span>Zoom +</span>
        </button>
        <button type="button" class="ai-canvas-btn" data-action="zoom-out" title="Zoom Out">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          <span>Zoom -</span>
        </button>
        <button type="button" class="ai-canvas-btn" data-action="zoom-reset" title="Reset Zoom">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span class="zoom-level-text">Fit 100%</span>
        </button>
      </div>
      <div class="ai-canvas-toolbar__group">
        <button type="button" class="ai-canvas-btn is-active" data-action="toggle-boxes" title="Toggle Detection Overlay">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
          <span class="toggle-text">Boxes: ON</span>
        </button>
      </div>
    `;

    // Stage (allows zoom scaling)
    const stage = document.createElement('div');
    stage.className = 'ai-canvas-stage';

    // Canvas Wrapper (wraps image and overlay tightly)
    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'ai-canvas-wrapper';

    // Base Image
    const img = document.createElement('img');
    img.className = 'ai-canvas-img';
    img.alt = 'Bridge Inspection Concrete Surface';
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    // Overlay Layer for Bounding Boxes
    const overlay = document.createElement('div');
    overlay.className = 'ai-canvas-overlay';

    canvasWrapper.appendChild(img);
    canvasWrapper.appendChild(overlay);
    stage.appendChild(canvasWrapper);
    viewport.appendChild(stage);
    viewport.appendChild(toolbar);
    container.appendChild(viewport);

    // State
    let zoomLevel = 1.0;
    let boxesVisible = true;

    // Apply zoom transform
    function applyZoom(newZoom) {
      zoomLevel = Math.max(0.75, Math.min(3.0, newZoom));
      canvasWrapper.style.transform = `scale(${zoomLevel})`;
      canvasWrapper.style.transformOrigin = 'center top';
      const zoomText = toolbar.querySelector('.zoom-level-text');
      if (zoomText) zoomText.textContent = `${Math.round(zoomLevel * 100)}%`;
    }

    // Toggle bounding boxes visibility
    function toggleBoxes(force) {
      boxesVisible = typeof force === 'boolean' ? force : !boxesVisible;
      overlay.style.display = boxesVisible ? 'block' : 'none';
      const btn = toolbar.querySelector('[data-action="toggle-boxes"]');
      const text = toolbar.querySelector('.toggle-text');
      if (btn) btn.classList.toggle('is-active', boxesVisible);
      if (text) text.textContent = boxesVisible ? 'Boxes: ON' : 'Boxes: OFF';
    }

    // Recalculates bounding box coordinates based on actual rendered image dimensions
    function renderBoundingBoxes() {
      overlay.innerHTML = '';

      if (!crackDetected || !detections || detections.length === 0) {
        // No bounding boxes to render
        return;
      }

      // 1. Resolve original image dimensions
      const origW = (imageDimensions && imageDimensions.width) || img.naturalWidth;
      const origH = (imageDimensions && imageDimensions.height) || img.naturalHeight;

      if (!origW || !origH) {
        // Image not loaded yet; will trigger on load event
        return;
      }

      // 2. Resolve rendered image dimensions
      const renderedW = img.clientWidth;
      const renderedH = img.clientHeight;

      if (!renderedW || !renderedH) return;

      // 3. Compute scaling factors
      const scaleX = renderedW / origW;
      const scaleY = renderedH / origH;

      // 4. Transform and inject bounding box elements
      detections.forEach((d, idx) => {
        if (!Array.isArray(d.bbox) || d.bbox.length < 4) return;

        const [x1, y1, x2, y2] = d.bbox;
        const left = Math.max(0, Math.round(x1 * scaleX));
        const top = Math.max(0, Math.round(y1 * scaleY));
        const right = Math.min(renderedW, Math.round(x2 * scaleX));
        const bottom = Math.min(renderedH, Math.round(y2 * scaleY));
        const width = Math.max(2, right - left);
        const height = Math.max(2, bottom - top);

        const boxEl = document.createElement('div');
        boxEl.className = 'ai-bbox';
        boxEl.dataset.boxIndex = idx;
        boxEl.style.left = `${left}px`;
        boxEl.style.top = `${top}px`;
        boxEl.style.width = `${width}px`;
        boxEl.style.height = `${height}px`;

        // Check if label needs inside-top placement (to avoid clipping near top border)
        const isNearTop = top < 32;
        const isNearRight = (left + 80) > renderedW;

        const labelEl = document.createElement('div');
        labelEl.className = `ai-bbox-label ${isNearTop ? 'is-inside-top' : ''} ${isNearRight ? 'is-align-right' : ''}`;
        labelEl.innerHTML = `
          <div class="ai-bbox-label__type">
            <span class="ai-bbox-label__idx">#${idx + 1}</span>
            <span>CRACK</span>
          </div>
          <div class="ai-bbox-label__conf">${formatConf(d.confidence)}</div>
        `;

        boxEl.appendChild(labelEl);

        // Hover events to cross-highlight in detections list
        boxEl.addEventListener('mouseenter', () => {
          boxEl.classList.add('is-hovered');
          highlightListItem(container, idx, true);
        });
        boxEl.addEventListener('mouseleave', () => {
          boxEl.classList.remove('is-hovered');
          highlightListItem(container, idx, false);
        });

        overlay.appendChild(boxEl);
      });
    }

    // Attach load listener
    if (!img.complete || img.naturalWidth === 0) {
      img.addEventListener('load', renderBoundingBoxes);
    } else {
      renderBoundingBoxes();
    }

    // Responsive ResizeObserver for smooth alignment during browser/container resizing
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        renderBoundingBoxes();
      });
      observer.observe(img);
      activeResizeObservers.set(container, observer);
    } else {
      window.addEventListener('resize', renderBoundingBoxes);
    }

    // Toolbar button interactions
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'zoom-in') applyZoom(zoomLevel + 0.25);
      else if (action === 'zoom-out') applyZoom(zoomLevel - 0.25);
      else if (action === 'zoom-reset') applyZoom(1.0);
      else if (action === 'toggle-boxes') toggleBoxes();
    });

    return {
      recalculate: renderBoundingBoxes,
      applyZoom,
      toggleBoxes,
      highlightBox: (idx, active) => {
        const box = overlay.querySelector(`[data-box-index="${idx}"]`);
        if (box) box.classList.toggle('is-highlighted', active);
      }
    };
  }

  /**
   * Injects dynamic styles for multi-patch tab switcher if not already present
   */
  function ensureStyles() {
    if (document.getElementById('setu-ai-multi-patch-styles')) return;
    const style = document.createElement('style');
    style.id = 'setu-ai-multi-patch-styles';
    style.textContent = `
      .ai-session-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        background: #F8FAFC;
        border: 1px solid var(--border);
        border-radius: var(--radius-m);
        padding: 12px 18px;
        margin-bottom: 16px;
      }
      .ai-session-stat {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        color: var(--navy);
      }
      .ai-stat-lbl {
        color: var(--navy-soft);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .ai-patch-tabs-wrapper {
        margin-bottom: 14px;
      }
      .ai-patch-tabs-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .ai-patch-tabs {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
      }
      .ai-patch-tab {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: #FFFFFF;
        border: 1.5px solid var(--border);
        border-radius: var(--radius-s);
        cursor: pointer;
        font-family: var(--font-body);
        font-size: 0.82rem;
        font-weight: 500;
        color: var(--navy);
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .ai-patch-tab:hover {
        border-color: var(--navy-soft);
        background: #F8FAFC;
      }
      .ai-patch-tab.is-active {
        border-color: var(--navy);
        background: var(--navy);
        color: #FFFFFF;
        box-shadow: 0 2px 6px rgba(16, 35, 61, 0.15);
      }
      .ai-patch-tab-badge {
        font-size: 0.7rem;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: var(--font-mono);
        font-weight: 600;
        text-transform: uppercase;
      }
      .ai-patch-tab.is-active .ai-patch-tab-badge {
        background: rgba(255, 255, 255, 0.2) !important;
        color: #FFFFFF !important;
      }
      .ai-patch-tab-badge--none { background: #E8F5E9; color: #2E7D32; }
      .ai-patch-tab-badge--low { background: #E3F2FD; color: #1565C0; }
      .ai-patch-tab-badge--moderate { background: #FFF3E0; color: #E65100; }
      .ai-patch-tab-badge--high { background: #FFEBEE; color: #C62828; }
      .ai-patch-tab-badge--critical { background: #FBE9E7; color: #D84315; }
      .ai-patch-tab-score {
        font-size: 0.75rem;
        opacity: 0.85;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Cross-highlights detection item in the detections side list
   */
  function highlightListItem(container, idx, active) {
    const root = container.closest('.ai-inspection-view') || document;
    const item = root.querySelector(`[data-detection-index="${idx}"]`);
    if (item) item.classList.toggle('is-highlighted', active);
  }

  /**
   * Renders the complete Side-by-Side Visual AI Inspection Result view.
   * Fully supports Multi-Image Inspection Sessions with interactive patch switching.
   * 
   * @param {HTMLElement} targetEl - Container element
   * @param {Object} inspection - Inspection record with detection_data, health_score, etc.
   * @param {Object} options - { onConfirm, isConfirmed, showBackBtn }
   */
  function renderInspectionView(targetEl, inspection, options = {}) {
    if (!targetEl || !inspection) return;
    ensureStyles();

    // Extract patches from inspection.images or detection_data.images
    let patches = [];
    if (Array.isArray(inspection.images) && inspection.images.length > 0) {
      patches = inspection.images;
    } else if (inspection.detection_data && Array.isArray(inspection.detection_data.images) && inspection.detection_data.images.length > 0) {
      patches = inspection.detection_data.images;
    } else {
      // Synthesize single patch
      patches = [{
        id: (inspection.id || 'patch') + '-1',
        patch_label: 'Patch 1',
        image_url: inspection.image_url,
        cloudinary_public_id: inspection.cloudinary_public_id,
        image_dimensions: inspection.detection_data?.image_dimensions || null,
        crack_count: inspection.crack_count || 0,
        crack_severity: inspection.crack_severity || 'none',
        confidence: inspection.detection_confidence || 0.0,
        detections: inspection.detection_data?.detections || [],
        local_condition_score: inspection.detection_data?.score_breakdown?.sessionConditionScore || inspection.health_score || 100.0
      }];
    }

    let activePatchIdx = 0;
    const isMultiPatch = patches.length > 1;

    // Overall session & bridge metrics
    const detData = inspection.detection_data || {};
    const totalPatches = patches.length;
    const affectedCount = patches.filter(p => (p.crack_count > 0 || (p.crack_severity && p.crack_severity !== 'none'))).length;
    const sessionCondition = detData.session_condition_score != null ? detData.session_condition_score : (inspection.health_score || 100);
    const bridgeHealthScore = inspection.health_score != null ? inspection.health_score : 100;
    const bridgeHealthStatus = inspection.health_status || 'Good';
    const maintenancePriority = detData.maintenance_priority || 'Medium';

    // Confirmation tracking
    const confirmKey = `setusight_insp_confirm_${inspection.id || 'current'}`;
    const wasConfirmed = options.isConfirmed || localStorage.getItem(confirmKey) === 'true';

    function resolvePriorityClass(priority) {
      if (typeof SetuApp !== 'undefined' && typeof SetuApp.getPriorityClass === 'function') {
        return SetuApp.getPriorityClass(priority);
      }
      const p = String(priority || '').toLowerCase();
      if (p.includes('urgent') || p.includes('critical') || p.includes('high')) return 'status--attention';
      if (p.includes('medium')) return 'status--moderate';
      return 'status--good';
    }

    function resolveStatusClass(status) {
      if (typeof SetuApp !== 'undefined' && typeof SetuApp.getStatusClass === 'function') {
        return SetuApp.getStatusClass(status);
      }
      const s = String(status || '').toLowerCase();
      if (s.includes('good') || s.includes('completed')) return 'status--good';
      if (s.includes('moderate') || s.includes('scheduled')) return 'status--moderate';
      if (s.includes('attention') || s.includes('critical') || s.includes('overdue')) return 'status--attention';
      return 'status--moderate';
    }

    function renderUI() {
      const activePatch = patches[activePatchIdx] || patches[0];
      const detections = activePatch.detections || [];
      const patchCrackCount = activePatch.crack_count != null ? activePatch.crack_count : detections.length;
      const patchCrackDetected = patchCrackCount > 0;
      const patchConfidence = activePatch.confidence != null ? activePatch.confidence : 0.0;
      const patchSeverity = (activePatch.crack_severity || 'none').toLowerCase();
      const localPatchScore = activePatch.local_condition_score != null ? activePatch.local_condition_score : 100;
      const patchDims = activePatch.image_dimensions || null;

      const statusText = patchCrackDetected
        ? `CRACK DETECTED IN ${activePatch.patch_label.toUpperCase()} (${patchCrackCount})`
        : `SOUND CONCRETE (${activePatch.patch_label.toUpperCase()})`;
      const statusPillClass = patchCrackDetected ? 'ai-pill--detected' : 'ai-pill--clean';

      targetEl.innerHTML = `
        <div class="ai-inspection-view">
          <!-- HEADER STRIP -->
          <div class="ai-inspection-header">
            <div class="ai-inspection-header__left">
              <span class="ai-badge-ai">AI-ASSISTED INSPECTION SESSION</span>
              <h3 class="ai-inspection-title">Computer Vision Concrete Surface Analysis</h3>
              <div class="ai-inspection-subtitle">
                Engine: <strong>YOLOv8</strong> (<code>ml/best.pt</code>) • Storage: Cloudinary • Session Mode: <strong>${isMultiPatch ? `${totalPatches}-Patch Session` : 'Single Inspection'}</strong>
              </div>
            </div>
            <div class="ai-inspection-header__right">
              <span class="ai-status-pill ${statusPillClass}">
                <span class="ai-status-dot"></span>
                ${statusText}
              </span>
            </div>
          </div>

          <!-- SESSION SUMMARY BAR -->
          <div class="ai-session-bar">
            <div class="ai-session-stat">
              <span class="ai-stat-lbl">Inspection Coverage:</span>
              <strong>${totalPatches} Patches Analyzed</strong> (${affectedCount} Affected)
            </div>
            <div class="ai-session-stat">
              <span class="ai-stat-lbl">Session Defect Score:</span>
              <strong class="mono font-bold">${sessionCondition} / 100</strong>
            </div>
            <div class="ai-session-stat">
              <span class="ai-stat-lbl">Bridge Health Score:</span>
              <strong class="mono font-bold" style="color: var(--green-dark);">${bridgeHealthScore} / 100</strong>
            </div>
            <div class="ai-session-stat">
              <span class="ai-stat-lbl">Bridge Status:</span>
              <span class="status ${resolveStatusClass(bridgeHealthStatus)}">${bridgeHealthStatus}</span>
            </div>
            <div class="ai-session-stat">
              <span class="ai-stat-lbl">Maintenance Priority:</span>
              <span class="status ${resolvePriorityClass(maintenancePriority)}">${maintenancePriority}</span>
            </div>
          </div>

          <!-- PATCH SELECTOR TABS (If multiple patches) -->
          ${isMultiPatch ? `
            <div class="ai-patch-tabs-wrapper">
              <div class="ai-patch-tabs-header">
                <span style="font-size: 0.78rem; font-weight: 700; color: var(--navy); text-transform: uppercase; letter-spacing: 0.04em;">
                  Select Inspected Patch View (${activePatchIdx + 1} of ${totalPatches}):
                </span>
                <span style="font-size: 0.75rem; color: var(--navy-soft);">
                  Viewing <strong>${activePatch.patch_label}</strong>
                </span>
              </div>
              <div class="ai-patch-tabs" id="aiPatchTabs">
                ${patches.map((p, idx) => `
                  <button type="button" class="ai-patch-tab ${idx === activePatchIdx ? 'is-active' : ''}" data-patch-idx="${idx}">
                    <span>${p.patch_label || `Patch ${idx + 1}`}</span>
                    <span class="ai-patch-tab-badge ai-patch-tab-badge--${p.crack_severity}">${p.crack_count > 0 ? `${p.crack_count} cracks` : 'Clean'}</span>
                    <span class="ai-patch-tab-score mono font-bold">${p.local_condition_score != null ? p.local_condition_score : 100}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- MAIN SPLIT WORKBENCH -->
          <div class="ai-workbench">
            <!-- LEFT: VISUAL AI DETECTION CANVAS -->
            <div class="ai-workbench__canvas-card">
              <div class="ai-workbench__card-header">
                <div>
                  <span class="ai-card-tag">${activePatch.patch_label.toUpperCase()} CANVAS</span>
                  <h4 class="ai-card-title">Concrete Imagery &amp; YOLO Crack Overlay</h4>
                </div>
                <span class="ai-badge-model">YOLOv8 Real Inference</span>
              </div>

              <!-- Canvas Container -->
              <div class="ai-canvas-mount" id="aiCanvasMount"></div>

              ${!patchCrackDetected ? `
                <div class="ai-clean-callout">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <div>
                    <strong>Sound Concrete Patch Verified</strong>
                    <div>No structural crack features exceeded the operational confidence threshold (0.35). Zero crack bounding boxes detected in this patch.</div>
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- RIGHT: METRICS & DECISION SUPPORT -->
            <div class="ai-workbench__analysis-panel">
              <!-- Detection Findings Card -->
              <div class="card ai-card">
                <div class="ai-card-header">
                  <div>
                    <span class="ai-card-tag">PATCH TELEMETRY</span>
                    <h4 class="ai-card-title">${activePatch.patch_label} Health Assessment</h4>
                  </div>
                </div>
                <div class="ai-card-body">
                  <!-- Metrics Grid -->
                  <div class="ai-metric-grid">
                    <div class="ai-metric-box">
                      <span class="ai-metric-label">Local Patch Condition</span>
                      <span class="ai-metric-value mono font-bold" style="color: ${localPatchScore >= 80 ? 'var(--green-dark)' : localPatchScore >= 60 ? 'var(--amber-dark)' : 'var(--red-dark)'};">
                        ${localPatchScore} <span style="font-size: 0.78rem; font-weight: 500; color: var(--navy-soft);">/ 100</span>
                      </span>
                      <span class="ai-metric-sub">Patch-level rating</span>
                    </div>

                    <div class="ai-metric-box">
                      <span class="ai-metric-label">Patch Cracks</span>
                      <span class="ai-metric-value mono font-bold">${patchCrackCount}</span>
                      <span class="ai-metric-sub">Detections in patch</span>
                    </div>

                    <div class="ai-metric-box">
                      <span class="ai-metric-label">YOLO Certainty</span>
                      <span class="ai-metric-value mono" style="color: var(--navy);">${formatConf(patchConfidence)}</span>
                      <span class="ai-metric-sub">Visual model confidence</span>
                    </div>

                    <div class="ai-metric-box">
                      <span class="ai-metric-label">Patch Severity</span>
                      <span class="ai-metric-value font-bold" style="text-transform: capitalize;">${patchSeverity}</span>
                      <span class="ai-metric-sub">Structural classification</span>
                    </div>
                  </div>

                  <!-- CRITICAL DISTINCTION NOTICE -->
                  <div class="ai-distinction-note">
                    <strong>Architecture Note:</strong> Local Patch Condition (<em>${localPatchScore}</em>) assesses this specific photograph. The overall Bridge Health Score (<em>${bridgeHealthScore}</em>) integrates evidence across all ${totalPatches} patches, structural design life, environmental exposure, and maintenance history.
                  </div>

                  <!-- DETECTIONS LIST FOR ACTIVE PATCH -->
                  <div class="ai-detections-list-wrap">
                    <div class="ai-detections-header">
                      <span>YOLOv8 Crack Detections in ${activePatch.patch_label} (${detections.length})</span>
                      <span class="mono" style="font-size: 0.72rem; color: var(--navy-faint);">[Hover to highlight]</span>
                    </div>
                    <div class="ai-detections-list" id="aiDetectionsList">
                      ${detections.length === 0 ? `
                        <div class="ai-detection-empty">Zero crack bounding boxes in this concrete patch</div>
                      ` : detections.map((d, i) => `
                        <div class="ai-detection-row" data-detection-index="${i}">
                          <div class="ai-detection-row__left">
                            <span class="ai-detection-badge">#${i + 1}</span>
                            <div>
                              <strong>${d.label.toUpperCase()}</strong>
                              <div class="mono" style="font-size: 0.7rem; color: var(--navy-faint);">
                                Coords: [${d.bbox.map(c => Math.round(c)).join(', ')}]
                              </div>
                            </div>
                          </div>
                          <div class="ai-detection-row__right">
                            <span class="mono font-bold" style="color: #D9381E;">${formatConf(d.confidence)}</span>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>

              <!-- INSPECTOR REVIEW & DECISION SUPPORT CARD -->
              <div class="card ai-card ai-review-card">
                <div class="ai-card-header">
                  <div>
                    <span class="ai-card-tag" style="color: var(--green-dark);">GOVERNANCE &amp; VERIFICATION</span>
                    <h4 class="ai-card-title">Inspector Review &amp; Decision Support</h4>
                  </div>
                </div>
                <div class="ai-card-body">
                  <p class="ai-review-text">
                    YOLOv8 detections and multi-patch health aggregations serve as decision-support telemetry for structural engineers. Field inspector validation is logged for audit integrity.
                  </p>

                  <div class="ai-confirm-box" id="aiConfirmBox">
                    ${wasConfirmed ? `
                      <div class="ai-confirmed-banner">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        <div>
                          <strong>Findings Verified &amp; Confirmed by Inspector</strong>
                          <div style="font-size: 0.75rem; color: var(--navy-soft);">Recorded in session dossier audit log.</div>
                        </div>
                      </div>
                    ` : `
                      <button type="button" class="btn btn--primary ai-btn-confirm" id="btnConfirmFindings">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Confirm Findings &amp; Validate Assessment
                      </button>
                    `}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      `;

      // Mount visual canvas for active patch
      const canvasMount = targetEl.querySelector('#aiCanvasMount');
      const canvasController = mountCanvas(canvasMount, {
        imageUrl: activePatch.image_url,
        detections: detections,
        imageDimensions: patchDims,
        crackDetected: patchCrackDetected
      });

      // Wire up patch tab switcher buttons
      const patchTabs = targetEl.querySelectorAll('.ai-patch-tab');
      patchTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const idx = parseInt(tab.dataset.patchIdx, 10);
          if (idx !== activePatchIdx) {
            activePatchIdx = idx;
            renderUI();
          }
        });
      });

      // Wire up detection list hover events to highlight canvas boxes
      const listRows = targetEl.querySelectorAll('.ai-detection-row');
      listRows.forEach(row => {
        const idx = parseInt(row.dataset.detectionIndex, 10);
        row.addEventListener('mouseenter', () => {
          row.classList.add('is-hovered');
          if (canvasController) canvasController.highlightBox(idx, true);
        });
        row.addEventListener('mouseleave', () => {
          row.classList.remove('is-hovered');
          if (canvasController) canvasController.highlightBox(idx, false);
        });
      });

      // Wire up Inspector Confirmation Action
      const confirmBtn = targetEl.querySelector('#btnConfirmFindings');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          localStorage.setItem(confirmKey, 'true');
          const box = targetEl.querySelector('#aiConfirmBox');
          if (box) {
            box.innerHTML = `
              <div class="ai-confirmed-banner">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <div>
                  <strong>Findings Verified &amp; Confirmed by Inspector</strong>
                  <div style="font-size: 0.75rem; color: var(--navy-soft);">
                    Confirmed at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Decision support recorded.
                  </div>
                </div>
              </div>
            `;
          }
          if (typeof SetuApp !== 'undefined' && SetuApp.showToast) {
            SetuApp.showToast('Inspection findings officially confirmed by inspector.', 'success');
          }
          if (typeof options.onConfirm === 'function') {
            options.onConfirm(inspection);
          }
        });
      }

      return canvasController;
    }

    return renderUI();
  }

  /**
   * Renders the clean failure state when AI analysis cannot be performed.
   * 
   * @param {HTMLElement} targetEl - Container element
   * @param {Object} options - { errorMessage, onRetry }
   */
  function renderInferenceFailure(targetEl, options = {}) {
    if (!targetEl) return;
    const { errorMessage = 'Unable to complete crack detection on the provided image.', onRetry } = options;

    targetEl.innerHTML = `
      <div class="ai-failure-card">
        <div class="ai-failure-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="ai-failure-content">
          <span class="ai-failure-badge">AI ANALYSIS UNAVAILABLE</span>
          <h3 class="ai-failure-title">Unable to Complete Crack Detection</h3>
          <p class="ai-failure-desc">
            ${errorMessage}
          </p>
          <div class="ai-failure-note">
            No mock results or fabricated confidence scores were generated. The existing error-handling policy ensures data integrity.
          </div>
          ${typeof onRetry === 'function' ? `
            <div style="margin-top: 18px;">
              <button type="button" class="btn btn--primary btn--sm" id="btnRetryAiAnalysis">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Retry AI Crack Analysis
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const retryBtn = targetEl.querySelector('#btnRetryAiAnalysis');
    if (retryBtn && typeof onRetry === 'function') {
      retryBtn.addEventListener('click', onRetry);
    }
  }

  /**
   * Opens the Interactive AI Inspection Modal for inspecting historical or current records.
   * DOES NOT rerun YOLO inference. Uses stored detection_data directly.
   * 
   * @param {Object} inspection - The complete inspection record
   */
  function openInspectionModal(inspection) {
    if (!inspection) return;

    closeModal();

    const backdrop = document.createElement('div');
    backdrop.className = 'ai-modal-backdrop';
    backdrop.id = 'aiInspectionModal';

    const modalDialog = document.createElement('div');
    modalDialog.className = 'ai-modal-dialog';

    modalDialog.innerHTML = `
      <div class="ai-modal-header">
        <div>
          <span class="ai-badge-ai">HISTORICAL INSPECTION AUDIT</span>
          <h2 class="ai-modal-title">Inspection Dossier: ${inspection.inspection_code || inspection.id || 'Visual Record'}</h2>
          <div class="ai-modal-meta">
            <span>Date: <strong>${inspection.inspection_date}</strong></span>
            <span>Bridge: <strong>${(inspection.bridge && inspection.bridge.bridge_name) || 'Bridge Structure'}</strong></span>
            <span>Mode: <strong>Stored YOLOv8 Telemetry (Zero Re-run)</strong></span>
          </div>
        </div>
        <button type="button" class="ai-modal-close" id="btnCloseModal" aria-label="Close modal">&times;</button>
      </div>
      <div class="ai-modal-body" id="aiModalContentMount"></div>
    `;

    backdrop.appendChild(modalDialog);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    // Mount full inspection view inside modal
    const mountPoint = modalDialog.querySelector('#aiModalContentMount');
    renderInspectionView(mountPoint, inspection);

    activeModal = backdrop;

    // Close handlers
    const closeBtn = modalDialog.querySelector('#btnCloseModal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const escListener = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        window.removeEventListener('keydown', escListener);
      }
    };
    window.addEventListener('keydown', escListener);
  }

  function closeModal() {
    if (activeModal) {
      activeModal.remove();
      activeModal = null;
      document.body.style.overflow = '';
    }
  }

  return {
    mountCanvas,
    renderInspectionView,
    renderInferenceFailure,
    openInspectionModal,
    closeModal,
    formatConf
  };
})();

// Attach to window object for access across all pages
window.SetuVisualAI = SetuVisualAI;
