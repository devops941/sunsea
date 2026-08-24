import type { Request, Response } from 'express';
import { CustomerTypeService } from './customer-type.service';
import { ApiResponse } from '../../utils/ApiResponse';

export class CustomerTypeController {
  static async getAll(req: Request, res: Response) {
    const data = await CustomerTypeService.getAll();
    return res.status(200).json(new ApiResponse('Customer types fetched successfully', data));
  }

  static async getById(req: Request, res: Response) {
    const id = parseInt(req.params.id as string, 10);
    const data = await CustomerTypeService.getById(id);
    return res.status(200).json(new ApiResponse('Customer type fetched successfully', data));
  }

  static async create(req: Request, res: Response) {
    const data = await CustomerTypeService.create(req.body);
    return res.status(201).json(new ApiResponse('Customer type created successfully', data));
  }

  static async update(req: Request, res: Response) {
    const id = parseInt(req.params.id as string, 10);
    const data = await CustomerTypeService.update(id, req.body);
    return res.status(200).json(new ApiResponse('Customer type updated successfully', data));
  }

  static async delete(req: Request, res: Response) {
    const id = parseInt(req.params.id as string, 10);
    await CustomerTypeService.delete(id);
    return res.status(200).json(new ApiResponse('Customer type deleted successfully', null));
  }
}
