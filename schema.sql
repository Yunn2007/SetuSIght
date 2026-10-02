-- ============================================================================
-- SetuSight: Smart Bridge Health Monitoring & Asset Management System
-- Supabase PostgreSQL Relational Schema DDL
-- ============================================================================

-- Enable pgcrypto / uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLE: users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'inspector', 'contractor')),
    contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast auth lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_contractor ON users(contractor_id);

-- ----------------------------------------------------------------------------
-- 2. TABLE: contractors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    flag_status VARCHAR(50) NOT NULL DEFAULT 'Normal' CHECK (flag_status IN ('Normal', 'Yellow / Review', 'Red / Escalated Review')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractors_flag ON contractors(flag_status);

-- ----------------------------------------------------------------------------
-- 3. TABLE: bridges
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bridges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bridge_id VARCHAR(50) UNIQUE NOT NULL,
    bridge_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    construction_year INTEGER NOT NULL,
    design_life INTEGER NOT NULL DEFAULT 50,
    material VARCHAR(100) NOT NULL,
    bridge_type VARCHAR(100) NOT NULL,
    length NUMERIC(10, 2),
    width NUMERIC(10, 2),
    contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
    current_health_score NUMERIC(5, 2) NOT NULL DEFAULT 100.0,
    current_health_status VARCHAR(50) NOT NULL DEFAULT 'Good' CHECK (current_health_status IN ('Good', 'Moderate', 'Attention Required')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bridges_bridge_id ON bridges(bridge_id);
CREATE INDEX IF NOT EXISTS idx_bridges_status ON bridges(current_health_status);
CREATE INDEX IF NOT EXISTS idx_bridges_location ON bridges(location);
CREATE INDEX IF NOT EXISTS idx_bridges_contractor ON bridges(contractor_id);

-- ----------------------------------------------------------------------------
-- 4. TABLE: inspections
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bridge_id UUID NOT NULL REFERENCES bridges(id) ON DELETE CASCADE,
    inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    image_url TEXT NOT NULL,
    cloudinary_public_id TEXT NOT NULL,
    crack_count INTEGER NOT NULL DEFAULT 0,
    crack_severity VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (crack_severity IN ('pending', 'none', 'low', 'moderate', 'high', 'critical')),
    detection_confidence NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    detection_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    health_score NUMERIC(5, 2) NOT NULL DEFAULT 100.0,
    health_status VARCHAR(50) NOT NULL DEFAULT 'Good' CHECK (health_status IN ('Good', 'Moderate', 'Attention Required')),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspections_bridge_id ON inspections(bridge_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector ON inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_inspections_severity ON inspections(crack_severity);

-- ----------------------------------------------------------------------------
-- 5. TABLE: maintenance
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bridge_id UUID NOT NULL REFERENCES bridges(id) ON DELETE CASCADE,
    contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL,
    completion_date DATE,
    priority VARCHAR(50) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Overdue')),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_bridge_id ON maintenance(bridge_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_contractor ON maintenance(contractor_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_priority ON maintenance(priority);

-- ----------------------------------------------------------------------------
-- 6. TABLE: notifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    bridge_id UUID REFERENCES bridges(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL CHECK (type IN ('inspection_due', 'critical_finding', 'maintenance_required', 'maintenance_due', 'maintenance_completed', 'contractor_assigned')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, is_read);

-- ----------------------------------------------------------------------------
-- 7. TABLE: reports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bridge_id UUID NOT NULL REFERENCES bridges(id) ON DELETE CASCADE,
    inspection_id UUID REFERENCES inspections(id) ON DELETE SET NULL,
    report_type VARCHAR(100) NOT NULL CHECK (report_type IN ('Inspection Report', 'Maintenance Report', 'Bridge History Report')),
    file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_bridge ON reports(bridge_id);
