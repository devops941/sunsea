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

      try {
        const { getIO } = require("../../socket/socket");
        const io = getIO();
        io.emit("salesReturn:created", data);
        io.emit("voucher:created", { source: "salesReturn" });
        io.emit("payment:created", { source: "salesReturn" });
        io.emit("accountLedger:updated", { source: "salesReturn" });
      } catch (sErr) {
        console.error("[Socket Emit Error] salesReturn:created", sErr);
      }

      return res.status(201).json({ success: true, message: "Sales return created", data });
    } catch (error) {
      next(error);
    }
  }

  async getSalesReturnById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await returnsService.getSalesReturnById(id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateSalesReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = createSalesReturnSchema.parse(req.body);
      const updatedBy = (req as any).user?.id || (req as any).user?.userId;
      const data = await returnsService.updateSalesReturn(id, input, updatedBy);

      try {
        const { getIO } = require("../../socket/socket");
        const io = getIO();
        io.emit("salesReturn:updated", data);
        if (data.status !== "DRAFT") {
          io.emit("voucher:created", { source: "salesReturn" });
          io.emit("payment:created", { source: "salesReturn" });
          io.emit("accountLedger:updated", { source: "salesReturn" });
        }
      } catch (sErr) {
        console.error("[Socket Emit Error] salesReturn:updated", sErr);
      }

      return res.status(200).json({ success: true, message: "Sales return updated", data });
    } catch (error) {
      next(error);
    }
  }

  async confirmSalesReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await returnsService.confirmSalesReturn(id);

      try {
        const { getIO } = require("../../socket/socket");
        const io = getIO();
        io.emit("salesReturn:updated", data);
        io.emit("voucher:created", { source: "salesReturn" });
        io.emit("payment:created", { source: "salesReturn" });
        io.emit("accountLedger:updated", { source: "salesReturn" });
      } catch (sErr) {
        console.error("[Socket Emit Error] salesReturn:updated", sErr);
      }

      return res.status(200).json({ success: true, message: "Sales return confirmed & posted", data });
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

      try {
        const { getIO } = require("../../socket/socket");
        const io = getIO();
        io.emit("purchaseReturn:created", data);
        io.emit("rawMaterial:updated", { source: "purchaseReturn" });
        io.emit("voucher:created", { source: "purchaseReturn" });
        io.emit("payment:created", { source: "purchaseReturn" });
        io.emit("accountLedger:updated", { source: "purchaseReturn" });
      } catch (sErr) {
        console.error("[Socket Emit Error] purchaseReturn:created", sErr);
      }

      return res.status(201).json({ success: true, message: "Purchase return created", data });
    } catch (error) {
      next(error);
    }
  }
}

export const returnsController = new ReturnsController();
