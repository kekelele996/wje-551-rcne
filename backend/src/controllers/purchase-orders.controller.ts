import type { NextFunction, Request, Response } from 'express';
import { resLocals } from '../middlewares/auth.middleware.js';
import { purchaseOrdersService } from '../services/purchase-orders.service.js';
import { ok } from '../utils/response.js';

export class PurchaseOrdersController {
  list(req: Request, res: Response) { res.json(ok(purchaseOrdersService.list(req.query as Record<string, string | undefined>))); }
  detail(req: Request, res: Response) { res.json(ok(purchaseOrdersService.detail(req.params.id))); }
  create(req: Request, res: Response) { res.json(ok(purchaseOrdersService.create(req.body, resLocals(req).user))); }
  update(req: Request, res: Response) { res.json(ok(purchaseOrdersService.update(req.params.id, req.body, resLocals(req).user))); }
  approve(req: Request, res: Response) { res.json(ok(purchaseOrdersService.approve(req.params.id, resLocals(req).user))); }
  receive(req: Request, res: Response, next: NextFunction) {
    Promise.resolve(purchaseOrdersService.receive(req.params.id, req.body, resLocals(req).user))
      .then((data) => res.json(ok(data)))
      .catch((error: unknown) => next(error));
  }
}

export const purchaseOrdersController = new PurchaseOrdersController();
