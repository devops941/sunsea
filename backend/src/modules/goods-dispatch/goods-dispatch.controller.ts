import { Request, Response } from "express";
import { GoodsDispatchService } from "./goods-dispatch.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class GoodsDispatchController {
  getNextNumber = asyncHandler(async (_req: Request, res: Response) => {
    const nextNumber = await GoodsDispatchService.getNextDispatchNumber();
    return res.status(200).json(
      new ApiResponse("Next dispatch number generated", { nextNumber })
    );
  });

  getEligibleOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await GoodsDispatchService.getEligibleProductionOrders({
      search: req.query.search as string,
      productItemId: req.query.productItemId as string,
      machineId: req.query.machineId as string,
      batchNo: req.query.batchNo as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.status(200).json(
      new ApiResponse("Eligible production orders fetched successfully", orders)
    );
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const dispatch = await GoodsDispatchService.create(req.body, userId!);
    return res.status(201).json(
      new ApiResponse("Goods Dispatch created successfully", dispatch)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const result = await GoodsDispatchService.findAll({
      search: req.query.search as string,
      status: req.query.status as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 10,
    });
    return res.status(200).json(
      new ApiResponse("Goods Dispatches fetched successfully", result)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const dispatch = await GoodsDispatchService.findById(Number(req.params.id));
    return res.status(200).json(
      new ApiResponse("Goods Dispatch fetched successfully", dispatch)
    );
  });

  gateApprove = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const dispatch = await GoodsDispatchService.gateApprove(
      Number(req.params.id),
      req.body,
      userId!
    );
    return res.status(200).json(
      new ApiResponse("Gate approval processed successfully", dispatch)
    );
  });

  storeReceive = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const dispatch = await GoodsDispatchService.storeReceive(
      Number(req.params.id),
      req.body,
      userId!
    );
    return res.status(200).json(
      new ApiResponse("Store receipt processed successfully", dispatch)
    );
  });
}

export default new GoodsDispatchController();
