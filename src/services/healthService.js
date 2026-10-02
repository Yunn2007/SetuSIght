/**
 * SetuSight — Bridge Health Assessment Engine (Rule-Based)
 * 
 * Computes an overall Bridge Health Score (0-100) and Health Status
 * ('Good', 'Moderate', 'Attention Required') based on multi-parameter heuristics.
 * 
 * Parameters Considered:
 * 1. Visual / Crack Evidence (Count, Severity)
 * 2. Bridge Age vs. Design Life Ratio
 * 3. Material Vulnerability Factor
 * 4. Location / Environmental Exposure (e.g. Coastal / Creek / Underpass vs Standard)
 * 5. Historical Inspection & Maintenance Track Record
 */

class HealthService {
  /**
   * Evaluates overall bridge health score and categorical status
   * 
   * @param {Object} bridge - Bridge asset metadata (construction_year, design_life, material, location)
   * @param {Object} inspectionData - Current inspection findings (crack_count, crack_severity)
   * @param {Array} history - Past inspections and maintenance records
   * @returns {{ healthScore: number, healthStatus: string, scoreBreakdown: Object }}
   */
  calculateHealthAssessment(bridge, inspectionData = {}, history = {}) {
    let score = 100.0;
    const breakdown = {
      baseScore: 100.0,
      crackDeduction: 0,
      ageDeduction: 0,
      materialAdjustment: 0,
      exposureAdjustment: 0,
      maintenanceOffset: 0
    };

    // 1. Crack Severity & Count Impact (Up to 45 points deduction)
    const severity = (inspectionData.crack_severity || 'none').toLowerCase();
    const count = parseInt(inspectionData.crack_count || 0, 10);

    let severityDeduction = 0;
    if (severity === 'critical') severityDeduction = 38;
    else if (severity === 'high') severityDeduction = 28;
    else if (severity === 'moderate') severityDeduction = 16;
    else if (severity === 'low') severityDeduction = 6;
    else if (severity === 'none' || severity === 'pending') severityDeduction = 0;

    const countDeduction = Math.min(count * 1.5, 12);
    breakdown.crackDeduction = Number((severityDeduction + countDeduction).toFixed(1));
    score -= breakdown.crackDeduction;

    // 2. Bridge Age vs. Design Life Ratio (Up to 25 points deduction)
    const currentYear = new Date().getFullYear();
    const constYear = bridge.construction_year || currentYear;
    const age = Math.max(0, currentYear - constYear);
    const designLife = bridge.design_life || 50;
    const ageRatio = Math.min(age / designLife, 1.5);

    if (ageRatio > 0.8) {
      breakdown.ageDeduction = Number((20 * (ageRatio - 0.5)).toFixed(1));
    } else if (ageRatio > 0.5) {
      breakdown.ageDeduction = Number((12 * (ageRatio - 0.3)).toFixed(1));
    } else if (ageRatio > 0.2) {
      breakdown.ageDeduction = Number((5 * ageRatio).toFixed(1));
    }
    score -= breakdown.ageDeduction;

    // 3. Material Factor (Up to 8 points adjustment)
    const material = (bridge.material || '').toLowerCase();
    if (material.includes('steel') && !material.includes('prestressed')) {
      // Steel exposed to coastal atmosphere requires higher maintenance vigilance
      breakdown.materialAdjustment = 4;
    } else if (material.includes('underpass') || material.includes('box culvert')) {
      breakdown.materialAdjustment = 5;
    } else {
      breakdown.materialAdjustment = 1;
    }
    score -= breakdown.materialAdjustment;

    // 4. Environmental & Traffic Exposure Adjustment (Up to 8 points deduction)
    const location = (bridge.location || '').toLowerCase();
    const bridgeName = (bridge.bridge_name || '').toLowerCase();
    if (bridgeName.includes('creek') || bridgeName.includes('underpass') || location.includes('creek')) {
      // Saline / tidal water or high seepage susceptibility
      breakdown.exposureAdjustment = 6;
    } else if (bridgeName.includes('flyover') || bridgeName.includes('rob')) {
      // High vehicle dynamic vibration load
      breakdown.exposureAdjustment = 4;
    } else {
      breakdown.exposureAdjustment = 2;
    }
    score -= breakdown.exposureAdjustment;

    // 5. Completed Maintenance Boost / Offset (Adds back up to 8 points)
    const recentMaintenance = history.recentMaintenance || [];
    const hasCompletedMaintenance = recentMaintenance.some(m => m.status === 'Completed');
    if (hasCompletedMaintenance) {
      breakdown.maintenanceOffset = 5;
      score += breakdown.maintenanceOffset;
    }

    // Clamp score within 0 - 100
    const finalScore = Math.max(10, Math.min(100, Math.round(score * 10) / 10));

    // Determine status
    let healthStatus = 'Good';
    if (finalScore < 60) {
      healthStatus = 'Attention Required';
    } else if (finalScore < 80) {
      healthStatus = 'Moderate';
    }

    return {
      healthScore: finalScore,
      healthStatus,
      scoreBreakdown: breakdown
    };
  }
}

module.exports = new HealthService();
