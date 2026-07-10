import { Request, Response } from "express";

import employeeService from "./employee.service";
import { prisma } from "../../config/prisma";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

class EmployeeController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const employee =
        await employeeService.create(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Employee created successfully",
          employee
        )
      );
    }
  );

  findAll = asyncHandler(
    async (req: Request, res: Response) => {
      const { search, departmentId, page, limit } = req.query;

      const employees = await employeeService.findAll({
        search: search as string | undefined,
        departmentId: departmentId ? parseInt(departmentId as string, 10) : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      });

      return res.status(200).json(
        new ApiResponse("Employees fetched successfully", employees)
      );
    }
  );

  getMyProfile = asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.user) {
        throw new ApiError(401, "Unauthorized");
      }

      const { userId } = req.user;

      const userRecord = await prisma.user.findUnique({
        where: { userId },
        select: { employeeId: true },
      });

      if (!userRecord?.employeeId) {
        throw new ApiError(404, "No employee record linked to this account");
      }

      const employee = await employeeService.findById(userRecord.employeeId);

      return res.status(200).json(
        new ApiResponse("Profile fetched successfully", employee)
      );
    }
  );

  getNextCode = asyncHandler(
    async (_req: Request, res: Response) => {
      const nextCode = await employeeService.getNextEmployeeCode();
      return res.status(200).json(
        new ApiResponse(
          "Next employee code fetched successfully",
          { nextCode }
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      const employee =
        await employeeService.findById(id);

      return res.status(200).json(
        new ApiResponse(
          "Employee fetched successfully",
          employee
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      const employee =
        await employeeService.update(
          id,
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Employee updated successfully",
          employee
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      await employeeService.delete(id);

      return res.status(200).json(
        new ApiResponse(
          "Employee deleted successfully"
        )
      );
    }
  );
}

export default new EmployeeController();