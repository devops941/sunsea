import { Request, Response } from "express";
import { deliveryRoutesService } from "./routes.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class DeliveryRoutesController {
  getSalesReps = asyncHandler(async (_req: Request, res: Response) => {
    const reps = await deliveryRoutesService.getSalesReps();
    return res.status(200).json(new ApiResponse("Sales representatives fetched successfully", reps));
  });

  getAvailableCities = asyncHandler(async (_req: Request, res: Response) => {
    const cities = await deliveryRoutesService.getAvailableCities();
    return res.status(200).json(new ApiResponse("Available cities fetched successfully", cities));
  });

  getAllRoutes = asyncHandler(async (_req: Request, res: Response) => {
    const routes = await deliveryRoutesService.getAllRoutes();
    return res.status(200).json(new ApiResponse("Delivery routes fetched successfully", routes));
  });

  getRepRoutePlan = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const plan = await deliveryRoutesService.getRepRoutePlan(id);
    return res.status(200).json(new ApiResponse("Route plan fetched successfully", plan));
  });

  saveRepRoutePlan = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { routeName, stops } = req.body;
    const result = await deliveryRoutesService.saveRepRoutePlan(id, { routeName, stops });
    return res.status(200).json(new ApiResponse("Route plan saved successfully", result));
  });

  getInvoicedCustomers = asyncHandler(async (_req: Request, res: Response) => {
    const customers = await deliveryRoutesService.getInvoicedCustomers();
    return res.status(200).json(new ApiResponse("Invoiced customers fetched successfully", customers));
  });

  updateStopStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { status } = req.body;
    const result = await deliveryRoutesService.updateStopStatus(id, status || "DELIVERED");
    return res.status(200).json(new ApiResponse("Stop status updated successfully", result));
  });
}

export const deliveryRoutesController = new DeliveryRoutesController();
