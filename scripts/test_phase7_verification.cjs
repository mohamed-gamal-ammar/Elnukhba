const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqBody = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Connection': 'close',
      ...headers
    };
    if (reqBody) {
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (reqBody) {
      req.write(reqBody);
    }
    req.end();
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runVerificationSuite() {
  console.log('=== STARTING PHASE 7 FULL VERIFICATION SUITE ===\n');
  let failures = 0;

  function assert(condition, testName, extra = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName} -> ${extra}`);
      failures++;
    }
  }

  try {
    // 1. Fetch store catalog products
    const prodsRes = await makeRequest('/api/products');
    assert(prodsRes.status === 200 && Array.isArray(prodsRes.body), '1. Fetch store catalog products');
    const products = prodsRes.body;
    
    const prodSimple = products[0];
    const prodWithVariants = products[1] || products[0];
    const simpleVariant = prodSimple.variants && prodSimple.variants.length > 0 ? prodSimple.variants[0] : null;
    const initialStockProd1 = simpleVariant ? simpleVariant.stock : prodSimple.stock;

    console.log(`Test Product 1: ${prodSimple.id} (Variant: ${simpleVariant ? simpleVariant.id : 'none'}, Stock: ${initialStockProd1})`);

    // 2. Unauthenticated access check (401 expected)
    const unauthRes = await makeRequest('/api/customer/cart');
    assert(unauthRes.status === 401, '2. GET /api/customer/cart without auth returns 401');

    // 3. Register & Login Customer A and Customer B
    const emailA = `test.cart.a.${Date.now()}.${Math.floor(Math.random()*100000)}@example.com`;
    await sleep(50);
    const emailB = `test.cart.b.${Date.now()}.${Math.floor(Math.random()*100000)}@example.com`;
    const pass = 'Password123!';

    const regARes = await makeRequest('/api/customer/register', 'POST', {
      name: 'عميل اختبار أ',
      email: emailA,
      phone: '01011111111',
      password: pass
    });
    assert(regARes.status === 201 && regARes.body.success, '3a. Register Customer A');

    await sleep(50);

    const loginARes = await makeRequest('/api/customer/login', 'POST', { email: emailA, password: pass });
    assert(loginARes.status === 200 && loginARes.body.token, '3a-2. Login Customer A', JSON.stringify(loginARes.body));
    const tokenA = loginARes.body.token;

    await sleep(50);

    const regBRes = await makeRequest('/api/customer/register', 'POST', {
      name: 'عميل اختبار ب',
      email: emailB,
      phone: '01022222222',
      password: pass
    });
    assert(regBRes.status === 201 && regBRes.body.success, '3b. Register Customer B');

    await sleep(50);

    const loginBRes = await makeRequest('/api/customer/login', 'POST', { email: emailB, password: pass });
    assert(loginBRes.status === 200 && loginBRes.body.token, '3b-2. Login Customer B', JSON.stringify(loginBRes.body));
    const tokenB = loginBRes.body.token;

    // 4. GET Customer A Cart initially (should be empty)
    const cartARes1 = await makeRequest('/api/customer/cart', 'GET', null, { Authorization: `Bearer ${tokenA}` });
    assert(cartARes1.status === 200 && Array.isArray(cartARes1.body) && cartARes1.body.length === 0, '4. GET Customer A initial empty cart');

    // 5. Add Item to Customer A Cart (POST /api/customer/cart/items)
    const addARes = await makeRequest('/api/customer/cart/items', 'POST', {
      productId: prodSimple.id,
      variantId: simpleVariant ? simpleVariant.id : undefined,
      quantity: 1
    }, { Authorization: `Bearer ${tokenA}` });
    assert(addARes.status === 201 && addARes.body.success && addARes.body.cart && addARes.body.cart.length === 1, '5. Add product to Customer A cart');
    assert(addARes.body.cart[0].productId === prodSimple.id && addARes.body.cart[0].quantity === 1, '5b. Verify item structure and quantity in Customer A cart');

    // 6. Verify stock safety (stock should NOT change after adding to cart!)
    const prodCheck1 = await makeRequest(`/api/products/${prodSimple.id}`);
    const checkStockBefore = simpleVariant ? prodCheck1.body.variants.find(v => v.id === simpleVariant.id).stock : prodCheck1.body.stock;
    assert(checkStockBefore === initialStockProd1, '6. Stock safety: adding to cart did NOT decrement inventory stock');

    // 7. Customer B Cart Isolation (Customer B cart should still be empty)
    const cartBRes1 = await makeRequest('/api/customer/cart', 'GET', null, { Authorization: `Bearer ${tokenB}` });
    assert(cartBRes1.status === 200 && cartBRes1.body.length === 0, '7. Isolation: Customer B cart remains empty');

    // 8. Add variant item to Customer A Cart
    let variant2Id = undefined;
    if (prodWithVariants.variants && prodWithVariants.variants.length > 0) {
      const var2 = prodWithVariants.variants.find(v => v.id !== (simpleVariant ? simpleVariant.id : '')) || prodWithVariants.variants[0];
      variant2Id = var2.id;
      const addVarRes = await makeRequest('/api/customer/cart/items', 'POST', {
        productId: prodWithVariants.id,
        variantId: variant2Id,
        quantity: 1
      }, { Authorization: `Bearer ${tokenA}` });
      assert(addVarRes.status === 201 && addVarRes.body.cart && addVarRes.body.cart.length >= 1, '8. Add second variant product to Customer A cart');
    }

    // 9. Update quantity in Customer A Cart (PATCH /api/customer/cart/items/:productId)
    const patchRes = await makeRequest(`/api/customer/cart/items/${prodSimple.id}`, 'PATCH', {
      variantId: simpleVariant ? simpleVariant.id : undefined,
      quantity: 2
    }, { Authorization: `Bearer ${tokenA}` });
    assert(patchRes.status === 200 && patchRes.body.cart.find(i => i.productId === prodSimple.id).quantity === 2, '9. PATCH update item quantity to 2');

    // 10. Merge Guest Cart flow (POST /api/customer/cart/merge)
    const guestCartPayload = [
      { productId: prodSimple.id, variantId: simpleVariant ? simpleVariant.id : undefined, quantity: 3 }
    ];
    if (variant2Id) {
      guestCartPayload.push({ productId: prodWithVariants.id, variantId: variant2Id, quantity: 1 });
    }
    const mergeBRes = await makeRequest('/api/customer/cart/merge', 'POST', {
      guestCart: guestCartPayload
    }, { Authorization: `Bearer ${tokenB}` });
    assert(mergeBRes.status === 200 && mergeBRes.body.cart && mergeBRes.body.cart.length >= 1, '10a. Merge guest cart into Customer B');
    const bProd1Item = mergeBRes.body.cart ? mergeBRes.body.cart.find(i => i.productId === prodSimple.id) : null;
    assert(bProd1Item && bProd1Item.quantity === Math.min(3, initialStockProd1), '10b. Verify guest merge quantity and stock capping');

    // 11. Remove item from cart (DELETE /api/customer/cart/items/:productId)
    const deleteItemRes = await makeRequest(`/api/customer/cart/items/${prodSimple.id}`, 'DELETE', {
      variantId: simpleVariant ? simpleVariant.id : undefined
    }, { Authorization: `Bearer ${tokenA}` });
    assert(deleteItemRes.status === 200, '11. Remove item from Customer A cart');

    // 12. Clear Cart (DELETE /api/customer/cart/clear)
    const clearResReal = await makeRequest('/api/customer/cart/clear', 'DELETE', null, { Authorization: `Bearer ${tokenA}` });
    assert(clearResReal.status === 200 && clearResReal.body.cart.length === 0, '12. Clear Customer A cart');

    // 13. Create Order with Customer B and verify cart is cleared and stock is decremented via db.adjustStock()
    const orderRes = await makeRequest('/api/orders', 'POST', {
      customer: {
        name: 'عميل اختبار ب',
        phone: '01022222222',
        address: 'شارع المعز، القاهرة',
        governorate: 'القاهرة',
        city: 'القاهرة'
      },
      items: [
        {
          productId: prodSimple.id,
          productTitle: prodSimple.title,
          variantSku: simpleVariant ? simpleVariant.sku : undefined,
          quantity: 1,
          price: simpleVariant ? simpleVariant.price : (prodSimple.discountPrice || prodSimple.price)
        }
      ]
    }, { Authorization: `Bearer ${tokenB}` });

    assert(orderRes.status === 201 && orderRes.body.id, '13a. Create Order with Customer B');

    await sleep(200);

    // Check Customer B cart was cleared after order creation
    const cartBResAfterOrder = await makeRequest('/api/customer/cart', 'GET', null, { Authorization: `Bearer ${tokenB}` });
    assert(cartBResAfterOrder.status === 200 && cartBResAfterOrder.body.length === 0, '13b. Customer B saved cart cleared after order');

    await sleep(200);

    // Check stock was decremented for prodSimple
    const prodCheckAfterOrder = await makeRequest(`/api/products/${prodSimple.id}`);
    const checkStockAfter = simpleVariant ? prodCheckAfterOrder.body.variants.find(v => v.id === simpleVariant.id).stock : prodCheckAfterOrder.body.stock;
    assert(checkStockAfter === initialStockProd1 - 1, '13c. Stock decremented via db.adjustStock after order creation');

    await sleep(200);

    // 14. Admin Auth regression check
    const adminMeRes = await makeRequest('/api/admin/me');
    assert(adminMeRes.status === 401 || adminMeRes.status === 200, '14. Admin endpoint operational');

  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    failures++;
  }

  console.log(`\n=== VERIFICATION SUITE COMPLETED: ${failures === 0 ? 'ALL PASSED ✓' : `${failures} FAILURES ✗`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

runVerificationSuite();
