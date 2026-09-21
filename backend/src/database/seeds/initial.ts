import { v4 as uuid } from 'uuid';
import { InventoryAlertLevel, PurchaseOrderStatus, ShipmentStatus, SupplierStatus } from '../../constants/enums.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import type { AuditLog, Inventory, PurchaseOrder, Shipment, Supplier, User, Warehouse } from '../../types/index.js';

const now = () => new Date().toISOString();

export const users: User[] = [
  {
    id: 'u-admin',
    username: 'admin',
    password: 'admin123',
    name: '系统管理员',
    roles: ['ADMIN'],
    permissions: Object.values(PERMISSIONS),
  },
  {
    id: 'u-purchase',
    username: 'purchase',
    password: 'purchase123',
    name: '采购经理',
    roles: ['PURCHASE_MANAGER'],
    permissions: [PERMISSIONS.DASHBOARD_READ, PERMISSIONS.SUPPLIER_READ, PERMISSIONS.SUPPLIER_WRITE, PERMISSIONS.SHIPMENT_READ, PERMISSIONS.SHIPMENT_WRITE, PERMISSIONS.INVENTORY_READ, PERMISSIONS.AUDIT_READ, PERMISSIONS.PURCHASE_ORDER_READ, PERMISSIONS.PURCHASE_ORDER_WRITE],
  },
  {
    id: 'u-warehouse',
    username: 'warehouse',
    password: 'warehouse123',
    name: '仓库经理',
    roles: ['WAREHOUSE_MANAGER'],
    permissions: [PERMISSIONS.DASHBOARD_READ, PERMISSIONS.SUPPLIER_READ, PERMISSIONS.SHIPMENT_READ, PERMISSIONS.SHIPMENT_RECEIVE, PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_WRITE, PERMISSIONS.AUDIT_READ, PERMISSIONS.PURCHASE_ORDER_READ, PERMISSIONS.PURCHASE_ORDER_RECEIVE],
  },
];

export const warehouses: Warehouse[] = [
  { id: 'wh-east', name: '华东中心仓', address: '上海市青浦区', capacity: 80000, status: 'ACTIVE', createdAt: now(), updatedAt: now() },
  { id: 'wh-south', name: '华南前置仓', address: '深圳市龙岗区', capacity: 52000, status: 'ACTIVE', createdAt: now(), updatedAt: now() },
  { id: 'wh-north', name: '华北冷链仓', address: '天津市武清区', capacity: 36000, status: 'ACTIVE', createdAt: now(), updatedAt: now() },
];

export const suppliers: Supplier[] = Array.from({ length: 10 }, (_, index) => {
  const statuses = [SupplierStatus.ACTIVE, SupplierStatus.ACTIVE, SupplierStatus.PENDING_REVIEW, SupplierStatus.INACTIVE, SupplierStatus.BLACKLISTED];
  const id = `sup-${index + 1}`;
  const rating = Number((2.7 + (index % 5) * 0.45).toFixed(1));
  return {
    id,
    name: ['远航包装', '北辰电子', '森谷食品', '云驰配件', '衡越纺织', '江湾化工', '立新五金', '蓝桥设备', '星火材料', '启明贸易'][index],
    contact: ['陈敏', '王立', '赵欣', '刘洋', '周琪', '何峰', '秦洁', '吴森', '孙宁', '李然'][index],
    phone: `1380000${String(1000 + index)}`,
    email: `supplier${index + 1}@example.com`,
    address: `示例工业园 ${index + 1} 号`,
    status: statuses[index % statuses.length],
    rating,
    ratingHistory: [{ id: uuid(), score: rating, weight: 1, remark: '初始合作评分', createdAt: now() }],
    createdAt: now(),
    updatedAt: now(),
  };
});

function alert(quantity: number, safetyStock: number) {
  if (quantity <= safetyStock * 0.5) return InventoryAlertLevel.CRITICAL;
  if (quantity <= safetyStock) return InventoryAlertLevel.LOW;
  return InventoryAlertLevel.NORMAL;
}

export const inventories: Inventory[] = Array.from({ length: 20 }, (_, index) => {
  const warehouse = warehouses[index % warehouses.length];
  const quantity = [12, 35, 68, 120, 8, 240, 52, 90, 16, 300][index % 10] + index;
  const safetyStock = [25, 40, 60, 80, 30][index % 5];
  return {
    id: `inv-${index + 1}`,
    warehouseId: warehouse.id,
    skuId: `SKU-${String(1000 + index)}`,
    skuName: ['轴承组件', '包装纸箱', '温控芯片', '食品托盘', '防潮薄膜'][index % 5],
    quantity,
    safetyStock,
    alertLevel: alert(quantity, safetyStock),
    updatedAt: now(),
  };
});

export const shipments: Shipment[] = Array.from({ length: 15 }, (_, index) => {
  const statuses = [ShipmentStatus.PENDING, ShipmentStatus.SHIPPED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED, ShipmentStatus.EXCEPTION, ShipmentStatus.CANCELLED];
  const status = statuses[index % statuses.length];
  const id = `ship-${index + 1}`;
  const createdAt = new Date(Date.now() - index * 86400000).toISOString();
  return {
    id,
    orderNo: `SHIP-202606${String(1 + index).padStart(2, '0')}-${String(index + 1).padStart(4, '0')}`,
    supplierId: suppliers[index % suppliers.length].id,
    warehouseId: warehouses[index % warehouses.length].id,
    status,
    trackingNo: status === ShipmentStatus.PENDING ? '' : `TRK${Date.now()}${index}`,
    carrier: status === ShipmentStatus.PENDING ? '' : ['顺丰速运', '京东物流', '德邦快运'][index % 3],
    estimatedArrival: new Date(Date.now() + (index + 1) * 86400000).toISOString(),
    actualArrival: status === ShipmentStatus.DELIVERED ? now() : undefined,
    remark: status === ShipmentStatus.EXCEPTION ? '承运方反馈中转延误' : '',
    items: [
      { id: uuid(), shipmentId: id, skuId: `SKU-${String(1000 + (index % 10))}`, skuName: '轴承组件', quantity: 10 + index },
      { id: uuid(), shipmentId: id, skuId: `SKU-${String(1010 + (index % 10))}`, skuName: '包装纸箱', quantity: 20 + index },
    ],
    timeline: [{ id: uuid(), status, operator: '系统种子', note: '初始化运单状态', createdAt }],
    createdAt,
    updatedAt: createdAt,
  };
});

