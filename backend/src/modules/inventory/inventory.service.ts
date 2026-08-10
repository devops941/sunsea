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
      // Fetch today's locked snapshots, yesterday's snapshots, and today's
      // transactions so we can compute the day-opening balance when no
      // yesterday snapshot exists (e.g. first day of using the system).
      const [todaySnapshots, yesterdaySnapshots, todayRmTxns, todayFgTxns] = await Promise.all([
        prisma.eodStockSnapshot.findMany({ where: { snapshotDate: date } }),
        prisma.eodStockSnapshot.findMany({ where: { snapshotDate: yesterday } }),
        prisma.rawMaterialTransaction.findMany({
          where: { txnDateTime: { gte: todayISTStart } },
        }),
        prisma.finishedGoodsTransaction.findMany({
          where: { txnDateTime: { gte: todayISTStart } },
        }),
      ]);

      const todayMap = new Map<string, any>();
      for (const s of todaySnapshots) {
        todayMap.set(`${s.category}_${s.itemId}_${s.storeId}`, s);
      }
      const yesterdayMap = new Map<string, any>();
      for (const s of yesterdaySnapshots) {
        yesterdayMap.set(`${s.category}_${s.itemId}_${s.storeId}`, s);
      }

      // ── Compute today's net stock change for Raw Materials ───────────────────
      // qty is always stored as absolute; txnType tells direction
      const rmNetMap = new Map<string, number>();
      for (const t of todayRmTxns) {
        const typ = t.txnType.toUpperCase();
        const q = Number(t.qty) || 0;
        // IN types add stock, OUT types subtract stock
        const isIn = typ.includes("IN") || typ.includes("RECEIPT") || typ.includes("OPENING") || typ.includes("RETURN");
        const isOut = typ.includes("OUT") || typ.includes("ISSUE") || typ.includes("CONSUMPTION") || typ.includes("DISPATCH");
        const delta = isIn ? q : isOut ? -q : 0;
        rmNetMap.set(t.rawMaterialId, (rmNetMap.get(t.rawMaterialId) || 0) + delta);
      }

      // ── Compute today's net stock change for Finished Goods ──────────────────
      const fgNetMap = new Map<string, number>();
      for (const t of todayFgTxns) {
        const typ = t.txnType.toUpperCase();
        const q = Number(t.qty) || 0;
        const isIn = typ.includes("IN") || typ.includes("RECEIPT") || typ.includes("OPENING") || typ.includes("RETURN");
        const isOut = typ.includes("OUT") || typ.includes("ISSUE") || typ.includes("DISPATCH");
        const delta = isIn ? q : isOut ? -q : 0;
        const key = `${t.productItemId}_${t.storeId}`;
        fgNetMap.set(key, (fgNetMap.get(key) || 0) + delta);
      }

      // ── Helper: compute startQty with 3-tier priority ────────────────────────
      // 1) Today's locked snapshot startQty (if EOD job already ran today)
      // 2) Yesterday's snapshot eodQty (yesterday's closing = today's opening)
      // 3) currentQty − netChangeToday (reverse today's transactions to get opening)
      const calcStartQty = (todaySnap: any, yesterdaySnap: any, currentQty: number, netChangeToday: number): number => {
        if (todaySnap) return Number(todaySnap.startQty);
        if (yesterdaySnap) return Number(yesterdaySnap.eodQty);
        return currentQty - netChangeToday;
      };

      // ── Raw Materials + Wastage ──────────────────────────────────────────────
      const rawMaterials = await prisma.rawMaterial.findMany({ where: { isActive: true } });
      const rmRows = rawMaterials.map((rm) => {
        const storeIdVal = rm.storeId || "DEFAULT";
        const cat = rm.itemType === "WASTAGE" ? "WASTAGE" : "RAW_MATERIAL";
        const todaySnap = todayMap.get(`${cat}_${rm.rawMaterialId}_${storeIdVal}`);
        const yestSnap = yesterdayMap.get(`${cat}_${rm.rawMaterialId}_${storeIdVal}`);

        const currentQty = Number(rm.onHandQty) || 0;
        const netChangeToday = rmNetMap.get(rm.rawMaterialId) || 0;
        const startQty = calcStartQty(todaySnap, yestSnap, currentQty, netChangeToday);

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
        const yestSnap = yesterdayMap.get(`FINISHED_PRODUCT_${itemIdStr}_${row.storeId}`);
        const currentQty = Number(row.onHandQty) || 0;
        const netChangeToday = fgNetMap.get(`${row.productItemId}_${row.storeId}`) || 0;
        const startQty = calcStartQty(todaySnap, yestSnap, currentQty, netChangeToday);

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
        const yestSnap = yesterdayMap.get(`FINISHED_PRODUCT_${itemIdStr}_${storeIdVal}`);
        const netChangeToday = fgNetMap.get(`${prod.id}_${storeIdVal}`) || 0;
        const startQty = calcStartQty(todaySnap, yestSnap, 0, netChangeToday);

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
      if (storeId) allRows = allRows.filter((r) => r.storeId === storeId);
      if (search) allRows = allRows.filter((r) => matchesSearch(r, search));

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
