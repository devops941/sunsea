import { prisma } from "../../config/prisma";
import { getISTDateParts } from "../../utils/dateUtils";

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

    const daySnapshotCount = await prisma.eodStockSnapshot.count({
      where: { snapshotDate: date },
    });

    const now = new Date();
    const nowParts = getISTDateParts(now);
    const todayISTStart = new Date(Date.UTC(nowParts.year, nowParts.month, nowParts.day));
    const isToday = date.getTime() === todayISTStart.getTime();

    if (daySnapshotCount === 0 && isToday) {
      // 1. Calculate yesterday's date in UTC
      const yesterday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1));

      // 2. Fetch yesterday's snapshots in bulk
      const yesterdaySnapshots = await prisma.eodStockSnapshot.findMany({
        where: { snapshotDate: yesterday },
      });

      const yesterdayMap = new Map<string, any>();
      for (const snap of yesterdaySnapshots) {
        const key = `${snap.category}_${snap.itemId}_${snap.storeId}`;
        yesterdayMap.set(key, snap);
      }

      // 3. Get active Raw Materials
      const rawMaterials = await prisma.rawMaterial.findMany({ where: { isActive: true } });
      const rmRows = rawMaterials.map((rm) => {
        const storeIdVal = rm.storeId || "DEFAULT";
        const categoryVal = rm.itemType === "WASTAGE" ? "WASTAGE" : "RAW_MATERIAL";
        const key = `${categoryVal}_${rm.rawMaterialId}_${storeIdVal}`;
        const prev = yesterdayMap.get(key);
        const currentQty = Number(rm.onHandQty) || 0;
        const startQty = prev ? Number(prev.eodQty) : currentQty;

        return {
          id: `temp-${categoryVal}-${rm.rawMaterialId}-${storeIdVal}`,
          category: categoryVal,
          itemId: rm.rawMaterialId,
          itemCode: rm.rawMaterialId,
          itemName: rm.materialName,
          uom: rm.baseUom,
          storeId: storeIdVal,
          snapshotDate: date,
          startQty,
          eodQty: null,
          recordedAt: null,
        };
      });

      // 4. Get Finished Goods Stock
      const stockRows = await prisma.finishedGoodsStock.findMany({
        include: {
          product: {
            include: {
              uom: true,
            },
          },
        },
      });

      const snapshottedProductItemIds = new Set<string>();
      const fgRows: any[] = [];

      for (const row of stockRows) {
        if (!row.product || !row.product.isActive) continue;

        const itemIdStr = String(row.productItemId);
        snapshottedProductItemIds.add(itemIdStr);

        const key = `FINISHED_PRODUCT_${itemIdStr}_${row.storeId}`;
        const prev = yesterdayMap.get(key);
        const currentQty = Number(row.onHandQty) || 0;
        const startQty = prev ? Number(prev.eodQty) : currentQty;

        fgRows.push({
          id: `temp-FINISHED_PRODUCT-${itemIdStr}-${row.storeId}`,
          category: "FINISHED_PRODUCT",
          itemId: itemIdStr,
          itemCode: row.product.productCode,
          itemName: row.product.productName,
          uom: row.product.uom?.uomName ?? null,
          storeId: row.storeId,
          snapshotDate: date,
          startQty,
          eodQty: null,
          recordedAt: null,
        });
      }

      // Products with no finishedGoodsStock row yet
      const allProducts = await prisma.product.findMany({
        where: { isActive: true },
        include: { uom: true },
      });

      for (const prod of allProducts) {
        const itemIdStr = String(prod.id);
        if (snapshottedProductItemIds.has(itemIdStr)) continue;

        const storeIdVal = "DEFAULT";
        const key = `FINISHED_PRODUCT_${itemIdStr}_${storeIdVal}`;
        const prev = yesterdayMap.get(key);
        const currentQty = 0;
        const startQty = prev ? Number(prev.eodQty) : currentQty;

        fgRows.push({
          id: `temp-FINISHED_PRODUCT-${itemIdStr}-${storeIdVal}`,
          category: "FINISHED_PRODUCT",
          itemId: itemIdStr,
          itemCode: prod.productCode,
          itemName: prod.productName,
          uom: prod.uom?.uomName ?? null,
          storeId: storeIdVal,
          snapshotDate: date,
          startQty,
          eodQty: null,
          recordedAt: null,
        });
      }

      let allRows = [...rmRows, ...fgRows];

      // Filter by category
      if (category) {
        const normalized = category.toUpperCase().trim();
        let catFilter: string | null = null;
        if (normalized === "RAW_MATERIAL" || normalized === "RAW_MATERIALS" || normalized === "RAW") {
          catFilter = "RAW_MATERIAL";
        } else if (normalized === "FINISHED_PRODUCT" || normalized === "FINISHED_PRODUCTS" || normalized === "FINISHED" || normalized === "PRODUCT") {
          catFilter = "FINISHED_PRODUCT";
        } else if (normalized === "WASTAGE") {
          catFilter = "WASTAGE";
        }
        if (catFilter) {
          allRows = allRows.filter((r) => r.category === catFilter);
        } else {
          allRows = [];
        }
      }

      // Filter by storeId
      if (storeId) {
        allRows = allRows.filter((r) => r.storeId === storeId);
      }

      // Filter by search term
      if (search) {
        const term = search.toLowerCase();
        allRows = allRows.filter((r) =>
          (r.itemCode && r.itemCode.toLowerCase().includes(term)) ||
          (r.itemName && r.itemName.toLowerCase().includes(term)) ||
          (r.uom && r.uom.toLowerCase().includes(term))
        );
      }

      // Sort by itemName asc
      allRows.sort((a, b) => a.itemName.localeCompare(b.itemName));

      const total = allRows.length;
      const start = (page - 1) * limit;
      const paginatedData = allRows.slice(start, start + limit);

      return {
        data: paginatedData,
        total,
      };
    }

    let categoryFilterValue: any = undefined;
    if (category) {
      const normalized = category.toUpperCase().trim();
      if (normalized === "RAW_MATERIAL" || normalized === "RAW_MATERIALS" || normalized === "RAW") {
        categoryFilterValue = "RAW_MATERIAL";
      } else if (normalized === "FINISHED_PRODUCT" || normalized === "FINISHED_PRODUCTS" || normalized === "FINISHED" || normalized === "PRODUCT") {
        categoryFilterValue = "FINISHED_PRODUCT";
      } else if (normalized === "WASTAGE") {
        categoryFilterValue = "WASTAGE";
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
