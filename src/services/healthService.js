/**
 * SetuSight — Bridge Health Assessment Engine (Phase 3A Multi-Patch Architecture)
 * 
 * Hierarchy:
 * 1. LOCAL PATCH CONDITION (0-100): Physical condition of an individual photo patch via YOLOv8
 * 2. INSPECTION SESSION CONDITION (0-100): Deterministic evidence aggregation across all inspected patches
 * 3. BRIDGE HEALTH SCORE (0-100): Asset-level health integrating inspection session evidence,
 *    bridge age/design life, structural material, environmental exposure, maintenance track record,
 *    and historical deterioration trend.
 * 
 * Authoritative Status Mapping:
 * - Health Score >= 80: 'Good' (unless worst severity override triggers)
 * - Health Score 60 - 79.9: 'Moderate' (unless worst severity override triggers)
 * - Health Score < 60: 'Attention Required'
 * - Worst Severity Override: 'critical' forces status 'Attention Required' (score capped at <= 58)
 * - Worst Severity Override: 'high' forces status at most 'Moderate' (score capped at <= 74)
 */

class HealthService {
  /**
   * Severity hierarchy for comparative calculations
   */
  static SEVERITY_WEIGHTS = {
    none: 0,
    low: 1,
    moderate: 2,
    high: 3,
    critical: 4
  };

  /**
   * Evaluates a single local patch condition based on YOLO detection results
   * 
   * @param {number} crackCount - Number of cracks detected in this patch
   * @param {string} severity - Crack severity ('none', 'low', 'moderate', 'high', 'critical')
   * @returns {number} Local patch condition score (0-100)
   */
  calculatePatchCondition(crackCount = 0, severity = 'none') {
    const sev = (severity || 'none').toLowerCase();
    const count = Math.max(0, parseInt(crackCount, 10) || 0);

    if (sev === 'none' && count === 0) {
      return 100.0;
    }

    let severityDeduction = 0;
    if (sev === 'critical') severityDeduction = 48;
    else if (sev === 'high') severityDeduction = 34;
    else if (sev === 'moderate') severityDeduction = 20;
    else if (sev === 'low') severityDeduction = 8;

    // Up to 15 points deduction for high count
    const countDeduction = Math.min(count * 2.0, 15);

    const patchScore = Math.max(10, Math.min(100, 100 - (severityDeduction + countDeduction)));
    return Number(patchScore.toFixed(1));
  }

  /**
   * Deterministically aggregates evidence across multiple inspected image patches
   * 
   * @param {Array<Object>} patches - Array of { crack_count, crack_severity, confidence, detections, local_condition_score }
   * @returns {Object} Aggregated inspection metrics and session condition score
   */
  aggregateSessionEvidence(patches = []) {
    if (!Array.isArray(patches) || patches.length === 0) {
      return {
        sessionConditionScore: 100.0,
        worstSeverity: 'none',
        totalCrackCount: 0,
        affectedPatchCount: 0,
        totalPatches: 0,
        affectedRatio: 0.0,
        aggregateConfidence: 0.0,
        severityDistribution: { none: 0, low: 0, moderate: 0, high: 0, critical: 0 },
        patchScores: []
      };
    }

    const totalPatches = patches.length;
    let totalCrackCount = 0;
    let affectedPatchCount = 0;
    let maxConfidence = 0.0;
    let worstSeverity = 'none';
    let worstWeight = 0;

    const severityDistribution = {
      none: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0
    };

    const evaluatedPatches = patches.map((p, idx) => {
      const count = Math.max(0, parseInt(p.crack_count, 10) || 0);
      let sev = (p.crack_severity || 'none').toLowerCase();
      if (sev === 'pending' || !HealthService.SEVERITY_WEIGHTS.hasOwnProperty(sev)) {
        sev = count === 0 ? 'none' : count === 1 ? 'low' : count <= 3 ? 'moderate' : count <= 6 ? 'high' : 'critical';
      }

      const conf = parseFloat(p.confidence || p.detection_confidence || 0.0) || 0.0;
      if (conf > maxConfidence) maxConfidence = conf;

      const localScore = typeof p.local_condition_score === 'number'
        ? p.local_condition_score
        : this.calculatePatchCondition(count, sev);

      if (count > 0 || (sev !== 'none' && sev !== 'pending')) {
        affectedPatchCount++;
      }

      totalCrackCount += count;
      if (severityDistribution.hasOwnProperty(sev)) {
        severityDistribution[sev]++;
      } else {
        severityDistribution.none++;
      }

      const weight = HealthService.SEVERITY_WEIGHTS[sev] || 0;
      if (weight > worstWeight) {
        worstWeight = weight;
        worstSeverity = sev;
      }

      return {
        ...p,
        patchIndex: idx + 1,
        crack_count: count,
        crack_severity: sev,
        confidence: conf,
        local_condition_score: localScore
      };
    });

    const affectedRatio = totalPatches > 0 ? Number((affectedPatchCount / totalPatches).toFixed(2)) : 0;
    const patchScores = evaluatedPatches.map(p => p.local_condition_score);

    // Calculate mean and min patch conditions
    const sumScores = patchScores.reduce((acc, s) => acc + s, 0);
    const meanScore = sumScores / totalPatches;
    const minScore = Math.min(...patchScores);

    // Weighted blend: 55% average condition + 45% worst observed hotspot
    let rawSessionScore = (0.55 * meanScore) + (0.45 * minScore);

    // Affected patch spread penalty: systemic damage across multiple patches
    const spreadPenalty = affectedRatio * 8.0;
    let sessionConditionScore = Math.max(10, Math.min(100, rawSessionScore - spreadPenalty));

    // Overrides: Critical finding must not hide behind clean patches
    if (worstSeverity === 'critical') {
      sessionConditionScore = Math.min(sessionConditionScore, 55.0);
    } else if (worstSeverity === 'high') {
      sessionConditionScore = Math.min(sessionConditionScore, 72.0);
    } else if (worstSeverity === 'moderate') {
      sessionConditionScore = Math.min(sessionConditionScore, 82.0);
    }

    sessionConditionScore = Number(sessionConditionScore.toFixed(1));

    return {
      sessionConditionScore,
      worstSeverity,
      totalCrackCount,
      affectedPatchCount,
      totalPatches,
      affectedRatio,
      aggregateConfidence: Number(maxConfidence.toFixed(2)),
      severityDistribution,
      patchScores,
      evaluatedPatches
    };
  }

