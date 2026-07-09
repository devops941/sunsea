import { Request, Response } from "express";

import customerService from "./customer.service";
import { prisma } from "../../config/prisma";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

class CustomerController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

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

    return res.status(201).json(
      new ApiResponse("Customer created successfully", customer)
    );
  });

  findAll = asyncHandler(
    async (req: Request, res: Response) => {
      const search = req.query.search ? String(req.query.search) : undefined;
      const customers =
        await customerService.getAllCustomers(search);

      return res.status(200).json(
        new ApiResponse(
          "Customers fetched successfully",
          customers
        )
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
          req.body
        );

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

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = req.params.id as string;

      await customerService.deleteCustomer(
        id
      );

      return res.status(200).json(
        new ApiResponse(
          "Customer deleted successfully"
        )
      );
    }
  );
}

export default new CustomerController();