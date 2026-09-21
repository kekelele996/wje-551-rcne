import type { Request, Response } from 'express';
import { resLocals } from '../middlewares/auth.middleware.js';
import { purchaseOrdersService } from '../services/purchase-orders.service.js';
import { ok } from '../utils/response.js';

export class PurchaseOrdersController {
  list(req: Request, res: Response) { res.json(ok(purchaseOrdersService.list(req.query as Record<string, string | undefined>))); }
  detail(req: Request, res: Response) { res.json(ok(purchaseOrdersService.detail(req.params.id))); }
  create(req: Request, res: Response) { res.json(ok(purchaseOrdersService.create(req.body, resLocals(req).user))); }
  update(req: Request, res: Response) { res.json(ok(purchaseOrdersService.update(req.params.id, req.body, resLocals(req).user))); }
  approve(req: Request, res: Response) { res.json(ok(purchaseOrdersService.approve(req.params.id, resLocals(req).user))); }
  cancel(req: Request, res: Response) { res.json(ok(purchaseOrdersService.cancel(req.params.id, resLocals(req).user))); }
  async receive(req: Request, res: Response, next: (error?: unknown) => void) {
    try {
      res.json(ok(await purchaseOrdersService.receive(req.params.id, req.body, resLocals(req).user)));
    } catch (error) {
      next(error);
    }
  }
}

export const purchaseOrdersController = new PurchaseOrdersController();
