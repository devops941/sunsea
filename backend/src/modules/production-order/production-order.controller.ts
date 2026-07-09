import { Request, Response } from "express";
import productionOrderService from "./production-order.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { ProductionOrderQueryInput } from "./production-order.validation";

class ProductionOrderController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const order = await productionOrderService.create(req.body, userId);

    return res.status(201).json(
      new ApiResponse("Production Order created successfully", order)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const query: ProductionOrderQueryInput = {
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
      productItemId: req.query.productItemId as string,
      productionOrderId: req.query.productionOrderId as string,
      status: req.query.status as string,
      search: req.query.search as string,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
      sortBy: this.parseSortBy(req.query.sortBy) ?? "createdAt",
      sortOrder: this.parseSortOrder(req.query.sortOrder) ?? "desc",
    };

    const orders = await productionOrderService.findAll(query);

    return res.status(200).json(
      new ApiResponse("Production Orders fetched successfully", orders)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const order = await productionOrderService.findById(String(req.params.productionOrderId));

    return res.status(200).json(
      new ApiResponse("Production Order fetched successfully", order)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const order = await productionOrderService.update(
      String(req.params.productionOrderId),
      req.body,
      userId
    );

    return res.status(200).json(
      new ApiResponse("Production Order updated successfully", order)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await productionOrderService.delete(String(req.params.productionOrderId));

    return res.status(200).json(
      new ApiResponse("Production Order deleted successfully")
    );
  });

  getNextId = asyncHandler(async (_req: Request, res: Response) => {
    const nextId = await productionOrderService.getNextProductionOrderId();
    return res.status(200).json(
      new ApiResponse("Next production order ID generated successfully", { nextId })
    );
  });

  private parseSortBy(value: unknown): "orderDate" | "createdAt" | "dueDate" | "productionOrderId" | undefined {
    if (!value || typeof value !== 'string') return undefined;

    const sortBy = value.toLowerCase();
    if (sortBy === 'orderdate' || sortBy === 'createdat' || sortBy === 'duedate' || sortBy === 'productionorderid') {
      return (sortBy === 'orderdate' ? 'orderDate' : sortBy === 'createdat' ? 'createdAt' : sortBy === 'duedate' ? 'dueDate' : 'productionOrderId');
    }
    return undefined;
  }

  private parseSortOrder(value: unknown): "asc" | "desc" | undefined {
    if (!value || typeof value !== 'string') return undefined;

    const sortOrder = value.toLowerCase();
    if (sortOrder === 'asc' || sortOrder === 'desc') {
      return sortOrder as "asc" | "desc";
    }
    return undefined;
  }
}

export default new ProductionOrderController();
