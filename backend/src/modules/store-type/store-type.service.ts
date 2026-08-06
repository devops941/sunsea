import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateStoreTypeInput, UpdateStoreTypeInput } from "./store-type.validation";

const db = prisma as any;

class StoreTypeService {
  async create(data: CreateStoreTypeInput) {
    const existing = await db.storeType?.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ApiError(409, `Store Type with code ${data.code} already exists`);
    }

    return db.storeType?.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}) {

    const {
      page,
      limit,
      search,
      sortBy = "name",
      sortOrder = "asc",
    } = params;

    const where: any = {};

    if (search) {
      where.OR = [
        {
          code: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const queryOptions: any = {
      where,
      include: {
        _count: {
          select: { stores: true },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    };

    if (page !== undefined || limit !== undefined) {
      const p = page || 1;
      const l = limit || 10;

      queryOptions.skip = (p - 1) * l;
      queryOptions.take = l;
    }

    const [storeTypes, total] = await Promise.all([
      db.storeType?.findMany ? db.storeType.findMany(queryOptions) : [],
      db.storeType?.count ? db.storeType.count({ where }) : 0,
    ]);

    return {
      storeTypes,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages: limit ? Math.ceil(total / limit) : 1,
    };
  }

  async findById(id: number) {
    const storeType = await db.storeType?.findUnique({
      where: { id },
    });

    if (!storeType) {
      throw new ApiError(404, `Store Type with ID ${id} not found`);
    }

    return storeType;
  }

  async update(id: number, data: UpdateStoreTypeInput) {
    await this.findById(id);

    // If code is updated, check for conflicts
    if (data.code) {
      const existing = await db.storeType?.findUnique({
        where: { code: data.code },
      });

      if (existing && existing.id !== id) {
        throw new ApiError(409, `Store Type with code ${data.code} already exists`);
      }
    }

    return db.storeType?.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    await this.findById(id);

    // Check if any stores are using this type
    const storesUsingType = await db.store?.count({
      where: { storeTypeId: id },
    }) || 0;

    if (storesUsingType > 0) {
      throw new ApiError(400, `Cannot delete Store Type because it is already assigned in Storage Store Management.`);
    }

    return db.storeType?.delete({
      where: { id },
    });
  }

  async getNextId() {
    const lastStoreType = await db.storeType?.findFirst({
      orderBy: { id: "desc" },
    });

    if (!lastStoreType) {
      return "ST001";
    }

    // Attempt to parse out numbers from something like "ST-RAW" or "ST001"
    const match = lastStoreType.code?.match(/\d+$/);
    if (!match) {
      // If no digits found, default fallback
      const random = Math.floor(100 + Math.random() * 900);
      return `ST${random}`;
    }

    const nextNumber = parseInt(match[0], 10) + 1;
    return `ST${String(nextNumber).padStart(3, "0")}`;
  }
}

export default new StoreTypeService();
