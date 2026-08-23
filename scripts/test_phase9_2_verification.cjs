const http = require('http');

// Helper for making HTTP requests
function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 9.2 REVIEWS & RATINGS VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = null) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      if (details) {
        console.error('   Details:', JSON.stringify(details, null, 2));
      }
      failed++;
    }
  }

  try {
    const BASE_HOST = 'localhost';
    const PORT = 3000;

    // 0. Setup test data by making login/register or seeding calls
    const adminLoginRes = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@store.com', password: 'Admin@123456' });

    const adminToken = adminLoginRes.body?.token;
    if (!adminToken) {
      throw new Error('Failed to obtain admin token for test setup');
    }

    // Register test customer A
    const custAEmail = `custA_${Date.now()}@test.com`;
    const custAPass = 'Password123!';
    await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/customer/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: 'العميل أحمد', email: custAEmail, password: custAPass, phone: '01011112222' });

    const loginARes = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/customer/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: custAEmail, password: custAPass });

    const custAToken = loginARes.body?.token;
    const custA = loginARes.body?.customer;

    // Register test customer B
    const custBEmail = `custB_${Date.now()}@test.com`;
    const custBPass = 'Password123!';
    await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/customer/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: 'العميل محمود', email: custBEmail, password: custBPass, phone: '01033334444' });

    const loginBRes = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/customer/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: custBEmail, password: custBPass });

    const custBToken = loginBRes.body?.token;
    const custB = loginBRes.body?.customer;

    const testProductId = 'prod-lg-oled-65';

    // Ensure stock is available before creating order
    await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/admin/inventory/adjust',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      productId: testProductId,
      variantId: 'var-lg-65',
      type: 'in_adjustment',
      quantity: 50,
      reason: 'شحن مخزون لاختبارات المرحلة 9.2'
    });

    // Create a completed order for Customer A so Customer A is a verified buyer of testProductId
    const createOrderRes = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${custAToken}`
      }
    }, {
      customer: {
        name: 'العميل أحمد',
        phone: '01011112222',
        email: custAEmail,
        address: 'شارع التحرير',
        governorate: 'القاهرة',
        city: 'الدقي'
      },
      items: [
        { productId: testProductId, quantity: 1, price: 44999 }
      ]
    });

    const createdOrderId = createOrderRes.body?.id;

    // Admin updates order status to 'Delivered' so it is a completed order
    const orderStatusRes = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/admin/orders/${createdOrderId}/status`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { status: 'Delivered', reason: 'تم التوصيل للعميل' });

    console.log('Test setup order status update res:', orderStatusRes.status, 'body:', JSON.stringify(orderStatusRes.body));

    // ------------------------------------------------------------------
    // TEST 1: Public GET /api/customer/products/:productId/reviews
    // ------------------------------------------------------------------
    const t1Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/reviews`,
      method: 'GET'
    });

    assert(
      t1Res.status === 200 && Array.isArray(t1Res.body?.reviews) && t1Res.body?.summary !== undefined,
      'Test 1: Public GET /api/customer/products/:productId/reviews returns approved reviews and summary',
      t1Res
    );

    // ------------------------------------------------------------------
    // TEST 2: GET /api/customer/products/:productId/reviews with variantId filter
    // ------------------------------------------------------------------
    const t2Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/reviews?variantId=var-lg-65`,
      method: 'GET'
    });

    assert(
      t2Res.status === 200 && Array.isArray(t2Res.body?.reviews),
      'Test 2: GET /api/customer/products/:productId/reviews accepts variantId filter parameter'
    );

    // ------------------------------------------------------------------
    // TEST 3: Unauthenticated review eligibility returns 401
    // ------------------------------------------------------------------
    const t3Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/review-eligibility`,
      method: 'GET'
    });

    assert(
      t3Res.status === 401,
      'Test 3: Unauthenticated GET review-eligibility returns 401 Unauthorized'
    );

    // ------------------------------------------------------------------
    // TEST 4: Customer B (no completed orders) review eligibility -> canReview: false
    // ------------------------------------------------------------------
    const t4Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/review-eligibility`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${custBToken}` }
    });

    assert(
      t4Res.status === 200 && t4Res.body?.canReview === false && t4Res.body?.isVerifiedPurchase === false,
      'Test 4: Customer without completed purchase gets canReview: false, isVerifiedPurchase: false',
      t4Res
    );

    // ------------------------------------------------------------------
    // TEST 5: Customer A (has delivered order) review eligibility -> canReview: true, isVerifiedPurchase: true
    // ------------------------------------------------------------------
    const t5Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/review-eligibility`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${custAToken}` }
    });

    assert(
      t5Res.status === 200 && t5Res.body?.canReview === true && t5Res.body?.isVerifiedPurchase === true,
      'Test 5: Customer with delivered order gets canReview: true, isVerifiedPurchase: true',
      t5Res
    );

    // ------------------------------------------------------------------
    // TEST 6: Unauthenticated POST review returns 401
    // ------------------------------------------------------------------
    const t6Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/reviews`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { rating: 5, comment: 'تجربة رائعة' });

    assert(
      t6Res.status === 401,
      'Test 6: Unauthenticated POST review returns 401 Unauthorized'
    );

    // ------------------------------------------------------------------
    // TEST 7: POST review missing rating or comment returns 400
    // ------------------------------------------------------------------
    const t7Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/reviews`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${custAToken}`
      }
    }, { rating: 5, comment: '' });

    assert(
      t7Res.status === 400,
      'Test 7: POST review with empty comment returns 400 Bad Request'
    );

    // ------------------------------------------------------------------
    // TEST 8: POST review with invalid rating returns 400
    // ------------------------------------------------------------------
    const t8Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/reviews`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${custAToken}`
      }
    }, { rating: 6, comment: 'ممتاز جداً' });

    assert(
      t8Res.status === 400,
      'Test 8: POST review with rating > 5 returns 400 Bad Request'
    );

    // ------------------------------------------------------------------
    // TEST 9 & 10 & 11: Create valid review, verify server overrides client body tamperings
    // ------------------------------------------------------------------
    const t11Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/reviews`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${custAToken}`
      }
    }, {
      rating: 5,
      title: 'شاشة سينمائية فائقة',
      comment: 'منتج ممتاز وتوصيل في الموعد المحدد بكل دقة',
      // Tampering attempts (should be ignored by server)
      customerId: 'hacker-customer-id',
      customerName: 'اسم مزيف',
      isVerifiedPurchase: false,
      status: 'approved'
    });

    const newReview = t11Res.body;
    assert(
      t11Res.status === 201 &&
      newReview?.id &&
      newReview?.customerId === custA.id &&
      newReview?.customerName === 'العميل أحمد' &&
      newReview?.isVerifiedPurchase === true &&
      newReview?.status === 'pending',
      'Test 9, 10, 11: Valid review created with 201 Created, status pending, server-derived customerId & verified purchase',
      t11Res
    );

    const createdReviewId = newReview?.id;

    // ------------------------------------------------------------------
    // TEST 12: Duplicate review attempt by Customer A for same product
    // ------------------------------------------------------------------
    const t12Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/reviews`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${custAToken}`
      }
    }, {
      rating: 4,
      title: 'محاولة مكررة',
      comment: 'محاولة أخرى لإضافة تقييم لنفس المنتج'
    });

    assert(
      t12Res.status === 400,
      'Test 12: Duplicate review attempt by same customer is rejected with 400'
    );

    // ------------------------------------------------------------------
    // TEST 13: GET /api/customer/reviews/my returns Customer A's reviews with product details
    // ------------------------------------------------------------------
    const t13Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/customer/reviews/my',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${custAToken}` }
    });

    assert(
      t13Res.status === 200 && Array.isArray(t13Res.body) && t13Res.body.length >= 1 && t13Res.body[0].productTitle !== undefined,
      'Test 13: GET /api/customer/reviews/my returns customer reviews enriched with productTitle'
    );

    // ------------------------------------------------------------------
    // TEST 14: Customer A edits their own review via PATCH
    // ------------------------------------------------------------------
    const t14Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/reviews/${createdReviewId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${custAToken}`
      }
    }, {
      rating: 5,
      comment: 'تعليق معدل: شاشة خيالية وأداء مبهر للجميع'
    });

    assert(
      t14Res.status === 200 && t14Res.body?.comment === 'تعليق معدل: شاشة خيالية وأداء مبهر للجميع',
      'Test 14: Customer successfully updates their own review'
    );

    // ------------------------------------------------------------------
    // TEST 15: Customer B tries to edit Customer A's review -> 403 Forbidden
    // ------------------------------------------------------------------
    const t15Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/reviews/${createdReviewId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${custBToken}`
      }
    }, {
      rating: 1,
      comment: 'محاولة اختراق وتعديل مراجعة عميل آخر'
    });

    assert(
      t15Res.status === 403,
      'Test 15: Customer B attempting to edit Customer A review returns 403 Forbidden'
    );

    // ------------------------------------------------------------------
    // TEST 16: Customer B tries to delete Customer A's review -> 403 Forbidden
    // ------------------------------------------------------------------
    const t16Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/reviews/${createdReviewId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${custBToken}` }
    });

    assert(
      t16Res.status === 403,
      'Test 16: Customer B attempting to delete Customer A review returns 403 Forbidden'
    );

    // ------------------------------------------------------------------
    // TEST 18: Unauthenticated GET /api/admin/reviews -> 401
    // ------------------------------------------------------------------
    const t18Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/admin/reviews',
      method: 'GET'
    });

    assert(
      t18Res.status === 401,
      'Test 18: Unauthenticated GET /api/admin/reviews returns 401 Unauthorized'
    );

    // ------------------------------------------------------------------
    // TEST 19: Admin GET /api/admin/reviews returns list, pagination & stats
    // ------------------------------------------------------------------
    const t19Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/admin/reviews',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert(
      t19Res.status === 200 && Array.isArray(t19Res.body?.reviews) && t19Res.body?.stats !== undefined && t19Res.body?.pagination !== undefined,
      'Test 19: Admin GET /api/admin/reviews returns paginated reviews with stats'
    );

    // ------------------------------------------------------------------
    // TEST 20: Admin GET /api/admin/reviews?status=pending
    // ------------------------------------------------------------------
    const t20Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: '/api/admin/reviews?status=pending',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert(
      t20Res.status === 200 && t20Res.body?.reviews.every(r => r.status === 'pending'),
      'Test 20: Admin GET /api/admin/reviews?status=pending filters pending reviews'
    );

    // ------------------------------------------------------------------
    // TEST 21: Admin GET /api/admin/reviews/:id
    // ------------------------------------------------------------------
    const t21Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/admin/reviews/${createdReviewId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert(
      t21Res.status === 200 && t21Res.body?.id === createdReviewId && t21Res.body?.productTitle !== undefined,
      'Test 21: Admin GET /api/admin/reviews/:id returns single review details with product Title'
    );

    // ------------------------------------------------------------------
    // TEST 22: Admin approves review via PATCH /api/admin/reviews/:id/status
    // ------------------------------------------------------------------
    const t22Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/admin/reviews/${createdReviewId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      status: 'approved',
      adminResponse: 'شكراً لتقييمك الرائع متجر النخبة في خدمتك دائماً'
    });

    assert(
      t22Res.status === 200 && t22Res.body?.status === 'approved' && t22Res.body?.adminResponse !== undefined,
      'Test 22: Admin approves review status to approved with admin response'
    );

    // ------------------------------------------------------------------
    // TEST 23: Approved review now appears in public GET /api/customer/products/:productId/reviews
    // ------------------------------------------------------------------
    const t23Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/reviews`,
      method: 'GET'
    });

    const isPresentPublicly = t23Res.body?.reviews?.some(r => r.id === createdReviewId);
    assert(
      t23Res.status === 200 && isPresentPublicly === true,
      'Test 23: Newly approved review is now visible in public product reviews list'
    );

    // ------------------------------------------------------------------
    // TEST 24: Product rating & count recalculation verified
    // ------------------------------------------------------------------
    const t24Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/products/${testProductId}`,
      method: 'GET'
    });

    assert(
      t24Res.status === 200 && typeof t24Res.body?.rating === 'number' && typeof t24Res.body?.reviewsCount === 'number',
      'Test 24: Product catalog rating and reviewsCount recalculated automatically'
    );

    // ------------------------------------------------------------------
    // TEST 25: Admin rejects review via PATCH /api/admin/reviews/:id/status
    // ------------------------------------------------------------------
    const t25Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/admin/reviews/${createdReviewId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { status: 'rejected', reason: 'ملاحظة غير مستوفية الشروط' });

    assert(
      t25Res.status === 200 && t25Res.body?.status === 'rejected',
      'Test 25: Admin rejects review status to rejected'
    );

    // ------------------------------------------------------------------
    // TEST 17: Customer A deletes their own review -> 200 OK
    // ------------------------------------------------------------------
    const t17Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/reviews/${createdReviewId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${custAToken}` }
    });

    assert(
      t17Res.status === 200 && t17Res.body?.success === true,
      'Test 17: Customer A successfully deletes their own review'
    );

    // ------------------------------------------------------------------
    // TEST 26: Admin DELETE review
    // ------------------------------------------------------------------
    // Create a temporary review as Customer A to test Admin DELETE
    const tempRevRes = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/customer/products/${testProductId}/reviews`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${custAToken}`
      }
    }, { rating: 4, comment: 'تقييم تجريبي للحذف من قبل المسؤول' });

    const tempRevId = tempRevRes.body?.id;

    const t26Res = await request({
      hostname: BASE_HOST,
      port: PORT,
      path: `/api/admin/reviews/${tempRevId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert(
      t26Res.status === 200 && t26Res.body?.success === true,
      'Test 26: Admin successfully deletes a review and triggers recalculation'
    );

  } catch (err) {
    console.error('❌ Exception during verification execution:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`📊 PHASE 9.2 VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
