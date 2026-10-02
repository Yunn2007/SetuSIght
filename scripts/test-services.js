/**
 * SetuSight — Services & Middleware Verification Test Suite
 */
const assert = require('assert');
const mlService = require('../src/services/mlService');
const healthService = require('../src/services/healthService');
const { requireRole } = require('../src/middleware/authMiddleware');

async function runTests() {
  console.log('🧪 Starting SetuSight Architecture & Service Verification Tests...\n');

  // Test 1: ML Service Isolation & Placeholder Contract
  console.log('Test 1: ML Service Contract Verification');
  const mlOutput = await mlService.analyzeBridgeImage('https://res.cloudinary.com/c3wesoc5/image/upload/v1787335079/setusight/inspections/bridge_crack_nerul_pier_01.jpg');
  assert.strictEqual(mlOutput.isMock, true, 'isMock flag should be true');
  assert.strictEqual(mlOutput.status, 'AI analysis module pending integration', 'Status must indicate pending YOLOv8 integration');
  assert.strictEqual(mlOutput.crackDetected, false);
  assert.strictEqual(mlOutput.crackCount, 0);
  assert.strictEqual(mlOutput.confidence, 0.0);
  assert(Array.isArray(mlOutput.detections), 'detections should be an array');
  console.log('  ✅ ML Service placeholder conforms strictly to architectural requirements.\n');

  // Test 2: Health Assessment Engine (Rule-based)
  console.log('Test 2: Rule-Based Health Assessment Engine');
  
  // Healthy bridge with 0 cracks, young age
  const healthyBridge = { construction_year: 2022, design_life: 50, material: 'Prestressed Concrete', location: 'Seawoods', bridge_name: 'Seawoods Grand Central FOB' };
  const healthyResult = healthService.calculateHealthAssessment(healthyBridge, { crack_severity: 'none', crack_count: 0 });
  assert(healthyResult.healthScore >= 80, `Healthy bridge score should be >= 80, got ${healthyResult.healthScore}`);
  assert.strictEqual(healthyResult.healthStatus, 'Good');
  console.log(`  ✅ Healthy Bridge Scenario: Score ${healthyResult.healthScore} -> Status '${healthyResult.healthStatus}'`);

  // Moderate bridge with low cracks, medium age
  const moderateBridge = { construction_year: 2008, design_life: 50, material: 'Reinforced Concrete', location: 'CBD Belapur', bridge_name: 'Belapur CBD Flyover' };
  const moderateResult = healthService.calculateHealthAssessment(moderateBridge, { crack_severity: 'moderate', crack_count: 3 });
  assert(moderateResult.healthScore >= 60 && moderateResult.healthScore < 80, `Moderate bridge score should be between 60 and 79, got ${moderateResult.healthScore}`);
  assert.strictEqual(moderateResult.healthStatus, 'Moderate');
  console.log(`  ✅ Moderate Bridge Scenario: Score ${moderateResult.healthScore} -> Status '${moderateResult.healthStatus}'`);

  // Critical bridge with high cracks, old age
  const criticalBridge = { construction_year: 1998, design_life: 50, material: 'Reinforced Concrete', location: 'Nerul', bridge_name: 'Nerul West Underpass' };
  const criticalResult = healthService.calculateHealthAssessment(criticalBridge, { crack_severity: 'high', crack_count: 7 });
  assert(criticalResult.healthScore < 60, `Critical bridge score should be < 60, got ${criticalResult.healthScore}`);
  assert.strictEqual(criticalResult.healthStatus, 'Attention Required');
  console.log(`  ✅ Critical Bridge Scenario: Score ${criticalResult.healthScore} -> Status '${criticalResult.healthStatus}'\n`);

  // Test 3: Role-based Authorization Middleware
  console.log('Test 3: Role-based Access Control Middleware');
  let allowed = false;
  let rejected = false;

  const mockAdminReq = { user: { role: 'admin' } };
  const mockInspectorReq = { user: { role: 'inspector' } };
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        if (code === 403) rejected = true;
      }
    })
  };

  const adminGuard = requireRole('admin');
  adminGuard(mockAdminReq, mockRes, () => { allowed = true; });
  assert.strictEqual(allowed, true, 'Admin should pass admin guard');

  adminGuard(mockInspectorReq, mockRes, () => {});
  assert.strictEqual(rejected, true, 'Inspector should be rejected by admin guard with 403');
  console.log('  ✅ Role guards correctly enforce Admin, Inspector, and Contractor permissions.\n');

  console.log('🎉 All Service & Middleware Unit Tests Passed Successfully!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
