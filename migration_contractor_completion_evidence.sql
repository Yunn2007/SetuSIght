-- ============================================================================
-- SetuSight: Migration — Contractor Completion & Repair Evidence Schema
-- Adds the maintenance_evidence table for before/progress/after repair photos
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_id UUID NOT NULL REFERENCES maintenance(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    cloudinary_public_id TEXT,
    evidence_type VARCHAR(50) NOT NULL CHECK (evidence_type IN ('before', 'progress', 'after')),
    caption TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_evidence_maintenance ON maintenance_evidence(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_evidence_type ON maintenance_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_maintenance_evidence_created ON maintenance_evidence(created_at);

-- Add comment for database documentation
COMMENT ON TABLE maintenance_evidence IS 'Stores before, during, and after repair photographic evidence uploaded by contractors or admins for maintenance work orders.';
