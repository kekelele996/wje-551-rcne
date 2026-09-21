import { request } from './request';
import type { PurchaseOrder } from '../types/purchase-order';

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

export const purchaseOrdersApi = {
  list: (params?: Record<string, string>) => request.get<PurchaseOrder[]>('/purchase-orders', { params }),
  detail: (id: string) => request.get<PurchaseOrder>(`/purchase-orders/${id}`),
  create: (payload: { supplierId: string; warehouseId: string; remark?: string; items: PurchaseOrderLineInput[] }) =>
    request.post<PurchaseOrder>('/purchase-orders', payload),
  update: (id: string, payload: { remark?: string; items: PurchaseOrderLineInput[] }) =>
    request.put<PurchaseOrder>(`/purchase-orders/${id}`, payload),
  approve: (id: string) => request.post<PurchaseOrder>(`/purchase-orders/${id}/approve`),
  cancel: (id: string) => request.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`),
  receive: (id: string, payload: { batchNo: string; remark?: string; items: PurchaseReceiptLineInput[] }) =>
    request.post<PurchaseOrder>(`/purchase-orders/${id}/receipts`, payload),
};
