import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateFinishedGoodsTransactionInput, UpdateFinishedGoodsTransactionInput } from "./finished-goods-transaction.validation";

class FinishedGoodsTransactionService {
  async create(data: CreateFinishedGoodsTransactionInput, userId?: string) {
    const productItemId = BigInt(data.productItemId);

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { storeId: data.storeId },
    });
    if (!store) {
      throw new ApiError(404, `Store with ID ${data.storeId} not found`);
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productItemId },
    });
    if (!product) {
      throw new ApiError(404, `Product with ID ${productItemId.toString()} not found`);
    }

    // Verify production order exists if provided
    if (data.productionOrderId) {
      const productionOrder = await prisma.productionOrder.findUnique({
        where: { productionOrderId: data.productionOrderId },
      });
      if (!productionOrder) {
        throw new ApiError(404, `Production Order with ID ${data.productionOrderId} not found`);
      }
    }

    // Run in a database transaction to ensure ledger consistency
    return prisma.$transaction(async (tx) => {
      // 1. Create the transaction record
      const txn = await tx.finishedGoodsTransaction.create({
        data: {
          txnDateTime: new Date(data.txnDateTime),
          storeId: data.storeId,
          productItemId,
          txnType: data.txnType,
          qty: data.qty,
          productionOrderId: data.productionOrderId,
          deliveryChallanId: data.deliveryChallanId,
          invoiceId: data.invoiceId,
          relatedDocNo: data.relatedDocNo,
          remarks: data.remarks,
          createdBy: userId,
        },
        include: {
          store: true,
          product: true,
          productionOrder: true,
        },
      });

      // 2. Find or create the corresponding Finished Goods Stock entry
      const stock = await tx.finishedGoodsStock.findUnique({
        where: {
          storeId_productItemId: {
            storeId: data.storeId,
            productItemId,
          },
        },
      });

      if (stock) {
        // Update existing stock
        await tx.finishedGoodsStock.update({
          where: {
            storeId_productItemId: {
              storeId: data.storeId,
              productItemId,
            },
          },
          data: {
            onHandQty: Number(stock.onHandQty) + data.qty,
          },
        });
      } else {
        // Create new stock entry
        await tx.finishedGoodsStock.create({
          data: {
            storeId: data.storeId,
            productItemId,
            onHandQty: data.qty,
          },
        });
      }

      return txn;
    });
  }

  async findAll() {
    return prisma.finishedGoodsTransaction.findMany({
      include: {
        store: true,
        product: true,
        productionOrder: true,
      },
      orderBy: {
        txnDateTime: "desc",
      },
    });
  }

  async findById(fgTxnId: bigint) {
    const txn = await prisma.finishedGoodsTransaction.findUnique({
      where: { fgTxnId },
      include: {
        store: true,
        product: true,
        productionOrder: true,
      },
    });

    if (!txn) {
      throw new ApiError(404, `Transaction with ID ${fgTxnId.toString()} not found`);
    }

    return txn;
  }

  async update(fgTxnId: bigint, data: UpdateFinishedGoodsTransactionInput) {
    const existing = await this.findById(fgTxnId);

    // If quantity or storeId or productItemId changes, we must adjust stocks.
    // To keep it simple and robust, we reverse the old transaction qty, and apply the new qty.
    const newStoreId = data.storeId ?? existing.storeId;
    const newProductItemId = data.productItemId ? BigInt(data.productItemId) : existing.productItemId;
    const newQty = data.qty ?? Number(existing.qty);

    return prisma.$transaction(async (tx) => {
      // 1. Reverse old stock adjustment
      const oldStock = await tx.finishedGoodsStock.findUnique({
        where: {
          storeId_productItemId: {
            storeId: existing.storeId,
            productItemId: existing.productItemId,
          },
        },
      });
      if (oldStock) {
        await tx.finishedGoodsStock.update({
          where: {
            storeId_productItemId: {
              storeId: existing.storeId,
              productItemId: existing.productItemId,
            },
          },
          data: {
            onHandQty: Number(oldStock.onHandQty) - Number(existing.qty),
          },
        });
      }

      // 2. Apply new stock adjustment
      const targetStock = await tx.finishedGoodsStock.findUnique({
        where: {
          storeId_productItemId: {
            storeId: newStoreId,
            productItemId: newProductItemId,
          },
        },
      });

      if (targetStock) {
        await tx.finishedGoodsStock.update({
          where: {
            storeId_productItemId: {
              storeId: newStoreId,
              productItemId: newProductItemId,
            },
          },
          data: {
            onHandQty: Number(targetStock.onHandQty) + newQty,
          },
        });
      } else {
        await tx.finishedGoodsStock.create({
          data: {
            storeId: newStoreId,
            productItemId: newProductItemId,
            onHandQty: newQty,
          },
        });
      }

      // 3. Update the transaction
      return tx.finishedGoodsTransaction.update({
        where: { fgTxnId },
        data: {
          txnDateTime: data.txnDateTime ? new Date(data.txnDateTime) : undefined,
          storeId: data.storeId,
          productItemId: data.productItemId ? BigInt(data.productItemId) : undefined,
          txnType: data.txnType,
          qty: data.qty,
          productionOrderId: data.productionOrderId,
          deliveryChallanId: data.deliveryChallanId,
          invoiceId: data.invoiceId,
          relatedDocNo: data.relatedDocNo,
          remarks: data.remarks,
        },
        include: {
          store: true,
          product: true,
          productionOrder: true,
        },
      });
    });
  }

  async delete(fgTxnId: bigint) {
    const existing = await this.findById(fgTxnId);

    return prisma.$transaction(async (tx) => {
      // Reverse stock adjustment on delete
      const stock = await tx.finishedGoodsStock.findUnique({
        where: {
          storeId_productItemId: {
            storeId: existing.storeId,
            productItemId: existing.productItemId,
          },
        },
      });
      if (stock) {
        await tx.finishedGoodsStock.update({
          where: {
            storeId_productItemId: {
              storeId: existing.storeId,
              productItemId: existing.productItemId,
            },
          },
          data: {
            onHandQty: Number(stock.onHandQty) - Number(existing.qty),
          },
        });
      }

      return tx.finishedGoodsTransaction.delete({
        where: { fgTxnId },
      });
    });
  }
}

export default new FinishedGoodsTransactionService();
