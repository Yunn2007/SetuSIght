/**
 * SetuSight — Phase 2B End-to-End Pipeline & API Verification Test
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function testFullPipeline() {
  console.log('================================================================');
  console.log('🚀 TESTING FULL PHASE 2B PIPELINE (AUTH -> UPLOAD -> YOLO -> API)');
  console.log('================================================================\n');

  // 1. Authenticate Inspector
  console.log('Step 1: Authenticating as Field Inspector...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inspector@setusight.gov.in', password: 'inspect123' })
  }).then(r => r.json());

  assert.strictEqual(loginRes.success, true, 'Login must succeed');
  const token = loginRes.token;
  console.log(`  ✅ Logged in as: ${loginRes.user.name} (${loginRes.user.role})`);

  // 2. Fetch Bridges
  console.log('\nStep 2: Fetching bridge inventory...');
  const bridgesRes = await fetch(`${BASE_URL}/api/bridges`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  assert.strictEqual(bridgesRes.success, true);
  const targetBridge = bridgesRes.data[0];
  console.log(`  ✅ Selected Bridge: ${targetBridge.bridge_name} (${targetBridge.bridge_id})`);

  // 3. Create Real Inspection with Concrete Crack Photo
  console.log('\nStep 3: Creating Inspection via Real YOLOv8 Computer Vision Pipeline...');
  const crackImgPath = path.resolve(__dirname, '../ml/validation_results/original/test_a1_bridge_crack.jpg');
  const imgBuffer = fs.readFileSync(crackImgPath);
  const blob = new Blob([imgBuffer], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('bridge_id', targetBridge.id);
  formData.append('inspection_date', new Date().toISOString().split('T')[0]);
  formData.append('crack_severity', 'auto');
  formData.append('remarks', 'Phase 2B Visual AI Detection Canvas Verification Audit');
  formData.append('image', blob, 'test_a1_bridge_crack.jpg');

  const createRes = await fetch(`${BASE_URL}/api/inspections`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  }).then(r => r.json());

  console.log(`  Create API Success: ${createRes.success}`);
  assert.strictEqual(createRes.success, true, 'createInspection must succeed');
  const insp = createRes.data;
  console.log(`  ✅ Inspection ID: ${insp.id}`);
  console.log(`     Cloudinary URL: ${insp.image_url}`);
  console.log(`     Crack Count: ${insp.crack_count}`);
  console.log(`     Assessed Severity: ${insp.crack_severity}`);
  console.log(`     Health Score: ${insp.health_score}/100 (${insp.health_status})`);
  console.log(`     Detection Confidence: ${(insp.detection_confidence * 100).toFixed(1)}%`);

  const det = insp.detection_data;
  assert.strictEqual(det.is_mock, false, 'is_mock must be false');
  assert.strictEqual(det.model_file, 'best.pt', 'model_file must be best.pt');
  assert(det.detections.length > 0, 'Detections must be present');
  console.log(`     Stored Detections Count: ${det.detections.length}`);
  console.log(`     Image Dimensions: ${det.image_dimensions?.width}x${det.image_dimensions?.height}`);

  // 4. Retrieve historical record via GET /api/inspections/:id
  console.log('\nStep 4: Retrieving historical inspection record...');
  const getRes = await fetch(`${BASE_URL}/api/inspections/${insp.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  assert.strictEqual(getRes.success, true);
  assert.strictEqual(getRes.data.id, insp.id);
  assert.strictEqual(getRes.data.crack_count, insp.crack_count);
  assert.deepStrictEqual(getRes.data.detection_data.detections, det.detections);
  console.log(`  ✅ Historical inspection retrieved: Stored detections match 100% without re-running YOLO!`);

  // 5. Test Timeline Endpoint
  console.log('\nStep 5: Verifying bridge timeline endpoint...');
  const timelineRes = await fetch(`${BASE_URL}/api/bridges/${targetBridge.id}/timeline`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  assert.strictEqual(timelineRes.success, true);
  const inspTimelineNode = timelineRes.data.timeline.find(n => n.type === 'inspection');
  assert(inspTimelineNode, 'Inspection node must exist in timeline');
  assert(inspTimelineNode.inspectionRecord, 'inspectionRecord must be attached for visual canvas modal');
  console.log(`  ✅ Bridge dossier timeline verified: inspectionRecord attached to timeline node.`);

  console.log('\n================================================================');
  console.log('🎉 FULL PIPELINE & API VERIFICATION SUITE PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

testFullPipeline().catch(err => {
  console.error('❌ Pipeline Test Failed:', err);
  process.exit(1);
});
