import { Request, Response, NextFunction } from "express";
import uomService from "./uom.service";

class UOMController {
  getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = uomService.getCategories();
      res.status(200).json({
        success: true,
        message: "Categories retrieved successfully",
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  };

  getUnits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = req.query.category as string | undefined;
      const units = uomService.getUnits(category);
      res.status(200).json({
        success: true,
        message: "Units retrieved successfully",
        data: units,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new UOMController();