export const purchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-1',
    orderNo: 'PO-20260901-0001',
    supplierId: 'sup-1',
    warehouseId: 'wh-east',
    status: PurchaseOrderStatus.PENDING_APPROVAL,
    remark: '季度补货',
    items: [
      { id: uuid(), skuId: 'SKU-1000', skuName: '轴承组件', orderedQuantity: 100, acceptedQuantity: 0 },
      { id: uuid(), skuId: 'SKU-1001', skuName: '包装纸箱', orderedQuantity: 200, acceptedQuantity: 0 },
    ],
    receipts: [],
    timeline: [{ id: uuid(), action: 'CREATE', operator: '采购经理', note: '创建采购单', createdAt: now() }],
    createdBy: 'u-purchase',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'po-2',
    orderNo: 'PO-20260905-0002',
    supplierId: 'sup-2',
    warehouseId: 'wh-south',
    status: PurchaseOrderStatus.APPROVED,
    remark: '',
    items: [
      { id: 'po-2-item-1', skuId: 'SKU-1002', skuName: '温控芯片', orderedQuantity: 120, acceptedQuantity: 0 },
      { id: 'po-2-item-2', skuId: 'SKU-1003', skuName: '食品托盘', orderedQuantity: 60, acceptedQuantity: 0 },
    ],
    receipts: [],
    timeline: [{ id: uuid(), action: 'APPROVE', operator: '系统管理员', note: '审核通过，订购数量冻结', createdAt: now() }],
    createdBy: 'u-purchase',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'po-3',
    orderNo: 'PO-20260910-0003',
    supplierId: 'sup-1',
    warehouseId: 'wh-east',
    status: PurchaseOrderStatus.PARTIAL_RECEIVED,
    remark: '分批到货示例',
    items: [
      { id: 'po-3-item-1', skuId: 'SKU-1000', skuName: '轴承组件', orderedQuantity: 100, acceptedQuantity: 60 },
      { id: 'po-3-item-2', skuId: 'SKU-1001', skuName: '包装纸箱', orderedQuantity: 80, acceptedQuantity: 80 },
    ],
    receipts: [
      {
        id: uuid(),
        batchNo: 'BATCH-20260912-01',
        items: [
          { id: uuid(), itemId: 'po-3-item-1', skuId: 'SKU-1000', skuName: '轴承组件', receivedQuantity: 65, acceptedQuantity: 60, rejectedQuantity: 5 },
          { id: uuid(), itemId: 'po-3-item-2', skuId: 'SKU-1001', skuName: '包装纸箱', receivedQuantity: 80, acceptedQuantity: 80, rejectedQuantity: 0 },
        ],
        operator: '仓库经理',
        remark: '5 件外观破损拒收',
        arrivedAt: now(),
        createdAt: now(),
      },
    ],
    timeline: [{ id: uuid(), action: 'RECEIVE', operator: '仓库经理', note: '登记批次BATCH-20260912-01到货', createdAt: now() }],
    createdBy: 'u-purchase',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'po-4',
    orderNo: 'PO-20260912-0004',
    supplierId: 'sup-3',
    warehouseId: 'wh-north',
    status: PurchaseOrderStatus.CLOSED,
    remark: '一次到齐',
    items: [
      { id: 'po-4-item-1', skuId: 'SKU-1004', skuName: '防潮薄膜', orderedQuantity: 40, acceptedQuantity: 40 },
    ],
    receipts: [
      {
        id: uuid(),
        batchNo: 'BATCH-20260915-01',
        items: [
          { id: uuid(), itemId: 'po-4-item-1', skuId: 'SKU-1004', skuName: '防潮薄膜', receivedQuantity: 40, acceptedQuantity: 40, rejectedQuantity: 0 },
        ],
        operator: '仓库经理',
        remark: '',
        arrivedAt: now(),
        createdAt: now(),
      },
    ],
    timeline: [{ id: uuid(), action: 'RECEIVE', operator: '仓库经理', note: '登记批次BATCH-20260915-01到货', createdAt: now() }],
    createdBy: 'u-purchase',
    createdAt: now(),
    updatedAt: now(),
  },
];

export const auditLogs: AuditLog[] = [
  { id: uuid(), userId: 'u-admin', username: '系统管理员', action: 'CREATE', module: 'SUPPLIER', targetId: 'sup-1', targetName: '远航包装', detail: { source: 'seed' }, ip: '127.0.0.1', createdAt: now() },
  { id: uuid(), userId: 'u-admin', username: '系统管理员', action: 'STATUS_CHANGE', module: 'SHIPMENT', targetId: 'ship-3', targetName: 'SHIP-20260603-0003', detail: { status: ShipmentStatus.IN_TRANSIT }, ip: '127.0.0.1', createdAt: now() },
];