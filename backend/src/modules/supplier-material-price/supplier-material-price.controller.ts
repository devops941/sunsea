import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import supplierMaterialPriceService from "./supplier-material-price.service";

class SupplierMaterialPriceController {
  getCurrentPrices = asyncHandler(async (req: Request, res: Response) => {
    const supplierId = Number(req.query.supplierId);
    //console.log("getCurrentPrices controller - supplierId:", supplierId);
    const data = await supplierMaterialPriceService.fetchCurrent(supplierId);
    //console.log("getCurrentPrices controller - data length:", data.length);
    //console.log("getCurrentPrices controller - data:", JSON.stringify(data));

    return res.status(200).json(
      new ApiResponse(
        "Current supplier material prices fetched successfully",
        data
      )
    );
  });

  getPriceHistory = asyncHandler(async (req: Request, res: Response) => {
    const supplierId = Number(req.query.supplierId);
    const rawMaterialId = String(req.query.rawMaterialId);
    const data = await supplierMaterialPriceService.fetchHistory(supplierId, rawMaterialId);

    return res.status(200).json(
      new ApiResponse(
        "Supplier material price history fetched successfully",
        data
      )
    );
  });

  createPrice = asyncHandler(async (req: Request, res: Response) => {
    const { supplierId, rawMaterialId, price, validFrom } = req.body;
    const data = await supplierMaterialPriceService.create({
      supplierId: Number(supplierId),
      rawMaterialId,
      price: Number(price),
      validFrom,
    });

    return res.status(201).json(
      new ApiResponse(
        "Supplier material price created successfully",
        data
      )
    );
  });

  revisePrice = asyncHandler(async (req: Request, res: Response) => {
    const { supplierId, rawMaterialId, price, validFrom } = req.body;
    const data = await supplierMaterialPriceService.revise({
      supplierId: Number(supplierId),
      rawMaterialId,
      price: Number(price),
      validFrom,
    });

    return res.status(200).json(
      new ApiResponse(
        "Supplier material price revised successfully",
        data
      )
    );
  });

  deletePrice = asyncHandler(async (req: Request, res: Response) => {
    const { priceRowId } = req.params;
    await supplierMaterialPriceService.delete(String(priceRowId));

    return res.status(200).json(
      new ApiResponse(
        "Supplier material price record deleted successfully",
        null
      )
    );
  });
}

export default new SupplierMaterialPriceController();
