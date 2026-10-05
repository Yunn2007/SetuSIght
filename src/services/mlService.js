/**
 * SetuSight — Machine Learning & Computer Vision Service
 * 
 * Production YOLOv8 Integration:
 * Connects directly to the trained YOLOv8 model at ml/best.pt via Python inference.
 * Runs real object detection for bridge concrete crack detection.
 */
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');

class MlService {
  constructor() {
    this.modelPath = process.env.YOLO_MODEL_PATH || path.resolve(__dirname, '../../ml/best.pt');
    this.scriptPath = path.resolve(__dirname, '../../ml/inference.py');
    this.confThreshold = parseFloat(process.env.YOLO_CONF_THRESHOLD || '0.35');
  }

  resolvePythonPath() {
    if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
      return process.env.PYTHON_PATH;
    }
    // Check local virtual environment inside the project
    const localVenvPython = path.resolve(__dirname, '../../ml/venv/bin/python');
    if (fs.existsSync(localVenvPython)) {
      return localVenvPython;
    }
    return 'python3';
  }

  /**
   * Analyzes an inspection image using the trained YOLOv8 crack detection model.
   * 
   * @param {string} imageUrl - Cloudinary image URL or local file path
   * @param {number} [confThreshold] - Optional confidence threshold override
   * @returns {Promise<Object>} Real detection results structure
   */
  async analyzeBridgeImage(imageUrl, confThreshold = this.confThreshold) {
    if (!imageUrl) {
      throw new Error('Image URL or file path is required for ML analysis');
    }

    if (!fs.existsSync(this.modelPath)) {
      const err = new Error(`YOLO model not found at ${this.modelPath}. Place the trained SetuSight model at this path.`);
      err.code = 'ML_MODEL_NOT_FOUND';
      throw err;
    }

    const pythonPath = this.resolvePythonPath();

    return new Promise((resolve, reject) => {
      const args = [
        this.scriptPath,
        imageUrl,
        '--model', this.modelPath,
        '--conf', String(confThreshold)
      ];

      const options = {
        timeout: 45000, // 45-second execution timeout
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          YOLO_VERBOSE: 'False'
        }
      };

      execFile(pythonPath, args, options, (error, stdout, stderr) => {
        if (error) {
          let errorMsg = error.message;
          if (stdout) {
            try {
              const parsed = JSON.parse(stdout.trim());
              if (parsed && parsed.error) errorMsg = parsed.error;
            } catch (_) {}
          }
          if (!errorMsg && stderr) {
            errorMsg = stderr.trim();
          }

          if (errorMsg.includes('YOLO model not found') || errorMsg.includes('Model weights file not found')) {
            const notFoundErr = new Error(`YOLO model not found at ${this.modelPath}. Place the trained SetuSight model at this path.`);
            notFoundErr.code = 'ML_MODEL_NOT_FOUND';
            return reject(notFoundErr);
          }

          const mlErr = new Error(`AI inference execution failed: ${errorMsg}`);
          mlErr.code = 'ML_INFERENCE_FAILED';
          mlErr.details = stderr || error.message;
          return reject(mlErr);
        }

        try {
          const trimmed = stdout.trim();
          // Extract the line containing the JSON response
          const jsonLine = trimmed.split('\n').filter(l => l.trim().startsWith('{')).pop() || trimmed;
          const result = JSON.parse(jsonLine);

          if (!result || typeof result !== 'object') {
            throw new Error('Invalid or empty JSON response received from ML inference process');
          }

          if (result.success === false) {
            const mlErr = new Error(result.error || 'AI inference returned failure');
            mlErr.code = 'ML_INFERENCE_FAILED';
            return reject(mlErr);
          }

          resolve({
            status: 'AI analysis completed',
            isMock: false,
            crackDetected: Boolean(result.crackDetected),
            crackCount: Number(result.crackCount || 0),
            confidence: Number(result.confidence || 0.0),
            detections: Array.isArray(result.detections) ? result.detections : [],
            image_dimensions: result.image_dimensions || null,
            model_metadata: result.model_metadata || null,
            imageUrl: imageUrl,
            processedAt: new Date().toISOString(),
            note: 'Real YOLOv8 inference executed with ml/best.pt'
          });
        } catch (parseErr) {
          const mlErr = new Error(`Failed to parse ML inference output: ${parseErr.message}`);
          mlErr.code = 'ML_PARSE_ERROR';
          mlErr.rawOutput = stdout;
          reject(mlErr);
        }
      });
    });
  }
}

module.exports = new MlService();
