import { request } from './request';
import type { CreatePurchaseOrderPayload, PurchaseOrder, ReceivePurchaseOrderPayload } from '../types/purchase-order';

export const purchaseOrdersApi = {
  list: (params?: Record<string, string>) => request.get<PurchaseOrder[]>('/purchase-orders', { params }),
  detail: (id: string) => request.get<PurchaseOrder>(`/purchase-orders/${id}`),
  create: (payload: CreatePurchaseOrderPayload) => request.post<PurchaseOrder>('/purchase-orders', payload),
  update: (id: string, payload: { remark?: string }) => request.put<PurchaseOrder>(`/purchase-orders/${id}`, payload),
  approve: (id: string) => request.post<PurchaseOrder>(`/purchase-orders/${id}/approve`),
  receive: (id: string, payload: ReceivePurchaseOrderPayload) => request.post<PurchaseOrder>(`/purchase-orders/${id}/receipts`, payload),
};
