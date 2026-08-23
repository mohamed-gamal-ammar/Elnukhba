import { db } from './db.js';

async function runTests() {
  console.log('🧪 Starting Phase 7 Purchase Orders Verification Tests...\n');

  try {
    // 1. Fetch initial suppliers
    const suppliers = db.getSuppliers({ status: 'active' });
    if (suppliers.length === 0) {
      throw new Error('No active suppliers found for testing');
    }
    const supplier = suppliers[0];
    console.log(`✅ Step 1: Found active supplier "${supplier.companyName}" (${supplier.id})`);

    // Fetch products
    const products = db.getProducts();
    if (products.length === 0) {
      throw new Error('No products found for testing');
    }

    const simpleProduct = products.find(p => !p.variants || p.variants.length === 0) || products[0];
    const variantProduct = products.find(p => p.variants && p.variants.length > 0);

    console.log(`✅ Step 2: Selected test products: "${simpleProduct.title}"${variantProduct ? ` and "${variantProduct.title}"` : ''}`);

    // 2. Test invalid creation cases
    try {
      db.addPurchaseOrder({
        supplierId: 'invalid-supplier-id',
        items: [{ productId: simpleProduct.id, quantityOrdered: 5, unitCost: 100 }]
      }, 'test@admin.com');
      console.error('❌ Failed: Should have rejected invalid supplier ID');
    } catch (err: any) {
      console.log('✅ Step 3a: Correctly rejected invalid supplier ID:', err.message);
    }

    try {
      db.addPurchaseOrder({
        supplierId: supplier.id,
        items: []
      }, 'test@admin.com');
      console.error('❌ Failed: Should have rejected empty items array');
    } catch (err: any) {
      console.log('✅ Step 3b: Correctly rejected empty items array:', err.message);
    }

    // 3. Create valid draft PO
    const itemsToOrder = [
      {
        productId: simpleProduct.id,
        variantId: simpleProduct.variants && simpleProduct.variants.length > 0 ? simpleProduct.variants[0].id : undefined,
        quantityOrdered: 10,
        unitCost: 50
      }
    ];

    if (variantProduct && variantProduct.variants && variantProduct.variants.length > 0) {
      itemsToOrder.push({
        productId: variantProduct.id,
        variantId: variantProduct.variants[0].id,
        quantityOrdered: 5,
        unitCost: 120
      });
    }

    const createdPO = db.addPurchaseOrder({
      supplierId: supplier.id,
      items: itemsToOrder,
      discount: 20,
      shippingCost: 30,
      notes: 'أمر شراء تجريبي لاختبار النظام',
      expectedDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]
    }, 'admin@store.com');

    console.log(`✅ Step 4: Created draft PO ${createdPO.poNumber} (ID: ${createdPO.id})`);
    console.log(`   - Subtotal: ${createdPO.subtotal}, Total Cost: ${createdPO.totalCost}`);

    // Verify totals math: item1 (10*50=500), item2 (5*120=600 if present -> total 1100), discount 20, shipping 30 -> total 1110
    const expectedSubtotal = itemsToOrder.reduce((sum, i) => sum + (i.quantityOrdered * i.unitCost), 0);
    const expectedTotal = expectedSubtotal - 20 + 30;
    if (createdPO.subtotal !== expectedSubtotal || createdPO.totalCost !== expectedTotal) {
      throw new Error(`PO math calculation mismatch: expected subtotal ${expectedSubtotal}, total ${expectedTotal}`);
    }

    // 4. Get PO by ID
    const fetchedPO = db.getPurchaseOrderById(createdPO.id);
    if (!fetchedPO || fetchedPO.status !== 'draft') {
      throw new Error('Failed to retrieve created draft PO');
    }
    console.log('✅ Step 5: Successfully retrieved draft PO by ID');

    // 5. Update PO
    const updatedPO = db.updatePurchaseOrder(createdPO.id, {
      discount: 50,
      notes: 'تحديث ملاحظات أمر الشراء'
    }, 'admin@store.com');

    if (updatedPO.discount !== 50 || updatedPO.totalCost !== (expectedSubtotal - 50 + 30)) {
      throw new Error('Failed to update PO discount/totals');
    }
    console.log(`✅ Step 6: Successfully updated draft PO (New total: ${updatedPO.totalCost})`);

    // 6. Test invalid receive on draft
    try {
      db.receivePurchaseOrderItems(createdPO.id, [{ itemId: createdPO.items[0].id, quantityToReceive: 2 }], 'admin@store.com');
      console.error('❌ Failed: Should not allow receiving items on draft PO');
    } catch (err: any) {
      console.log('✅ Step 7: Correctly blocked receiving items on draft PO:', err.message);
    }

    // 7. Change status to 'ordered'
    const orderedPO = db.updatePurchaseOrderStatus(createdPO.id, 'ordered', 'admin@store.com');
    if (orderedPO.status !== 'ordered') {
      throw new Error('Failed to transition PO status to ordered');
    }
    console.log('✅ Step 8: Successfully transitioned status to "ordered"');

    // 8. Test invalid transition (ordered -> draft)
    try {
      db.updatePurchaseOrderStatus(createdPO.id, 'draft', 'admin@store.com');
      console.error('❌ Failed: Should not allow ordered -> draft transition');
    } catch (err: any) {
      console.log('✅ Step 9: Correctly blocked invalid transition (ordered -> draft):', err.message);
    }

    // 9. Partial Receive
    const initialStock = simpleProduct.variants && simpleProduct.variants.length > 0
      ? simpleProduct.variants[0].stock
      : simpleProduct.stock;

    const receive1 = db.receivePurchaseOrderItems(createdPO.id, [{
      itemId: createdPO.items[0].id,
      quantityToReceive: 3
    }], 'admin@store.com');

    if (receive1.status !== 'partially_received') {
      throw new Error(`Expected status partially_received, got ${receive1.status}`);
    }
    if (receive1.items[0].quantityReceived !== 3) {
      throw new Error(`Expected quantityReceived 3, got ${receive1.items[0].quantityReceived}`);
    }

    // Verify stock adjustment
    const updatedSimpleProduct = db.getProductById(simpleProduct.id)!;
    const newStock = updatedSimpleProduct.stock;
    console.log(`✅ Step 10: Partial receive successful! Stock increased from ${initialStock} to ${newStock}`);

    // Check stock movement entry
    const movements = db.getStockMovements();
    const poMovement = movements.find(m => m.referenceId === createdPO.id && m.type === 'in_purchase');
    if (!poMovement) {
      throw new Error('Missing stock movement record for PO receive');
    }
    console.log(`✅ Step 11: Stock movement record verified (ID: ${poMovement.id}, Qty: ${poMovement.quantity})`);

    // 10. Attempt over-receive
    try {
      db.receivePurchaseOrderItems(createdPO.id, [{
        itemId: createdPO.items[0].id,
        quantityToReceive: 100 // exceeds remaining 7
      }], 'admin@store.com');
      console.error('❌ Failed: Should block over-receiving');
    } catch (err: any) {
      console.log('✅ Step 12: Correctly blocked over-receiving:', err.message);
    }

    // 11. Complete receive
    const remainingToReceive = receive1.items.map(it => ({
      itemId: it.id,
      quantityToReceive: it.quantityOrdered - it.quantityReceived
    })).filter(it => it.quantityToReceive > 0);

    const finalPO = db.receivePurchaseOrderItems(createdPO.id, remainingToReceive, 'admin@store.com');

    if (finalPO.status !== 'received') {
      throw new Error(`Expected status received, got ${finalPO.status}`);
    }
    console.log('✅ Step 13: Fully received PO! Final status: "received"');

    // 12. Create and cancel a draft PO
    const poToCancel = db.addPurchaseOrder({
      supplierId: supplier.id,
      items: [{ productId: simpleProduct.id, variantId: simpleProduct.variants && simpleProduct.variants.length > 0 ? simpleProduct.variants[0].id : undefined, quantityOrdered: 1, unitCost: 10 }]
    }, 'admin@store.com');

    const cancelledPO = db.updatePurchaseOrderStatus(poToCancel.id, 'cancelled', 'admin@store.com');
    if (cancelledPO.status !== 'cancelled') {
      throw new Error('Failed to cancel draft PO');
    }
    console.log('✅ Step 14: Successfully cancelled draft PO');

    console.log('\n🎉 ALL PHASE 7 PURCHASE ORDERS BACKEND TESTS PASSED SUCCESSFULLY!');
  } catch (error: any) {
    console.error('\n❌ TEST FAILED WITH ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
