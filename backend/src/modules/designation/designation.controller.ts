import { Request, Response } from "express";

import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

import {
  createDesignationService,
  getAllDesignationsService,
  getDesignationByIdService,
  updateDesignationService,
  deleteDesignationService,
} from "./designation.service";

export const createDesignation =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const designation =
        await createDesignationService(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Designation created successfully",
          designation
        )
      );
    }
  );

export const getAllDesignations =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const departmentId =
        req.query.departmentId
          ? Number(req.query.departmentId)
          : undefined;


      const designations =
        await getAllDesignationsService(departmentId);

      return res.status(200).json(
        new ApiResponse(
          "Designations fetched successfully",
          designations
        )
      );
    }
  );

export const getDesignationById =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const designationId =
        Number(
          String(req.params.id)
        );

      const designation =
        await getDesignationByIdService(
          designationId
        );

      return res.status(200).json(
        new ApiResponse(
          "Designation fetched successfully",
          designation
        )
      );
    }
  );

export const updateDesignation =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const designationId =
        Number(
          String(req.params.id)
        );

      const designation =
        await updateDesignationService(
          designationId,
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Designation updated successfully",
          designation
        )
      );
    }
  );

export const deleteDesignation =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const designationId =
        Number(
          String(req.params.id)
        );

      await deleteDesignationService(
        designationId
      );

      return res.status(200).json(
        new ApiResponse(
          "Designation deleted successfully",
          null
        )
      );
    }
  );



