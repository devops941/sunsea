import { prisma } from "../../config/prisma";
import { Prisma, VoucherType } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { CreateSalesReturnInput, CreatePurchaseReturnInput } from "./returns.types";
import { accountsService } from "../accounts/accounts.service";
import { voucherPostingService } from "../accounts/voucherPosting.service";
import rawMaterialStockService from "../raw-material-stock/raw-material-stock.service";
import { vouchersService } from "../vouchers/vouchers.service";

class ReturnsService {
  private generateReturnNo(prefix: string): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${timestamp}-${random}`;
  }

  // --- SALES RETURN ---
  async getSalesReturns(companyId?: string) {
    return prisma.salesReturn.findMany({
      where: companyId ? { companyId } : undefined,
      include: {
        customer: {
          select: {
            id: true,
            firmName: true,
            customerCode: true,
            customerGradeId: true,
            customerGrade: { select: { id: true, name: true } },
          },
        },
        salesInvoice: { select: { id: true, invoiceNo: true } },
        items: { include: { product: { select: { id: true, productName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createSalesReturn(data: CreateSalesReturnInput, createdBy?: string) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new ApiError(404, "Customer not found");

    const salesReturn = await prisma.$transaction(
      async (tx) => {
        let storeIdForRestock = "MAIN_STORE";

        // 1. Validate against sales invoice if provided
        if (data.salesInvoiceId) {
          const invoice = await tx.salesInvoice.findUnique({
            where: { id: data.salesInvoiceId },
            include: { items: true },
          });
          if (!invoice) throw new ApiError(404, "Original sales invoice not found");
          if (invoice.customerId !== data.customerId) {
            throw new ApiError(400, "Sales invoice does not belong to the selected customer");
          }
          if (invoice.storeId) storeIdForRestock = invoice.storeId;

          // Check previously returned quantities for this invoice
          const previousReturns = await tx.salesReturn.findMany({
            where: { salesInvoiceId: data.salesInvoiceId, status: { not: "CANCELLED" } },
            include: { items: true },
          });

          const returnedQtyMap = new Map<string, number>();
          for (const ret of previousReturns) {
            for (const item of ret.items) {
              if (item.salesInvoiceItemId) {
                const current = returnedQtyMap.get(item.salesInvoiceItemId) || 0;
                returnedQtyMap.get(item.salesInvoiceItemId);
                returnedQtyMap.set(item.salesInvoiceItemId, current + Number(item.quantity));
              }
            }
          }

          // Validate each item
          for (const itemInput of data.items) {
            if (itemInput.salesInvoiceItemId) {
              const invItem = invoice.items.find((i) => i.id === itemInput.salesInvoiceItemId);
              if (!invItem) {
                throw new ApiError(400, `Invoice item ${itemInput.salesInvoiceItemId} not found in invoice ${data.salesInvoiceId}`);
              }
              const alreadyReturned = returnedQtyMap.get(itemInput.salesInvoiceItemId) || 0;
              const originalQty = Number(invItem.quantity);
              const remainingReturnable = originalQty - alreadyReturned;

              if (itemInput.quantity > remainingReturnable) {
                throw new ApiError(
                  400,
                  `Cannot return ${itemInput.quantity} units of product item ${itemInput.productId}. Original qty: ${originalQty}, already returned: ${alreadyReturned}, max returnable: ${remainingReturnable}.`
                );
              }
            }
          }
        }

        // 2. Compute totals
        let subTotal = 0;
        let taxAmount = 0;

        const itemsData = data.items.map((item) => {
          const lineSubtotal = item.quantity * item.unitPrice;
          const lineTax = (lineSubtotal * (item.taxRate || 0)) / 100;
          const lineTotal = lineSubtotal + lineTax;

          subTotal += lineSubtotal;
          taxAmount += lineTax;

          return {
            productId: BigInt(item.productId),
            salesInvoiceItemId: item.salesInvoiceItemId || null,
            quantity: new Prisma.Decimal(item.quantity),
            weight: item.weight ? new Prisma.Decimal(item.weight) : null,
            uom: item.uom || null,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            taxRate: new Prisma.Decimal(item.taxRate || 0),
            lineTotal: new Prisma.Decimal(lineTotal),
            reason: item.reason || data.reason || null,
          };
        });

        const grandTotal = subTotal + taxAmount;
        const returnNo = this.generateReturnNo("SRT");

        // 3. Create SalesReturn + Items
        const salesReturn = await tx.salesReturn.create({
          data: {
            returnNo,
            returnDate: new Date(),
            customerId: data.customerId,
            salesInvoiceId: data.salesInvoiceId || null,
            reason: data.reason || null,
            subTotal: new Prisma.Decimal(subTotal),
            taxAmount: new Prisma.Decimal(taxAmount),
            grandTotal: new Prisma.Decimal(grandTotal),
            status: "APPROVED",
            narration: data.narration || null,
            companyId: data.companyId,
            createdBy: createdBy || null,
            items: {
              create: itemsData,
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });

        return salesReturn;
      }, { maxWait: 10000, timeout: 30000 });

      // 4. Post Double-Entry Accounting Voucher(s) after return transaction has committed
      try {
        await voucherPostingService.postSalesReturnVoucher(salesReturn.id);
      } catch (vErr) {
        console.error("[Auto-Post Voucher Error] Failed to post Sales Return Voucher:", vErr);
      }

      return salesReturn;
  }

  async getSalesReturnById(id: string) {
    const returnRecord = await prisma.salesReturn.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, firmName: true, customerCode: true, customerGrade: true } },
        salesInvoice: { select: { id: true, invoiceNo: true } },
        items: {
          include: {
            product: { select: { id: true, productName: true, productCode: true, category: true } },
          },
        },
      },
    });
    if (!returnRecord) throw new ApiError(404, "Sales return not found");
    return returnRecord;
  }

  async updateSalesReturn(id: string, data: CreateSalesReturnInput, _updatedBy?: string) {
    const existing = await prisma.salesReturn.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new ApiError(404, "Sales return not found");

    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new ApiError(404, "Customer not found");

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Delete previous items
      await tx.salesReturnItem.deleteMany({ where: { salesReturnId: id } });

      // 2. Compute totals
      let subTotal = 0;
      let taxAmount = 0;

      const itemsData = data.items.map((item) => {
        const lineSubtotal = item.quantity * item.unitPrice;
        const lineTax = (lineSubtotal * (item.taxRate || 0)) / 100;
        const lineTotal = lineSubtotal + lineTax;

        subTotal += lineSubtotal;
        taxAmount += lineTax;

        return {
          productId: BigInt(item.productId),
          salesInvoiceItemId: item.salesInvoiceItemId || null,
          quantity: new Prisma.Decimal(item.quantity),
          weight: item.weight ? new Prisma.Decimal(item.weight) : null,
          uom: item.uom || null,
          unitPrice: new Prisma.Decimal(item.unitPrice),
          taxRate: new Prisma.Decimal(item.taxRate || 0),
          lineTotal: new Prisma.Decimal(lineTotal),
          reason: item.reason || data.reason || null,
        };
      });

      const grandTotal = subTotal + taxAmount;

      const record = await tx.salesReturn.update({
        where: { id },
        data: {
          customerId: data.customerId,
          salesInvoiceId: data.salesInvoiceId || null,
          reason: data.reason || null,
          subTotal: new Prisma.Decimal(subTotal),
          taxAmount: new Prisma.Decimal(taxAmount),
          grandTotal: new Prisma.Decimal(grandTotal),
          status: "APPROVED",
          narration: data.narration || null,
          companyId: data.companyId,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      return record;
    });

    try {
      await voucherPostingService.postSalesReturnVoucher(updated.id);
    } catch (vErr) {
      console.error("[Auto-Post Voucher Error] Failed to post Sales Return Voucher on update:", vErr);
    }

    return updated;
  }

  // --- PURCHASE RETURN ---
  async getPurchaseReturns(companyId?: string) {
    return prisma.purchaseReturn.findMany({
      where: companyId ? { companyId } : undefined,
      include: {
        supplier: { select: { id: true, legalName: true, supplierCode: true } },
        grnInvoice: { select: { id: true, invoiceNo: true } },
        items: { include: { rawMaterial: { select: { rawMaterialId: true, materialName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createPurchaseReturn(data: CreatePurchaseReturnInput, createdBy?: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) throw new ApiError(404, "Supplier not found");

    const purchaseReturn = await prisma.$transaction(
      async (tx) => {
        let storeIdForDeduction: string | null = (data as any).storeId || null;

        // 1. Determine store & validate against GRN invoice if provided
        if (data.grnInvoiceId) {
          const grnInvoice = await (tx as any).grnInvoice.findUnique({
            where: { id: data.grnInvoiceId },
            include: { items: true },
          });
          if (!grnInvoice) throw new ApiError(404, "Original GRN invoice not found");
          if (grnInvoice.supplierId !== data.supplierId) {
            throw new ApiError(400, "GRN invoice does not belong to the selected supplier");
          }
          if (grnInvoice.storeId) {
            storeIdForDeduction = grnInvoice.storeId;
          }

          // Fetch previous purchase returns against this GRN invoice
          const previousReturns = await tx.purchaseReturn.findMany({
            where: { grnInvoiceId: data.grnInvoiceId, status: { not: "CANCELLED" } },
            include: { items: true },
          });

          const returnedQtyMap = new Map<string, number>();
          for (const ret of previousReturns) {
            for (const item of ret.items) {
              const current = returnedQtyMap.get(item.rawMaterialId) || 0;
              returnedQtyMap.set(item.rawMaterialId, current + Number(item.quantity));
            }
          }

          // Validate each item against GRN invoice line items
          for (const itemInput of data.items) {
            const grnItem = grnInvoice.items?.find((i: any) => i.productId === itemInput.rawMaterialId || i.rawMaterialId === itemInput.rawMaterialId);
            if (grnItem) {
              const alreadyReturned = returnedQtyMap.get(itemInput.rawMaterialId) || 0;
              const originalQty = Number(grnItem.quantity);
              const remainingReturnable = originalQty - alreadyReturned;

              if (itemInput.quantity > remainingReturnable) {
                throw new ApiError(
                  400,
                  `Cannot return ${itemInput.quantity} units of raw material ${itemInput.rawMaterialId}. Original purchased qty: ${originalQty}, already returned: ${alreadyReturned}, max returnable: ${remainingReturnable}.`
                );
              }
            } else {
              throw new ApiError(
                400,
                `Raw material ${itemInput.rawMaterialId} was not purchased in GRN/PO ${grnInvoice.invoiceNo || grnInvoice.grnNumber}`
              );
            }
          }
        }

        if (!storeIdForDeduction) {
          // If no GRN storeId and no data.storeId, check if raw material has storeId or throw error
          const firstRm = await tx.rawMaterial.findUnique({ where: { rawMaterialId: data.items[0].rawMaterialId } });
          if (firstRm && firstRm.storeId) {
            storeIdForDeduction = firstRm.storeId;
          } else {
            throw new ApiError(400, "Store/warehouse is required for purchase return stock deduction");
          }
        }

        const returnNo = this.generateReturnNo("PRT");
        let grandTotal = 0;
        const itemsData = data.items.map((item) => {
          const lineTotal = item.quantity * item.unitPrice;
          grandTotal += lineTotal;
          return {
            rawMaterialId: item.rawMaterialId,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            lineTotal: new Prisma.Decimal(lineTotal),
            reason: item.reason || data.reason || null,
          };
        });

        // 2. Create PurchaseReturn + Items
        const purchaseReturn = await tx.purchaseReturn.create({
          data: {
            returnNo,
            returnDate: new Date(),
            supplierId: data.supplierId,
            grnInvoiceId: data.grnInvoiceId || null,
            reason: data.reason || null,
            grandTotal: new Prisma.Decimal(grandTotal),
            status: "APPROVED",
            narration: data.narration || null,
            companyId: data.companyId,
            createdBy: createdBy || null,
            items: {
              create: itemsData,
            },
          },
          include: {
            items: true,
            supplier: true,
          },
        });

        // 3. Deduct Raw Material Stock
        await rawMaterialStockService.deductForPurchaseReturn(
          data.items.map((i) => ({
            rawMaterialId: i.rawMaterialId,
            quantity: i.quantity,
            storeId: storeIdForDeduction!,
          })),
          returnNo,
          tx
        );

        // 3b. Create Stock Adjustment Record & Stock Adjustment Items
        const year = new Date().getFullYear();
        const prefix = `ADJ-${year}-`;
        const lastAdj = await tx.stockAdjustment.findFirst({
          where: { adjustmentNumber: { startsWith: prefix } },
          orderBy: { adjustmentNumber: "desc" },
          select: { adjustmentNumber: true },
        });
        let seq = 1;
        if (lastAdj?.adjustmentNumber) {
          const parts = lastAdj.adjustmentNumber.split("-");
          seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
        }
        const adjustmentNumber = `${prefix}${String(seq).padStart(4, "0")}`;

        const saRecord = await tx.stockAdjustment.create({
          data: {
            adjustmentNumber,
            adjustmentDate: new Date(),
            adjustmentType: "PURCHASE_RETURN",
            reason: `Purchase Return ${returnNo}`,
            status: "APPROVED",
            approvedBy: createdBy || "SYSTEM",
            approvedAt: new Date(),
            createdBy: createdBy || "SYSTEM",
            updatedBy: createdBy || "SYSTEM",
            autoGenerated: true,
            sourceDocument: "PURCHASE_RETURN",
            sourceDocId: purchaseReturn.id,
          },
        });

        for (const item of data.items) {
          const rm = await tx.rawMaterial.findUnique({ where: { rawMaterialId: item.rawMaterialId } });
          const currentQty = Number(rm?.onHandQty || 0) + Number(item.quantity); // qty before deduction
          const adjustedQty = Number(rm?.onHandQty || 0); // qty after deduction

          await tx.stockAdjustmentItem.create({
            data: {
              stockAdjustmentId: saRecord.id,
              itemType: "RAW_MATERIAL",
              rawMaterialId: item.rawMaterialId,
              storeId: storeIdForDeduction!,
              currentQty,
              adjustedQty,
              difference: -Number(item.quantity),
              unitCost: item.unitPrice,
              remarks: `Purchase Return ${returnNo}`,
            },
          });
        }

        return purchaseReturn;
      },
      { maxWait: 10000, timeout: 30000 }
    );

    // 4. Post Purchase Return Voucher (Debit: Supplier Ledger, Credit: Purchase Return Account) after return transaction commits
    try {
      const { voucherPostingService } = require("../accounts/voucherPosting.service");
      await voucherPostingService.postPurchaseReturnVoucher(purchaseReturn.id);
    } catch (vErr) {
      console.error("[Auto-Post Voucher Error] Failed to post Purchase Return Voucher:", vErr);
    }

    return purchaseReturn;
  }

  async getPurchaseReturnById(id: string) {
    const returnRecord = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, legalName: true, supplierCode: true } },
        grnInvoice: { select: { id: true, invoiceNo: true } },
        items: {
          include: {
            rawMaterial: { select: { rawMaterialId: true, materialName: true } },
          },
        },
      },
    });
    if (!returnRecord) throw new ApiError(404, "Purchase return not found");
    return returnRecord;
  }

  async updatePurchaseReturn(id: string, data: CreatePurchaseReturnInput, _updatedBy?: string) {
    const existing = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new ApiError(404, "Purchase return not found");

    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) throw new ApiError(404, "Supplier not found");

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Delete previous items
      await tx.purchaseReturnItem.deleteMany({ where: { purchaseReturnId: id } });

      // 2. Compute totals
      let grandTotal = 0;
      const itemsData = data.items.map((item) => {
        const lineTotal = item.quantity * item.unitPrice;
        grandTotal += lineTotal;

        return {
          rawMaterialId: item.rawMaterialId,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.unitPrice),
          lineTotal: new Prisma.Decimal(lineTotal),
          reason: item.reason || data.reason || null,
        };
      });

      const record = await tx.purchaseReturn.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          grnInvoiceId: data.grnInvoiceId || null,
          reason: data.reason || null,
          grandTotal: new Prisma.Decimal(grandTotal),
          status: "APPROVED",
          narration: data.narration || null,
          companyId: data.companyId,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
          supplier: true,
        },
      });

      return record;
    });

    try {
      const { voucherPostingService } = require("../accounts/voucherPosting.service");
      await voucherPostingService.postPurchaseReturnVoucher(updated.id);
    } catch (vErr) {
      console.error("[Auto-Post Voucher Error] Failed to post Purchase Return Voucher on update:", vErr);
    }

    return updated;
  }
}

export const returnsService = new ReturnsService();
