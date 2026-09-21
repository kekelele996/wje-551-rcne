import { v4 as uuid } from 'uuid';
import { PurchaseOrderStatus } from '../constants/enums.js';
import { purchaseOrders, suppliers, warehouses } from '../database/seeds/initial.js';
import type { PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem, User } from '../types/index.js';
import { auditService } from './audit.service.js';
import { inventoryService } from './inventory.service.js';
import { BusinessException } from '../utils/response.js';
import { assertPositiveInteger, assertRequired } from '../utils/validation.js';

interface ReceiptItemInput {
  skuId: string;
  skuName?: string;
  receivedQuantity: number;
  acceptedQuantity: number;
}

interface ReceivePayload {
  batchNo: string;
  remark?: string;
  items: ReceiptItemInput[];
}

interface PurchaseOrderProgressItem extends PurchaseOrderItem {
  remainingQuantity: number;
  progress: number;
}

export interface PurchaseOrderView extends PurchaseOrder {
  supplier?: ReturnType<typeof findSupplier>;
  warehouse?: ReturnType<typeof findWarehouse>;
  progressItems: PurchaseOrderProgressItem[];
  totalOrdered: number;
  totalAccepted: number;
  totalRemaining: number;
  totalReceived: number;
}

const findSupplier = (id: string) => suppliers.find((item) => item.id === id);
const findWarehouse = (id: string) => warehouses.find((item) => item.id === id);

/** 按采购单串行化到货登记，保证重复/并发批次只有一次能生效 */
const orderLocks = new Map<string, Promise<unknown>>();

function withOrderLock<T>(orderId: string, task: () => T | Promise<T>): Promise<T> {
  const previous = orderLocks.get(orderId) ?? Promise.resolve();
  // result 归调用方；tail 已吞掉拒绝态，仅用于串行排队，避免未处理拒绝
  const result = previous.then(task, task);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  orderLocks.set(orderId, tail);
  tail.finally(() => {
    if (orderLocks.get(orderId) === tail) orderLocks.delete(orderId);
  });
  return result;
}

function nextOrderNo() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `PO-${date}-${String(purchaseOrders.length + 1).padStart(4, '0')}`;
}

function decorate(order: PurchaseOrder): PurchaseOrderView {
  const progressItems: PurchaseOrderProgressItem[] = order.items.map((item) => ({
    ...item,
    remainingQuantity: item.orderedQuantity - item.acceptedQuantity,
    progress: item.orderedQuantity === 0 ? 0 : Number((item.acceptedQuantity / item.orderedQuantity).toFixed(4)),
  }));
  return {
    ...order,
    supplier: findSupplier(order.supplierId),
    warehouse: findWarehouse(order.warehouseId),
    progressItems,
    totalOrdered: progressItems.reduce((sum, item) => sum + item.orderedQuantity, 0),
    totalAccepted: progressItems.reduce((sum, item) => sum + item.acceptedQuantity, 0),
    totalRemaining: progressItems.reduce((sum, item) => sum + item.remainingQuantity, 0),
    totalReceived: order.receipts.reduce((sum, receipt) => sum + receipt.receivedQuantity, 0),
  };
}

