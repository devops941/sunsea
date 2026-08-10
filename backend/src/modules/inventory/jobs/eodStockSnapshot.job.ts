import { prisma } from "../../../config/prisma";
import { getISTDateParts } from "../../../utils/dateUtils";
import { getIO } from "../../../socket/socket";

/**
 * Helper to safely upsert EOD stock snapshots without triggering Postgres ON CONFLICT 42P10 errors
 */
const upsertEodSnapshot = async (data: {
  category: "RAW_MATERIAL" | "FINISHED_PRODUCT" | "WASTAGE";
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string | null;
  storeId: string;
  snapshotDate: Date;
  startQty: number;
  eodQty: number;
  recordedAt: Date;
}) => {
  const existing = await prisma.eodStockSnapshot.findFirst({
    where: {
      category: data.category as any,
      itemId: data.itemId,
      storeId: data.storeId,
      snapshotDate: data.snapshotDate,
    },
  });

  if (existing) {
    await prisma.eodStockSnapshot.update({
      where: { id: existing.id },
      data: {
        startQty: data.startQty,
        eodQty: data.eodQty,
        recordedAt: data.recordedAt,
      },
    });
  } else {
    await prisma.eodStockSnapshot.create({
      data: {
        category: data.category as any,
        itemId: data.itemId,
        itemCode: data.itemCode,
        itemName: data.itemName,
        uom: data.uom,
        storeId: data.storeId,
        snapshotDate: data.snapshotDate,
        startQty: data.startQty,
        eodQty: data.eodQty,
        recordedAt: data.recordedAt,
      },
    });
  }
};

/**
 * Executes EOD Stock snapshot for Raw Materials and Finished Products.
 *
 * startQty logic (same as the live view):
 *   1) Yesterday's snapshot eodQty  (yesterday's closing = today's opening)
 *   2) currentQty − netChangeToday  (reverse today's transactions to derive opening)
 *
 * eodQty = currentQty (live on-hand at the moment the job runs)
 */
