import type { PurchaseOrder } from '../types/index.js';
import { PurchaseOrderStatus } from '../constants/enums.js';

export type PurchaseOrderEntity = PurchaseOrder;
export const purchaseOrderStatuses = Object.values(PurchaseOrderStatus);
