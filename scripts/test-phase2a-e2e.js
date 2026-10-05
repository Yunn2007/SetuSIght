/**
 * SetuSight — Phase 2A Real YOLOv8 End-to-End Verification Test
 * 
 * Verifies the complete real chain:
 * Cloudinary -> Node/Express -> Python (ml/inference.py) -> ml/best.pt -> real YOLO inference
 * -> JSON -> healthService -> Supabase -> Admin & Inspector verification.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runPhase2ATests() {
  console.log('===============================================================');
  console.log('🔬 STARTING PHASE 2A REAL YOLOv8 END-TO-END VERIFICATION SUITE');
  console.log('===============================================================\n');

  // 1. Authenticate as Inspector
  console.log('Step 1: Authenticating Inspector...');
  const inspectorLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inspector@setusight.gov.in', password: 'inspect123' })
  }).then(r => r.json());

  assert.strictEqual(inspectorLoginRes.success, true, 'Inspector login must succeed');
  const inspectorToken = inspectorLoginRes.token;
  console.log(`  ✅ Inspector authenticated: ${inspectorLoginRes.user.name}`);

  // 2. Fetch Bridges to select a target bridge
  console.log('\nStep 2: Fetching bridge inventory...');
  const bridgesRes = await fetch(`${BASE_URL}/api/bridges`, {
    headers: { Authorization: `Bearer ${inspectorToken}` }
  }).then(r => r.json());

  assert.strictEqual(bridgesRes.success, true);
  assert(bridgesRes.data.length > 0, 'Must have at least one bridge');
  const targetBridge = bridgesRes.data[0];
  console.log(`  ✅ Target bridge selected: ${targetBridge.bridge_name} (${targetBridge.bridge_id}) [ID: ${targetBridge.id}]`);
  const initialHealthScore = targetBridge.current_health_score;
  console.log(`     Initial Health Score: ${initialHealthScore}/100 (${targetBridge.current_health_status})`);

  // --------------------------------------------------------------------------
  // CASE A: REAL CRACK IMAGE
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('TEST CASE A: REAL CRACK IMAGE INFERENCE & HEALTH ASSESSMENT');
  console.log('===============================================================');
  const crackImgPath = path.resolve(__dirname, '../ml/test_samples/crack_sample.jpg');
  assert(fs.existsSync(crackImgPath), 'crack_sample.jpg must exist');

  const crackBlob = new Blob([fs.readFileSync(crackImgPath)], { type: 'image/jpeg' });
  const formA = new FormData();
  formA.append('bridge_id', targetBridge.id);
  formA.append('inspection_date', new Date().toISOString().split('T')[0]);
  formA.append('crack_severity', 'auto');
  formA.append('remarks', 'Phase 2A Automated Test Case A: Real Concrete Crack Analysis');
  formA.append('image', crackBlob, 'crack_sample.jpg');

  console.log('  Submitting inspection with actual crack photo to POST /api/inspections...');
  const resA = await fetch(`${BASE_URL}/api/inspections`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${inspectorToken}` },
    body: formA
  }).then(r => r.json());

  assert.strictEqual(resA.success, true, `Inspection submission failed: ${resA.error}`);
  const inspA = resA.data;
  console.log(`  ✅ Cloudinary Upload Succeeded! Public ID: ${inspA.cloudinary_public_id}`);
  console.log(`     Cloudinary Image URL: ${inspA.image_url}`);

  console.log('\n  Validating YOLOv8 Inference Results:');
  console.log(`     Crack Detected: ${resA.ml_service?.crackDetected}`);
  console.log(`     Crack Count: ${inspA.crack_count}`);
  console.log(`     Model Confidence: ${(inspA.detection_confidence * 100).toFixed(1)}%`);
  console.log(`     Evaluated Severity: ${inspA.crack_severity}`);
  console.log(`     Calculated Health Score: ${inspA.health_score}/100 (${inspA.health_status})`);

  assert.strictEqual(resA.ml_service?.crackDetected, true, 'Case A must detect crack');
  assert(inspA.crack_count > 0, 'Crack count must be > 0');
  assert(inspA.detection_confidence > 0, 'Confidence must be > 0');
  assert(inspA.detection_data.detections.length > 0, 'Must have bounding box detections');
  assert.strictEqual(inspA.detection_data.is_mock, false, 'is_mock must be false');
  assert.strictEqual(inspA.detection_data.model_file, 'best.pt', 'Model must be best.pt');

  console.log(`     Detections:`, inspA.detection_data.detections);
  console.log('  ✅ Case A Real Crack Pipeline PASSED!');

  // --------------------------------------------------------------------------
  // CASE B: NON-CRACK IMAGE
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('TEST CASE B: NON-CRACK CONCRETE IMAGE INFERENCE');
  console.log('===============================================================');
  const noCrackImgPath = path.resolve(__dirname, '../ml/test_samples/no_crack_sample.jpg');
  assert(fs.existsSync(noCrackImgPath), 'no_crack_sample.jpg must exist');

  const noCrackBlob = new Blob([fs.readFileSync(noCrackImgPath)], { type: 'image/jpeg' });
  const formB = new FormData();
  formB.append('bridge_id', targetBridge.id);
  formB.append('inspection_date', new Date().toISOString().split('T')[0]);
  formB.append('crack_severity', 'auto');
  formB.append('remarks', 'Phase 2A Automated Test Case B: Clean Concrete Surface (No Cracks)');
  formB.append('image', noCrackBlob, 'no_crack_sample.jpg');

  console.log('  Submitting inspection with clean concrete photo to POST /api/inspections...');
  const resB = await fetch(`${BASE_URL}/api/inspections`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${inspectorToken}` },
    body: formB
  }).then(r => r.json());

  assert.strictEqual(resB.success, true, `Non-crack inspection submission failed: ${resB.error}`);
  const inspB = resB.data;
  console.log(`  ✅ Cloudinary Upload Succeeded! Public ID: ${inspB.cloudinary_public_id}`);
  console.log('\n  Validating YOLOv8 Clean Surface Results:');
  console.log(`     Crack Detected: ${resB.ml_service?.crackDetected}`);
  console.log(`     Crack Count: ${inspB.crack_count}`);
  console.log(`     Model Confidence: ${inspB.detection_confidence}`);
  console.log(`     Evaluated Severity: ${inspB.crack_severity}`);
  console.log(`     Calculated Health Score: ${inspB.health_score}/100 (${inspB.health_status})`);

  assert.strictEqual(resB.ml_service?.crackDetected, false, 'Case B must not detect cracks');
  assert.strictEqual(inspB.crack_count, 0, 'Crack count must be 0 for clean surface');
  assert.strictEqual(inspB.crack_severity, 'none', 'Severity must be none');
  assert.strictEqual(inspB.detection_data.detections.length, 0, 'Detections array must be empty');
  assert.strictEqual(inspB.detection_data.is_mock, false, 'is_mock must be false');
  console.log('  ✅ Case B Non-Crack Pipeline PASSED!');

  // --------------------------------------------------------------------------
  // CASE C: INVALID / CORRUPT FILE ERROR HANDLING
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('TEST CASE C: INVALID / CORRUPT FILE ERROR HANDLING');
  console.log('===============================================================');
  const invalidFilePath = path.resolve(__dirname, '../ml/test_samples/invalid_file.txt');
  const invalidBlob = new Blob([fs.readFileSync(invalidFilePath)], { type: 'image/jpeg' });
  const formC = new FormData();
  formC.append('bridge_id', targetBridge.id);
  formC.append('inspection_date', new Date().toISOString().split('T')[0]);
  formC.append('remarks', 'Phase 2A Automated Test Case C: Corrupt File Upload');
  formC.append('image', invalidBlob, 'invalid.jpg');

  console.log('  Submitting invalid file payload to POST /api/inspections...');
  const resC = await fetch(`${BASE_URL}/api/inspections`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${inspectorToken}` },
    body: formC
  });

  const bodyC = await resC.json();
  console.log(`  Response Status Code: ${resC.status}`);
  console.log(`  Response Body:`, bodyC);

  assert.strictEqual(bodyC.success, false, 'Case C must return success: false');
  assert(bodyC.error, 'Must contain clear error message');
  assert(!bodyC.data, 'Must not return inspection data on failure');
  console.log('  ✅ Case C Failure Handling PASSED! No fabricated result created.');

  // --------------------------------------------------------------------------
  // ADMIN DASHBOARD OVERVIEW VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('STEP 6: VERIFY ADMIN DASHBOARD REFLECTS REAL SUPABASE DATA');
  console.log('===============================================================');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@setusight.gov.in', password: 'admin123' })
  }).then(r => r.json());

  assert.strictEqual(adminLoginRes.success, true);
  const adminToken = adminLoginRes.token;

  const overviewRes = await fetch(`${BASE_URL}/api/analytics/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());

  assert.strictEqual(overviewRes.success, true);
  console.log('  Admin Overview Metrics:', overviewRes.data.metrics);
  console.log('  Latest Inspection logged in overview:', overviewRes.data.recentInspections?.[0]?.crack_severity);
  assert(overviewRes.data.metrics.totalInspections >= 6, 'Total inspections should reflect newly inserted records');
  console.log('  ✅ Admin Dashboard overview reflects live updated structural data!');

  console.log('\n===============================================================');
  console.log('🎉 ALL PHASE 2A REAL YOLOv8 TESTS PASSED SUCCESSFULLY!');
  console.log('===============================================================');
}

runPhase2ATests().catch(err => {
  console.error('\n❌ PHASE 2A TEST FAILED:', err);
  process.exit(1);
});
