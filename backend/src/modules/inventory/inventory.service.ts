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

    const where: any = {
      snapshotDate: date,
      ...(category && { category }),
      ...(storeId && { storeId }),
      ...(search && {
        OR: [
          { itemCode: { contains: search, mode: "insensitive" } },
          { itemName: { contains: search, mode: "insensitive" } },
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
