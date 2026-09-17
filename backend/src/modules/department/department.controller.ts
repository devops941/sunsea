import { Request, Response } from "express";

import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

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
      const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));

      const department =
        await createDepartmentService({
          ...req.body,
          userId,
        });

      getIO().emit("department:created", department);

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
      req: Request,
      res: Response
    ) => {
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;

      const { departments, total } =
        await getAllDepartmentsService(page, limit, search);

      return res.status(200).json({
        success: true,
        message: "Departments fetched successfully",
        data: departments,
        meta: {
          total,
          page: page || 1,
          limit: limit || total,
        }
      });
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
      const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));

      const department =
        await updateDepartmentService(
          departmentId,
          {
            ...req.body,
            userId,
          }
        );

      getIO().emit("department:updated", department);

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
      
      getIO().emit("department:deleted", { id: departmentId });
      
      return res.status(200).json(
        new ApiResponse("Department deleted successfully")
      );
    }
  );
