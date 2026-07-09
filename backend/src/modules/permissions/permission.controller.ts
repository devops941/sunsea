import { Request, Response } from "express";

import permissionService from "./permission.service";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class PermissionController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const permission =
        await permissionService.createPermission(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Permission created successfully",
          permission
        )
      );
    }
  );

  findAll = asyncHandler(
    async (_req: Request, res: Response) => {
      const permissions =
        await permissionService.getAllPermissions();

      return res.status(200).json(
        new ApiResponse(
          "Permissions fetched successfully",
          permissions
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const permissionId = Number(
        String(req.params.id)
      );

      const permission =
        await permissionService.getPermissionById(
          permissionId
        );

      return res.status(200).json(
        new ApiResponse(
          "Permission fetched successfully",
          permission
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const permissionId = Number(
        String(req.params.id)
      );

      const permission =
        await permissionService.updatePermission(
          permissionId,
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Permission updated successfully",
          permission
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const permissionId = Number(
        String(req.params.id)
      );

      await permissionService.deletePermission(
        permissionId
      );

      return res.status(200).json(
        new ApiResponse(
          "Permission deleted successfully"
        )
      );
    }
  );
}

export default new PermissionController();