export class PurchaseOrdersService {
  list(query: Record<string, string | undefined>) {
    return purchaseOrders
      .filter((order) => !query.orderNo || order.orderNo.includes(query.orderNo))
      .filter((order) => !query.supplierId || order.supplierId === query.supplierId)
      .filter((order) => !query.warehouseId || order.warehouseId === query.warehouseId)
      .filter((order) => !query.status || order.status === query.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(decorate);
  }

  detail(id: string): PurchaseOrderView {
    const order = purchaseOrders.find((item) => item.id === id);
    if (!order) throw new BusinessException(404, '采购订单不存在');
    return decorate(order);
  }

  create(payload: { supplierId?: string; warehouseId?: string; remark?: string; items?: Array<{ skuId?: string; skuName?: string; quantity?: number }> }, user?: User) {
    assertRequired(payload.supplierId, '供应商');
    assertRequired(payload.warehouseId, '目标仓库');
    const supplier = suppliers.find((item) => item.id === payload.supplierId);
    if (!supplier) throw new BusinessException(404, '供应商不存在');
    const warehouse = warehouses.find((item) => item.id === payload.warehouseId);
    if (!warehouse) throw new BusinessException(404, '目标仓库不存在');
    if (warehouse.status !== 'ACTIVE') throw new BusinessException(400, '目标仓库未启用，不能下单');
    if (!Array.isArray(payload.items) || payload.items.length === 0) throw new BusinessException(400, '至少填写一行采购明细');

    const skuIds = new Set<string>();
    const now = new Date().toISOString();
    const orderId = uuid();
    const items = payload.items.map((line) => {
      assertRequired(line.skuId, 'SKU 编码');
      assertRequired(line.skuName, 'SKU 名称');
      assertPositiveInteger(Number(line.quantity), '订购数量');
      if (skuIds.has(line.skuId!)) throw new BusinessException(400, `SKU ${line.skuId} 在同一订单中重复`);
      skuIds.add(line.skuId!);
      return { id: uuid(), orderId, skuId: line.skuId!, skuName: line.skuName!, orderedQuantity: Number(line.quantity), acceptedQuantity: 0 };
    });

    const order: PurchaseOrder = {
      id: orderId,
      orderNo: nextOrderNo(),
      supplierId: payload.supplierId!,
      warehouseId: payload.warehouseId!,
      status: PurchaseOrderStatus.DRAFT,
      remark: payload.remark ?? '',
      items,
      receipts: [],
      createdBy: user?.name ?? '系统',
      createdAt: now,
      updatedAt: now,
    };
    purchaseOrders.unshift(order);
    auditService.record({ action: 'CREATE', module: 'PURCHASE_ORDER', targetId: order.id, targetName: order.orderNo, detail: { items } }, user);
    return this.detail(order.id);
  }

  /** 审核通过：数量自此冻结，只能通过到货登记累计合格数 */
  approve(id: string, user?: User) {
    const order = this.requireOrder(id);
    if (order.status !== PurchaseOrderStatus.DRAFT) throw new BusinessException(400, '只有待审核订单可以审核');
    const now = new Date().toISOString();
    order.status = PurchaseOrderStatus.APPROVED;
    order.approvedAt = now;
    order.approver = user?.name ?? '系统';
    order.updatedAt = now;
    auditService.record({ action: 'STATUS_CHANGE', module: 'PURCHASE_ORDER', targetId: order.id, targetName: order.orderNo, detail: { before: PurchaseOrderStatus.DRAFT, after: order.status } }, user);
    return this.detail(id);
  }

  update(id: string, payload: { remark?: string }, user?: User) {
    const order = this.requireOrder(id);
    if (order.status !== PurchaseOrderStatus.DRAFT) throw new BusinessException(400, '订单审核后数量冻结，已关闭或已审核的订单不能改单');
    if (payload.remark !== undefined) order.remark = payload.remark;
    order.updatedAt = new Date().toISOString();
    auditService.record({ action: 'UPDATE', module: 'PURCHASE_ORDER', targetId: order.id, targetName: order.orderNo, detail: payload }, user);
    return this.detail(id);
  }

  receive(id: string, payload: ReceivePayload, user?: User) {
    // 同一采购单的到货登记串行执行，重复批次或并发提交最多一次成功
    return withOrderLock(id, () => this.applyReceipt(id, payload, user));
  }

  private applyReceipt(id: string, payload: ReceivePayload, user?: User): PurchaseOrderView {
    const order = this.requireOrder(id);
    assertRequired(payload.batchNo, '批次号');
    const batchNo = String(payload.batchNo).trim();
    if (![PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIAL_RECEIVED].includes(order.status)) {
      throw new BusinessException(400, '当前订单状态不允许登记到货');
    }
    if (purchaseOrders.some((po) => po.receipts.some((receipt) => receipt.batchNo === batchNo))) {
      throw new BusinessException(400, `批次号 ${batchNo} 已登记，重复批次整次不生效`);
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) throw new BusinessException(400, '至少登记一行到货明细');
    if (payload.items.every((line) => Number(line.receivedQuantity) <= 0)) throw new BusinessException(400, '到货数量不能全部为 0');

    // ---- 先做全部校验，任何一行不通过则整次不生效，订单与库存保持原样 ----
    const seenSku = new Set<string>();
    const receiptItems: PurchaseReceiptItem[] = payload.items.map((line) => {
      assertRequired(line.skuId, 'SKU 编码');
      if (seenSku.has(line.skuId)) throw new BusinessException(400, `SKU ${line.skuId} 在本次到货中重复登记，整次到货不生效`);
      seenSku.add(line.skuId);
      const orderItem = order.items.find((item) => item.skuId === line.skuId);
      if (!orderItem) throw new BusinessException(400, `SKU ${line.skuId} 不在采购订单中，整次到货不生效`);
      const receivedQuantity = Number(line.receivedQuantity);
      const acceptedQuantity = Number(line.acceptedQuantity);
      assertPositiveInteger(receivedQuantity, '到货数量');
      if (!Number.isInteger(acceptedQuantity) || acceptedQuantity < 0) throw new BusinessException(400, '合格数量必须为非负整数');
      if (acceptedQuantity > receivedQuantity) throw new BusinessException(400, `SKU ${line.skuId} 合格数量不能大于到货数量，整次到货不生效`);
      const projected = orderItem.acceptedQuantity + acceptedQuantity;
      if (projected > orderItem.orderedQuantity) {
        throw new BusinessException(400, `SKU ${line.skuId} 累计合格 ${projected} 超过订购 ${orderItem.orderedQuantity}，整次到货不生效`);
      }
      return { skuId: line.skuId, receivedQuantity, acceptedQuantity };
    });

    // ---- 合格品写入目标仓库库存；写入失败回滚已入库数量，保证整次原子性 ----
    const applied: Array<{ skuId: string; quantity: number }> = [];
    try {
      for (const line of receiptItems) {
        if (line.acceptedQuantity <= 0) continue;
        const orderItem = order.items.find((item) => item.skuId === line.skuId)!;
        inventoryService.inbound({ warehouseId: order.warehouseId, skuId: orderItem.skuId, skuName: orderItem.skuName, quantity: line.acceptedQuantity }, user);
        applied.push({ skuId: orderItem.skuId, quantity: line.acceptedQuantity });
      }
    } catch (error) {
      // 补偿出库，恢复库存到货前快照
      applied.forEach((line) => {
        try {
          inventoryService.outbound({ warehouseId: order.warehouseId, skuId: line.skuId, quantity: line.quantity }, user);
        } catch {
          /* 入库量必然足够补偿出库，忽略补偿失败 */
        }
      });
      throw error;
    }

    // ---- 库存落库成功后才更新订单累计合格数与状态 ----
    receiptItems.forEach((line) => {
      const orderItem = order.items.find((item) => item.skuId === line.skuId)!;
      orderItem.acceptedQuantity += line.acceptedQuantity;
    });

    const receivedTotal = receiptItems.reduce((sum, item) => sum + item.receivedQuantity, 0);
    const acceptedTotal = receiptItems.reduce((sum, item) => sum + item.acceptedQuantity, 0);
    const receipt: PurchaseReceipt = {
      id: uuid(),
      orderId: order.id,
      batchNo,
      receivedQuantity: receivedTotal,
      acceptedQuantity: acceptedTotal,
      rejectedQuantity: receivedTotal - acceptedTotal,
      items: receiptItems,
      operator: user?.name ?? '系统',
      remark: payload.remark ?? '',
      createdAt: new Date().toISOString(),
    };
    order.receipts.unshift(receipt);

    const allAccepted = order.items.every((item) => item.acceptedQuantity >= item.orderedQuantity);
    const before = order.status;
    if (allAccepted) {
      order.status = PurchaseOrderStatus.CLOSED;
      order.closedAt = receipt.createdAt;
    } else {
      order.status = PurchaseOrderStatus.PARTIAL_RECEIVED;
    }
    order.updatedAt = receipt.createdAt;

    auditService.record({
      action: 'STATUS_CHANGE',
      module: 'PURCHASE_ORDER',
      targetId: order.id,
      targetName: order.orderNo,
      detail: { type: 'RECEIVE', batchNo, receipt, before, after: order.status },
    }, user);
    return this.detail(order.id);
  }

  private requireOrder(id: string) {
    const order = purchaseOrders.find((item) => item.id === id);
    if (!order) throw new BusinessException(404, '采购订单不存在');
    return order;
  }
}

export const purchaseOrdersService = new PurchaseOrdersService();
