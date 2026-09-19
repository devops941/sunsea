import { Request, Response } from "express";

import customerService from "./customer.service";
import { prisma } from "../../config/prisma";
import creditCheckService from "../sales-order/creditCheckService";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { getIO } from "../../socket/socket";

class CustomerController {
  create = asyncHandler(async (req: Request, res: Response) => {
    let userId = req.user?.userId;

    if (!userId) {
      throw new ApiError(401, "Unauthorized: missing user context");
    }



    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }

    const customer = await customerService.createCustomer(req.body, {
      userId,
      companyId: company.id,
    });

    getIO().emit("customer:created", customer);

    return res.status(201).json(
      new ApiResponse("Customer created successfully", customer)
    );
  });

  findAll = asyncHandler(
    async (req: Request, res: Response) => {
      // BUG-CUST-004 fix: pass page and limit for server-side pagination
      const search = req.query.search ? String(req.query.search) : undefined;
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
      const status = req.query.status ? String(req.query.status) : undefined;
      const customerTypeId = req.query.customerTypeId ? parseInt(String(req.query.customerTypeId), 10) : undefined;
      const customerGradeId = req.query.customerGradeId ? parseInt(String(req.query.customerGradeId), 10) : undefined;

      const result = await customerService.getAllCustomers({ search, page, limit, status, customerTypeId, customerGradeId });

      return res.status(200).json(
        new ApiResponse("Customers fetched successfully", result)
      );
    }
  );

  findOne = asyncHandler(
    async (req: Request, res: Response) => {
      const id = req.params.id as string;

      const customer =
        await customerService.getCustomerById(
          id
        );

      return res.status(200).json(
        new ApiResponse(
          "Customer fetched successfully",
          customer
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = req.params.id as string;

      const customer =
        await customerService.updateCustomer(
          id,
          req.body,
          req.user?.userId
        );

      getIO().emit("customer:updated", customer);

      return res.status(200).json(
        new ApiResponse(
          "Customer updated successfully",
          customer
        )
      );
    }
  );


  // Testing
  getNextCode = asyncHandler(
    async (req: Request, res: Response) => {
      const nextCode = await customerService.getNextCustomerCode();
      return res.status(200).json(
        new ApiResponse(
          "Next customer code fetched successfully",
          nextCode
        )
      );
    }
  );

  getCreditStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const creditResult = await creditCheckService.checkCustomerCredit(id, 0);
    return res.status(200).json(
      new ApiResponse("Customer credit status fetched successfully", creditResult)
    );
  });

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = req.params.id as string;

      await customerService.deleteCustomer(
        id,
        req.user?.userId
      );

      getIO().emit("customer:deleted", { id });

      return res.status(200).json(
        new ApiResponse(
          "Customer deleted successfully"
        )
      );
    }
  );
}

export default new CustomerController();