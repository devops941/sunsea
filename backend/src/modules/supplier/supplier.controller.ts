import { Request, Response } from "express";
import supplierService from "./supplier.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class SupplierController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req.user?.userId || "d67768ba-bcde-4321-a123-bcdef9876543"; // fallback to default admin seeded user if not present
      const supplier = await supplierService.createSupplier({
        ...req.body,
        userId,
      });

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
          "Next customer code fetched successfully",
          nextCode
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      await supplierService.deleteSupplier(id);

      return res.status(200).json(
        new ApiResponse(
          "Supplier deleted successfully"
        )
      );
    }
  );
}

export default new SupplierController();