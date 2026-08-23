const http = require('http');
const fs = require('fs');
const path = require('path');

let ipCounter = 1;
function request(options, body) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    opts.headers['Connection'] = 'close';
    if (!opts.headers['X-Forwarded-For']) {
      opts.headers['X-Forwarded-For'] = `10.10.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
      ipCounter++;
    }
    let payload = null;
    if (body) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function getCustomerResetTokenFromDb(email) {
  try {
    const dbPath = path.join(__dirname, '..', 'data', 'db.json');
    if (!fs.existsSync(dbPath)) return null;
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const customer = (dbData.customers || []).find(c => c.email.toLowerCase() === email.toLowerCase());
    return customer ? customer.resetToken : null;
  } catch (err) {
    return null;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('--- STARTING SPRINT 3 PHASE 6 COMPREHENSIVE VERIFICATION SUITE ---');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${testName}`, details);
      failed++;
    }
  }

  // A. PASSWORD MINIMUM LENGTH VALIDATION
  console.log('--- A. PASSWORD MINIMUM LENGTH VALIDATION ---');
  
  // A1. Registration with password < 8 chars rejected
  const regShort = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Short Pass User', email: `short_pass_${Date.now()}@test.com`, password: '1234567' });

  assert(regShort.status === 400 && regShort.body.error, 'A1. Registration with password < 8 characters rejected (400)');

  // Register a valid user for testing change & reset
  const testEmail = `phase6_test_${Date.now()}@test.com`;
  const initialPassword = 'InitialPassword@123';

  const regValid = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Phase6 Tester', email: testEmail, password: initialPassword });

  assert(regValid.status === 201, 'Valid user registered successfully');

  const loginValid = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, password: initialPassword });

  assert(loginValid.status === 200 && loginValid.body.token, 'Initial login successful');
  let currentToken = loginValid.body.token;
  const customerId = loginValid.body.customer.id;

  // A2. Change password with new password < 8 chars rejected
  const changeShort = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/change-password',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    }
  }, { oldPassword: initialPassword, newPassword: 'short' });

  assert(changeShort.status === 400, 'A2. Change password with new password < 8 characters rejected (400)');

  // A3. Reset password with new password < 8 chars rejected
  const forgotResp = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/forgot-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail });

  const resetTokenA = getCustomerResetTokenFromDb(testEmail);

  const resetShort = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/reset-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, token: resetTokenA, newPassword: '123' });

  assert(resetShort.status === 400, 'A3. Reset password with new password < 8 characters rejected (400)');

  console.log('\n--- B. SECURE PASSWORD CHANGE & SESSION INVALIDATION ---');

  // B1. Wrong current password rejected
  const changeWrongOld = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/change-password',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    }
  }, { oldPassword: 'WrongOldPassword', newPassword: 'BrandNewPassword@123' });

  assert(changeWrongOld.status === 400, 'B1. Wrong current password rejected (400)');

  // B2. New password equal to current password rejected
  const changeSamePass = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/change-password',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    }
  }, { oldPassword: initialPassword, newPassword: initialPassword });

  assert(changeSamePass.status === 400, 'B2. New password identical to current password rejected (400)');

  // B3. Valid password change succeeds
  const updatedPassword = 'NewPassword@123456';
  const changeSuccess = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/change-password',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    }
  }, { oldPassword: initialPassword, newPassword: updatedPassword });

  assert(changeSuccess.status === 200 && changeSuccess.body.success, 'B3. Valid password change succeeded (200)');

  // B4. Old session token invalidated
  const oldSessionCheck = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/profile',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${currentToken}` }
  });

  assert(oldSessionCheck.status === 401, 'B4. Session token invalidated immediately after password change (401)');

  // B5. Login with old password fails, login with new password succeeds
  const loginOldPass = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, password: initialPassword });

  assert(loginOldPass.status === 401, 'B5a. Login with old password fails (401)');

  const loginNewPass = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, password: updatedPassword });

  assert(loginNewPass.status === 200 && loginNewPass.body.token, 'B5b. Login with new password succeeds (200)');
  currentToken = loginNewPass.body.token;

  console.log('\n--- C. SECURE PASSWORD RESET & REUSE PREVENTION ---');

  // C1. Request forgot password
  const forgotResp2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/forgot-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail });

  assert(forgotResp2.status === 200, 'C1. Forgot password request succeeded (200)');

  const resetTokenB = getCustomerResetTokenFromDb(testEmail);
  assert(!!resetTokenB, 'Reset token generated in database');

  // C2. Invalid reset token rejected
  const resetInvalidToken = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/reset-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, token: '999999', newPassword: 'ResetPassword@123' });

  assert(resetInvalidToken.status === 400, 'C2. Invalid reset token rejected (400)');

  // C3. Valid reset password succeeds
  const resetPasswordVal = 'ResetPassword@123456';
  const resetSuccess = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/reset-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, token: resetTokenB, newPassword: resetPasswordVal });

  assert(resetSuccess.status === 200 && resetSuccess.body.success, 'C3. Valid password reset succeeded (200)');

  // C4. Reset token cannot be reused
  const resetReuse = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/reset-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, token: resetTokenB, newPassword: 'AnotherPassword@123' });

  assert(resetReuse.status === 400, 'C4. Reset token reuse rejected (400)');

  // C5. Session invalidated after reset
  const sessionCheckPostReset = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/profile',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${currentToken}` }
  });

  assert(sessionCheckPostReset.status === 401, 'C5. Sessions invalidated immediately after password reset (401)');

  // C6. Login with reset password works
  const loginResetPass = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, password: resetPasswordVal });

  assert(loginResetPass.status === 200 && loginResetPass.body.token, 'C6. Login with reset password succeeds (200)');

  console.log('\n--- D. ACCOUNT ENUMERATION PREVENTION ---');

  // D1. Forgot password for existing email
  const enumExist = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/forgot-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail });

  // D2. Forgot password for non-existent email
  const enumNonExist = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/forgot-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: `nonexistent_${Date.now()}@test.com` });

  assert(enumExist.status === 200 && enumNonExist.status === 200, 'D1. Both existing and non-existent emails return HTTP 200');
  assert(enumExist.body.message === enumNonExist.body.message, 'D2. Responses have identical generic message');
  assert(enumExist.body.resetToken === undefined && enumNonExist.body.resetToken === undefined, 'D3. resetToken is NEVER exposed in API response');

  console.log('\n--- E. RATE LIMITING & BRUTE FORCE PROTECTION ---');

  // E1. Trigger rate limit on forgot-password
  let rateLimited = false;
  const rateLimitEmail = `ratelimit_${Date.now()}@test.com`;
  const rateLimitIp = `192.168.88.${Math.floor(Math.random() * 200) + 1}`;
  for (let i = 0; i < 8; i++) {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/customer/forgot-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': rateLimitIp }
    }, { email: rateLimitEmail });

    if (res.status === 429) {
      rateLimited = true;
      break;
    }
  }

  assert(rateLimited, 'E1. Rapid forgot-password requests trigger HTTP 429 rate limit');

  console.log('\n--- F. BLOCKED ACCOUNT PROTECTION ---');

  // F1. Admin login & block user
  const adminLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@store.com', password: 'Admin@123456' });

  const adminToken = adminLogin.body.token;

  // Block the test customer
  const blockUser = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/customers/${customerId}/status`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { status: 'blocked' });

  assert(blockUser.status === 200, 'F1. Admin blocked test customer account');

  // F2. Blocked user cannot login
  const blockedLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, password: resetPasswordVal });

  assert(blockedLogin.status === 403, 'F2. Blocked customer login rejected with HTTP 403');

  console.log('\n--- G. REGRESSION CHECKS ---');

  // G1. Guest checkout works
  const guestOrder = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    customer: {
      name: 'Guest Tester',
      email: 'guest@test.com',
      phone: '01000000000',
      address: 'Test Address',
      governorate: 'القاهرة'
    },
    items: [{ productId: 'prod-lg-oled-65', variantId: 'var-lg-65', variantSku: 'LG-OLED-65C3', productTitle: 'شاشة إل جي', price: 44999, quantity: 1 }]
  });

  assert(guestOrder.status === 201 && guestOrder.body.id, 'G1. Guest checkout functions normally (201)');

  // G2. Admin profile endpoint works
  const adminMe = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/me',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  assert(adminMe.status === 200, 'G2. Admin authentication remains unaffected (200)');

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
