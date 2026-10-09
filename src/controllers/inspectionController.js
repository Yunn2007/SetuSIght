/**
 * SetuSight — Inspection Controller (Phase 3A Multi-Image Session Architecture)
 * 
 * Flow:
 * Multiple patch images (1-10) -> Multer memory buffers -> Cloudinary uploads
 * -> Python YOLOv8 inference per patch -> Individual local patch condition scores
 * -> Deterministic inspection session aggregation -> Holistic Bridge Health Assessment
 * -> Supabase PostgreSQL storage -> Real Admin Notification if Attention Required / Critical.
 */
const dbService = require('../services/dbService');
const { uploadImageBuffer } = require('../config/cloudinary');
const mlService = require('../services/mlService');
const healthService = require('../services/healthService');
const notificationService = require('../services/notificationService');

class InspectionController {
  /**
   * GET /api/inspections
   */
  async getAllInspections(req, res, next) {
    try {
      const filters = {
        bridge_id: req.query.bridge_id,
        severity: req.query.severity,
        inspector_id: req.query.inspector_id
      };

      const inspections = await dbService.getAllInspections(filters);

      res.json({
        success: true,
        count: inspections.length,
        data: inspections
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/inspections/:id
   */
  async getInspectionById(req, res, next) {
    try {
      const inspection = await dbService.getInspectionById(req.params.id);
      if (!inspection) {
        return res.status(404).json({
          success: false,
          error: 'Inspection record not found'
        });
      }

      res.json({
        success: true,
        data: inspection
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/inspections
   * Inspector & Admin: Create new multi-image inspection session with real YOLOv8 inference per patch
   */
  async createInspection(req, res, next) {
    try {
      const {
        bridge_id,
        inspection_date,
        crack_count,
        crack_severity,
        remarks
      } = req.body;

      if (!bridge_id) {
        return res.status(400).json({
          success: false,
          error: 'Bridge selection (bridge_id) is mandatory'
        });
      }

      // Collect uploaded files from req.inspectionFiles or fallback to req.file/req.files
      let files = req.inspectionFiles || [];
      if (files.length === 0) {
        if (Array.isArray(req.files) && req.files.length > 0) {
          files = req.files;
        } else if (req.file) {
          files = [req.file];
        }
      }

      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one inspection image file is required (JPEG, PNG, or WebP up to 10MB)'
        });
      }

      if (files.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 10 image patches permitted per inspection session'
        });
      }

      // 1. Fetch bridge asset metadata
      const bridge = await dbService.getBridgeById(bridge_id);
      if (!bridge) {
        return res.status(404).json({
          success: false,
          error: 'Specified bridge structure not found in database'
        });
      }

      const sessionTimestamp = Date.now();
      const patches = [];

      // 2. Process each image patch through Cloudinary & real YOLOv8
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const patchNum = i + 1;
        const patchLabel = `Patch ${patchNum}`;

        // A. Upload patch buffer to Cloudinary
        const uploadResult = await uploadImageBuffer(file.buffer, {
          folder: `setusight/bridges/${bridge.bridge_id}/session_${sessionTimestamp}`,
          tags: ['setusight', 'inspection', bridge.bridge_id, 'patch']
        });

        const imageUrl = uploadResult.secure_url;
        const cloudinaryPublicId = uploadResult.public_id;

        // B. Run real YOLOv8 Computer Vision Inference on patch
        let mlDetection;
        try {
          mlDetection = await mlService.analyzeBridgeImage(imageUrl);
        } catch (mlErr) {
          if (mlErr.code === 'ML_MODEL_NOT_FOUND' || (mlErr.message && mlErr.message.includes('YOLO model not found'))) {
            return res.status(503).json({
              success: false,
              error: 'YOLO model not found at ml/best.pt. Place the trained SetuSight model at this path.'
            });
          }
          console.error(`ML inference failed on ${patchLabel}:`, mlErr.message);
          mlDetection = {
            status: 'failed',
            crackDetected: false,
            crackCount: 0,
            confidence: 0.0,
            detections: [],
            error: mlErr.message,
            note: 'AI ANALYSIS UNAVAILABLE'
          };
        }

        // C. Determine patch crack count & severity
        let patchCrackCount = mlDetection.crackCount || 0;
        let patchSeverity = 'none';

        // Support manual override only if a single image was uploaded and an explicit override given
        if (files.length === 1 && crack_count !== undefined && crack_count !== '' && !isNaN(parseInt(crack_count, 10))) {
          const parsedCount = parseInt(crack_count, 10);
          if (parsedCount >= 0) patchCrackCount = parsedCount;
        }

        if (files.length === 1 && crack_severity && crack_severity !== 'auto') {
          patchSeverity = crack_severity.toLowerCase();
        } else {
          // Automatic severity mapping from real patch crack count
          if (patchCrackCount === 0) patchSeverity = 'none';
          else if (patchCrackCount === 1) patchSeverity = 'low';
          else if (patchCrackCount <= 3) patchSeverity = 'moderate';
          else if (patchCrackCount <= 6) patchSeverity = 'high';
          else patchSeverity = 'critical';
        }

        // D. Calculate individual Local Patch Condition (0-100)
        const localConditionScore = healthService.calculatePatchCondition(patchCrackCount, patchSeverity);

        patches.push({
          id: `patch-${patchNum}-${sessionTimestamp}`,
          patch_label: patchLabel,
          image_url: imageUrl,
          cloudinary_public_id: cloudinaryPublicId,
          image_dimensions: mlDetection.image_dimensions || { width: uploadResult.width, height: uploadResult.height },
          crack_count: patchCrackCount,
          crack_severity: patchSeverity,
          confidence: Number((mlDetection.confidence || 0.0).toFixed(2)),
          detections: mlDetection.detections || [],
          local_condition_score: localConditionScore,
          ai_status: mlDetection.status,
          crack_detected: mlDetection.crackDetected,
          error: mlDetection.error || null
        });
      }

      // Partial Failure Policy: Verify at least one patch succeeded
      const successfulPatches = patches.filter(p => p.ai_status !== 'failed');
      const failedPatches = patches.filter(p => p.ai_status === 'failed');

      if (successfulPatches.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'AI analysis failed for all uploaded patches. Bridge health was not updated.',
          details: failedPatches.map(p => ({ patch: p.patch_label, error: p.error }))
        });
      }

      // 3. Aggregate evidence across inspected patches (Inspection Session Condition)
      const sessionEvidence = healthService.aggregateSessionEvidence(successfulPatches);

      // 4. Fetch bridge context (maintenance history + past inspections trend)
      const pastMaintenance = await dbService.getMaintenanceByBridgeId(bridge.id);
      const pastInspections = await dbService.getInspectionsByBridgeId(bridge.id);

      // 5. Calculate Holistic Bridge-Level Health Score
      const assessment = healthService.calculateHealthAssessment(
        bridge,
        sessionEvidence,
        {
          recentMaintenance: pastMaintenance,
          pastInspections: pastInspections
        }
      );

      // Primary cover image (Patch 1)
      const primaryPatch = patches[0];

      // 6. Store Inspection Session Record in Supabase
      const inspectionData = {
        bridge_id: bridge.id,
        inspector_id: req.user ? req.user.id : null,
        inspection_date: inspection_date || new Date().toISOString().split('T')[0],
        image_url: primaryPatch.image_url,
        cloudinary_public_id: primaryPatch.cloudinary_public_id,
        crack_count: sessionEvidence.totalCrackCount,
        crack_severity: sessionEvidence.worstSeverity,
        detection_confidence: sessionEvidence.aggregateConfidence,
        detection_data: {
          is_multi_patch: patches.length > 1,
          total_patches: patches.length,
          affected_patch_count: sessionEvidence.affectedPatchCount,
          affected_ratio: sessionEvidence.affectedRatio,
          session_condition_score: sessionEvidence.sessionConditionScore,
          worst_severity: sessionEvidence.worstSeverity,
          severity_distribution: sessionEvidence.severityDistribution,
          score_breakdown: assessment.scoreBreakdown,
          maintenance_priority: assessment.maintenancePriority,
          images: patches,
          primary_image_dimensions: primaryPatch.image_dimensions,
          detections: primaryPatch.detections,
          is_mock: false,
          model_file: 'best.pt'
        },
        health_score: assessment.healthScore,
        health_status: assessment.healthStatus,
        remarks: remarks || '',
        patch_images: patches
      };

      const savedInspection = await dbService.createInspection(inspectionData);

      // 7. Update Bridge Current Health Score & Status
      await dbService.updateBridge(bridge.id, {
        current_health_score: assessment.healthScore,
        current_health_status: assessment.healthStatus
      });

      // 8. Dispatch Real Admin Notification if Attention Required, High, or Critical
      if (
        assessment.healthStatus === 'Attention Required' ||
        sessionEvidence.worstSeverity === 'critical' ||
        sessionEvidence.worstSeverity === 'high' ||
        assessment.healthScore < 60
      ) {
        await notificationService.notifyCriticalFinding(bridge, savedInspection, sessionEvidence);
      }

      res.status(201).json({
        success: true,
        message: `Inspection session submitted with ${patches.length} patch(es) analyzed successfully`,
        data: savedInspection,
        ml_service: {
          crackDetected: sessionEvidence.totalCrackCount > 0,
          crackCount: sessionEvidence.totalCrackCount,
          worstSeverity: sessionEvidence.worstSeverity,
          detections: primaryPatch.detections,
          isMock: false
        },
        session_summary: {
          total_patches: patches.length,
          affected_patches: sessionEvidence.affectedPatchCount,
          total_cracks: sessionEvidence.totalCrackCount,
          worst_severity: sessionEvidence.worstSeverity,
          inspection_condition_score: sessionEvidence.sessionConditionScore,
          bridge_health_score: assessment.healthScore,
          bridge_health_status: assessment.healthStatus,
          maintenance_priority: assessment.maintenancePriority
        },
        patches: patches
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/inspections/:id/analyze
   * Trigger real YOLOv8 ML re-analysis
   */
  async analyzeInspection(req, res, next) {
    try {
      const inspection = await dbService.getInspectionById(req.params.id);
      if (!inspection) {
        return res.status(404).json({
          success: false,
          error: 'Inspection record not found'
        });
      }

      const mlResult = await mlService.analyzeBridgeImage(inspection.image_url);

      res.json({
        success: true,
        message: 'Real YOLOv8 ML analysis completed',
        data: mlResult
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InspectionController();
