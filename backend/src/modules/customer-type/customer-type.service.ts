import { PrismaClient } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import type { CreateCustomerTypeInput, UpdateCustomerTypeInput } from './customer-type.validation';

const prisma = new PrismaClient();

export class CustomerTypeService {
  static async getAll() {
    return prisma.customerType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  static async getById(id: number) {
    const type = await prisma.customerType.findUnique({ where: { id } });
    if (!type) throw new ApiError(404, 'Customer type not found');
    return type;
  }

  static async create(data: CreateCustomerTypeInput) {
    const existing = await prisma.customerType.findFirst({ where: { name: { equals: data.name, mode: 'insensitive' } } });
    if (existing) throw new ApiError(409, 'Customer type already exists');

    return prisma.customerType.create({ data });
  }

  static async update(id: number, data: UpdateCustomerTypeInput) {
    await this.getById(id);

    const existing = await prisma.customerType.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        id: { not: id },
      },
    });
    if (existing) throw new ApiError(409, 'Customer type already exists');

    return prisma.customerType.update({ where: { id }, data });
  }

  static async delete(id: number) {
    await this.getById(id);

    // Check if any customers are using this type
    const usersCount = await prisma.customer.count({ where: { customerTypeId: id } });
    if (usersCount > 0) throw new ApiError(400, 'Cannot delete customer type currently in use by customers');

    await prisma.customerType.delete({ where: { id } });
  }
}
