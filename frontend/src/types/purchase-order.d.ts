import type { PurchaseOrderStatus } from '../constants/enums';

export interface PurchaseOrderItem {
  id: string;
  skuId: string;
  skuName: string;
  orderedQuantity: number;
  acceptedQuantity: number;
  pendingQuantity: number;
  progress: number;
  lineStatus: 'PENDING' | 'PARTIAL' | 'DONE';
}

export interface PurchaseReceiptItem {
  id: string;
  itemId: string;
  skuId: string;
  skuName: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
}

export interface PurchaseReceipt {
  id: string;
  batchNo: string;
  items: PurchaseReceiptItem[];
  operator: string;
  remark: string;
  arrivedAt: string;
  createdAt: string;
}

export interface PurchaseOrderEvent {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'APPROVE' | 'RECEIVE' | 'CANCEL';
  operator: string;
  note: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  supplierId: string;
  warehouseId: string;
  supplierName?: string;
  warehouseName?: string;
  status: PurchaseOrderStatus;
  remark: string;
  items: PurchaseOrderItem[];
  receipts: PurchaseReceipt[];
  timeline: PurchaseOrderEvent[];
  totalOrdered: number;
  totalAccepted: number;
  totalPending: number;
  overallProgress: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
