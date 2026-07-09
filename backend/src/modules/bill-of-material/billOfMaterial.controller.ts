import { Request, Response } from "express";

import billOfMaterialService from "./billOfMaterial.service";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class BillOfMaterialController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const billOfMaterial =
        await billOfMaterialService.create(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Bill Of Material created successfully",
          billOfMaterial
        )
      );
    }
  );

  findAll = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const search = req.query.search as string;
      const billOfMaterials =
        await billOfMaterialService.findAll(search);

      return res.status(200).json(
        new ApiResponse(
          "Bill Of Materials fetched successfully",
          billOfMaterials
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
     const id = Number(req.params.id);

      const billOfMaterial =
        await billOfMaterialService.findById(
          id
        );

      return res.status(200).json(
        new ApiResponse(
          "Bill Of Material fetched successfully",
          billOfMaterial
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
     const id = Number(req.params.id);

      const billOfMaterial =
        await billOfMaterialService.update(
          id,
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Bill Of Material updated successfully",
          billOfMaterial
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
    const id = Number(req.params.id);

      await billOfMaterialService.delete(
        id
      );

      return res.status(200).json(
        new ApiResponse(
          "Bill Of Material deleted successfully"
        )
      );
    }
  );

  getNextId = asyncHandler(
    async (
      _req: Request,
      res: Response
    ) => {
      const nextId =
        await billOfMaterialService.getNextBillOfMaterialId();

      return res.status(200).json(
        new ApiResponse(
          "Next Bill Of Material ID fetched successfully",
          { nextId }
        )
      );
    }
  );
}

export default new BillOfMaterialController();