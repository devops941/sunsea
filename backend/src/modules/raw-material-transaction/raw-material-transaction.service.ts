import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateRawMaterialTransactionInput, UpdateRawMaterialTransactionInput } from "./raw-material-transaction.validation";

class RawMaterialTransactionService {
  async create(data: CreateRawMaterialTransactionInput) {
    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { storeId: data.storeId },
    });
    if (!store) {
      throw new ApiError(404, `Store with ID ${data.storeId} not found`);
    }

    // Verify raw material exists
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { rawMaterialId: data.rawMaterialId },
    });
    if (!rawMaterial) {
      throw new ApiError(404, `Raw Material with ID ${data.rawMaterialId} not found`);
    }

    const txnDateTime = data.txnDateTime ? new Date(data.txnDateTime) : new Date();

    return prisma.$transaction(async (tx) => {
      // 1. Create the transaction record
      const txn = await tx.rawMaterialTransaction.create({
        data: {
          storeId: data.storeId,
          rawMaterialId: data.rawMaterialId,
          txnType: data.txnType,
          qty: data.qty,
          txnDateTime,
          remarks: data.remarks,
        },
        include: {
          store: true,
          rawMaterial: true,
        },
      });

      // 2. Update the corresponding Raw Material Stock (which is the RawMaterial itself)
      await tx.rawMaterial.update({
        where: { rawMaterialId: data.rawMaterialId },
        data: {
          onHandQty: {
            increment: data.qty,
          },
          lastMovementAt: new Date()
        },
      });

      return txn;
    });
  }

  async findAll() {
    return prisma.rawMaterialTransaction.findMany({
      include: {
        store: true,
        rawMaterial: true,
      },
      orderBy: {
        txnDateTime: "desc",
      },
    });
  }

  async findById(rmTxnId: bigint) {
    const txn = await prisma.rawMaterialTransaction.findUnique({
      where: { rmTxnId },
      include: {
        store: true,
        rawMaterial: true,
      },
    });

    if (!txn) {
      throw new ApiError(404, `Raw Material Transaction with ID ${rmTxnId.toString()} not found`);
    }

    return txn;
  }

  async update(rmTxnId: bigint, data: UpdateRawMaterialTransactionInput) {
    const existing = await this.findById(rmTxnId);

    const newStoreId = data.storeId ?? existing.storeId;
    const newRawMaterialId = data.rawMaterialId ?? existing.rawMaterialId;
    const newQty = data.qty ?? Number(existing.qty);
    const txnDateTime = data.txnDateTime ? new Date(data.txnDateTime) : existing.txnDateTime;

    return prisma.$transaction(async (tx) => {
      // 1. Reverse old stock level
      await tx.rawMaterial.update({
        where: { rawMaterialId: existing.rawMaterialId },
        data: {
          onHandQty: {
            decrement: Number(existing.qty)
          }
        },
      });

      // 2. Apply new stock level
      await tx.rawMaterial.update({
        where: { rawMaterialId: newRawMaterialId },
        data: {
          onHandQty: {
            increment: newQty
          },
          lastMovementAt: new Date()
        },
      });

      // 3. Update transaction entry
      return tx.rawMaterialTransaction.update({
        where: { rmTxnId },
        data: {
          storeId: newStoreId,
          rawMaterialId: newRawMaterialId,
          txnType: data.txnType,
          qty: newQty,
          txnDateTime,
          remarks: data.remarks,
        },
        include: {
          store: true,
          rawMaterial: true,
        },
      });
    });
  }

  async delete(rmTxnId: bigint) {
    const existing = await this.findById(rmTxnId);

    return prisma.$transaction(async (tx) => {
      // Reverse stock level on delete
      await tx.rawMaterial.update({
        where: { rawMaterialId: existing.rawMaterialId },
        data: {
          onHandQty: {
            decrement: Number(existing.qty)
          },
          lastMovementAt: new Date()
        },
      });

      return tx.rawMaterialTransaction.delete({
        where: { rmTxnId },
      });
    });
  }
}

export default new RawMaterialTransactionService();
