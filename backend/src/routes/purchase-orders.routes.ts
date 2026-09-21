import { Router } from 'express';
import { PERMISSIONS } from '../constants/permissions.js';
import { purchaseOrdersController } from '../controllers/purchase-orders.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

export const purchaseOrdersRoutes = Router();
purchaseOrdersRoutes.get('/', requirePermission(PERMISSIONS.PURCHASE_ORDER_READ), (req, res) => purchaseOrdersController.list(req, res));
purchaseOrdersRoutes.post('/', requirePermission(PERMISSIONS.PURCHASE_ORDER_WRITE), (req, res) => purchaseOrdersController.create(req, res));
purchaseOrdersRoutes.get('/:id', requirePermission(PERMISSIONS.PURCHASE_ORDER_READ), (req, res) => purchaseOrdersController.detail(req, res));
purchaseOrdersRoutes.put('/:id', requirePermission(PERMISSIONS.PURCHASE_ORDER_WRITE), (req, res) => purchaseOrdersController.update(req, res));
purchaseOrdersRoutes.post('/:id/approve', requirePermission(PERMISSIONS.PURCHASE_ORDER_APPROVE), (req, res) => purchaseOrdersController.approve(req, res));
purchaseOrdersRoutes.post('/:id/receipts', requirePermission(PERMISSIONS.PURCHASE_ORDER_RECEIVE), (req, res, next) => purchaseOrdersController.receive(req, res, next));
