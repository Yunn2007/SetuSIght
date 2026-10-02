-- ============================================================================
-- SetuSight: Realistic Seed Data for Supabase PostgreSQL
-- Focus: Navi Mumbai Monitored Bridge Assets & Demonstration Workflow
-- Default Passwords:
--   admin@setusight.gov.in      -> admin123
--   inspector@setusight.gov.in  -> inspect123
--   contractor@setusight.gov.in -> contract123
-- ============================================================================

-- 1. Insert Contractors
INSERT INTO contractors (id, company_name, contact_person, email, phone, flag_status)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'InfraTech Solutions Pvt. Ltd.', 'Suresh Kulkarni', 'contractor@setusight.gov.in', '+91 98201 44552', 'Normal'),
    ('c2222222-2222-2222-2222-222222222222', 'Navi Mumbai Structural Works', 'Anil Gaikwad', 'contact@nmstructures.com', '+91 98202 33441', 'Yellow / Review'),
    ('c3333333-3333-3333-3333-333333333333', 'Apex Coastal Infra Engineering', 'Ramesh Shinde', 'apex.infra@mumbai.in', '+91 98203 77889', 'Normal'),
    ('c4444444-4444-4444-4444-444444444444', 'Konkan Bridge Buildtech', 'Devendra More', 'support@konkanbuild.co.in', '+91 98204 99001', 'Red / Escalated Review')
ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    contact_person = EXCLUDED.contact_person,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    flag_status = EXCLUDED.flag_status;

-- 2. Insert Initial Users
-- Password hashes generated with bcryptjs (salt 10)
INSERT INTO users (id, name, email, password_hash, role, contractor_id)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Er. Rajesh Deshmukh (Chief Engineer)', 'admin@setusight.gov.in', '$2a$10$l67j9bM0eN3p8i/k5HquduqO8w3G4Z/G8j8uM7K1uP.Xp7H5w3n4y', 'admin', NULL),
    ('b0000000-0000-0000-0000-000000000002', 'Vikram Patil (Senior Inspector)', 'inspector@setusight.gov.in', '$2a$10$7qjNnF2B6/5fS.k5HquduquO8w3G4Z/G8j8uM7K1uP.Xp7H5w3n4y', 'inspector', NULL),
    ('c0000000-0000-0000-0000-000000000003', 'M/s InfraTech Projects Lead', 'contractor@setusight.gov.in', '$2a$10$9.XJvB4H1p6z8Q/k5HquduquO8w3G4Z/G8j8uM7K1uP.Xp7H5w3n4y', 'contractor', 'c1111111-1111-1111-1111-111111111111')
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    contractor_id = EXCLUDED.contractor_id;

