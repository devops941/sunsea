import { prisma } from "../../../config/prisma";

/**
 * Executes EOD Stock snapshot for Raw Materials and Finished Products
 */
export const runEodStockSnapshot = async () => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // 1. RAW MATERIAL
  const rawMaterials = await prisma.rawMaterial.findMany({ where: { isActive: true } });
  for (const rm of rawMaterials) {
    if (!rm.storeId) continue;

    const prev = await prisma.eodStockSnapshot.findUnique({
      where: {
        category_itemId_storeId_snapshotDate: {
          category: "RAW_MATERIAL",
          itemId: rm.rawMaterialId,
          storeId: rm.storeId,
          snapshotDate: yesterday,
        },
      },
    });

    const currentQty = Number(rm.onHandQty);
    const startQty = prev ? Number(prev.eodQty) : currentQty;

    await prisma.eodStockSnapshot.upsert({
      where: {
        category_itemId_storeId_snapshotDate: {
          category: "RAW_MATERIAL",
          itemId: rm.rawMaterialId,
          storeId: rm.storeId,
          snapshotDate: today,
        },
      },
      update: { startQty, eodQty: currentQty, recordedAt: now },
      create: {
        category: "RAW_MATERIAL",
        itemId: rm.rawMaterialId,
        itemCode: rm.rawMaterialId,
        itemName: rm.materialName,
        uom: rm.baseUom,
        storeId: rm.storeId,
        snapshotDate: today,
        startQty,
        eodQty: currentQty,
        recordedAt: now,
      },
    });
  }

  // 2. FINISHED PRODUCT (store-wise)
  const stockRows = await prisma.finishedGoodsStock.findMany({
    include: {
      product: {
        include: {
          uom: true,
        },
      },
    },
  });

  for (const row of stockRows) {
    if (!row.product.isActive) continue;

    const prev = await prisma.eodStockSnapshot.findUnique({
      where: {
        category_itemId_storeId_snapshotDate: {
          category: "FINISHED_PRODUCT",
          itemId: String(row.productItemId),
          storeId: row.storeId,
          snapshotDate: yesterday,
        },
      },
    });

    const currentQty = Number(row.onHandQty);
    const startQty = prev ? Number(prev.eodQty) : currentQty;

    await prisma.eodStockSnapshot.upsert({
      where: {
        category_itemId_storeId_snapshotDate: {
          category: "FINISHED_PRODUCT",
          itemId: String(row.productItemId),
          storeId: row.storeId,
          snapshotDate: today,
        },
      },
      update: { startQty, eodQty: currentQty, recordedAt: now },
      create: {
        category: "FINISHED_PRODUCT",
        itemId: String(row.productItemId),
        itemCode: row.product.productCode,
        itemName: row.product.productName,
        uom: row.product.uom?.uomName ?? null,
        storeId: row.storeId,
        snapshotDate: today,
        startQty,
        eodQty: currentQty,
        recordedAt: now,
      },
    });
  }

  console.log(`✅ EOD snapshot done: ${rawMaterials.length} RM, ${stockRows.length} FG rows at ${now.toISOString()}`);
};
