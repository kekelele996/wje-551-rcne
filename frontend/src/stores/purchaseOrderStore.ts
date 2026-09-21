import { defineStore } from 'pinia';
import { purchaseOrdersApi } from '../api/purchase-orders';
import type { PurchaseOrder } from '../types/purchase-order';

export const usePurchaseOrderStore = defineStore('purchaseOrder', {
  state: () => ({ orders: [] as PurchaseOrder[], current: null as PurchaseOrder | null }),
  actions: {
    async fetchList(params: Record<string, string> = {}) {
      this.orders = await purchaseOrdersApi.list(params) as unknown as PurchaseOrder[];
    },
    async fetchDetail(id: string) {
      this.current = await purchaseOrdersApi.detail(id) as unknown as PurchaseOrder;
    },
  },
});
