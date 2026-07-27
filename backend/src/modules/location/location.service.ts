import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateLocationInput, UpdateLocationInput } from "./location.validation";

class LocationService {
  async create(data: CreateLocationInput, userId?: string) {
    const existingId = await prisma.location.findUnique({
      where: { locationId: data.locationId },
    });

    if (existingId) {
      throw new ApiError(409, `Location with ID ${data.locationId} already exists`);
    }

    const codeToUse = data.locationCode || data.locationId;

    const existingCode = await prisma.location.findUnique({
      where: { locationCode: codeToUse },
    });

    if (existingCode) {
      throw new ApiError(409, `Location with code ${codeToUse} already exists`);
    }

    return prisma.location.create({
      data: {
        locationId: data.locationId,
        locationCode: codeToUse,
        locationName: data.locationName,
        locationType: data.locationType,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        isActive: data.isActive ?? true,
        createdBy: userId,
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    locationType?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}) {
    const {
      page,
      limit,
      search,
      locationType,
      sortBy = "locationCode",
      sortOrder = "asc"
    } = params;
    const where: any = {};

    if (search) {
      where.OR = [
        { locationId: { contains: search, mode: "insensitive" } },
        { locationCode: { contains: search, mode: "insensitive" } },
        { locationName: { contains: search, mode: "insensitive" } },
        { locationType: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }

    if (locationType) {
      where.locationType = locationType;
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

    const [locations, total] = await Promise.all([
      prisma.location.findMany(queryOptions),
      prisma.location.count({ where }),
    ]);

    return {
      locations,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages: limit ? Math.ceil(total / limit) : 1,
    };
  }

  async findById(locationId: string) {
    const location = await prisma.location.findUnique({
      where: { locationId },
      include: {
        stores: true,
      },
    });

    if (!location) {
      throw new ApiError(404, `Location with ID ${locationId} not found`);
    }

    return location;
  }

  async update(locationId: string, data: UpdateLocationInput, userId?: string) {
    await this.findById(locationId);

    if (data.locationCode) {
      const existingCode = await prisma.location.findFirst({
        where: {
          locationCode: data.locationCode,
          locationId: { not: locationId },
        },
      });

      if (existingCode) {
        throw new ApiError(409, `Location with code ${data.locationCode} already exists`);
      }
    }

    return prisma.location.update({
      where: { locationId },
      data: {
        ...data,
        updatedBy: userId,
      },
    });
  }

  async delete(locationId: string) {
    await this.findById(locationId);

    const storeCount = await prisma.store.count({ where: { locationId } });
    if (storeCount > 0) {
      throw new ApiError(400, "Cannot delete this location because it is already assigned in Storage Store Management.");
    }

    return prisma.location.delete({
      where: { locationId },
    });
  }
  async getNextLocationId() {
    const lastLocation = await prisma.location.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastLocation) {
      return "LOC001";
    }

    const lastId = lastLocation.locationId;
    const match = lastId.match(/\d+/);
    if (!match) {
      return lastId + "001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const prefix = lastId.substring(0, lastId.indexOf(numberStr));
    const suffix = lastId.substring(lastId.indexOf(numberStr) + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }
}

export default new LocationService();
