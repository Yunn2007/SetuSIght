#!/usr/bin/env python3
"""
SetuSight — Real YOLOv8 Crack Detection Inference Service
Loads ml/best.pt and runs real inference on inspection images.
Outputs standardized JSON result to stdout.
"""

import sys
import os
import json
import argparse
import tempfile
import urllib.request
import urllib.error
from pathlib import Path

# Suppress ultralytics logging noise to keep stdout strictly clean JSON
os.environ["YOLO_VERBOSE"] = "False"

try:
    from ultralytics import YOLO
    from PIL import Image
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Required Python packages not installed: {str(e)}"
    }))
    sys.exit(1)


def is_url(path_str):
    """Check if the provided input is a web URL."""
    return path_str.startswith("http://") or path_str.startswith("https://")


def download_image_to_temp(image_url):
    """
    Downloads an image from a URL to a temporary local file with timeout and safety headers.
    Returns the path to the temp file.
    """
    headers = {
        "User-Agent": "SetuSight-Inference-Engine/1.0 (Infrastructure Structural Health Monitoring)"
    }
    req = urllib.request.Request(image_url, headers=headers)
    
    # 20 second timeout for network requests
    with urllib.request.urlopen(req, timeout=20) as response:
        content_type = response.info().get_content_type()
        # Ensure we got an image or valid octet stream
        data = response.read()
        if len(data) == 0:
            raise ValueError("Downloaded image payload is empty (0 bytes).")

    # Determine extension
    ext = ".jpg"
    if "png" in content_type:
        ext = ".png"
    elif "webp" in content_type:
        ext = ".webp"

    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    try:
        tmp.write(data)
        tmp.flush()
        return tmp.name
    finally:
        tmp.close()


def run_inference(image_input, model_path="ml/best.pt", conf_threshold=0.25):
    """
    Executes real YOLOv8 inference on image_input (local path or URL).
    Returns a standardized dictionary.
    """
    # 1. Verify model exists
    if not os.path.exists(model_path):
        return {
            "success": False,
            "error": f"Model weights file not found at: {model_path}"
        }

    # 2. Resolve image source
    temp_file_created = None
    target_image_path = image_input

    try:
        if is_url(image_input):
            try:
                temp_file_created = download_image_to_temp(image_input)
                target_image_path = temp_file_created
            except Exception as dl_err:
                return {
                    "success": False,
                    "error": f"Failed to download image from URL: {str(dl_err)}"
                }
        else:
            if not os.path.exists(target_image_path):
                return {
                    "success": False,
                    "error": f"Local image file not found: {target_image_path}"
                }

        # 3. Validate image integrity using PIL
        try:
            with Image.open(target_image_path) as img:
                img.verify()
            # Reopen to read dimensions after verify
            with Image.open(target_image_path) as img:
                img_width, img_height = img.size
        except Exception as img_err:
            return {
                "success": False,
                "error": f"Invalid or unreadable image file: {str(img_err)}"
            }

        # 4. Load YOLO model
        try:
            model = YOLO(model_path)
        except Exception as model_err:
            return {
                "success": False,
                "error": f"Failed to load YOLOv8 model from {model_path}: {str(model_err)}"
            }

        # 5. Run inference
        try:
            results = model.predict(
                source=target_image_path,
                conf=conf_threshold,
                verbose=False,
                device="cpu"
            )
        except Exception as inf_err:
            return {
                "success": False,
                "error": f"YOLOv8 inference execution error: {str(inf_err)}"
            }

        # 6. Parse detection results
        detections = []
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                label = model.names.get(cls_id, "crack")
                confidence = float(box.conf[0].item())
                xyxy = box.xyxy[0].tolist()

                detections.append({
                    "label": label,
                    "confidence": round(confidence, 4),
                    "bbox": [round(float(c), 2) for c in xyxy]
                })

        crack_count = len(detections)
        crack_detected = crack_count > 0

        # Primary confidence: highest detection certainty, or 0.0 if none
        if crack_detected:
            primary_confidence = round(max(d["confidence"] for d in detections), 4)
        else:
            primary_confidence = 0.0

        return {
            "success": True,
            "crackDetected": crack_detected,
            "crackCount": crack_count,
            "confidence": primary_confidence,
            "detections": detections,
            "image_dimensions": {
                "width": img_width,
                "height": img_height
            },
            "model_metadata": {
                "model_file": os.path.basename(model_path),
                "conf_threshold": conf_threshold,
                "classes": model.names
            }
        }

    finally:
        # 7. Clean up any temporary file
        if temp_file_created and os.path.exists(temp_file_created):
            try:
                os.remove(temp_file_created)
            except OSError:
                pass


def main():
    parser = argparse.ArgumentParser(description="SetuSight YOLOv8 Crack Detection Inference")
    parser.add_argument("image", help="Path to local image or HTTP/HTTPS image URL")
    parser.add_argument("--model", default="ml/best.pt", help="Path to trained YOLOv8 weights (.pt)")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")

    args = parser.parse_args()

    result = run_inference(
        image_input=args.image,
        model_path=args.model,
        conf_threshold=args.conf
    )

    # Print strict single-line JSON to stdout
    print(json.dumps(result))

    if not result.get("success", False):
        sys.exit(1)


if __name__ == "__main__":
    main()