export const runEodStockSnapshot = async (targetDateStr?: string) => {
  const now = new Date();

  let dateStr: string;
  let today: Date;
  if (targetDateStr) {
    dateStr = targetDateStr.split("T")[0];
    const [year, month, day] = dateStr.split("-").map(Number);
    today = new Date(Date.UTC(year, month - 1, day));
  } else {
    const parts = getISTDateParts(now);
    today = new Date(Date.UTC(parts.year, parts.month, parts.day));
    dateStr = `${parts.year}-${String(parts.month + 1).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  }

  // Construct a fixed recordedAt timestamp at 23:59:00 in India Standard Time (+05:30)
  const recordedAtFixed = new Date(`${dateStr}T23:59:00+05:30`);

  const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));

  // Today's start in IST (midnight) as a UTC Date for querying transactions
  const todayISTStart = new Date(`${dateStr}T00:00:00+05:30`);

  // ── Fetch yesterday's snapshots + today's transactions in parallel ────────
  const [yesterdaySnapshots, todayRmTxns, todayFgTxns] = await Promise.all([
    prisma.eodStockSnapshot.findMany({ where: { snapshotDate: yesterday } }),
    prisma.rawMaterialTransaction.findMany({
      where: { txnDateTime: { gte: todayISTStart } },
    }),
    prisma.finishedGoodsTransaction.findMany({
      where: { txnDateTime: { gte: todayISTStart } },
    }),
  ]);

  const yesterdayMap = new Map<string, any>();
  for (const s of yesterdaySnapshots) {
    yesterdayMap.set(`${s.category}_${s.itemId}_${s.storeId}`, s);
  }

  // ── Compute net stock change today for Raw Materials ─────────────────────
  const rmNetMap = new Map<string, number>();
  for (const t of todayRmTxns) {
    const typ = t.txnType.toUpperCase();
    const q = Number(t.qty) || 0;
    const isIn = typ.includes("IN") || typ.includes("RECEIPT") || typ.includes("OPENING") || typ.includes("RETURN");
    const isOut = typ.includes("OUT") || typ.includes("ISSUE") || typ.includes("CONSUMPTION") || typ.includes("DISPATCH");
    const delta = isIn ? q : isOut ? -q : 0;
    rmNetMap.set(t.rawMaterialId, (rmNetMap.get(t.rawMaterialId) || 0) + delta);
  }

  // ── Compute net stock change today for Finished Goods ────────────────────
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

  // ── Helper: compute startQty with 2-tier priority ────────────────────────
  // 1) Yesterday's eodQty (yesterday's closing = today's opening)
  // 2) currentQty − netChangeToday (reverse today's transactions to get opening)
  const calcStartQty = (yestSnap: any, currentQty: number, netChangeToday: number): number => {
    if (yestSnap) return Number(yestSnap.eodQty);
    return currentQty - netChangeToday;
  };

  let rmCount = 0;
  let fgCount = 0;

  // 1. RAW MATERIAL
  const rawMaterials = await prisma.rawMaterial.findMany({ where: { isActive: true } });
  for (const rm of rawMaterials) {
    const storeId = rm.storeId || "DEFAULT";
    const category = rm.itemType === "WASTAGE" ? "WASTAGE" : "RAW_MATERIAL";

    const yestSnap = yesterdayMap.get(`${category}_${rm.rawMaterialId}_${storeId}`);
    const currentQty = Number(rm.onHandQty) || 0;
    const netChangeToday = rmNetMap.get(rm.rawMaterialId) || 0;
    const startQty = calcStartQty(yestSnap, currentQty, netChangeToday);

    await upsertEodSnapshot({
      category: category as any,
      itemId: rm.rawMaterialId,
      itemCode: rm.rawMaterialId,
      itemName: rm.materialName,
      uom: rm.baseUom,
      storeId,
      snapshotDate: today,
      startQty,
      eodQty: currentQty,
      recordedAt: recordedAtFixed,
    });
    rmCount++;
  }

  // 2. FINISHED PRODUCT (store-wise stock rows + products fallback)
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

  for (const row of stockRows) {
    if (!row.product || !row.product.isActive) continue;

    const itemIdStr = String(row.productItemId);
    snapshottedProductItemIds.add(itemIdStr);

    const yestSnap = yesterdayMap.get(`FINISHED_PRODUCT_${itemIdStr}_${row.storeId}`);
    const currentQty = Number(row.onHandQty) || 0;
    const netChangeToday = fgNetMap.get(`${row.productItemId}_${row.storeId}`) || 0;
    const startQty = calcStartQty(yestSnap, currentQty, netChangeToday);

    await upsertEodSnapshot({
      category: "FINISHED_PRODUCT",
      itemId: itemIdStr,
      itemCode: row.product.productCode,
      itemName: row.product.productName,
      uom: row.product.uom?.uomName ?? null,
      storeId: row.storeId,
      snapshotDate: today,
      startQty,
      eodQty: currentQty,
      recordedAt: recordedAtFixed,
    });
    fgCount++;
  }

  // Products with no finishedGoodsStock row yet
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { uom: true },
  });

  for (const prod of allProducts) {
    const itemIdStr = String(prod.id);
    if (snapshottedProductItemIds.has(itemIdStr)) continue;

    const storeId = "DEFAULT";
    const yestSnap = yesterdayMap.get(`FINISHED_PRODUCT_${itemIdStr}_${storeId}`);
    const currentQty = 0;
    const netChangeToday = fgNetMap.get(`${prod.id}_${storeId}`) || 0;
    const startQty = calcStartQty(yestSnap, currentQty, netChangeToday);

    await upsertEodSnapshot({
      category: "FINISHED_PRODUCT",
      itemId: itemIdStr,
      itemCode: prod.productCode,
      itemName: prod.productName,
      uom: prod.uom?.uomName ?? null,
      storeId,
      snapshotDate: today,
      startQty,
      eodQty: currentQty,
      recordedAt: recordedAtFixed,
    });
    fgCount++;
  }

  console.log(`✅ EOD snapshot done: ${rmCount} RM, ${fgCount} FG rows at ${now.toISOString()} (locked recordedAt to ${recordedAtFixed.toISOString()})`);
  getIO().emit("inventorySnapshot:completed", { date: dateStr, timestamp: now.toISOString() });
};
