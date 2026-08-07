import { Request, Response, NextFunction } from "express";
import { vouchersService } from "./vouchers.service";
import { createVoucherSchema, getVouchersQuerySchema } from "./vouchers.types";

class VouchersController {
  async getVouchers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getVouchersQuerySchema.parse(req.query);
      const result = await vouchersService.getVouchers(query);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVoucherById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const voucher = await vouchersService.getVoucherById(id);
      return res.status(200).json({
        success: true,
        data: voucher,
      });
    } catch (error) {
      next(error);
    }
  }

  async createVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createVoucherSchema.parse(req.body);
      const createdBy = (req as any).user?.id || (req as any).user?.userId;
      const voucher = await vouchersService.createVoucher(input, createdBy);

      try {
        const { getIO } = require("../../socket/socket");
        const io = getIO();
        io.emit("voucher:created", voucher);
        io.emit("payment:created", voucher);
        io.emit("accountLedger:updated", { source: "voucher" });
      } catch (e) {}

      return res.status(201).json({
        success: true,
        message: "Voucher created successfully",
        data: voucher,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const vouchersController = new VouchersController();
