import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateGstTaxInput, UpdateGstTaxInput, GstTaxQueryInput } from "./gstTaxValidation";

class GstTaxService {
    async create(data: CreateGstTaxInput, userId?: string) {
        const nameExists = await prisma.gstTaxRate.findFirst({
            where: { taxName: data.taxName }
        });
        if (nameExists) {
            throw new ApiError(409, "A GST tax with this name already exists");
        }

        const rateExists = await prisma.gstTaxRate.findFirst({
            where: { taxRate: Number(data.taxRate) }
        });
        if (rateExists) {
            throw new ApiError(409, `A GST tax with the rate ${data.taxRate}% already exists`);
        }
        return prisma.gstTaxRate.create({
            data: {
                taxName: data.taxName,
                taxType: data.taxType,
                taxRate: Number(data.taxRate),
                status: data.status || "ACTIVE",
            },
        });
    }

    async findAll({ search = "", page = "1", pageSize = "10" }: GstTaxQueryInput = {}) {
        const where = search
            ? { taxName: { contains: search, mode: "insensitive" as const } }
            : {};

        const pageNum = Number(page);
        const pageSizeNum = Number(pageSize);
        const skip = (pageNum - 1) * pageSizeNum;

        const [data, total] = await Promise.all([
            prisma.gstTaxRate.findMany({
                where,
                skip,
                take: pageSizeNum,
                orderBy: { createdAt: "desc" },
            }),
            prisma.gstTaxRate.count({ where }),
        ]);

        return { data, total, page: pageNum, pageSize: pageSizeNum };
    }

    async findById(gstTaxId: string) {
        const row = await prisma.gstTaxRate.findUnique({
            where: { id: gstTaxId },
        });

        if (!row) {
            throw new ApiError(404, `GST Tax with ID ${gstTaxId} not found`);
        }

        return row;
    }

    async update(gstTaxId: string, data: UpdateGstTaxInput) {
        await this.findById(gstTaxId); // throws 404 if missing

        if (data.taxName) {
            const existingName = await prisma.gstTaxRate.findFirst({
                where: {
                    id: { not: gstTaxId },
                    taxName: data.taxName
                }
            });
            if (existingName) {
                throw new ApiError(409, "A GST tax with this name already exists");
            }
        }

        if (data.taxRate !== undefined) {
            const existingRate = await prisma.gstTaxRate.findFirst({
                where: {
                    id: { not: gstTaxId },
                    taxRate: Number(data.taxRate)
                }
            });
            if (existingRate) {
                throw new ApiError(409, `A GST tax with the rate ${data.taxRate}% already exists`);
            }
        }

        return prisma.gstTaxRate.update({
            where: { id: gstTaxId },
            data: {
                ...(data.taxName !== undefined && { taxName: data.taxName }),
                ...(data.taxType !== undefined && { taxType: data.taxType }),
                ...(data.taxRate !== undefined && { taxRate: Number(data.taxRate) }),
                ...(data.status !== undefined && { status: data.status }),
            },
        });
    }

    async delete(gstTaxId: string) {
        await this.findById(gstTaxId); // throws 404 if missing

        const linkedProducts = await prisma.product.findFirst({ where: { taxId: gstTaxId } });
        if (linkedProducts) throw new ApiError(400, "Cannot delete GST Tax because it is linked to one or more Products");

        const linkedMaterials = await prisma.rawMaterial.findFirst({ where: { taxId: gstTaxId } });
        if (linkedMaterials) throw new ApiError(400, "Cannot delete GST Tax because it is linked to one or more Raw Materials");

        const linkedSalesOrders = await prisma.salesOrderItem.findFirst({ where: { taxId: gstTaxId } });
        if (linkedSalesOrders) throw new ApiError(400, "Cannot delete GST Tax because it is linked to one or more Sales Order Items");

        return prisma.gstTaxRate.delete({
            where: { id: gstTaxId },
        });
    }
}

export default new GstTaxService();