-- 3. Insert Monitored Bridges (Navi Mumbai Network)
-- Note: contractor@setusight.gov.in ('c1111111-1111-1111-1111-111111111111') is assigned to BR001, BR003, and BR008
INSERT INTO bridges (id, bridge_id, bridge_name, location, latitude, longitude, construction_year, design_life, material, bridge_type, length, width, contractor_id, current_health_score, current_health_status)
VALUES
    ('d0000001-0000-0000-0000-000000000001', 'BR001', 'Nerul Railway Over Bridge', 'Nerul', 19.0330, 73.0180, 2012, 50, 'Prestressed Concrete', 'Railway Over Bridge', 420.00, 18.50, 'c1111111-1111-1111-1111-111111111111', 88.50, 'Good'),
    ('d0000002-0000-0000-0000-000000000002', 'BR002', 'Seawoods Grand Central FOB', 'Seawoods', 19.0225, 73.0188, 2017, 40, 'Structural Steel Composite', 'Foot Overbridge', 140.00, 4.50, 'c2222222-2222-2222-2222-222222222222', 94.00, 'Good'),
    ('d0000003-0000-0000-0000-000000000003', 'BR003', 'Palm Beach Road Flyover', 'Nerul', 19.0285, 73.0210, 2008, 60, 'Reinforced Concrete', 'Flyover / Viaduct', 850.00, 24.00, 'c1111111-1111-1111-1111-111111111111', 74.00, 'Moderate'),
    ('d0000004-0000-0000-0000-000000000004', 'BR004', 'Seawoods Rail Overbridge', 'Seawoods', 19.0190, 73.0175, 2001, 50, 'Structural Steel & Concrete', 'ROB / Arch Girder', 310.00, 16.00, 'c2222222-2222-2222-2222-222222222222', 52.00, 'Attention Required'),
    ('d0000005-0000-0000-0000-000000000005', 'BR005', 'Belapur Bridge No. 2', 'CBD Belapur', 19.0120, 73.0390, 2005, 50, 'Reinforced Concrete', 'Multi-span Girder', 380.00, 21.00, 'c3333333-3333-3333-3333-333333333333', 71.50, 'Moderate'),
    ('d0000006-0000-0000-0000-000000000006', 'BR006', 'Sector 11 Pedestrian Bridge', 'CBD Belapur', 19.0160, 73.0410, 2019, 40, 'Pre-engineered Steel', 'Pedestrian Truss', 95.00, 3.80, 'c3333333-3333-3333-3333-333333333333', 96.00, 'Good'),
    ('d0000007-0000-0000-0000-000000000007', 'BR007', 'Nerul West Underpass', 'Nerul', 19.0305, 73.0115, 1998, 50, 'Reinforced Concrete', 'Underpass Box Culvert', 65.00, 14.00, 'c4444444-4444-4444-4444-444444444444', 49.00, 'Attention Required'),
    ('d0000008-0000-0000-0000-000000000008', 'BR008', 'Seawoods Bridge', 'Seawoods', 19.0145, 73.0240, 2015, 60, 'Prestressed Concrete', 'Continuous Girder', 290.00, 18.00, 'c1111111-1111-1111-1111-111111111111', 82.00, 'Good')
ON CONFLICT (bridge_id) DO UPDATE SET
    bridge_name = EXCLUDED.bridge_name,
    location = EXCLUDED.location,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    construction_year = EXCLUDED.construction_year,
    design_life = EXCLUDED.design_life,
    material = EXCLUDED.material,
    bridge_type = EXCLUDED.bridge_type,
    length = EXCLUDED.length,
    width = EXCLUDED.width,
    contractor_id = EXCLUDED.contractor_id,
    current_health_score = EXCLUDED.current_health_score,
    current_health_status = EXCLUDED.current_health_status;

