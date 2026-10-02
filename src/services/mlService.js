/**
 * SetuSight — Machine Learning & Computer Vision Service Interface
 * 
 * IMPORTANT ARCHITECTURAL SPECIFICATION:
 * YOLOv8 inference will be plugged into this isolated service interface in a later phase.
 * This placeholder defines the standard contract expected by the SetuSight backend API.
 * 
 * Flow:
 * Image uploaded to Cloudinary -> Cloudinary URL sent to analyzeBridgeImage() -> YOLOv8 model inference.
 */

class MlService {
  /**
   * Analyzes an inspection image for visible cracks.
   * Currently returns an explicit pending mock response as the real YOLOv8 engine
   * is slated for separate integration.
   * 
   * @param {string} imageUrl - Secure Cloudinary image URL
   * @returns {Promise<Object>} Detection results structure
   */
  async analyzeBridgeImage(imageUrl) {
    if (!imageUrl) {
      throw new Error('Image URL is required for ML analysis');
    }

    // Explicit placeholder object — do not simulate fake detections
    return {
      status: 'AI analysis module pending integration',
      isMock: true,
      crackDetected: false,
      crackCount: 0,
      confidence: 0.0,
      severity: 'pending', // 'none' | 'low' | 'moderate' | 'high' | 'critical'
      detections: [], // Array of bounding boxes: [{ box: [x1, y1, x2, y2], confidence: 0.0, label: 'crack' }]
      imageUrl: imageUrl,
      processedAt: new Date().toISOString(),
      note: 'YOLOv8 inference service will be connected to this endpoint. Crack severity will be evaluated based on detected crack surface area and density.'
    };
  }
}

module.exports = new MlService();
