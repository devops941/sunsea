import { Request, Response, NextFunction } from "express";
import { returnsService } from "./returns.service";
import { createSalesReturnSchema, createPurchaseReturnSchema } from "./returns.types";

class ReturnsController {
  async getSalesReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string | undefined;
      const data = await returnsService.getSalesReturns(companyId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createSalesReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createSalesReturnSchema.parse(req.body);
      const createdBy = (req as any).user?.id || (req as any).user?.userId;
      const data = await returnsService.createSalesReturn(input, createdBy);
      return res.status(201).json({ success: true, message: "Sales return created", data });
    } catch (error) {
      next(error);
    }
  }

  async getPurchaseReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string | undefined;
      const data = await returnsService.getPurchaseReturns(companyId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createPurchaseReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createPurchaseReturnSchema.parse(req.body);
      const createdBy = (req as any).user?.id || (req as any).user?.userId;
      const data = await returnsService.createPurchaseReturn(input, createdBy);
      return res.status(201).json({ success: true, message: "Purchase return created", data });
    } catch (error) {
      next(error);
    }
  }
}

export const returnsController = new ReturnsController();
