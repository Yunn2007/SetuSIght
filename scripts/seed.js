/**
 * SetuSight — Supabase Direct Database Seeder
 * Populates tables in Supabase with realistic initial demo data.
 * Fully compatible with schema.sql and idempotent.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_KEY;
if (supabaseKey && supabaseKey.startsWith('sbeyJ')) {
  supabaseKey = supabaseKey.substring(2);
}

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project')) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in .env before running seed.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🚀 Seeding Supabase database for SetuSight...');

  try {
    // 1. Seed Contractors
    const contractors = [
      {
        id: 'c0000000-0000-0000-0000-000000000001',
        contractor_code: 'C001',
        company_name: 'InfraTech Bridge Systems',
        contact_person: 'Suresh Kulkarni',
        email: 'contractor@setusight.gov.in',
        phone: '+91 98201 44552',
        flag_status: 'Normal'
      },
      {
        id: 'c0000000-0000-0000-0000-000000000002',
        contractor_code: 'C002',
        company_name: 'Navi Mumbai Infrastructure Works',
        contact_person: 'Anil Gaikwad',
        email: 'contact@nmstructures.com',
        phone: '+91 98202 33441',
        flag_status: 'Yellow / Review'
      },
      {
        id: 'c0000000-0000-0000-0000-000000000003',
        contractor_code: 'C003',
        company_name: 'Apex Structural Engineering',
        contact_person: 'Ramesh Shinde',
        email: 'apex.infra@mumbai.in',
        phone: '+91 98203 77889',
        flag_status: 'Normal'
      },
      {
        id: 'c0000000-0000-0000-0000-000000000004',
        contractor_code: 'C004',
        company_name: 'Konkan Bridge Buildtech',
        contact_person: 'Devendra More',
        email: 'support@konkanbuild.co.in',
        phone: '+91 98204 99001',
        flag_status: 'Red / Escalated Review'
      },
      {
        id: 'c0000000-0000-0000-0000-000000000005',
        contractor_code: 'C005',
        company_name: 'Coastal Infrastructure Solutions',
        contact_person: 'Prakash Patil',
        email: 'info@coastalinfra.in',
        phone: '+91 98205 11223',
        flag_status: 'Normal'
      }
    ];

    const { error: contractorError } = await supabase.from('contractors').upsert(contractors, { onConflict: 'id' });
    if (contractorError) console.warn('Contractors seed warning:', contractorError.message);
    else console.log('✅ Contractors seeded');

    // 2. Seed Users
    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('admin123', salt);
    const inspectorPass = await bcrypt.hash('inspect123', salt);
    const contractorPass = await bcrypt.hash('contract123', salt);

    const users = [
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        user_code: 'A001',
        name: 'Er. Rajesh Deshmukh (Chief Engineer)',
        email: 'admin@setusight.gov.in',
        password_hash: adminPass,
        role: 'admin',
        contractor_id: null
      },
      {
        id: 'b0000000-0000-0000-0000-000000000001',
        user_code: 'I001',
        name: 'Vikram Patil (Senior Inspector)',
        email: 'inspector@setusight.gov.in',
        password_hash: inspectorPass,
        role: 'inspector',
        contractor_id: null
      },
      {
        id: 'c0000000-0000-0000-0000-000000000006',
        user_code: 'U001',
        name: 'M/s InfraTech Projects Lead',
        email: 'contractor@setusight.gov.in',
        password_hash: contractorPass,
        role: 'contractor',
        contractor_id: 'c0000000-0000-0000-0000-000000000001'
      }
    ];

    const { error: userError } = await supabase.from('users').upsert(users, { onConflict: 'email' });
    if (userError) console.warn('Users seed warning:', userError.message);
    else console.log('✅ Users seeded');

    // 3. Seed Bridges (Navi Mumbai Network)
    const bridges = [
      {
        id: 'd0000000-0000-0000-0000-000000000001',
        bridge_id: 'BR001',
        bridge_name: 'Nerul Railway Over Bridge',
        location: 'Nerul',
        construction_year: 2012,
        design_life: 50,
        material: 'Prestressed Concrete',
        bridge_type: 'Railway Over Bridge',
        length: 420.00,
        width: 18.50,
        contractor_id: 'c0000000-0000-0000-0000-000000000001',
        last_maintenance_date: '2024-06-15',
        next_maintenance_date: '2029-06-15',
        maintenance_cycle_years: 5,
        current_health_score: 88.50,
        current_health_status: 'Good'
      },
      {
        id: 'd0000000-0000-0000-0000-000000000002',
        bridge_id: 'BR002',
        bridge_name: 'Seawoods Railway Over Bridge',
        location: 'Seawoods',
        construction_year: 2017,
        design_life: 40,
        material: 'Structural Steel Composite',
        bridge_type: 'Railway Over Bridge',
        length: 140.00,
        width: 4.50,
        contractor_id: 'c0000000-0000-0000-0000-000000000002',
        last_maintenance_date: '2024-12-05',
        next_maintenance_date: '2029-12-05',
        maintenance_cycle_years: 5,
        current_health_score: 94.00,
        current_health_status: 'Good'
      },
      {
        id: 'd0000000-0000-0000-0000-000000000003',
        bridge_id: 'BR003',
        bridge_name: 'Palm Beach Road Flyover',
        location: 'Nerul',
        construction_year: 2008,
        design_life: 60,
        material: 'Reinforced Concrete',
        bridge_type: 'Flyover / Viaduct',
        length: 850.00,
        width: 24.00,
        contractor_id: 'c0000000-0000-0000-0000-000000000003',
        last_maintenance_date: '2023-09-20',
        next_maintenance_date: '2028-09-20',
        maintenance_cycle_years: 5,
        current_health_score: 74.00,
        current_health_status: 'Moderate'
      },
      {
        id: 'd0000000-0000-0000-0000-000000000004',
        bridge_id: 'BR004',
        bridge_name: 'Nerul Station Foot Over Bridge',
        location: 'Nerul',
        construction_year: 2001,
        design_life: 50,
        material: 'Structural Steel & Concrete',
        bridge_type: 'Foot Overbridge',
        length: 310.00,
        width: 16.00,
        contractor_id: 'c0000000-0000-0000-0000-000000000004',
        last_maintenance_date: '2022-04-12',
        next_maintenance_date: '2027-04-12',
        maintenance_cycle_years: 5,
        current_health_score: 52.00,
        current_health_status: 'Attention Required'
      },
      {
        id: 'd0000000-0000-0000-0000-000000000005',
        bridge_id: 'BR005',
        bridge_name: 'Seawoods Station Foot Over Bridge',
        location: 'Seawoods',
        construction_year: 2005,
        design_life: 50,
        material: 'Reinforced Concrete',
        bridge_type: 'Foot Overbridge',
        length: 380.00,
        width: 21.00,
        contractor_id: 'c0000000-0000-0000-0000-000000000005',
        last_maintenance_date: '2022-08-18',
        next_maintenance_date: '2027-08-18',
        maintenance_cycle_years: 5,
        current_health_score: 71.50,
        current_health_status: 'Moderate'
      },
      {
        id: 'd0000000-0000-0000-0000-000000000006',
        bridge_id: 'BR006',
        bridge_name: 'CBD Belapur Railway Over Bridge',
        location: 'CBD Belapur',
        construction_year: 2019,
        design_life: 40,
        material: 'Pre-engineered Steel',
        bridge_type: 'Railway Over Bridge',
        length: 95.00,
        width: 3.80,
        contractor_id: 'c0000000-0000-0000-0000-000000000001',
        last_maintenance_date: '2024-01-10',
        next_maintenance_date: '2029-01-10',
        maintenance_cycle_years: 5,
        current_health_score: 96.00,
        current_health_status: 'Good'
      },
      {
        id: 'd0000000-0000-0000-0000-000000000007',
        bridge_id: 'BR007',
        bridge_name: 'Belapur Flyover',
        location: 'CBD Belapur',
        construction_year: 1998,
        design_life: 50,
        material: 'Reinforced Concrete',
        bridge_type: 'Flyover / Viaduct',
        length: 65.00,
        width: 14.00,
        contractor_id: 'c0000000-0000-0000-0000-000000000002',
        last_maintenance_date: '2021-11-05',
        next_maintenance_date: '2026-11-05',
        maintenance_cycle_years: 5,
        current_health_score: 49.00,
        current_health_status: 'Attention Required'
      },
      {
        id: 'd0000000-0000-0000-0000-000000000008',
        bridge_id: 'BR008',
        bridge_name: 'Seawoods Bridge',
        location: 'Seawoods',
        construction_year: 2015,
        design_life: 60,
        material: 'Prestressed Concrete',
        bridge_type: 'Continuous Girder',
        length: 290.00,
        width: 18.00,
        contractor_id: 'c0000000-0000-0000-0000-000000000003',
        last_maintenance_date: '2024-07-30',
        next_maintenance_date: '2029-07-30',
        maintenance_cycle_years: 5,
        current_health_score: 82.00,
        current_health_status: 'Good'
      }
    ];

    const { error: bridgeError } = await supabase.from('bridges').upsert(bridges, { onConflict: 'id' });
    if (bridgeError) console.warn('Bridges seed warning:', bridgeError.message);
    else console.log('✅ Bridges seeded');

    // 4. Seed Inspections with Real Crack Evidence Photos
    const inspections = [
      {
        id: 'e0000000-0000-0000-0000-000000000001',
        inspection_code: 'INS001',
        bridge_id: 'd0000000-0000-0000-0000-000000000001',
        inspector_id: 'b0000000-0000-0000-0000-000000000001',
        inspection_date: '2026-06-12',
        image_url: 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335079/setusight/inspections/bridge_crack_nerul_pier_01.jpg',
        cloudinary_public_id: 'setusight/inspections/bridge_crack_nerul_pier_01',
        crack_count: 1,
        crack_severity: 'low',
        detection_confidence: 0.88,
        detection_data: { status: 'AI analysis completed', crackDetected: true, crackCount: 1 },
        health_score: 88.50,
        health_status: 'Good',
        remarks: 'Minor surface hairline crack near south pier P4. Bearing pads sound.'
      },
      {
        id: 'e0000000-0000-0000-0000-000000000002',
        inspection_code: 'INS002',
        bridge_id: 'd0000000-0000-0000-0000-000000000003',
        inspector_id: 'b0000000-0000-0000-0000-000000000001',
        inspection_date: '2026-06-03',
        image_url: 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335083/setusight/inspections/bridge_crack_deck_spall_02.jpg',
        cloudinary_public_id: 'setusight/inspections/bridge_crack_deck_spall_02',
        crack_count: 3,
        crack_severity: 'moderate',
        detection_confidence: 0.91,
        detection_data: { status: 'AI analysis completed', crackDetected: true, crackCount: 3 },
        health_score: 74.00,
        health_status: 'Moderate',
        remarks: 'Moderate longitudinal stress cracks and concrete spalling along span 3 deck slab.'
      }
    ];

    const { error: inspError } = await supabase.from('inspections').upsert(inspections, { onConflict: 'id' });
    if (inspError) console.warn('Inspections seed warning:', inspError.message);
    else console.log('✅ Inspections seeded');

    // 4b. Seed Inspection Images (Multi-Patch Relational Children)
    const inspectionImages = [
      {
        id: '70000001-0000-0000-0000-000000000001',
        inspection_id: 'e0000000-0000-0000-0000-000000000001',
        image_url: 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335079/setusight/inspections/bridge_crack_nerul_pier_01.jpg',
        cloudinary_public_id: 'setusight/inspections/bridge_crack_nerul_pier_01',
        patch_label: 'Patch 1 (South Pier P4)',
        image_dimensions: { width: 1376, height: 768 },
        crack_count: 1,
        crack_severity: 'low',
        detection_confidence: 0.88,
        detection_data: { detections: [{ bbox: [374.7, 242.3, 1208.9, 764.5], confidence: 0.88, label: 'crack', severity_level: 'low' }] },
        local_condition_score: 88.50
      },
      {
        id: '70000002-0000-0000-0000-000000000002',
        inspection_id: 'e0000000-0000-0000-0000-000000000002',
        image_url: 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335083/setusight/inspections/bridge_crack_deck_spall_02.jpg',
        cloudinary_public_id: 'setusight/inspections/bridge_crack_deck_spall_02',
        patch_label: 'Patch 1 (Span 3 Deck)',
        image_dimensions: { width: 1376, height: 768 },
        crack_count: 3,
        crack_severity: 'moderate',
        detection_confidence: 0.91,
        detection_data: { detections: [{ bbox: [276.4, 79.0, 1209.0, 759.7], confidence: 0.91, label: 'crack', severity_level: 'moderate' }] },
        local_condition_score: 74.00
      }
    ];

    const { error: imgError } = await supabase.from('inspection_images').upsert(inspectionImages, { onConflict: 'id' });
    if (imgError) console.warn('Inspection images seed notice (may await schema migration):', imgError.message);
    else console.log('✅ Inspection images seeded');

    // 5. Seed Maintenance
    const maintenance = [
      {
        id: 'f0000000-0000-0000-0000-000000000001',
        maintenance_code: 'M001',
        bridge_id: 'd0000000-0000-0000-0000-000000000002',
        contractor_id: 'c0000000-0000-0000-0000-000000000002',
        scheduled_date: '2026-07-10',
        completion_date: null,
        priority: 'Medium',
        status: 'Scheduled',
        remarks: 'Resurfacing and sealant renewal on longitudinal joints scheduled.'
      },
      {
        id: 'f0000000-0000-0000-0000-000000000002',
        maintenance_code: 'M002',
        bridge_id: 'd0000000-0000-0000-0000-000000000007',
        contractor_id: 'c0000000-0000-0000-0000-000000000004',
        scheduled_date: '2026-06-15',
        completion_date: '2026-06-20',
        priority: 'Low',
        status: 'Completed',
        remarks: 'Bearing cleaning, seal replacement, and drainage spout clearing completed successfully.'
      },
      {
        id: 'f0000000-0000-0000-0000-000000000003',
        maintenance_code: 'M003',
        bridge_id: 'd0000000-0000-0000-0000-000000000001',
        contractor_id: 'c0000000-0000-0000-0000-000000000001',
        scheduled_date: '2026-06-25',
        completion_date: null,
        priority: 'High',
        status: 'In Progress',
        remarks: 'Expansion joint elastomeric seal renewal and pier cap epoxy coating underway.'
      },
      {
        id: 'f0000000-0000-0000-0000-000000000004',
        maintenance_code: 'M004',
        bridge_id: 'd0000000-0000-0000-0000-000000000003',
        contractor_id: 'c0000000-0000-0000-0000-000000000003',
        scheduled_date: '2026-05-10',
        completion_date: null,
        priority: 'Urgent',
        status: 'Overdue',
        remarks: 'Structural epoxy injection on pier P2 and bearing replacement overdue.'
      }
    ];

    const { error: maintError } = await supabase.from('maintenance').upsert(maintenance, { onConflict: 'id' });
    if (maintError) console.warn('Maintenance seed warning:', maintError.message);
    else console.log('✅ Maintenance seeded');

    // 6. Seed Notifications
    const notifications = [
      {
        id: '90000000-0000-0000-0000-000000000001',
        notification_code: 'N001',
        recipient_id: 'a0000000-0000-0000-0000-000000000001',
        bridge_id: 'd0000000-0000-0000-0000-000000000004',
        type: 'critical_finding',
        title: 'Critical Crack Alert: Seawoods Rail Overbridge',
        message: 'Inspection logged high-severity shear cracks on Pier P2. Urgent maintenance assigned.',
        is_read: false
      },
      {
        id: '90000000-0000-0000-0000-000000000002',
        notification_code: 'N002',
        recipient_id: 'c0000000-0000-0000-0000-000000000006',
        bridge_id: 'd0000000-0000-0000-0000-000000000008',
        type: 'contractor_assigned',
        title: 'Maintenance Work Order Assigned',
        message: 'You have been assigned high-priority repair work for Seawoods Bridge (BR008).',
        is_read: false
      }
    ];
    const { error: notifError } = await supabase.from('notifications').upsert(notifications, { onConflict: 'id' });
    if (notifError) console.warn('Notifications seed warning:', notifError.message);
    else console.log('✅ Notifications seeded');

    // 7. Seed Reports
    const reports = [
      {
        id: '80000000-0000-0000-0000-000000000001',
        report_code: 'R001',
        bridge_id: 'd0000000-0000-0000-0000-000000000003',
        inspection_id: 'e0000000-0000-0000-0000-000000000002',
        report_type: 'Inspection Report',
        file_url: '/report-view.html?id=80000000-0000-0000-0000-000000000001'
      }
    ];
    const { error: repError } = await supabase.from('reports').upsert(reports, { onConflict: 'id' });
    if (repError) console.warn('Reports seed warning:', repError.message);
    else console.log('✅ Reports seeded');

    console.log('🎉 Supabase database seeding complete with real crack images!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
