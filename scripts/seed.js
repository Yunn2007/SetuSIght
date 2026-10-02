/**
 * SetuSight — Supabase Direct Database Seeder
 * Populates tables in Supabase with realistic initial demo data
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
        id: 'c1111111-1111-1111-1111-111111111111',
        contractor_code: 'C001',
        company_name: 'InfraTech Solutions Pvt. Ltd.',
        contact_person: 'Suresh Kulkarni',
        email: 'contractor@setusight.gov.in',
        phone: '+91 98201 44552',
        flag_status: 'Normal'
      },
      {
        id: 'c2222222-2222-2222-2222-222222222222',
        contractor_code: 'C002',
        company_name: 'Navi Mumbai Structural Works',
        contact_person: 'Anil Gaikwad',
        email: 'contact@nmstructures.com',
        phone: '+91 98202 33441',
        flag_status: 'Yellow / Review'
      },
      {
        id: 'c3333333-3333-3333-3333-333333333333',
        contractor_code: 'C003',
        company_name: 'Apex Coastal Infra Engineering',
        contact_person: 'Ramesh Shinde',
        email: 'apex.infra@mumbai.in',
        phone: '+91 98203 77889',
        flag_status: 'Normal'
      },
      {
        id: 'c4444444-4444-4444-4444-444444444444',
        contractor_code: 'C004',
        company_name: 'Konkan Bridge Buildtech',
        contact_person: 'Devendra More',
        email: 'support@konkanbuild.co.in',
        phone: '+91 98204 99001',
        flag_status: 'Red / Escalated Review'
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
        id: 'b0000000-0000-0000-0000-000000000002',
        user_code: 'I001',
        name: 'Vikram Patil (Senior Inspector)',
        email: 'inspector@setusight.gov.in',
        password_hash: inspectorPass,
        role: 'inspector',
        contractor_id: null
      },
      {
        id: 'c0000000-0000-0000-0000-000000000003',
        user_code: 'U001',
        name: 'M/s InfraTech Projects Lead',
        email: 'contractor@setusight.gov.in',
        password_hash: contractorPass,
        role: 'contractor',
        contractor_id: 'c1111111-1111-1111-1111-111111111111'
      }
    ];

    const { error: userError } = await supabase.from('users').upsert(users, { onConflict: 'email' });
    if (userError) console.warn('Users seed warning:', userError.message);
    else console.log('✅ Users seeded');

    // 3. Seed Bridges (BR001, BR003, BR008 assigned to c1111111-1111-1111-1111-111111111111)
    const bridges = [
      {
        id: 'd0000001-0000-0000-0000-000000000001',
        bridge_id: 'BR001',
        bridge_name: 'Nerul Railway Over Bridge',
        location: 'Nerul',
        construction_year: 2012,
        design_life: 50,
        material: 'Prestressed Concrete',
        bridge_type: 'Railway Over Bridge',
        length: 420.00,
        width: 18.50,
        contractor_id: 'c1111111-1111-1111-1111-111111111111',
        last_maintenance_date: '2024-06-15',
        next_maintenance_date: '2029-06-15',
        maintenance_cycle_years: 5,
        current_health_score: 88.50,
        current_health_status: 'Good'
      },
      {
        id: 'd0000002-0000-0000-0000-000000000002',
        bridge_id: 'BR002',
        bridge_name: 'Seawoods Grand Central FOB',
        location: 'Seawoods',
        construction_year: 2017,
        design_life: 40,
        material: 'Structural Steel Composite',
        bridge_type: 'Foot Overbridge',
        length: 140.00,
        width: 4.50,
        contractor_id: 'c2222222-2222-2222-2222-222222222222',
        last_maintenance_date: '2024-12-05',
        next_maintenance_date: '2029-12-05',
        maintenance_cycle_years: 5,
        current_health_score: 94.00,
        current_health_status: 'Good'
      },
      {
        id: 'd0000003-0000-0000-0000-000000000003',
        bridge_id: 'BR003',
        bridge_name: 'Palm Beach Road Flyover',
        location: 'Nerul',
        construction_year: 2008,
        design_life: 60,
        material: 'Reinforced Concrete',
        bridge_type: 'Flyover / Viaduct',
        length: 850.00,
        width: 24.00,
        contractor_id: 'c1111111-1111-1111-1111-111111111111',
        last_maintenance_date: '2023-09-20',
        next_maintenance_date: '2028-09-20',
        maintenance_cycle_years: 5,
        current_health_score: 74.00,
        current_health_status: 'Moderate'
      },
      {
        id: 'd0000004-0000-0000-0000-000000000004',
        bridge_id: 'BR004',
        bridge_name: 'Seawoods Rail Overbridge',
        location: 'Seawoods',
        construction_year: 2001,
        design_life: 50,
        material: 'Structural Steel & Concrete',
        bridge_type: 'ROB / Arch Girder',
        length: 310.00,
        width: 16.00,
        contractor_id: 'c2222222-2222-2222-2222-222222222222',
        last_maintenance_date: '2022-04-12',
        next_maintenance_date: '2027-04-12',
        maintenance_cycle_years: 5,
        current_health_score: 52.00,
        current_health_status: 'Attention Required'
      },
      {
        id: 'd0000005-0000-0000-0000-000000000005',
        bridge_id: 'BR005',
        bridge_name: 'Belapur Bridge No. 2',
        location: 'CBD Belapur',
        construction_year: 2005,
        design_life: 50,
        material: 'Reinforced Concrete',
        bridge_type: 'Multi-span Girder',
        length: 380.00,
        width: 21.00,
        contractor_id: 'c3333333-3333-3333-3333-333333333333',
        last_maintenance_date: '2022-08-18',
        next_maintenance_date: '2027-08-18',
        maintenance_cycle_years: 5,
        current_health_score: 71.50,
        current_health_status: 'Moderate'
      },
      {
        id: 'd0000006-0000-0000-0000-000000000006',
        bridge_id: 'BR006',
        bridge_name: 'Sector 11 Pedestrian Bridge',
        location: 'CBD Belapur',
        construction_year: 2019,
        design_life: 40,
        material: 'Pre-engineered Steel',
        bridge_type: 'Pedestrian Truss',
        length: 95.00,
        width: 3.80,
        contractor_id: 'c3333333-3333-3333-3333-333333333333',
        last_maintenance_date: '2024-07-30',
        next_maintenance_date: '2029-07-30',
        maintenance_cycle_years: 5,
        current_health_score: 96.00,
        current_health_status: 'Good'
      },
      {
        id: 'd0000007-0000-0000-0000-000000000007',
        bridge_id: 'BR007',
        bridge_name: 'Nerul West Underpass',
        location: 'Nerul',
        construction_year: 1998,
        design_life: 50,
        material: 'Reinforced Concrete',
        bridge_type: 'Underpass Box Culvert',
        length: 65.00,
        width: 14.00,
        contractor_id: 'c4444444-4444-4444-4444-444444444444',
        last_maintenance_date: '2021-03-22',
        next_maintenance_date: '2026-03-22',
        maintenance_cycle_years: 5,
        current_health_score: 49.00,
        current_health_status: 'Attention Required'
      },
      {
        id: 'd0000008-0000-0000-0000-000000000008',
        bridge_id: 'BR008',
        bridge_name: 'Seawoods Bridge',
        location: 'Seawoods',
        construction_year: 2015,
        design_life: 60,
        material: 'Prestressed Concrete',
        bridge_type: 'Continuous Girder',
        length: 290.00,
        width: 18.00,
        contractor_id: 'c1111111-1111-1111-1111-111111111111',
        last_maintenance_date: '2024-07-30',
        next_maintenance_date: '2029-07-30',
        maintenance_cycle_years: 5,
        current_health_score: 82.00,
        current_health_status: 'Good'
      }
    ];

    const { error: bridgeError } = await supabase.from('bridges').upsert(bridges, { onConflict: 'bridge_id' });
    if (bridgeError) console.warn('Bridges seed warning:', bridgeError.message);
    else console.log('✅ Bridges seeded');

    // 4. Seed Inspections with Real Crack Evidence Photos
    const inspections = [
      {
        id: 'e0000001-0000-0000-0000-000000000001',
        inspection_code: 'INS001',
        bridge_id: 'd0000001-0000-0000-0000-000000000001',
        inspector_id: 'b0000000-0000-0000-0000-000000000002',
        inspection_date: '2026-06-12',
        image_url: 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335079/setusight/inspections/bridge_crack_nerul_pier_01.jpg',
        cloudinary_public_id: 'setusight/inspections/bridge_crack_nerul_pier_01',
        crack_count: 1,
        crack_severity: 'low',
        detection_confidence: 0.88,
        detection_data: { status: 'AI analysis module pending integration', crackDetected: true, crackCount: 1 },
        health_score: 88.50,
        health_status: 'Good',
        remarks: 'Minor surface hairline crack near south pier P4. Bearing pads sound.'
      },
      {
        id: 'e0000002-0000-0000-0000-000000000002',
        inspection_code: 'INS002',
        bridge_id: 'd0000003-0000-0000-0000-000000000003',
        inspector_id: 'b0000000-0000-0000-0000-000000000002',
        inspection_date: '2026-06-03',
        image_url: 'https://res.cloudinary.com/c3wesoc5/image/upload/v1787335083/setusight/inspections/bridge_crack_deck_spall_02.jpg',
        cloudinary_public_id: 'setusight/inspections/bridge_crack_deck_spall_02',
        crack_count: 3,
        crack_severity: 'moderate',
        detection_confidence: 0.91,
        detection_data: { status: 'AI analysis module pending integration', crackDetected: true, crackCount: 3 },
        health_score: 74.00,
        health_status: 'Moderate',
        remarks: 'Moderate longitudinal stress cracks and concrete spalling along span 3 deck slab.'
      }
    ];

    const { error: inspError } = await supabase.from('inspections').upsert(inspections, { onConflict: 'id' });
    if (inspError) console.warn('Inspections seed warning:', inspError.message);
    else console.log('✅ Inspections seeded with real bridge crack photos');

    // 5. Seed Maintenance for Contractor c1111111-1111-1111-1111-111111111111
    const maintenance = [
      {
        id: 'f0000001-0000-0000-0000-000000000001',
        maintenance_code: 'M001',
        bridge_id: 'd0000003-0000-0000-0000-000000000003',
        contractor_id: 'c1111111-1111-1111-1111-111111111111',
        scheduled_date: '2026-07-10',
        completion_date: null,
        priority: 'Medium',
        status: 'Scheduled',
        remarks: 'Resurfacing and sealant renewal on longitudinal joints scheduled.'
      },
      {
        id: 'f0000002-0000-0000-0000-000000000002',
        maintenance_code: 'M002',
        bridge_id: 'd0000001-0000-0000-0000-000000000001',
        contractor_id: 'c1111111-1111-1111-1111-111111111111',
        scheduled_date: '2026-06-15',
        completion_date: '2026-06-20',
        priority: 'Low',
        status: 'Completed',
        remarks: 'Bearing cleaning, seal replacement, and drainage spout clearing completed successfully.'
      },
      {
        id: 'f0000003-0000-0000-0000-000000000003',
        maintenance_code: 'M003',
        bridge_id: 'd0000008-0000-0000-0000-000000000008',
        contractor_id: 'c1111111-1111-1111-1111-111111111111',
        scheduled_date: '2026-06-25',
        completion_date: null,
        priority: 'High',
        status: 'In Progress',
        remarks: 'Expansion joint elastomeric seal renewal and pier cap epoxy coating underway.'
      },
      {
        id: 'f0000004-0000-0000-0000-000000000004',
        maintenance_code: 'M004',
        bridge_id: 'd0000004-0000-0000-0000-000000000004',
        contractor_id: 'c2222222-2222-2222-2222-222222222222',
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
        id: '90000001-0000-0000-0000-000000000001',
        notification_code: 'N001',
        recipient_id: 'a0000000-0000-0000-0000-000000000001',
        bridge_id: 'd0000004-0000-0000-0000-000000000004',
        type: 'critical_finding',
        title: 'Critical Crack Alert: Seawoods Rail Overbridge',
        message: 'Inspection logged high-severity shear cracks on Pier P2. Urgent maintenance assigned.',
        is_read: false
      },
      {
        id: '90000002-0000-0000-0000-000000000001',
        notification_code: 'N002',
        recipient_id: 'c0000000-0000-0000-0000-000000000003',
        bridge_id: 'd0000008-0000-0000-0000-000000000008',
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
        id: '80000001-0000-0000-0000-000000000001',
        report_code: 'R001',
        bridge_id: 'd0000003-0000-0000-0000-000000000003',
        inspection_id: 'e0000002-0000-0000-0000-000000000002',
        report_type: 'Inspection Report',
        file_url: '/report-view.html?id=80000001-0000-0000-0000-000000000001'
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
