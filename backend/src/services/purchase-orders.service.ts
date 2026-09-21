import { v4 as uuid } from 'uuid';
import { PurchaseOrderStatus, SupplierStatus } from '../constants/enums.js';
import { inventories, purchaseOrders, suppliers, warehouses } from '../database/seeds/initial.js';
import type { PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem, User } from '../types/index.js';
import { auditService } from './audit.service.js';
import { calculateAlertLevel, inventoryService } from './inventory.service.js';
import { BusinessException } from '../utils/response.js';
import { assertNonNegativeInteger, assertPositiveInteger, assertRequired } from '../utils/validation.js';
import { KeyedMutex } from '../utils/lock.js';

export interface PurchaseOrderLineInput {
  skuId: string;
  skuName: string;
  orderedQuantity: number;
}

export interface PurchaseReceiptLineInput {
  skuId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
}

function nextOrderNo() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `PO-${date}-${String(purchaseOrders.length + 1).padStart(4, '0')}`;
}

const receivableStatuses = [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIAL_RECEIVED];
const receiveLocks = new KeyedMutex();

export class PurchaseOrdersService {
  list(query: Record<string, string | undefined>) {
    return purchaseOrders
      .filter((order) => !query.orderNo || order.orderNo.includes(query.orderNo))
      .filter((order) => !query.supplierId || order.supplierId === query.supplierId)
      .filter((order) => !query.warehouseId || order.warehouseId === query.warehouseId)
      .filter((order) => !query.status || order.status === query.status)
      .map((order) => this.decorate(order))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  detail(id: string) {
    return this.decorate(this.requireOrder(id));
  }

  create(payload: { supplierId: string; warehouseId: string; remark?: string; items: PurchaseOrderLineInput[] }, user?: User) {
    assertRequired(payload.supplierId, '供应商');
    assertRequired(payload.warehouseId, '目标仓库');
    const supplier = suppliers.find((item) => item.id === payload.supplierId);
    if (!supplier) throw new BusinessException(404, '供应商不存在');
    if (supplier.status === SupplierStatus.BLACKLISTED) throw new BusinessException(400, '黑名单供应商不能创建采购单');
    const warehouse = warehouses.find((item) => item.id === payload.warehouseId);
    if (!warehouse) throw new BusinessException(404, '目标仓库不存在');
    if (warehouse.status !== 'ACTIVE') throw new BusinessException(400, '目标仓库未启用');
    const items = this.normalizeLines(payload.items);
    const now = new Date().toISOString();
    const order: PurchaseOrder = {
      id: uuid(),
      orderNo: nextOrderNo(),
      supplierId: payload.supplierId,
      warehouseId: payload.warehouseId,
      status: PurchaseOrderStatus.PENDING_APPROVAL,
      remark: payload.remark ?? '',
      items: items.map((line) => ({ id: uuid(), skuId: line.skuId, skuName: line.skuName, orderedQuantity: line.orderedQuantity, acceptedQuantity: 0 })),
      receipts: [],
      timeline: [{ id: uuid(), action: 'CREATE', operator: user?.name ?? '系统', note: '创建采购单', createdAt: now }],
      createdBy: user?.id ?? 'system',
      createdAt: now,
      updatedAt: now,
    };
    purchaseOrders.unshift(order);
    auditService.record({ action: 'CREATE', module: 'PURCHASE_ORDER', targetId: order.id, targetName: order.orderNo, detail: { items: order.items } }, user);
    return this.decorate(order);
  }

  update(id: string, payload: { remark?: string; items: PurchaseOrderLineInput[] }, user?: User) {
    const order = this.requireOrder(id);
    if (order.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw new BusinessException(400, '仅待审核采购单可以修改，审核后订购数量已冻结');
    }
    const items = this.normalizeLines(payload.items);
    order.items = items.map((line) => ({ id: uuid(), skuId: line.skuId, skuName: line.skuName, orderedQuantity: line.orderedQuantity, acceptedQuantity: 0 }));
    order.remark = payload.remark ?? order.remark;
    this.touch(order, 'UPDATE', user, '修改采购单明细');
    auditService.record({ action: 'UPDATE', module: 'PURCHASE_ORDER', targetId: order.id, targetName: order.orderNo, detail: { items: order.items } }, user);
    return this.decorate(order);
  }

  approve(id: string, user?: User) {
    const order = this.requireOrder(id);
    if (order.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw new BusinessException(400, `当前状态${order.status}不允许审核`);
    }
    order.status = PurchaseOrderStatus.APPROVED;
    this.touch(order, 'APPROVE', user, '审核通过，订购数量冻结');
    auditService.record({ action: 'STATUS_CHANGE', module: 'PURCHASE_ORDER', targetId: order.id, targetName: order.orderNo, detail: { after: order.status } }, user);
    return this.decorate(order);
  }

  cancel(id: string, user?: User) {
    const order = this.requireOrder(id);
    if (order.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw new BusinessException(400, '仅待审核采购单可以取消');
    }
    order.status = PurchaseOrderStatus.CANCELLED;
    this.touch(order, 'CANCEL', user, '取消采购单');
    auditService.record({ action: 'STATUS_CHANGE', module: 'PURCHASE_ORDER', targetId: order.id, targetName: order.orderNo, detail: { after: order.status } }, user);
    return this.decorate(order);
  }

  /**
   * 登记一次分批到货。整批为一个事务边界：
   * 批次号重复、累计合格超过订购任一情况发生时，整次登记不生效，
   * 采购单与库存均保持原样（已做的入库全部回滚）。
   * 同一采购单的并发登记通过单据级互斥锁串行，保证只有一次成功。
   */
  async receive(id: string, payload: { batchNo: string; remark?: string; items: PurchaseReceiptLineInput[] }, user?: User) {
    return receiveLocks.run(id, async () => this.receiveLocked(id, payload, user));
  }

  private receiveLocked(id: string, payload: { batchNo: string; remark?: string; items: PurchaseReceiptLineInput[] }, user?: User) {
    const order = this.requireOrder(id);
    if (!receivableStatuses.includes(order.status)) {
      throw new BusinessException(400, `当前状态${order.status}不允许登记到货`);
    }
    assertRequired(payload.batchNo, '批次号');
    if (purchaseOrders.some((other) => other.receipts.some((receipt) => receipt.batchNo === payload.batchNo))) {
      throw new BusinessException(400, `批次号${payload.batchNo}已存在，整次登记不生效`);
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) throw new BusinessException(400, '到货明细不能为空');

    const lines = payload.items.map((line) => {
      assertRequired(line.skuId, 'SKU');
      const receivedQuantity = Number(line.receivedQuantity);
      const acceptedQuantity = Number(line.acceptedQuantity);
      assertPositiveInteger(receivedQuantity, `${line.skuId}到货数`);
      assertNonNegativeInteger(acceptedQuantity, `${line.skuId}合格数`);
      if (acceptedQuantity > receivedQuantity) {
        throw new BusinessException(400, `${line.skuId}合格数不能超过到货数`);
      }
      const item = order.items.find((candidate) => candidate.skuId === line.skuId);
      if (!item) throw new BusinessException(400, `SKU ${line.skuId}不在采购单${order.orderNo}中，整次登记不生效`);
      if (item.acceptedQuantity + acceptedQuantity > item.orderedQuantity) {
        throw new BusinessException(400, `SKU ${line.skuId}累计合格数将超过订购数，整次登记不生效`);
      }
      return { item, receivedQuantity, acceptedQuantity };
    });

    // 先入账再累计，任何异常都回滚本次全部入库，订单与库存保持原样
    const inbound: Array<{ skuId: string; quantity: number }> = [];
    const before = order.items.map((item) => item.acceptedQuantity);
    try {
      lines.forEach(({ item, acceptedQuantity }) => {
        if (acceptedQuantity > 0) {
          inventoryService.inbound({ warehouseId: order.warehouseId, skuId: item.skuId, skuName: item.skuName, quantity: acceptedQuantity }, user);
          inbound.push({ skuId: item.skuId, quantity: acceptedQuantity });
        }
        item.acceptedQuantity += acceptedQuantity;
      });
    } catch (error) {
      this.rollbackInbound(order.warehouseId, inbound);
      order.items.forEach((item, index) => { item.acceptedQuantity = before[index]; });
      throw error;
    }

    const now = new Date().toISOString();
    const receiptItems: PurchaseReceiptItem[] = lines.map(({ item, receivedQuantity, acceptedQuantity }) => ({
      id: uuid(),
      itemId: item.id,
      skuId: item.skuId,
      skuName: item.skuName,
      receivedQuantity,
      acceptedQuantity,
      rejectedQuantity: receivedQuantity - acceptedQuantity,
    }));
    const receipt: PurchaseReceipt = {
      id: uuid(),
      batchNo: payload.batchNo,
      items: receiptItems,
      operator: user?.name ?? '系统',
      remark: payload.remark ?? '',
      arrivedAt: now,
      createdAt: now,
    };
    order.receipts.unshift(receipt);
    order.status = this.computeStatus(order);
    this.touch(order, 'RECEIVE', user, `登记批次${payload.batchNo}到货`);
    auditService.record(
      {
        action: 'STATUS_CHANGE',
        module: 'PURCHASE_ORDER',
        targetId: order.id,
        targetName: order.orderNo,
        detail: { batchNo: receipt.batchNo, items: receiptItems, rejectedOnly: receiptItems.filter((item) => item.rejectedQuantity > 0), after: order.status },
      },
      user,
    );
    return this.decorate(order);
  }

  private rollbackInbound(warehouseId: string, inbound: Array<{ skuId: string; quantity: number }>) {
    // 登记失败时静默回补库存：不产生入库/出库审计记录，保持库存与登记前完全一致
    inbound.forEach(({ skuId, quantity }) => {
      const inventory = inventories.find((item) => item.warehouseId === warehouseId && item.skuId === skuId);
      if (inventory) {
        inventory.quantity -= quantity;
        inventory.alertLevel = calculateAlertLevel(inventory.quantity, inventory.safetyStock);
        inventory.updatedAt = new Date().toISOString();
      }
    });
  }

  private computeStatus(order: PurchaseOrder) {
    if (order.items.every((item) => item.acceptedQuantity === item.orderedQuantity)) return PurchaseOrderStatus.CLOSED;
    if (order.items.some((item) => item.acceptedQuantity > 0)) return PurchaseOrderStatus.PARTIAL_RECEIVED;
    return PurchaseOrderStatus.APPROVED;
  }

  private normalizeLines(items: PurchaseOrderLineInput[]): PurchaseOrderLineInput[] {
    if (!Array.isArray(items) || items.length === 0) throw new BusinessException(400, '采购明细至少一行');
    const seen = new Set<string>();
    return items.map((line) => {
      assertRequired(line.skuId, 'SKU 编码');
      assertRequired(line.skuName, 'SKU 名称');
      assertPositiveInteger(Number(line.orderedQuantity), `${line.skuId}订购数量`);
      if (seen.has(line.skuId)) throw new BusinessException(400, `SKU ${line.skuId}在同一采购单中重复`);
      seen.add(line.skuId);
      return { skuId: line.skuId, skuName: line.skuName, orderedQuantity: Number(line.orderedQuantity) };
    });
  }

  private requireOrder(id: string) {
    const order = purchaseOrders.find((item) => item.id === id);
    if (!order) throw new BusinessException(404, '采购单不存在');
    return order;
  }

  private touch(order: PurchaseOrder, action: PurchaseOrder['timeline'][number]['action'], user: User | undefined, note: string) {
    const now = new Date().toISOString();
    order.updatedAt = now;
    order.timeline.unshift({ id: uuid(), action, operator: user?.name ?? '系统', note, createdAt: now });
  }

  /** 汇总每行累计合格、待收与进度，保证页面刷新后看到一致结果 */
  private decorate(order: PurchaseOrder) {
    const totalOrdered = order.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
    const totalAccepted = order.items.reduce((sum, item) => sum + item.acceptedQuantity, 0);
    const supplier = suppliers.find((item) => item.id === order.supplierId);
    const warehouse = warehouses.find((item) => item.id === order.warehouseId);
    const items: Array<PurchaseOrderItem & { pendingQuantity: number; progress: number; lineStatus: 'PENDING' | 'PARTIAL' | 'DONE' }> = order.items.map((item) => {
      const pendingQuantity = item.orderedQuantity - item.acceptedQuantity;
      return {
        ...item,
        pendingQuantity,
        progress: Number((item.acceptedQuantity / item.orderedQuantity).toFixed(4)),
        lineStatus: item.acceptedQuantity === 0 ? 'PENDING' : pendingQuantity === 0 ? 'DONE' : 'PARTIAL',
      };
    });
    return {
      ...order,
      items,
      supplierName: supplier?.name ?? order.supplierId,
      warehouseName: warehouse?.name ?? order.warehouseId,
      totalOrdered,
      totalAccepted,
      totalPending: totalOrdered - totalAccepted,
      overallProgress: totalOrdered === 0 ? 0 : Number((totalAccepted / totalOrdered).toFixed(4)),
    };
  }
}

export const purchaseOrdersService = new PurchaseOrdersService();
