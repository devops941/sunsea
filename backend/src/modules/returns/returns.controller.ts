import { Request, Response, NextFunction } from "express";
import { returnsService } from "./returns.service";
import { createSalesReturnSchema, createPurchaseReturnSchema } from "./returns.types";

class ReturnsController {
  private parseSortBy(value: unknown): "customer" | "customerName" | "supplier" | "supplierName" | "returnNo" | "returnDate" | "grandTotal" | "createdAt" | undefined {
    if (!value || typeof value !== "string") return undefined;
    const trimmed = value.trim();
    const validFields = ["customer", "customerName", "supplier", "supplierName", "returnNo", "returnDate", "grandTotal", "createdAt"];
    const found = validFields.find((f) => f.toLowerCase() === trimmed.toLowerCase());
    return found as any;
  }

  private parseSortOrder(value: unknown): "asc" | "desc" | undefined {
    if (!value || typeof value !== "string") return undefined;
    const v = value.toLowerCase().trim();
    return v === "asc" || v === "desc" ? (v as any) : undefined;
  }

  async getSalesReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string | undefined;
      const sortBy = this.parseSortBy(req.query.sortBy);
      const sortOrder = this.parseSortOrder(req.query.sortOrder);
      const data = await returnsService.getSalesReturns({
        companyId,
        sortBy,
        sortOrder,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createSalesReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createSalesReturnSchema.parse(req.body);
      const createdBy = (req as any).user?.userId || (req as any).user?.id;
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
      const updatedBy = (req as any).user?.userId || (req as any).user?.id;
      const data = await returnsService.updateSalesReturn(id, input, updatedBy);

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

      return res.status(200).json({ success: true, message: "Sales return updated", data });
    } catch (error) {
      next(error);
    }
  }

  async getPurchaseReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string | undefined;
      const sortBy = this.parseSortBy(req.query.sortBy);
      const sortOrder = this.parseSortOrder(req.query.sortOrder);
      const data = await returnsService.getPurchaseReturns({
        companyId,
        sortBy,
        sortOrder,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createPurchaseReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createPurchaseReturnSchema.parse(req.body);
      const createdBy = (req as any).user?.userId || (req as any).user?.id;
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
  async getPurchaseReturnById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await returnsService.getPurchaseReturnById(id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updatePurchaseReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = createPurchaseReturnSchema.parse(req.body);
      const updatedBy = (req as any).user?.userId || (req as any).user?.id;
      const data = await returnsService.updatePurchaseReturn(id, input, updatedBy);

      try {
        const { getIO } = require("../../socket/socket");
        const io = getIO();
        io.emit("purchaseReturn:updated", data);
        io.emit("rawMaterial:updated", { source: "purchaseReturn" });
        io.emit("voucher:created", { source: "purchaseReturn" });
        io.emit("payment:created", { source: "purchaseReturn" });
        io.emit("accountLedger:updated", { source: "purchaseReturn" });
      } catch (sErr) {
        console.error("[Socket Emit Error] purchaseReturn:updated", sErr);
      }

      return res.status(200).json({ success: true, message: "Purchase return updated", data });
    } catch (error) {
      next(error);
    }
  }
}

export const returnsController = new ReturnsController();
