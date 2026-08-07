import { prisma } from "../../config/prisma";
import { getISTDateParts } from "../../utils/dateUtils";

// ─── helpers ──────────────────────────────────────────────────────────────────

const normCategory = (category?: string): "RAW_MATERIAL" | "FINISHED_PRODUCT" | "WASTAGE" | null | undefined => {
  if (!category) return undefined;
  const n = category.toUpperCase().trim();
  if (n === "RAW_MATERIAL" || n === "RAW_MATERIALS" || n === "RAW") return "RAW_MATERIAL";
  if (n === "FINISHED_PRODUCT" || n === "FINISHED_PRODUCTS" || n === "FINISHED" || n === "PRODUCT") return "FINISHED_PRODUCT";
  if (n === "WASTAGE") return "WASTAGE";
  return null; // unknown → return empty
};

const matchesSearch = (row: any, term: string): boolean => {
  const t = term.toLowerCase();
  return (
    (row.itemCode && row.itemCode.toLowerCase().includes(t)) ||
    (row.itemName && row.itemName.toLowerCase().includes(t)) ||
    (row.uom && row.uom.toLowerCase().includes(t))
  );
};

// ─── service ──────────────────────────────────────────────────────────────────

class InventoryService {
  /**
   * Fetch daily EOD stock snapshots.
   *
   * For TODAY  → always shows ALL active items with live quantities so nothing
   *              is ever missing from the view mid-day.
   *
   * For PAST DATES → returns DB snapshot rows first; any active item that was
   *              NOT captured in that snapshot (added later, or job missed it)
   *              is appended with its current on-hand qty so the table is
   *              always complete.  A "Re-run EOD" call will lock proper values.
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

    const now = new Date();
    const nowParts = getISTDateParts(now);
    const todayISTStart = new Date(Date.UTC(nowParts.year, nowParts.month, nowParts.day));
    const isToday = date.getTime() === todayISTStart.getTime();
    const yesterday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1));

    const catFilter = normCategory(category);
    if (catFilter === null) return { data: [], total: 0 }; // unknown category

    // ── TODAY: always use live in-memory data ─────────────────────────────────
    if (isToday) {
      // Fetch today's locked snapshots (if EOD job already ran for today)
      // and yesterday's snapshots for opening-balance (startQty) calculation
      const [todaySnapshots, yesterdaySnapshots] = await Promise.all([
        prisma.eodStockSnapshot.findMany({ where: { snapshotDate: date } }),
        prisma.eodStockSnapshot.findMany({ where: { snapshotDate: yesterday } }),
      ]);

      const todayMap = new Map<string, any>();
      for (const s of todaySnapshots) {
        todayMap.set(`${s.category}_${s.itemId}_${s.storeId}`, s);
      }
      const yesterdayMap = new Map<string, any>();
      for (const s of yesterdaySnapshots) {
        yesterdayMap.set(`${s.category}_${s.itemId}_${s.storeId}`, s);
      }

      // ── Raw Materials + Wastage ──────────────────────────────────────────────
      const rawMaterials = await prisma.rawMaterial.findMany({ where: { isActive: true } });
      const rmRows = rawMaterials.map((rm) => {
        const storeIdVal = rm.storeId || "DEFAULT";
        const cat = rm.itemType === "WASTAGE" ? "WASTAGE" : "RAW_MATERIAL";
        const todaySnap = todayMap.get(`${cat}_${rm.rawMaterialId}_${storeIdVal}`);
        const prevSnap  = yesterdayMap.get(`${cat}_${rm.rawMaterialId}_${storeIdVal}`);

        const currentQty = Number(rm.onHandQty) || 0;
        // startQty: use today's locked startQty → else yesterday's eodQty → else current
        const startQty = todaySnap
          ? Number(todaySnap.startQty)
          : prevSnap
          ? Number(prevSnap.eodQty)
          : currentQty;

        return {
          id: todaySnap ? String(todaySnap.id) : `temp-${cat}-${rm.rawMaterialId}-${storeIdVal}`,
          category: cat as any,
          itemId: rm.rawMaterialId,
          itemCode: rm.rawMaterialId,
          itemName: rm.materialName,
          uom: rm.baseUom,
          storeId: storeIdVal,
          snapshotDate: date,
          startQty,
          eodQty: currentQty,   // always show live current qty throughout the day
          recordedAt: null,      // null = live / not locked yet
        };
      });

      // ── Finished Goods ───────────────────────────────────────────────────────
      const stockRows = await prisma.finishedGoodsStock.findMany({
        include: { product: { include: { uom: true } } },
      });

      const seenProductIds = new Set<string>();
      const fgRows: any[] = [];

      for (const row of stockRows) {
        if (!row.product?.isActive) continue;
        const itemIdStr = String(row.productItemId);
        seenProductIds.add(itemIdStr);

        const todaySnap = todayMap.get(`FINISHED_PRODUCT_${itemIdStr}_${row.storeId}`);
        const prevSnap  = yesterdayMap.get(`FINISHED_PRODUCT_${itemIdStr}_${row.storeId}`);
        const currentQty = Number(row.onHandQty) || 0;
        const startQty = todaySnap
          ? Number(todaySnap.startQty)
          : prevSnap
          ? Number(prevSnap.eodQty)
          : currentQty;

        fgRows.push({
          id: todaySnap ? String(todaySnap.id) : `temp-FINISHED_PRODUCT-${itemIdStr}-${row.storeId}`,
          category: "FINISHED_PRODUCT" as any,
          itemId: itemIdStr,
          itemCode: row.product.productCode,
          itemName: row.product.productName,
          uom: row.product.uom?.uomName ?? null,
          storeId: row.storeId,
          snapshotDate: date,
          startQty,
          eodQty: currentQty,
          recordedAt: null,
        });
      }

      // Products with no FinishedGoodsStock row yet
      const allProducts = await prisma.product.findMany({
        where: { isActive: true },
        include: { uom: true },
      });
      for (const prod of allProducts) {
        const itemIdStr = String(prod.id);
        if (seenProductIds.has(itemIdStr)) continue;
        const storeIdVal = "DEFAULT";
        const todaySnap = todayMap.get(`FINISHED_PRODUCT_${itemIdStr}_${storeIdVal}`);
        const prevSnap  = yesterdayMap.get(`FINISHED_PRODUCT_${itemIdStr}_${storeIdVal}`);
        const startQty = todaySnap
          ? Number(todaySnap.startQty)
          : prevSnap
          ? Number(prevSnap.eodQty)
          : 0;

        fgRows.push({
          id: todaySnap ? String(todaySnap.id) : `temp-FINISHED_PRODUCT-${itemIdStr}-${storeIdVal}`,
          category: "FINISHED_PRODUCT" as any,
          itemId: itemIdStr,
          itemCode: prod.productCode,
          itemName: prod.productName,
          uom: prod.uom?.uomName ?? null,
          storeId: storeIdVal,
          snapshotDate: date,
          startQty,
          eodQty: 0,
          recordedAt: null,
        });
      }

      let allRows = [...rmRows, ...fgRows];

      // Apply filters
      if (catFilter) allRows = allRows.filter((r) => r.category === catFilter);
      if (storeId)   allRows = allRows.filter((r) => r.storeId === storeId);
      if (search)    allRows = allRows.filter((r) => matchesSearch(r, search));

      allRows.sort((a, b) => a.itemName.localeCompare(b.itemName));

      const total = allRows.length;
      return {
        data: allRows.slice((page - 1) * limit, page * limit),
        total,
      };
    }

    // ── PAST DATE: Only return locked DB snapshots (historical data only) ────────
    const where: any = {
      snapshotDate: date,
      ...(catFilter && { category: catFilter }),
      ...(storeId && { storeId }),
      ...(search && {
        OR: [
          { itemCode: { contains: search, mode: "insensitive" } },
          { itemName: { contains: search, mode: "insensitive" } },
          { uom: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [allSnapshots, total] = await Promise.all([
      prisma.eodStockSnapshot.findMany({
        where,
        orderBy: { itemName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.eodStockSnapshot.count({ where }),
    ]);

    const snapshotRows = allSnapshots.map((s) => ({
      id: s.id.toString(),
      category: s.category as any,
      itemId: s.itemId,
      itemCode: s.itemCode,
      itemName: s.itemName,
      uom: s.uom,
      storeId: s.storeId,
      snapshotDate: s.snapshotDate,
      startQty: Number(s.startQty) || 0,
      eodQty: Number(s.eodQty) || 0,
      recordedAt: s.recordedAt,
    }));

    return { data: snapshotRows, total };
  }
}

export default new InventoryService();
