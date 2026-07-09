import { Request, Response } from "express";

import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

import {
  createDepartmentService,
  deleteDepartmentService,
  getAllDepartmentsService,
  updateDepartmentService,
  getDepartmentByIdService,
} from "./department.service";

/**
 * Create Department
 */
export const createDepartment =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const department =
        await createDepartmentService(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Department created successfully",
          department
        )
      );
    }
  );

/**
 * Get All Departments
 */
export const getAllDepartments =
  asyncHandler(
    async (
      _req: Request,
      res: Response
    ) => {

      const departments =
        await getAllDepartmentsService();

      return res.status(200).json(
        new ApiResponse(
          "Departments fetched successfully",
          departments
        )
      );
    }
  );

/**
 * Get Department By Id
 */
export const getDepartmentById =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const departmentId = Number(
        String(req.params.id)
      );

      const department =
        await getDepartmentByIdService(
          departmentId
        );

      return res.status(200).json(
        new ApiResponse(
          "Department fetched successfully",
          department
        )
      );
    }
  );

export const updateDepartment =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const departmentId =
        Number(
          String(req.params.id)
        );

      const department =
        await updateDepartmentService(
          departmentId,
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Department updated successfully",
          department
        )
      );
    }
  );

export const deleteDepartment =
  asyncHandler(
    async (req: Request, res: Response) => {
      const departmentId = Number(String(req.params.id));
      await deleteDepartmentService(departmentId);
      return res.status(200).json(
        new ApiResponse("Department deleted successfully")
      );
    }
  );
