import { Request, Response } from "express";
import productShiftRecordService from "./product-shift-record.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { getIO } from "../../socket/socket";

class ProductShiftRecordController {
  async create(req: Request, res: Response) {
    const record = await productShiftRecordService.create(req.body);
    if (!record) {
      return res.status(200).json(new ApiResponse("No new record - achieved qty not higher than current best", null));
    }

    getIO().emit("productShiftRecord:created", record);

    return res.status(201).json(new ApiResponse("New shift record saved!", record));
  }

  async findByProduct(req: Request, res: Response) {
    const productId = Number(req.params.productId);
    const records = await productShiftRecordService.findByProduct(productId);
    const highest = await productShiftRecordService.getHighestByProduct(productId);
    return res.status(200).json(new ApiResponse("Records fetched", { records, highest }));
  }
}

export default new ProductShiftRecordController();
