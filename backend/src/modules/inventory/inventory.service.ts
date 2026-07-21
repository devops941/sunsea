import { prisma } from "../../config/prisma";

class InventoryService {
  /**
   * Fetch daily EOD stock snapshots
   */
  async getEodStock(query: {
    date: Date;
    category?: string;
    storeId?: string;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { date, category, storeId, search, page, limit } = query;

    let categoryFilterValue: any = undefined;
    if (category) {
      const normalized = category.toUpperCase().trim();
      if (normalized === "RAW_MATERIAL" || normalized === "RAW_MATERIALS" || normalized === "RAW") {
        categoryFilterValue = "RAW_MATERIAL";
      } else if (normalized === "FINISHED_PRODUCT" || normalized === "FINISHED_PRODUCTS" || normalized === "FINISHED" || normalized === "PRODUCT") {
        categoryFilterValue = "FINISHED_PRODUCT";
      } else {
        return { data: [], total: 0 };
      }
    }

    const where: any = {
      snapshotDate: date,
      ...(categoryFilterValue && { category: categoryFilterValue }),
      ...(storeId && { storeId }),
      ...(search && {
        OR: [
          { itemCode: { contains: search, mode: "insensitive" } },
          { itemName: { contains: search, mode: "insensitive" } },
          { uom: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    // Query both matching snapshot rows and total count
    const [snapshots, total] = await Promise.all([
      prisma.eodStockSnapshot.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { itemName: "asc" },
      }),
      prisma.eodStockSnapshot.count({ where }),
    ]);

    // Format Decimal values to numbers for seamless API serialization
    const data = snapshots.map((s) => ({
      id: s.id.toString(), // Convert BigInt to String
      category: s.category,
      itemId: s.itemId,
      itemCode: s.itemCode,
      itemName: s.itemName,
      uom: s.uom,
      storeId: s.storeId,
      snapshotDate: s.snapshotDate,
      startQty: Number(s.startQty) || 0,
      eodQty: Number(s.eodQty) || 0,
      recordedAt: s.recordedAt,
      createdAt: s.createdAt,
    }));

    return {
      data,
      total,
    };
  }
}

export default new InventoryService();
