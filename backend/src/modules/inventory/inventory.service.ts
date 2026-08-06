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

    // ── PAST DATE: DB snapshots + augment missing items ───────────────────────
    // Build DB where clause
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

    // Fetch ALL snapshots for this date (no pagination yet — need to augment)
    const allSnapshots = await prisma.eodStockSnapshot.findMany({
      where,
      orderBy: { itemName: "asc" },
    });

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

    // Build set of already-snapshotted keys
    const snappedKeys = new Set(allSnapshots.map((s) => `${s.category}_${s.itemId}_${s.storeId}`));

    // Fetch active items not in snapshot to augment the list
    const [rawMaterials, stockRows, allProducts] = await Promise.all([
      prisma.rawMaterial.findMany({ where: { isActive: true } }),
      prisma.finishedGoodsStock.findMany({
        include: { product: { include: { uom: true } } },
      }),
      prisma.product.findMany({ where: { isActive: true }, include: { uom: true } }),
    ]);

    const missingRows: any[] = [];

    // Missing raw materials / wastage
    for (const rm of rawMaterials) {
      const storeIdVal = rm.storeId || "DEFAULT";
      const cat = rm.itemType === "WASTAGE" ? "WASTAGE" : "RAW_MATERIAL";
      const key = `${cat}_${rm.rawMaterialId}_${storeIdVal}`;
      if (snappedKeys.has(key)) continue;

      // Apply same filters
      if (catFilter && cat !== catFilter) continue;
      if (storeId && storeIdVal !== storeId) continue;

      const row = {
        id: `missing-${cat}-${rm.rawMaterialId}-${storeIdVal}`,
        category: cat as any,
        itemId: rm.rawMaterialId,
        itemCode: rm.rawMaterialId,
        itemName: rm.materialName,
        uom: rm.baseUom,
        storeId: storeIdVal,
        snapshotDate: date,
        startQty: Number(rm.onHandQty) || 0,
        eodQty: Number(rm.onHandQty) || 0,
        recordedAt: null,  // null = not snapshotted for this date
      };
      if (!search || matchesSearch(row, search)) missingRows.push(row);
    }

    // Missing finished goods (from stock rows)
    const seenProductIds = new Set<string>();
    for (const row of stockRows) {
      if (!row.product?.isActive) continue;
      const itemIdStr = String(row.productItemId);
      seenProductIds.add(itemIdStr);

      const key = `FINISHED_PRODUCT_${itemIdStr}_${row.storeId}`;
      if (snappedKeys.has(key)) continue;
      if (catFilter && catFilter !== "FINISHED_PRODUCT") continue;
      if (storeId && row.storeId !== storeId) continue;

      const r = {
        id: `missing-FINISHED_PRODUCT-${itemIdStr}-${row.storeId}`,
        category: "FINISHED_PRODUCT" as any,
        itemId: itemIdStr,
        itemCode: row.product.productCode,
        itemName: row.product.productName,
        uom: row.product.uom?.uomName ?? null,
        storeId: row.storeId,
        snapshotDate: date,
        startQty: Number(row.onHandQty) || 0,
        eodQty: Number(row.onHandQty) || 0,
        recordedAt: null,
      };
      if (!search || matchesSearch(r, search)) missingRows.push(r);
    }

    // Missing finished goods (products with no stock row)
    for (const prod of allProducts) {
      const itemIdStr = String(prod.id);
      if (seenProductIds.has(itemIdStr)) continue;
      const storeIdVal = "DEFAULT";
      const key = `FINISHED_PRODUCT_${itemIdStr}_${storeIdVal}`;
      if (snappedKeys.has(key)) continue;
      if (catFilter && catFilter !== "FINISHED_PRODUCT") continue;
      if (storeId && storeIdVal !== storeId) continue;

      const r = {
        id: `missing-FINISHED_PRODUCT-${itemIdStr}-${storeIdVal}`,
        category: "FINISHED_PRODUCT" as any,
        itemId: itemIdStr,
        itemCode: prod.productCode,
        itemName: prod.productName,
        uom: prod.uom?.uomName ?? null,
        storeId: storeIdVal,
        snapshotDate: date,
        startQty: 0,
        eodQty: 0,
        recordedAt: null,
      };
      if (!search || matchesSearch(r, search)) missingRows.push(r);
    }

    // Merge: locked snapshots first, then missing items (sorted by name within each group)
    missingRows.sort((a, b) => a.itemName.localeCompare(b.itemName));
    const combined = [...snapshotRows, ...missingRows];

    const total = combined.length;
    return {
      data: combined.slice((page - 1) * limit, page * limit),
      total,
    };
  }
}

export default new InventoryService();
