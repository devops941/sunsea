import { PrismaClient } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import type { CreateCustomerGradeInput, UpdateCustomerGradeInput } from './customer-grade.validation';

const prisma = new PrismaClient();

export class CustomerGradeService {
  static async getAll() {
    return prisma.customerGrade.findMany({
      orderBy: { name: 'asc' },
    });
  }

  static async getById(id: number) {
    const grade = await prisma.customerGrade.findUnique({ where: { id } });
    if (!grade) throw new ApiError(404, 'Customer grade not found');
    return grade;
  }

  static async create(data: CreateCustomerGradeInput) {
    const existing = await prisma.customerGrade.findFirst({ where: { name: { equals: data.name, mode: 'insensitive' } } });
    if (existing) throw new ApiError(409, 'Customer grade already exists');

    return prisma.customerGrade.create({ data });
  }

  static async update(id: number, data: UpdateCustomerGradeInput) {
    await this.getById(id);

    const existing = await prisma.customerGrade.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        id: { not: id },
      },
    });
    if (existing) throw new ApiError(409, 'Customer grade already exists');

    return prisma.customerGrade.update({ where: { id }, data });
  }

  static async delete(id: number) {
    await this.getById(id);

    const usersCount = await prisma.customer.count({ where: { customerGradeId: id } });
    if (usersCount > 0) throw new ApiError(400, 'Cannot delete customer grade currently in use by customers');

    await prisma.customerGrade.delete({ where: { id } });
  }
}
