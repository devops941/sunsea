import { prisma } from "../../config/prisma";
import { Prisma, VoucherType } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { CreateSalesReturnInput, CreatePurchaseReturnInput } from "./returns.types";
import { accountsService } from "../accounts/accounts.service";
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
        customer: { select: { id: true, firmName: true, customerCode: true } },
        salesInvoice: { select: { id: true, invoiceNo: true } },
        items: { include: { product: { select: { id: true, productName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createSalesReturn(data: CreateSalesReturnInput, createdBy?: string) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new ApiError(404, "Customer not found");

    const returnNo = this.generateReturnNo("SRT");
    let grandTotal = 0;
    const itemsData = data.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      grandTotal += lineTotal;
      return {
        productId: BigInt(item.productId),
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice: new Prisma.Decimal(item.unitPrice),
        lineTotal: new Prisma.Decimal(lineTotal),
        reason: item.reason || data.reason || null,
      };
    });

    return prisma.$transaction(async (tx) => {
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNo,
          returnDate: new Date(),
          customerId: data.customerId,
          salesInvoiceId: data.salesInvoiceId || null,
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
          customer: true,
        },
      });

      // Post Sales Return Voucher (Debit: Sales Return Account, Credit: Customer Ledger)
      await accountsService.ensureSystemLedgersExist(tx);
      const customerLedger = await accountsService.ensureCustomerLedger(customer, tx);
      let salesReturnLedger = await tx.accountLedger.findUnique({ where: { code: "SRT-001" } });
      if (!salesReturnLedger) {
        const srList = await tx.accountLedger.findMany({
          where: { name: { contains: "Sales Return", mode: "insensitive" } },
        });
        salesReturnLedger = srList.length > 0 ? srList[0] : null;
      }
      const salesReturnLedgerId = salesReturnLedger ? salesReturnLedger.id : customerLedger.id;

      await vouchersService.autoPostVoucher({
        type: VoucherType.SALES_RETURN,
        refDocType: "SALES_RETURN",
        refDocId: salesReturn.id,
        debitLedgerId: salesReturnLedgerId,
        creditLedgerId: customerLedger.id,
        amount: grandTotal,
        narration: `Sales Return ${returnNo} for Customer ${customer.firmName}`,
        createdBy,
      });

      return salesReturn;
    });
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

    return prisma.$transaction(async (tx) => {
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

      // Post Purchase Return Voucher (Debit: Supplier Ledger, Credit: Purchase Return Account)
      await accountsService.ensureSystemLedgersExist(tx);
      const supplierLedger = await accountsService.ensureSupplierLedger(supplier, tx);
      let purchaseReturnLedger = await tx.accountLedger.findUnique({ where: { code: "PRT-001" } });
      if (!purchaseReturnLedger) {
        const prList = await tx.accountLedger.findMany({
          where: { name: { contains: "Purchase Return", mode: "insensitive" } },
        });
        purchaseReturnLedger = prList.length > 0 ? prList[0] : null;
      }
      const purchaseReturnLedgerId = purchaseReturnLedger ? purchaseReturnLedger.id : supplierLedger.id;

      await vouchersService.autoPostVoucher({
        type: VoucherType.PURCHASE_RETURN,
        refDocType: "PURCHASE_RETURN",
        refDocId: purchaseReturn.id,
        debitLedgerId: supplierLedger.id,
        creditLedgerId: purchaseReturnLedgerId,
        amount: grandTotal,
        narration: `Purchase Return ${returnNo} for Supplier ${supplier.legalName}`,
        createdBy,
      });

      return purchaseReturn;
    });
  }
}

export const returnsService = new ReturnsService();