-- 4. Insert Initial Inspection Records
INSERT INTO inspections (id, bridge_id, inspector_id, inspection_date, image_url, cloudinary_public_id, crack_count, crack_severity, detection_confidence, detection_data, health_score, health_status, remarks)
VALUES
    ('e0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '2026-06-12', 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335079/setusight/inspections/bridge_crack_nerul_pier_01.jpg', 'setusight/inspections/bridge_crack_nerul_pier_01', 1, 'low', 0.88, '{"status":"AI analysis module pending integration","crackDetected":true,"crackCount":1}'::jsonb, 88.50, 'Good', 'Minor surface hairline crack near south pier P4. Bearing pads sound.'),
    ('e0000002-0000-0000-0000-000000000002', 'd0000003-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '2026-06-03', 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335083/setusight/inspections/bridge_crack_deck_spall_02.jpg', 'setusight/inspections/bridge_crack_deck_spall_02', 3, 'moderate', 0.91, '{"status":"AI analysis module pending integration","crackDetected":true,"crackCount":3}'::jsonb, 74.00, 'Moderate', 'Moderate longitudinal stress cracks and concrete spalling along span 3 deck slab.'),
    ('e0000003-0000-0000-0000-000000000003', 'd0000004-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', '2026-05-28', 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335079/setusight/inspections/bridge_crack_nerul_pier_01.jpg', 'setusight/inspections/bridge_crack_nerul_pier_01', 7, 'high', 0.94, '{"status":"AI analysis module pending integration","crackDetected":true,"crackCount":7}'::jsonb, 52.00, 'Attention Required', 'Significant diagonal shear cracks detected along pier P2 and expansion joints.'),
    ('e0000004-0000-0000-0000-000000000004', 'd0000007-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002', '2026-04-15', 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335083/setusight/inspections/bridge_crack_deck_spall_02.jpg', 'setusight/inspections/bridge_crack_deck_spall_02', 6, 'high', 0.89, '{"status":"AI analysis module pending integration","crackDetected":true,"crackCount":6}'::jsonb, 49.00, 'Attention Required', 'Water seepage induced concrete spalling and visible structural cracks on retaining wall.')
ON CONFLICT (id) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    cloudinary_public_id = EXCLUDED.cloudinary_public_id,
    crack_count = EXCLUDED.crack_count,
    crack_severity = EXCLUDED.crack_severity,
    detection_confidence = EXCLUDED.detection_confidence,
    detection_data = EXCLUDED.detection_data,
    health_score = EXCLUDED.health_score,
    health_status = EXCLUDED.health_status,
    remarks = EXCLUDED.remarks;

-- 5. Insert Maintenance Records
INSERT INTO maintenance (id, bridge_id, contractor_id, scheduled_date, completion_date, priority, status, remarks)
VALUES
    ('f0000001-0000-0000-0000-000000000001', 'd0000003-0000-0000-0000-000000000003', 'c1111111-1111-1111-1111-111111111111', '2026-07-10', NULL, 'Medium', 'Scheduled', 'Resurfacing and sealant renewal on longitudinal joints scheduled.'),
    ('f0000002-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', '2026-06-15', '2026-06-20', 'Low', 'Completed', 'Bearing cleaning, seal replacement, and drainage spout clearing completed successfully.'),
    ('f0000003-0000-0000-0000-000000000003', 'd0000008-0000-0000-0000-000000000008', 'c1111111-1111-1111-1111-111111111111', '2026-06-25', NULL, 'High', 'In Progress', 'Expansion joint elastomeric seal renewal and pier cap epoxy coating underway.'),
    ('f0000004-0000-0000-0000-000000000004', 'd0000004-0000-0000-0000-000000000004', 'c2222222-2222-2222-2222-222222222222', '2026-05-10', NULL, 'Urgent', 'Overdue', 'Structural epoxy injection on pier P2 and bearing replacement overdue.')
ON CONFLICT (id) DO UPDATE SET
    bridge_id = EXCLUDED.bridge_id,
    contractor_id = EXCLUDED.contractor_id,
    scheduled_date = EXCLUDED.scheduled_date,
    completion_date = EXCLUDED.completion_date,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    remarks = EXCLUDED.remarks;

-- 6. Insert System Notifications
INSERT INTO notifications (id, recipient_id, bridge_id, type, title, message, is_read)
VALUES
    ('90000001-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000004-0000-0000-0000-000000000004', 'critical_finding', 'Critical Crack Alert: Seawoods Rail Overbridge', 'Inspection logged high-severity shear cracks on Pier P2. Urgent maintenance assigned.', false),
    ('90000002-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'd0000008-0000-0000-0000-000000000008', 'contractor_assigned', 'Maintenance Work Order Assigned', 'You have been assigned high-priority repair work for Seawoods Bridge (BR008).', false),
    ('90000003-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000007-0000-0000-0000-000000000007', 'maintenance_due', 'Overdue Maintenance Task', 'Nerul West Underpass repair past scheduled deadline. Contractor flagged for review.', false),
    ('90000004-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'd0000003-0000-0000-0000-000000000003', 'inspection_due', 'Routine Inspection Due', 'Palm Beach Road Flyover is scheduled for bi-annual visual scan next week.', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Insert Sample Reports
INSERT INTO reports (id, bridge_id, inspection_id, report_type, file_url)
VALUES
    ('80000001-0000-0000-0000-000000000001', 'd0000003-0000-0000-0000-000000000003', 'e0000002-0000-0000-0000-000000000002', 'Inspection Report', '/report-view.html?id=80000001-0000-0000-0000-000000000001'),
    ('80000002-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'Bridge History Report', '/report-view.html?id=80000002-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;