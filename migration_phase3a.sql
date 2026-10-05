-- ============================================================================
-- SetuSight — Phase 3A Database Migration
-- Multi-Image Inspection Sessions & Patch Details
-- ============================================================================

-- 1. Create table for individual inspection patch images
CREATE TABLE IF NOT EXISTS inspection_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    cloudinary_public_id TEXT NOT NULL,
    patch_label VARCHAR(100) DEFAULT 'Patch 1',
    image_dimensions JSONB DEFAULT '{"width": 0, "height": 0}'::jsonb,
    crack_count INTEGER NOT NULL DEFAULT 0,
    crack_severity VARCHAR(50) NOT NULL DEFAULT 'none' CHECK (crack_severity IN ('pending', 'none', 'low', 'moderate', 'high', 'critical')),
    detection_confidence NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    detection_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    local_condition_score NUMERIC(5, 2) NOT NULL DEFAULT 100.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_images_inspection_id ON inspection_images(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_images_severity ON inspection_images(crack_severity);

-- 2. Backfill existing single-image inspections into inspection_images (preserve historical data)
INSERT INTO inspection_images (
    inspection_id,
    image_url,
    cloudinary_public_id,
    patch_label,
    image_dimensions,
    crack_count,
    crack_severity,
    detection_confidence,
    detection_data,
    local_condition_score,
    created_at
)
SELECT
    i.id AS inspection_id,
    i.image_url,
    i.cloudinary_public_id,
    'Patch 1 (Historical)' AS patch_label,
    COALESCE(i.detection_data->'image_dimensions', '{"width": 0, "height": 0}'::jsonb) AS image_dimensions,
    i.crack_count,
    i.crack_severity,
    i.detection_confidence,
    i.detection_data,
    i.health_score AS local_condition_score,
    i.created_at
FROM inspections i
WHERE NOT EXISTS (
    SELECT 1 FROM inspection_images img WHERE img.inspection_id = i.id
)
AND i.image_url IS NOT NULL;

-- 3. Add comment documenting Phase 3A schema evolution
COMMENT ON TABLE inspection_images IS 'Stores individual concrete patch images, local YOLOv8 detections, and local condition scores for multi-image inspection sessions.';
