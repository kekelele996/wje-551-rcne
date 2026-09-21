import { defineStore } from 'pinia';
import { purchaseOrdersApi } from '../api/purchaseOrders';
import type { CreatePurchaseOrderPayload, PurchaseOrder, ReceivePurchaseOrderPayload } from '../types/purchase-order';

export const usePurchaseOrderStore = defineStore('purchaseOrder', {
  state: () => ({ orders: [] as PurchaseOrder[], current: null as PurchaseOrder | null, loading: false }),
  actions: {
    async fetchList(params: Record<string, string> = {}) {
      this.loading = true;
      try {
        this.orders = await purchaseOrdersApi.list(params) as unknown as PurchaseOrder[];
      } finally {
        this.loading = false;
      }
    },
    async fetchDetail(id: string) {
      this.current = await purchaseOrdersApi.detail(id) as unknown as PurchaseOrder;
    },
    async create(payload: CreatePurchaseOrderPayload) {
      return purchaseOrdersApi.create(payload);
    },
    async approve(id: string) {
      return purchaseOrdersApi.approve(id);
    },
    async receive(id: string, payload: ReceivePurchaseOrderPayload) {
      return purchaseOrdersApi.receive(id, payload);
    },
  },
});