  /**
   * Holistic Bridge Health Calculation
   * Evaluates overall bridge asset health score and categorical status
   * 
   * @param {Object} bridge - Bridge asset metadata (construction_year, design_life, material, location)
   * @param {Object|Array} inspectionEvidence - Session aggregation or single inspection findings
   * @param {Object} history - Past inspections and maintenance records
   * @returns {{ healthScore: number, healthStatus: string, maintenancePriority: string, scoreBreakdown: Object }}
   */
  calculateHealthAssessment(bridge, inspectionEvidence = {}, history = {}) {
    let sessionMetrics;

    // Check if evidence is already aggregated or if array of patches provided
    if (inspectionEvidence && inspectionEvidence.sessionConditionScore !== undefined) {
      sessionMetrics = inspectionEvidence;
    } else if (Array.isArray(inspectionEvidence.patches)) {
      sessionMetrics = this.aggregateSessionEvidence(inspectionEvidence.patches);
    } else if (Array.isArray(inspectionEvidence)) {
      sessionMetrics = this.aggregateSessionEvidence(inspectionEvidence);
    } else {
      // Single patch fallback (backward compatibility)
      const count = parseInt(inspectionEvidence.crack_count || 0, 10);
      const sev = inspectionEvidence.crack_severity || (count === 0 ? 'none' : 'moderate');
      sessionMetrics = this.aggregateSessionEvidence([{
        crack_count: count,
        crack_severity: sev,
        confidence: inspectionEvidence.confidence || 0.0
      }]);
    }

    const {
      sessionConditionScore,
      worstSeverity,
      totalCrackCount,
      affectedPatchCount,
      totalPatches,
      affectedRatio
    } = sessionMetrics;

    let score = 100.0;
    const breakdown = {
      baseScore: 100.0,
      sessionConditionScore,
      defectDeduction: 0,
      ageDeduction: 0,
      materialAdjustment: 0,
      exposureAdjustment: 0,
      maintenanceOffset: 0,
      trendAdjustment: 0
    };

    // 1. Visual Defect Impact derived from Inspection Session Condition (Up to 45 pts deduction)
    // Directly maps physical session condition without double-counting severity and count
    breakdown.defectDeduction = Number(((100.0 - sessionConditionScore) * 0.45).toFixed(1));
    score -= breakdown.defectDeduction;

    // 2. Bridge Age vs. Design Life Ratio (Up to 22 points deduction)
    const currentYear = new Date().getFullYear();
    const constYear = bridge.construction_year || currentYear;
    const age = Math.max(0, currentYear - constYear);
    const designLife = bridge.design_life || 50;
    const ageRatio = Math.min(age / designLife, 1.5);

    if (ageRatio > 0.8) {
      breakdown.ageDeduction = Number((18 * (ageRatio - 0.5)).toFixed(1));
    } else if (ageRatio > 0.5) {
      breakdown.ageDeduction = Number((10 * (ageRatio - 0.3)).toFixed(1));
    } else if (ageRatio > 0.2) {
      breakdown.ageDeduction = Number((4 * ageRatio).toFixed(1));
    }
    score -= breakdown.ageDeduction;

    // 3. Structural Material Vulnerability (Up to 6 points adjustment)
    const material = (bridge.material || '').toLowerCase();
    if (material.includes('steel') && !material.includes('prestressed')) {
      // Steel exposed to environmental weathering
      breakdown.materialAdjustment = 4;
    } else if (material.includes('underpass') || material.includes('box culvert') || material.includes('masonry')) {
      breakdown.materialAdjustment = 5;
    } else if (material.includes('composite')) {
      breakdown.materialAdjustment = 3;
    } else {
      breakdown.materialAdjustment = 1;
    }
    score -= breakdown.materialAdjustment;

    // 4. Environmental & Traffic Exposure Adjustment (Up to 6 points deduction)
    const location = (bridge.location || '').toLowerCase();
    const bridgeName = (bridge.bridge_name || '').toLowerCase();
    if (bridgeName.includes('creek') || bridgeName.includes('underpass') || location.includes('creek') || location.includes('coastal')) {
      // Saline / tidal water or high seepage susceptibility
      breakdown.exposureAdjustment = 5;
    } else if (bridgeName.includes('flyover') || bridgeName.includes('rob') || bridgeName.includes('highway')) {
      // Heavy dynamic vehicle vibration load
      breakdown.exposureAdjustment = 3;
    } else {
      breakdown.exposureAdjustment = 1;
    }
    score -= breakdown.exposureAdjustment;

    // 5. Maintenance History & Status Adjustment
    const recentMaintenance = history.recentMaintenance || [];
    const hasCompletedMaintenance = recentMaintenance.some(m => m.status === 'Completed');
    const hasOverdueMaintenance = recentMaintenance.some(m => m.status === 'Overdue');

    if (hasCompletedMaintenance) {
      // Timely maintenance restored structural protection
      breakdown.maintenanceOffset += 5;
    }
    if (hasOverdueMaintenance) {
      // Overdue maintenance allows localized cracks to accelerate deterioration
      breakdown.maintenanceOffset -= 6;
    }
    score += breakdown.maintenanceOffset;

    // 6. Historical Inspection Trend (Expert-Informed Empirical Factor)
    const pastInspections = history.pastInspections || [];
    if (Array.isArray(pastInspections) && pastInspections.length >= 2) {
      const pastScores = pastInspections
        .map(i => parseFloat(i.health_score))
        .filter(s => !isNaN(s));
      
      if (pastScores.length >= 2) {
        const latestPast = pastScores[0];
        const priorPast = pastScores[1];
        if (latestPast < priorPast && (priorPast - latestPast) >= 6) {
          // Accelerating degradation trend observed
          breakdown.trendAdjustment = -3;
        } else if (latestPast > priorPast && (latestPast - priorPast) >= 6) {
          // Documented structural improvement
          breakdown.trendAdjustment = +2;
        }
      }
    }
    score += breakdown.trendAdjustment;

    // 7. Clamp and Apply Authoritative Safety Overrides
    let finalScore = Math.max(10, Math.min(100, Math.round(score * 10) / 10));

    // Safety Override: Critical crack cannot produce a "Good" or "Moderate" bridge status
    if (worstSeverity === 'critical') {
      finalScore = Math.min(finalScore, 58.0);
    } else if (worstSeverity === 'high') {
      finalScore = Math.min(finalScore, 74.0);
    }

    // Determine Unified Health Status
    let healthStatus = 'Good';
    if (finalScore < 60 || worstSeverity === 'critical') {
      healthStatus = 'Attention Required';
    } else if (finalScore < 80 || worstSeverity === 'high') {
      healthStatus = 'Moderate';
    }

    // Determine Maintenance Priority
    const maintenancePriority = this.calculateMaintenancePriority(finalScore, worstSeverity, history);

    return {
      healthScore: finalScore,
      healthStatus,
      maintenancePriority,
      scoreBreakdown: breakdown,
      sessionMetrics: {
        totalPatches,
        affectedPatchCount,
        affectedRatio,
        totalCrackCount,
        worstSeverity,
        sessionConditionScore
      }
    };
  }

  /**
   * Deterministic Maintenance Priority Engine
   * Separates Bridge Health Score from Urgency of Intervention
   */
  calculateMaintenancePriority(healthScore, worstSeverity = 'none', history = {}) {
    const sev = (worstSeverity || 'none').toLowerCase();
    const recentMaintenance = history.recentMaintenance || [];
    const hasOverdue = recentMaintenance.some(m => m.status === 'Overdue');

    if (sev === 'critical' || healthScore < 45 || (hasOverdue && healthScore < 60)) {
      return 'Urgent';
    }
    if (sev === 'high' || healthScore < 60 || (hasOverdue && healthScore < 75)) {
      return 'High';
    }
    if (sev === 'moderate' || healthScore < 78) {
      return 'Medium';
    }
    return 'Low';
  }
}

module.exports = new HealthService();
