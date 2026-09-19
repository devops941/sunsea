import { Request, Response } from "express";
import supplierService from "./supplier.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { prisma } from "../../config/prisma";
import { getIO } from "../../socket/socket";

class SupplierController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      // BUG-SUP-002 fix: removed hardcoded fallback UUID — always require authenticated user
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError(401, "Unauthorized: missing user context");
      }

      // BUG-SUP-001 fix: resolve companyId server-side — never trust it from the client
      const company = await prisma.company.findFirst();
      if (!company) {
        throw new ApiError(500, "No company found in the system");
      }

      const supplier = await supplierService.createSupplier({
        ...req.body,
        companyId: company.id, // override any client-supplied companyId
        userId,
      });

      getIO().emit("supplier:created", supplier);

      return res.status(201).json(
        new ApiResponse(
          "Supplier created successfully",
          supplier
        )
      );
    }
  );

  findAll = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = req.query.search ? String(req.query.search) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;

      const result = await supplierService.getAllSuppliers({
        page,
        limit,
        search,
        status,
      });

      return res.status(200).json(
        new ApiResponse(
          "Suppliers fetched successfully",
          result
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      const supplier = await supplierService.getSupplierById(id);

      return res.status(200).json(
        new ApiResponse(
          "Supplier fetched successfully",
          supplier
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      const userId = req.user?.userId;

      const supplier = await supplierService.updateSupplier(
        id,
        {
          ...req.body,
          userId,
        }
      );

      getIO().emit("supplier:updated", supplier);

      return res.status(200).json(
        new ApiResponse(
          "Supplier updated successfully",
          supplier
        )
      );
    }
  );

  getNextCode = asyncHandler(
    async (req: Request, res: Response) => {
      const nextCode = await supplierService.getNextSupplierCode();
      return res.status(200).json(
        new ApiResponse(
          // BUG-SUP (message typo) fix: corrected "customer" → "supplier"
          "Next supplier code fetched successfully",
          nextCode
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      await supplierService.deleteSupplier(id, req.user?.userId);

      getIO().emit("supplier:deleted", { id });

      return res.status(200).json(
        new ApiResponse(
          "Supplier deleted successfully"
        )
      );
    }
  );
}

export default new SupplierController();