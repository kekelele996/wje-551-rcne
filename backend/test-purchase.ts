import assert from 'node:assert';
import { PurchaseOrderStatus } from './src/constants/enums.js';
import { inventories } from './src/database/seeds/initial.js';
import { inventoryService } from './src/services/inventory.service.js';
import { purchaseOrdersService as svc } from './src/services/purchase-orders.service.js';

const purchase = { id: 'u-purchase', name: '采购经理' } as any;
const warehouse = { id: 'u-warehouse', name: '仓库经理' } as any;

function invQty(warehouseId: string, skuId: string) {
  return inventories.find((i) => i.warehouseId === warehouseId && i.skuId === skuId)?.quantity ?? 0;
}

async function expectErrorAsync(fn: () => Promise<unknown>, snippet: string) {
  try {
    await fn();
    throw new Error(`应抛出异常但未抛出: ${snippet}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('应抛出异常')) throw error;
    if (error instanceof Error && !error.message.includes(snippet)) throw error;
  }
}

function expectError(fn: () => unknown, snippet: string) {
  try {
    fn();
    throw new Error(`应抛出异常但未抛出: ${snippet}`);
  } catch (error) {
    if (error instanceof Error && !error.message.includes(snippet)) throw error;
  }
}

// 1. 创建：供应商 + 目标仓库 + 多行
const order = svc.create({
  supplierId: 'sup-1',
  warehouseId: 'wh-east',
  items: [
    { skuId: 'SKU-T1', skuName: '测试料一', quantity: 100 },
    { skuId: 'SKU-T2', skuName: '测试料二', quantity: 50 },
  ],
}, purchase);
assert.equal(order.status, PurchaseOrderStatus.DRAFT);
const id = order.id;

// 2. 重复 SKU 行不允许
expectError(() => svc.create({ supplierId: 'sup-1', warehouseId: 'wh-east', items: [{ skuId: 'X', skuName: 'a', quantity: 1 }, { skuId: 'X', skuName: 'b', quantity: 1 }] }), '重复');

// 3. 待审核状态不能登记到货
await expectErrorAsync(() => svc.receive(id, { batchNo: 'B0', items: [{ skuId: 'SKU-T1', receivedQuantity: 10, acceptedQuantity: 10 }] }, warehouse), '不允许登记到货');

// 4. 审核后数量冻结，不能改单
svc.approve(id, purchase);
expectError(() => svc.update(id, { remark: 'x' }, purchase), '不能改单');

// 5. 超收（累计合格 > 订购）整次不生效，订单与库存保持原样
const before = svc.detail(id);
const q1Before = invQty('wh-east', 'SKU-T1');
const q2Before = invQty('wh-east', 'SKU-T2');
await expectErrorAsync(() => svc.receive(id, { batchNo: 'B-OVER', items: [{ skuId: 'SKU-T1', receivedQuantity: 120, acceptedQuantity: 120 }] }, warehouse), '超过订购');
assert.equal(svc.detail(id).status, PurchaseOrderStatus.APPROVED, '超收后状态不变');
assert.equal(invQty('wh-east', 'SKU-T1'), q1Before, '超收后库存不变');
assert.deepStrictEqual(svc.detail(id).progressItems.map((i) => i.acceptedQuantity), [0, 0]);

// 6. 部分合格：拒收品只留记录，合格品入库
const r1 = await svc.receive(id, {
  batchNo: 'B1',
  remark: '10 件破损拒收',
  items: [
    { skuId: 'SKU-T1', receivedQuantity: 40, acceptedQuantity: 30 },
    { skuId: 'SKU-T2', receivedQuantity: 20, acceptedQuantity: 20 },
  ],
}, warehouse);
assert.equal(r1.status, PurchaseOrderStatus.PARTIAL_RECEIVED, '部分合格显示部分到货');
assert.equal(r1.totalAccepted, 50);
assert.equal(r1.totalRemaining, 100);
assert.equal(invQty('wh-east', 'SKU-T1') - q1Before, 30, '只有合格品入库');
assert.equal(invQty('wh-east', 'SKU-T2') - q2Before, 20);
const receiptRecord = r1.receipts.find((r) => r.batchNo === 'B1')!;
assert.equal(receiptRecord.rejectedQuantity, 10, '拒收数仅在批次记录中');

// 7. 重复批次整次不生效（含未提交的新到货数量）
const q1Mid = invQty('wh-east', 'SKU-T1');
await expectErrorAsync(() => svc.receive(id, { batchNo: 'B1', items: [{ skuId: 'SKU-T1', receivedQuantity: 999, acceptedQuantity: 70 }] }, warehouse), '重复批次');
assert.equal(invQty('wh-east', 'SKU-T1'), q1Mid, '重复批次库存不变');
assert.equal(svc.detail(id).totalAccepted, 50, '重复批次累计不变');

// 8. 并发：同一批次号并发登记，只能成功一次；另一批同时超收也失败
const concurrent = [
  svc.receive(id, { batchNo: 'B-RACE', items: [{ skuId: 'SKU-T1', receivedQuantity: 70, acceptedQuantity: 70 }, { skuId: 'SKU-T2', receivedQuantity: 30, acceptedQuantity: 30 }] }, warehouse),
  svc.receive(id, { batchNo: 'B-RACE', items: [{ skuId: 'SKU-T1', receivedQuantity: 70, acceptedQuantity: 70 }, { skuId: 'SKU-T2', receivedQuantity: 30, acceptedQuantity: 30 }] }, warehouse),
];
const results = await Promise.allSettled(concurrent);
const fulfilled = results.filter((r) => r.status === 'fulfilled');
const rejected = results.filter((r) => r.status === 'rejected');
assert.equal(fulfilled.length, 1, '并发同批次仅一次成功');
assert.equal(rejected.length, 1);
assert.equal(svc.detail(id).totalAccepted, 150, '并发后累计不翻倍');
assert.equal(invQty('wh-east', 'SKU-T1') - q1Before, 100);
assert.equal(invQty('wh-east', 'SKU-T2') - q2Before, 50);

// 9. 全部合格 → CLOSED
assert.equal(svc.detail(id).status, PurchaseOrderStatus.CLOSED);

// 10. 关闭后不能到货、不能改单
await expectErrorAsync(() => svc.receive(id, { batchNo: 'B-LATE', items: [{ skuId: 'SKU-T1', receivedQuantity: 1, acceptedQuantity: 0 }] }, warehouse), '不允许登记到货');
expectError(() => svc.approve(id, purchase), '只有待审核');

// 11. 跨订单批次号也唯一（整单内唯一即可，这里 B1 已存在）
const order2 = svc.create({ supplierId: 'sup-2', warehouseId: 'wh-south', items: [{ skuId: 'SKU-T3', skuName: '测试料三', quantity: 10 }] }, purchase);
svc.approve(order2.id, purchase);
await expectErrorAsync(() => svc.receive(order2.id, { batchNo: 'B1', items: [{ skuId: 'SKU-T3', receivedQuantity: 5, acceptedQuantity: 5 }] }, warehouse), '重复批次');

// 12. 一批多行，其中一行超收 → 整批回滚（另一行合格量也不能入库）
const o3 = svc.create({ supplierId: 'sup-1', warehouseId: 'wh-east', items: [{ skuId: 'SKU-T4', skuName: '四', quantity: 5 }, { skuId: 'SKU-T5', skuName: '五', quantity: 5 }] }, purchase);
svc.approve(o3.id, purchase);
const q4 = invQty('wh-east', 'SKU-T4');
const q5 = invQty('wh-east', 'SKU-T5');
await expectErrorAsync(() => svc.receive(o3.id, {
  batchNo: 'B-MIX',
  items: [{ skuId: 'SKU-T4', receivedQuantity: 3, acceptedQuantity: 3 }, { skuId: 'SKU-T5', receivedQuantity: 9, acceptedQuantity: 9 }],
}, warehouse), '超过订购');
assert.equal(invQty('wh-east', 'SKU-T4'), q4, '整批回滚：SKU-T4 未入库');
assert.equal(invQty('wh-east', 'SKU-T5'), q5);
assert.equal(svc.detail(o3.id).status, PurchaseOrderStatus.APPROVED);

console.log('✅ 采购订单与分批到货闭环全部规则验证通过');
