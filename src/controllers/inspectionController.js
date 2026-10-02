/**
 * SetuSight — Inspection Controller
 * 
 * Strict Cloud-Only Flow:
 * Multipart image -> Multer memory buffer -> Cloudinary upload -> ML placeholder -> Health assessment -> Supabase PostgreSQL
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
   * Inspector & Admin: Create new bridge inspection with Cloudinary image upload
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

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          error: 'Inspection image file is required (JPEG, PNG, or WebP up to 10MB)'
        });
      }

      // 1. Fetch bridge structure
      const bridge = await dbService.getBridgeById(bridge_id);
      if (!bridge) {
        return res.status(404).json({
          success: false,
          error: 'Specified bridge structure not found in database'
        });
      }

      // 2. Upload image buffer to Cloudinary (Strict Cloud Storage)
      const uploadResult = await uploadImageBuffer(req.file.buffer, {
        folder: `setusight/bridges/${bridge.bridge_id}`,
        tags: ['setusight', 'inspection', bridge.bridge_id]
      });

      const imageUrl = uploadResult.secure_url;
      const cloudinaryPublicId = uploadResult.public_id;

      // 3. Run ML Service Placeholder Interface (Prepared for YOLOv8)
      const mlDetection = await mlService.analyzeBridgeImage(imageUrl);

      // Determine crack count and severity from inspector input or pending ML
      const finalCrackCount = crack_count !== undefined ? parseInt(crack_count, 10) : mlDetection.crackCount;
      const finalSeverity = crack_severity || (finalCrackCount > 5 ? 'high' : (finalCrackCount > 0 ? 'moderate' : 'none'));

      // 4. Calculate Rule-Based Health Assessment
      const pastMaintenance = await dbService.getMaintenanceByBridgeId(bridge.id);
      const assessment = healthService.calculateHealthAssessment(
        bridge,
        { crack_severity: finalSeverity, crack_count: finalCrackCount },
        { recentMaintenance: pastMaintenance }
      );

      // 5. Store Inspection Record in Supabase
      const inspectionData = {
        bridge_id: bridge.id,
        inspector_id: req.user ? req.user.id : null,
        inspection_date: inspection_date || new Date().toISOString().split('T')[0],
        image_url: imageUrl,
        cloudinary_public_id: cloudinaryPublicId,
        crack_count: finalCrackCount,
        crack_severity: finalSeverity,
        detection_confidence: mlDetection.confidence || 0.0,
        detection_data: {
          ml_status: mlDetection.status,
          is_mock: mlDetection.isMock,
          detections: mlDetection.detections,
          image_dimensions: { width: uploadResult.width, height: uploadResult.height },
          score_breakdown: assessment.scoreBreakdown
        },
        health_score: assessment.healthScore,
        health_status: assessment.healthStatus,
        remarks: remarks || ''
      };

      const savedInspection = await dbService.createInspection(inspectionData);

      // 6. Update Bridge Current Health Score & Status
      await dbService.updateBridge(bridge.id, {
        current_health_score: assessment.healthScore,
        current_health_status: assessment.healthStatus
      });

      // 7. Dispatch Alert Notification if Critical Finding
      if (finalSeverity === 'high' || finalSeverity === 'critical' || assessment.healthScore < 60) {
        await notificationService.notifyCriticalFinding(bridge, savedInspection);
      }

      res.status(201).json({
        success: true,
        message: 'Inspection submitted and structural health re-assessed successfully',
        data: savedInspection,
        ml_service: {
          status: mlDetection.status,
          note: mlDetection.note
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/inspections/:id/analyze
   * Trigger ML placeholder re-analysis
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
        message: 'ML analysis interface executed (placeholder ready for YOLOv8)',
        data: mlResult
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InspectionController();
