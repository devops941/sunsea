import type { Request, Response } from 'express';
import { CustomerGradeService } from './customer-grade.service';
import { ApiResponse } from '../../utils/ApiResponse';

export class CustomerGradeController {
  static async getAll(req: Request, res: Response) {
    const data = await CustomerGradeService.getAll();
    return res.status(200).json(new ApiResponse('Customer grades fetched successfully', data));
  }

  static async getById(req: Request, res: Response) {
    const id = parseInt(req.params.id as string, 10);
    const data = await CustomerGradeService.getById(id);
    return res.status(200).json(new ApiResponse('Customer grade fetched successfully', data));
  }

  static async create(req: Request, res: Response) {
    const data = await CustomerGradeService.create(req.body);
    return res.status(201).json(new ApiResponse('Customer grade created successfully', data));
  }

  static async update(req: Request, res: Response) {
    const id = parseInt(req.params.id as string, 10);
    const data = await CustomerGradeService.update(id, req.body);
    return res.status(200).json(new ApiResponse('Customer grade updated successfully', data));
  }

  static async delete(req: Request, res: Response) {
    const id = parseInt(req.params.id as string, 10);
    await CustomerGradeService.delete(id);
    return res.status(200).json(new ApiResponse('Customer grade deleted successfully', null));
  }
}
