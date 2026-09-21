export enum ShipmentStatus {
  PENDING = 'PENDING',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  EXCEPTION = 'EXCEPTION',
  CANCELLED = 'CANCELLED',
}

export const ShipmentStatusLabel: Record<ShipmentStatus, string> = {
  [ShipmentStatus.PENDING]: '待发货',
  [ShipmentStatus.SHIPPED]: '已发货',
  [ShipmentStatus.IN_TRANSIT]: '运输中',
  [ShipmentStatus.DELIVERED]: '已签收',
  [ShipmentStatus.EXCEPTION]: '异常',
  [ShipmentStatus.CANCELLED]: '已取消',
};

export enum SupplierStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLACKLISTED = 'BLACKLISTED',
  PENDING_REVIEW = 'PENDING_REVIEW',
}

export const SupplierStatusLabel: Record<SupplierStatus, string> = {
  [SupplierStatus.ACTIVE]: '活跃',
  [SupplierStatus.INACTIVE]: '停用',
  [SupplierStatus.BLACKLISTED]: '黑名单',
  [SupplierStatus.PENDING_REVIEW]: '待审核',
};

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  PARTIAL_RECEIVED = 'PARTIAL_RECEIVED',
  CLOSED = 'CLOSED',
}

export const PurchaseOrderStatusLabel: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.DRAFT]: '待审核',
  [PurchaseOrderStatus.APPROVED]: '已审核待到货',
  [PurchaseOrderStatus.PARTIAL_RECEIVED]: '部分到货',
  [PurchaseOrderStatus.CLOSED]: '已关闭',
};

export enum InventoryAlertLevel {
  NORMAL = 'NORMAL',
  LOW = 'LOW',
  CRITICAL = 'CRITICAL',
}

export const InventoryAlertLevelLabel: Record<InventoryAlertLevel, string> = {
  [InventoryAlertLevel.NORMAL]: '正常',
  [InventoryAlertLevel.LOW]: '低库存',
  [InventoryAlertLevel.CRITICAL]: '严重不足',
};
