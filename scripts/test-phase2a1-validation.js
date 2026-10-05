/**
 * SetuSight — Phase 2A.1 Real-World YOLOv8 Validation & Cloudinary Pipeline Test
 */
const path = require('path');
const fs = require('fs');
const assert = require('assert');
require('dotenv').config();

const mlService = require('../src/services/mlService');
const { uploadImageBuffer, cloudinary } = require('../src/config/cloudinary');

async function runValidationPass() {
  console.log('================================================================');
  console.log('🔬 PHASE 2A.1 — REAL-WORLD YOLOv8 VALIDATION & API PIPELINE TEST');
  console.log('================================================================\n');

  const testCrackPath = path.resolve(__dirname, '../ml/validation_results/original/test_a1_bridge_crack.jpg');
  const testRoughPath = path.resolve(__dirname, '../ml/validation_results/original/test_c1_rough_texture.jpg');
  const invalidPath = path.resolve(__dirname, '../ml/test_samples/invalid_file.txt');

  assert(fs.existsSync(testCrackPath), 'test_a1_bridge_crack.jpg must exist');
  assert(fs.existsSync(testRoughPath), 'test_c1_rough_texture.jpg must exist');

  // 1. Local image API test - Real crack image
  console.log('--- 1. Testing mlService.analyzeBridgeImage() on Real Crack Image ---');
  for (const conf of [0.25, 0.35, 0.50]) {
    const res = await mlService.analyzeBridgeImage(testCrackPath, conf);
    console.log(`  Threshold ${conf}: crackDetected=${res.crackDetected}, count=${res.crackCount}, maxConf=${(res.confidence * 100).toFixed(1)}%, isMock=${res.isMock}`);
    assert.strictEqual(res.isMock, false, 'isMock must be false');
    assert.strictEqual(res.crackDetected, true, 'Crack must be detected');
    assert(res.crackCount > 0, 'Crack count must be > 0');
    assert(res.detections.length > 0, 'Detections array must be populated');
    assert(res.detections[0].bbox.length === 4, 'Bounding box must have 4 coordinates');
  }
  console.log('  ✅ Real crack image API test passed!\n');

  // 2. Local image API test - Real rough concrete non-crack image
  console.log('--- 2. Testing mlService.analyzeBridgeImage() on Clean Aggregate Texture ---');
  for (const conf of [0.25, 0.35, 0.50]) {
    const res = await mlService.analyzeBridgeImage(testRoughPath, conf);
    console.log(`  Threshold ${conf}: crackDetected=${res.crackDetected}, count=${res.crackCount}, maxConf=${res.confidence}, isMock=${res.isMock}`);
    assert.strictEqual(res.isMock, false, 'isMock must be false');
    assert.strictEqual(res.crackDetected, false, 'Crack must not be detected');
    assert.strictEqual(res.crackCount, 0, 'Crack count must be 0');
    assert.strictEqual(res.detections.length, 0, 'Detections array must be empty');
  }
  console.log('  ✅ Clean aggregate texture test passed (0 false positives)!\n');

  // 3. Error handling test - Invalid input file
  console.log('--- 3. Testing Error Handling on Invalid Input ---');
  let errorCaught = false;
  try {
    await mlService.analyzeBridgeImage(invalidPath);
  } catch (err) {
    errorCaught = true;
    console.log(`  Correctly rejected with code: ${err.code}, message: "${err.message}"`);
    assert(err.code === 'ML_INFERENCE_FAILED' || err.code === 'ML_PARSE_ERROR');
  }
  assert.strictEqual(errorCaught, true, 'Inference on invalid file must throw error (never return fake success)');
  console.log('  ✅ Error handling test passed!\n');

  // 4. Cloudinary -> Node -> Python -> YOLO integration test
  console.log('--- 4. Testing Full Cloudinary -> Node -> Python -> YOLO Pipeline ---');
  const buffer = fs.readFileSync(testCrackPath);
  console.log('  Uploading test bridge crack photo to Cloudinary...');
  const uploadRes = await uploadImageBuffer(buffer, {
    folder: 'setusight/validation_tests'
  });
  console.log(`  ✅ Cloudinary upload succeeded: ${uploadRes.secure_url}`);
  console.log(`     Public ID: ${uploadRes.public_id}`);

  try {
    console.log('  Passing Cloudinary HTTPS URL to mlService.analyzeBridgeImage()...');
    const cloudMlRes = await mlService.analyzeBridgeImage(uploadRes.secure_url, 0.35);
    console.log(`  ✅ YOLOv8 inference on Cloudinary URL succeeded!`);
    console.log(`     Crack Detected: ${cloudMlRes.crackDetected}`);
    console.log(`     Crack Count: ${cloudMlRes.crackCount}`);
    console.log(`     Max Confidence: ${(cloudMlRes.confidence * 100).toFixed(1)}%`);
    console.log(`     Detections:`, cloudMlRes.detections);
    console.log(`     isMock: ${cloudMlRes.isMock}`);

    assert.strictEqual(cloudMlRes.isMock, false);
    assert.strictEqual(cloudMlRes.crackDetected, true);
    assert(cloudMlRes.crackCount > 0);
    assert(cloudMlRes.detections.length > 0);
  } finally {
    console.log('  Cleaning up temporary Cloudinary test asset...');
    await cloudinary.uploader.destroy(uploadRes.public_id);
    console.log('  ✅ Cloudinary test asset cleaned up.');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 2A.1 VALIDATION AND API TESTS PASSED SUCCESSFULLY');
  console.log('================================================================\n');
}

runValidationPass().catch(err => {
  console.error('❌ Validation Pass Failed:', err);
  process.exit(1);
});
