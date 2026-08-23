const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    opts.headers['Connection'] = 'close';
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

async function runTests() {
  console.log('--- STARTING SPRINT 3 PHASE 5 COMPREHENSIVE VERIFICATION SUITE ---');

  // 1. Authentication protection test (Unauthenticated requests fail with 401)
  const unauthGet = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET'
  });
  if (unauthGet.status !== 401) {
    console.error('Authentication protection check failed!', unauthGet);
    process.exit(1);
  }
  console.log('1. Authentication protection verified (401 Unauthorized for unauthenticated request).');

  // 2. Admin login
  const adminLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@store.com', password: 'Admin@123456' });

  if (adminLogin.status !== 200 || !adminLogin.body.token) {
    console.error('Failed admin login', adminLogin);
    process.exit(1);
  }
  const adminToken = adminLogin.body.token;
  console.log('2. Admin authenticated successfully.');

  // 3. Register & Login Customer A
  const custAEmail = `phase5_cust_a_${Date.now()}@test.com`;
  const registerA = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Customer A', email: custAEmail, password: 'Password@123456', phone: '01000000001' });

  if (registerA.status !== 201) {
    console.error('Failed registering customer A', registerA);
    process.exit(1);
  }

  const loginA = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: custAEmail, password: 'Password@123456' });

  if (loginA.status !== 200 || !loginA.body.token) {
    console.error('Failed logging in customer A', loginA);
    process.exit(1);
  }

  const tokenA = loginA.body.token;
  const custAId = loginA.body.customer.id;
  console.log(`3. Customer A registered & logged in (ID: ${custAId}).`);

  // 4. Register & Login Customer B
  const custBEmail = `phase5_cust_b_${Date.now()}@test.com`;
  const registerB = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Customer B', email: custBEmail, password: 'Password@123456', phone: '01000000002' });

  const loginB = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: custBEmail, password: 'Password@123456' });

  const tokenB = loginB.body.token;
  const custBId = loginB.body.customer.id;
  console.log(`4. Customer B registered & logged in (ID: ${custBId}).`);

  // 5. Test Customer Order Confirmation Notification & Idempotency
  const createOrderA = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    }
  }, {
    customer: {
      name: 'Customer A',
      email: custAEmail,
      phone: '01000000001',
      governorate: 'القاهرة',
      address: '123 Test St'
    },
    items: [{ productId: 'prod-tornado-blend-15', variantId: 'var-torn-white', productTitle: 'خلاط كهربائي تورنيدو', price: 999, quantity: 1 }]
  });

  if ((createOrderA.status !== 200 && createOrderA.status !== 201) || !createOrderA.body.id) {
    console.error('Failed creating order for Customer A', createOrderA);
    process.exit(1);
  }
  const orderIdA = createOrderA.body.id;
  console.log(`5. Order created for Customer A (ID: ${orderIdA}).`);

  // Fetch Customer A notifications
  const notifsA = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });

  const orderConfirmNotif = notifsA.body.find(n => n.id === `not-order-confirm-${orderIdA}`);
  if (!orderConfirmNotif) {
    console.error('Order confirmation notification missing for Customer A!', notifsA.body);
    process.exit(1);
  }
  console.log('   ✓ Order confirmation notification generated successfully:', orderConfirmNotif.title);

  // Verify Idempotency (re-fetching or triggering no duplicates)
  const notifsA_recheck = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const matches = notifsA_recheck.body.filter(n => n.id === `not-order-confirm-${orderIdA}`);
  if (matches.length !== 1) {
    console.error('Idempotency failure: duplicate order confirmation notifications found!', matches);
    process.exit(1);
  }
  console.log('   ✓ Idempotency verified: zero duplicate order confirmation notifications.');

  // 6. Test Guest Checkout (Guest order creates order but no customer notification pollution)
  const guestEmail = `guest_${Date.now()}@test.com`;
  const guestOrder = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    customer: {
      name: 'Guest User',
      email: guestEmail,
      phone: '01099999999',
      governorate: 'الجيزة',
      address: '456 Guest Ave'
    },
    items: [{ productId: 'prod-tornado-blend-15', variantId: 'var-torn-white', productTitle: 'خلاط كهربائي تورنيدو', price: 999, quantity: 1 }]
  });
  if (guestOrder.status !== 201 || !guestOrder.body.id) {
    console.error('Failed guest checkout', guestOrder);
    process.exit(1);
  }
  console.log(`6. Guest checkout completed (ID: ${guestOrder.body.id}).`);

  // Verify Customer A's notifications remain unaffected by guest checkout
  const notifsA_afterGuest = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const guestPollution = notifsA_afterGuest.body.find(n => n.id === `not-order-confirm-${guestOrder.body.id}`);
  if (guestPollution) {
    console.error('Guest checkout leaked notification to Customer A!', guestPollution);
    process.exit(1);
  }
  console.log('   ✓ Guest checkout verification passed: no customer notification leaked.');

  // 7. Admin Targeted Notification
  const sendTargeted = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/customers/' + custAId + '/notifications',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    title: 'تنبيه خاص بالعميل أ',
    message: 'هذا إشعار تجريبي مخصص لحسابك فقط',
    type: 'promo'
  });

  if (sendTargeted.status !== 201) {
    console.error('Failed admin targeted notification', sendTargeted);
    process.exit(1);
  }
  console.log('7. Admin targeted notification sent to Customer A.');

  // Verify Customer A received targeted notification and Customer B did NOT
  const notifsA_targeted = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const targetedNotifA = notifsA_targeted.body.find(n => n.title === 'تنبيه خاص بالعميل أ');
  if (!targetedNotifA) {
    console.error('Targeted notification missing for Customer A!');
    process.exit(1);
  }

  const notifsB_targeted = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const targetedNotifB = notifsB_targeted.body.find(n => n.title === 'تنبيه خاص بالعميل أ');
  if (targetedNotifB) {
    console.error('Isolation failure! Targeted notification leaked to Customer B!', targetedNotifB);
    process.exit(1);
  }
  console.log('   ✓ Customer isolation verified: targeted notification delivered exclusively to Customer A.');

  // 8. Admin Broadcast Notification & Filtering
  const broadcast = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/customers/notifications/broadcast',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    title: 'عرض الموسم المباشر',
    message: 'خصم 20% لجميع العملاء الكرام',
    type: 'promo',
    targetStatus: 'active'
  });

  if (broadcast.status !== 200 || typeof broadcast.body.count !== 'number') {
    console.error('Failed broadcast notification', broadcast);
    process.exit(1);
  }
  console.log(`8. Admin broadcast sent to active customers (Count: ${broadcast.body.count}).`);

  // 9. Individual Notification Read & Unread Counter Synchronization
  const notifsA_beforeRead = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const unreadBeforeRead = notifsA_beforeRead.body.filter(n => !n.isRead).length;

  const markReadRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/customer/notifications/${targetedNotifA.id}/read`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });

  if (markReadRes.status !== 200) {
    console.error('Failed single mark read', markReadRes);
    process.exit(1);
  }

  const notifsA_afterRead = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const unreadAfterRead = notifsA_afterRead.body.filter(n => !n.isRead).length;
  if (unreadAfterRead !== unreadBeforeRead - 1) {
    console.error(`Unread counter mismatch! Before: ${unreadBeforeRead}, After: ${unreadAfterRead}`);
    process.exit(1);
  }
  console.log('9. Single notification mark as read & unread counter sync verified.');

  // 10. Mark ALL Notifications as Read
  const markAllReadRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications/read',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  if (markAllReadRes.status !== 200) {
    console.error('Failed mark all read', markAllReadRes);
    process.exit(1);
  }

  const notifsA_allRead = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const unreadAll = notifsA_allRead.body.filter(n => !n.isRead).length;
  if (unreadAll !== 0) {
    console.error('Mark all read failed! Unread count remaining:', unreadAll);
    process.exit(1);
  }
  console.log('10. Mark all notifications as read verified (0 unread remaining).');

  // 11. Security Isolation: Customer B trying to modify/delete Customer A's notification
  const maliciousDelete = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/customer/notifications/${targetedNotifA.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });

  if (maliciousDelete.status !== 404) {
    console.error('Security vulnerability! Customer B modified Customer A notification!', maliciousDelete);
    process.exit(1);
  }
  console.log('11. Security check passed: Customer B denied access to Customer A notification (404).');

  // 12. Individual Notification Deletion
  const legitDelete = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/customer/notifications/${targetedNotifA.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });

  if (legitDelete.status !== 200) {
    console.error('Customer A failed deleting own notification', legitDelete);
    process.exit(1);
  }
  console.log('12. Customer A successfully deleted individual notification.');

  // 13. Clear All Notifications
  const clearRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications/clear',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });

  if (clearRes.status !== 200) {
    console.error('Failed clearing customer notifications', clearRes);
    process.exit(1);
  }

  const notifsACleared = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });

  if (notifsACleared.body.length !== 0) {
    console.error('Clear notifications failed, count remaining:', notifsACleared.body.length);
    process.exit(1);
  }
  console.log('13. Customer A successfully cleared all notifications.');

  // 14. Blocked Customer Access Prevention
  // Admin blocks Customer B
  const blockBRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/customers/${custBId}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { status: 'blocked' });

  if (blockBRes.status !== 200) {
    console.error('Failed blocking Customer B via admin API', blockBRes);
    process.exit(1);
  }

  // Customer B attempts to fetch notifications -> should be blocked (403)
  const blockedFetch = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/customer/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });

  if (blockedFetch.status !== 403) {
    console.error('Blocked customer access prevention failed!', blockedFetch);
    process.exit(1);
  }
  console.log('14. Blocked customer access prevention verified (403 Forbidden for blocked customer session).');

  console.log('=== ALL SPRINT 3 PHASE 5 VERIFICATION SCENARIOS PASSED SUCCESSFULLY ===');
}

runTests().catch(err => {
  console.error('Verification script exception:', err);
  process.exit(1);
});
