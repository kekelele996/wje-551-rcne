import type { PurchaseOrderStatus } from '../constants/enums';
import type { Supplier } from './supplier';
import type { Warehouse } from './inventory';

export interface PurchaseOrderItem {
  id: string;
  orderId: string;
  skuId: string;
  skuName: string;
  orderedQuantity: number;
  acceptedQuantity: number;
  remainingQuantity?: number;
  progress?: number;
}

export interface PurchaseReceiptItem {
  skuId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
}

export interface PurchaseReceipt {
  id: string;
  orderId: string;
  batchNo: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  items: PurchaseReceiptItem[];
  operator: string;
  remark: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  supplierId: string;
  warehouseId: string;
  status: PurchaseOrderStatus;
  remark: string;
  items: PurchaseOrderItem[];
  progressItems: PurchaseOrderItem[];
  receipts: PurchaseReceipt[];
  supplier?: Supplier;
  warehouse?: Warehouse;
  totalOrdered: number;
  totalAccepted: number;
  totalRemaining: number;
  totalReceived: number;
  approvedAt?: string;
  approver?: string;
  closedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderPayload {
  supplierId: string;
  warehouseId: string;
  remark?: string;
  items: Array<{ skuId: string; skuName: string; quantity: number }>;
}

export interface ReceivePurchaseOrderPayload {
  batchNo: string;
  remark?: string;
  items: Array<{ skuId: string; receivedQuantity: number; acceptedQuantity: number }>;
}
