import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateSalesInvoiceInput } from "./sales-invoice.validation";
import crypto from "crypto";

function serializeInvoice(invoice: any) {
  if (!invoice) return invoice;
  const serialized = { ...invoice };
  if (serialized.items) {
    serialized.items = serialized.items.map((item: any) => ({
      ...item,
      productId: item.productId?.toString(),
    }));
  }
  return serialized;
}

class SalesInvoiceService {
  async createSalesInvoice(data: CreateSalesInvoiceInput, currentUser: { userId: string; companyId: string }) {
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      include: { addresses: true },
    });
    if (!customer) throw new ApiError(404, "Customer not found");

    const company = await prisma.company.findUnique({ where: { id: currentUser.companyId } });
    if (!company) throw new ApiError(404, "Company not found");

    const billingAddress = (customer as any).addresses?.find((a: any) => a.is_default) || (customer as any).addresses?.[0];
    const customerState = billingAddress?.state_code || (billingAddress?.address as any)?.state?.toLowerCase()?.trim() || "";
    const isInterState = company.state?.toLowerCase().trim() !== customerState;

    // Calculate items and totals
    let subTotal = 0;
    let taxTotal = 0;

    // Look up sales product names for invoice item descriptions
    const spIds = [...new Set(data.items.map(i => String(i.productId)))];
    const salesProductsForDesc = await prisma.salesProduct.findMany({
      where: { id: { in: spIds.map(id => BigInt(id)) } },
      select: { id: true, salesProductName: true, salesProductCode: true },
    }).catch(() => []);
    const spNameMap = new Map(salesProductsForDesc.map((sp: any) => [sp.id.toString(), sp.salesProductName || sp.salesProductCode || ""]));

    const invoiceItems = data.items.map((item) => {
      const qty = Number(item.qty);
      const rate = Number(item.rate);
      const discount = Number(item.discountAmount) || 0;
      const lineSubtotal = (qty * rate) - discount;

      const taxRate = Number(item.taxPercent) || 0;
      const lineTax = (lineSubtotal * taxRate) / 100;

      let cgstRate = 0;
      let cgstAmount = 0;
      let sgstRate = 0;
      let sgstAmount = 0;
      let igstRate = 0;
      let igstAmount = 0;

      if (isInterState) {
        igstRate = taxRate;
        igstAmount = lineTax;
      } else {
        cgstRate = taxRate / 2;
        sgstRate = taxRate / 2;
        cgstAmount = lineTax / 2;
        sgstAmount = lineTax / 2;
      }

      const lineTotal = lineSubtotal + lineTax;

      subTotal += lineSubtotal;
      taxTotal += lineTax;

      return {
        productId: BigInt(item.productId),
        description: spNameMap.get(String(item.productId)) || null,
        quantity: qty,
        unitPrice: rate,
        discountAmount: discount,
        tax: taxRate,
        taxableAmount: lineSubtotal,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        lineTotal,
      };
    });

    // Discount
    const d = data as any;
    const totalDiscount = Number(d.totalDiscount) || 0;
    const taxableAmount = subTotal - totalDiscount;

    // Recalculate tax on discounted amount
    if (totalDiscount > 0 && subTotal > 0) {
      taxTotal = 0;
      invoiceItems.forEach((item) => {
        const lineAmount = Number(item.quantity) * Number(item.unitPrice);
        const share = lineAmount / subTotal;
        const lineTaxable = lineAmount - (totalDiscount * share);
        const lineTax = (lineTaxable * Number(item.tax)) / 100;
        taxTotal += lineTax;
      });
    }

    // Parse extra charges from narration
    let chargeAdditions = 0;
    let chargeDeductions = 0;
    if ((data as any).narration) {
      try {
        const parsed = JSON.parse((data as any).narration);
        const chargeRows = parsed?.__chargeRows__ || [];
        for (const row of chargeRows) {
          const amt = Number(row.amount) || 0;
          if (amt <= 0) continue;
          if (String(row.type || "").includes("MINUS")) chargeDeductions += amt;
          else chargeAdditions += amt;
        }
      } catch { /* ignore bad JSON */ }
    }
    const grandTotal = taxableAmount + taxTotal + chargeAdditions - chargeDeductions;

    const computedStatus = "CONFIRMED";

    const invoice = await prisma.$transaction(async (tx) => {
      // Increment invoice sequence number
      const settings = await tx.invoiceSetting.findUnique({
        where: { companyId: currentUser.companyId },
      });

      if (settings) {
        const invDate = new Date(data.invoiceDate);
        const settingsStart = new Date(settings.financialYearStart);
        const settingsEnd = new Date(settings.financialYearEnd);

        if (invDate >= settingsStart && invDate <= settingsEnd) {
          await tx.invoiceSetting.update({
            where: { id: settings.id },
            data: { currentSequenceNumber: { increment: 1 } },
          });
        }
      }

      // Create the invoice
      const invoice = await tx.salesInvoice.create({
        data: {
          invoiceNo: data.invoiceNo,
          invoiceDate: new Date(data.invoiceDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          customerId: data.customerId,
          storeId: data.storeId,
          notes: data.notes,
          narration: (data as any).narration || null,
          salesOrderId: data.salesOrderId || null,
          subTotal,
          discountType: d.discountType || null,
          discountValue: Number(d.discountValue) || 0,
          totalDiscount,
          taxTotal,
          grandTotal,
          companyId: currentUser.companyId,
          createdBy: currentUser.userId,
          status: computedStatus,
          payments: [] as any,
          items: { create: invoiceItems },
        },
        include: {
          customer: { select: { id: true, firmName: true, displayName: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, productCode: true, productName: true } },
            },
          },
        },
      });

      // Update customer outstandingAmount
      const unpaidPortion = Math.max(0, Math.round(grandTotal * 100) / 100);
      await tx.customer.update({
        where: { id: data.customerId },
        data: { outstandingAmount: { increment: unpaidPortion } },
      });

      // Update invoicedQty on SalesOrderItems and mark source SO as INVOICED
      if (data.salesOrderId) {
        // Fetch the sales order items to match by salesProductId
        const soItems = await tx.salesOrderItem.findMany({
          where: { salesOrderId: data.salesOrderId },
        });

        for (const item of data.items) {
          const invoiceQty = Number(item.qty);
          if (invoiceQty <= 0) continue;
          const excludedComps = new Set(((item as any).excludedComponents || []).map(String));

          // Find SO items that belong to this sales product
          const matchingItems = soItems.filter(
            soi => String(soi.salesProductId) === String(item.productId)
          );

          if (matchingItems.length > 0) {
            // Update each component product's invoicedQty (skip excluded ones)
            for (const soi of matchingItems) {
              if (excludedComps.has(String(soi.productId))) continue;
              const compPerUnit = Number(soi.quantity) / Math.max(1, invoiceQty);
              const compQty = compPerUnit * invoiceQty;
              await tx.salesOrderItem.update({
                where: { id: soi.id },
                data: { invoicedQty: { increment: compQty } },
              });
            }
          } else {
            // Fallback: direct productId match
            await tx.salesOrderItem.updateMany({
              where: { salesOrderId: data.salesOrderId, productId: BigInt(item.productId) },
              data: { invoicedQty: { increment: invoiceQty } },
            });
          }
        }

        // Mark the source sales order as INVOICED
        await tx.salesOrder.update({
          where: { id: data.salesOrderId },
          data: {
            status: "INVOICED" as any,
          },
        });
      }

      // Create stock adjustment for dispatched items
      // Resolve component products from SalesProduct so stock is deducted per component
      const adjustmentPrefix = `ADJ-${new Date().getFullYear()}-`;
      const lastAdj = await tx.stockAdjustment.findFirst({
        where: { adjustmentNumber: { startsWith: adjustmentPrefix } },
        orderBy: { adjustmentNumber: "desc" },
        select: { adjustmentNumber: true },
      });
      let seq = 1;
      if (lastAdj?.adjustmentNumber) {
        const parts = lastAdj.adjustmentNumber.split("-");
        seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
      }
      const adjustmentNumber = `${adjustmentPrefix}${String(seq).padStart(4, "0")}`;

      let stockAdjustmentCreated = false;
      let stockAdjustmentId: bigint | null = null;

      for (const item of data.items) {
        const invoiceQty = Number(item.qty);
        if (invoiceQty <= 0) continue;
        const excludedComps = new Set(((item as any).excludedComponents || []).map(String));

        // Look up SalesProduct components to deduct stock per component
        const salesProduct = await tx.salesProduct.findUnique({
          where: { id: BigInt(item.productId) },
          include: { components: true },
        }).catch(() => null);

        // Build list of products to deduct: components if SalesProduct found, else direct productId
        const productsToDeduct: { productId: bigint; qty: number }[] = [];
        if (salesProduct && salesProduct.components.length > 0) {
          for (const comp of salesProduct.components) {
            if (excludedComps.has(String(comp.componentProductId))) continue;
            const compQty = Number(comp.quantity || 1) * invoiceQty;
            productsToDeduct.push({ productId: comp.componentProductId, qty: compQty });
          }
        } else {
          productsToDeduct.push({ productId: BigInt(item.productId), qty: invoiceQty });
        }

        for (const { productId: pid, qty } of productsToDeduct) {
          const fgStocks = await tx.finishedGoodsStock.findMany({
            where: { productItemId: pid },
            orderBy: { onHandQty: 'desc' },
          });
          if (fgStocks.length === 0) continue;

          const targetStoreId = fgStocks[0].storeId;
          const fgStock = fgStocks[0];

          if (!stockAdjustmentCreated) {
            const newAdj = await tx.stockAdjustment.create({
              data: {
                adjustmentNumber,
                adjustmentDate: new Date(data.invoiceDate),
                adjustmentType: "SALES_INVOICE_DISPATCH",
                reason: `Sales Invoice ${data.invoiceNo}`,
                status: "APPROVED",
                createdBy: currentUser.userId,
                updatedBy: currentUser.userId,
                approvedBy: currentUser.userId,
                approvedAt: new Date(),
                autoGenerated: true,
                sourceDocument: "SALES_INVOICE",
                sourceDocId: invoice.id,
              },
            });
            stockAdjustmentId = newAdj.id;
            stockAdjustmentCreated = true;
          }

          await tx.finishedGoodsStock.update({
            where: { storeId_productItemId: { storeId: targetStoreId, productItemId: pid } },
            data: { onHandQty: { decrement: qty } },
          });

          await tx.stockAdjustmentItem.create({
            data: {
              stockAdjustmentId: stockAdjustmentId!,
              itemType: "FINISHED_GOODS",
              productItemId: pid,
              storeId: targetStoreId,
              currentQty: fgStock.onHandQty,
              adjustedQty: Number(fgStock.onHandQty) - qty,
              difference: -qty,
              remarks: `Invoice ${data.invoiceNo}`,
            },
          });

          await tx.finishedGoodsTransaction.create({
            data: {
              txnDateTime: new Date(),
              storeId: targetStoreId,
              productItemId: pid,
              txnType: "STOCK_ADJUSTMENT_OUT",
              qty: new (require('decimal.js').Decimal)(qty),
              relatedDocNo: adjustmentNumber,
              remarks: `Invoice ${data.invoiceNo}`,
              createdBy: currentUser.userId,
            },
          });
        } // end productsToDeduct loop
      } // end items loop

      return invoice;
    }, { maxWait: 10000, timeout: 30000 });

    // Auto-post SALES Voucher
    {
      try {
        const { voucherPostingService } = require("../accounts/voucherPosting.service");
        await voucherPostingService.postSalesVoucher(invoice.id);
      } catch (vErr) {
        console.error("[Auto-Post Voucher Error] Failed to post Sales Voucher for invoice:", vErr);
      }
    }

    return serializeInvoice(invoice);
  }

  async getAllSalesInvoices(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    customerId?: string;
    fromDate?: string;
    toDate?: string;
    companyId: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const whereClause: any = {
      companyId: params.companyId,
    };

    if (params.customerId) {
      whereClause.customerId = params.customerId;
    }

    if (params.search) {
      whereClause.OR = [
        { invoiceNo: { contains: params.search, mode: "insensitive" } },
        { customer: { firmName: { contains: params.search, mode: "insensitive" } } },
        { customer: { displayName: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    if (params.fromDate || params.toDate) {
      whereClause.invoiceDate = {};
      if (params.fromDate) {
        whereClause.invoiceDate.gte = new Date(params.fromDate);
      }
      if (params.toDate) {
        whereClause.invoiceDate.lte = new Date(params.toDate);
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              firmName: true,
              displayName: true,
              mobile: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  productCode: true,
                  productName: true,
                },
              },
            },
          },
        },
      }),
      prisma.salesInvoice.count({ where: whereClause }),
    ]);

    return {
      data: invoices.map(serializeInvoice),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getSalesInvoiceById(id: string, companyId: string) {
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id, companyId },
      include: {
        customer: {
          select: {
            id: true,
            firmName: true,
            displayName: true,
            email: true,
            gstin: true,
            addresses: true,
            mobile: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNo: true,
            mobile: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                productCode: true,
                productName: true,
                hsnCode: true,
                uom: { select: { uomName: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice) throw new ApiError(404, "Sales Invoice not found");
    return serializeInvoice(invoice);
  }

  async deleteSalesInvoice(id: string, companyId: string) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findFirst({
        where: { id, companyId },
      });
      if (!invoice) throw new ApiError(404, "Sales Invoice not found");

      const payments = invoice.payments ? (typeof invoice.payments === "string" ? JSON.parse(invoice.payments) : invoice.payments) as any[] : [];
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const unpaidPortion = Math.max(0, Math.round((Number(invoice.grandTotal) - totalPaid) * 100) / 100);

      await tx.salesInvoice.delete({
        where: { id },
      });

      await tx.customer.update({
        where: { id: invoice.customerId },
        data: {
          outstandingAmount: {
            decrement: unpaidPortion,
          },
        },
      });

      return true;
    });
  }

  async updateSalesInvoice(id: string, data: CreateSalesInvoiceInput, currentUser: { userId: string; companyId: string }) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch existing invoice with items
      const existing = await tx.salesInvoice.findFirst({
        where: { id, companyId: currentUser.companyId },
        include: { items: true },
      });
      if (!existing) throw new ApiError(404, "Sales Invoice not found");

      if (existing.status === "PAID") {
        throw new ApiError(400, "Fully paid invoices cannot be edited");
      }

      // Revert old accounting/stock
      {
        const oldUnpaidPortion = Math.max(0, Math.round(Number(existing.grandTotal) * 100) / 100);

        await tx.customer.update({
          where: { id: existing.customerId },
          data: { outstandingAmount: { decrement: oldUnpaidPortion } },
        });

        // 3. Revert old invoicedQty on SalesOrderItems
        if (existing.salesOrderId) {
          for (const item of existing.items) {
            const qty = Number(item.quantity);
            if (qty <= 0) continue;
            await tx.salesOrderItem.updateMany({
              where: { salesOrderId: existing.salesOrderId, productId: item.productId },
              data: { invoicedQty: { decrement: qty } },
            });
          }
        }

        // 4. Revert old stock adjustments & finished goods stocks
        const oldAdj = await tx.stockAdjustment.findFirst({
          where: { sourceDocument: "SALES_INVOICE", sourceDocId: existing.id },
        });
        if (oldAdj) {
          const oldAdjItems = await tx.stockAdjustmentItem.findMany({
            where: { stockAdjustmentId: oldAdj.id },
          });
          for (const adjItem of oldAdjItems) {
            if (adjItem.productItemId === null) continue;
            const pid: bigint = adjItem.productItemId;
            await tx.finishedGoodsStock.update({
              where: { storeId_productItemId: { storeId: adjItem.storeId, productItemId: pid } },
              data: { onHandQty: { increment: Number(adjItem.difference) * -1 } },
            });
          }
          await tx.stockAdjustmentItem.deleteMany({ where: { stockAdjustmentId: oldAdj.id } });
          await tx.stockAdjustment.delete({ where: { id: oldAdj.id } });
        }
      }

      // 5. Calculate new items and totals
      const customer = await tx.customer.findUnique({
        where: { id: data.customerId },
        include: { addresses: true },
      });
      if (!customer) throw new ApiError(404, "Customer not found");

      const company = await tx.company.findUnique({ where: { id: currentUser.companyId } });
      if (!company) throw new ApiError(404, "Company not found");

      const billingAddr = (customer as any).addresses?.find((a: any) => a.is_default) || (customer as any).addresses?.[0];
      const custState = billingAddr?.state_code || (billingAddr?.address as any)?.state?.toLowerCase()?.trim() || "";
      const isInterState = company.state?.toLowerCase().trim() !== custState;

      let subTotal = 0;
      let taxTotal = 0;

      const invoiceItems = data.items.map((item) => {
        const qty = Number(item.qty);
        const rate = Number(item.rate);
        const discount = Number(item.discountAmount) || 0;
        const lineSubtotal = (qty * rate) - discount;

        const taxRate = Number(item.taxPercent) || 0;
        const lineTax = (lineSubtotal * taxRate) / 100;

        let cgstRate = 0;
        let cgstAmount = 0;
        let sgstRate = 0;
        let sgstAmount = 0;
        let igstRate = 0;
        let igstAmount = 0;

        if (isInterState) {
          igstRate = taxRate;
          igstAmount = lineTax;
        } else {
          cgstRate = taxRate / 2;
          sgstRate = taxRate / 2;
          cgstAmount = lineTax / 2;
          sgstAmount = lineTax / 2;
        }

        const lineTotal = lineSubtotal + lineTax;

        subTotal += lineSubtotal;
        taxTotal += lineTax;

        return {
          productId: BigInt(item.productId),
          quantity: qty,
          unitPrice: rate,
          discountAmount: discount,
          tax: taxRate,
          taxableAmount: lineSubtotal,
          cgstRate,
          cgstAmount,
          sgstRate,
          sgstAmount,
          igstRate,
          igstAmount,
          lineTotal,
        };
      });

      const du = data as any;
      const updTotalDiscount = Number(du.totalDiscount) || 0;
      const updTaxableAmount = subTotal - updTotalDiscount;

      if (updTotalDiscount > 0 && subTotal > 0) {
        taxTotal = 0;
        invoiceItems.forEach((item) => {
          const lineAmount = Number(item.quantity) * Number(item.unitPrice);
          const share = lineAmount / subTotal;
          const lineTaxable = lineAmount - (updTotalDiscount * share);
          const lineTax = (lineTaxable * Number(item.tax)) / 100;
          taxTotal += lineTax;
        });
      }

      let updChargeAdditions = 0;
      let updChargeDeductions = 0;
      if ((data as any).narration) {
        try {
          const parsed = JSON.parse((data as any).narration);
          const chargeRows = parsed?.__chargeRows__ || [];
          for (const row of chargeRows) {
            const amt = Number(row.amount) || 0;
            if (amt <= 0) continue;
            if (String(row.type || "").includes("MINUS")) updChargeDeductions += amt;
            else updChargeAdditions += amt;
          }
        } catch { /* ignore bad JSON */ }
      }
      const grandTotal = updTaxableAmount + taxTotal + updChargeAdditions - updChargeDeductions;

      const computedStatus = "CONFIRMED";

      // 6. Delete old invoice items and update record
      await tx.salesInvoiceItem.deleteMany({ where: { salesInvoiceId: id } });

      const updatedInvoice = await tx.salesInvoice.update({
        where: { id },
        data: {
          customerId: data.customerId,
          invoiceDate: new Date(data.invoiceDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          notes: data.notes,
          narration: (data as any).narration || null,
          salesOrderId: data.salesOrderId || null,
          subTotal,
          discountType: du.discountType || null,
          discountValue: Number(du.discountValue) || 0,
          totalDiscount: updTotalDiscount,
          taxTotal,
          grandTotal,
          status: computedStatus,
          payments: [] as any,
          items: { create: invoiceItems },
        },
        include: {
          customer: { select: { id: true, firmName: true, displayName: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, productCode: true, productName: true } },
            },
          },
        },
      });

      // Apply accounting/stock
      {
        const newUnpaidPortion = Math.max(0, Math.round(grandTotal * 100) / 100);
        await tx.customer.update({
          where: { id: data.customerId },
          data: { outstandingAmount: { increment: newUnpaidPortion } },
        });

        // 9. Apply new invoicedQty on SalesOrderItems
        if (data.salesOrderId) {
          for (const item of data.items) {
            const qty = Number(item.qty);
            if (qty <= 0) continue;
            await tx.salesOrderItem.updateMany({
              where: { salesOrderId: data.salesOrderId, productId: BigInt(item.productId) },
              data: { invoicedQty: { increment: qty } },
            });
          }
        }

        // 10. Apply new stock adjustments
        const adjustmentPrefix = `ADJ-${new Date().getFullYear()}-`;
        const lastAdjNew = await tx.stockAdjustment.findFirst({
          where: { adjustmentNumber: { startsWith: adjustmentPrefix } },
          orderBy: { adjustmentNumber: "desc" },
          select: { adjustmentNumber: true },
        });
        let seq = 1;
        if (lastAdjNew?.adjustmentNumber) {
          const parts = lastAdjNew.adjustmentNumber.split("-");
          seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
        }
        const newAdjustmentNumber = `${adjustmentPrefix}${String(seq).padStart(4, "0")}`;

        let stockAdjustmentCreated = false;
        let stockAdjustmentId = BigInt(0);

        for (const item of data.items) {
          const qty = Number(item.qty);
          if (qty <= 0) continue;

          const fgStocks = await tx.finishedGoodsStock.findMany({
            where: { productItemId: BigInt(item.productId) },
            orderBy: { onHandQty: 'desc' },
          });
          if (fgStocks.length === 0) continue;

          const targetStoreId = fgStocks[0].storeId;
          const fgStock = fgStocks[0];

          if (!stockAdjustmentCreated) {
            const newAdj = await tx.stockAdjustment.create({
              data: {
                adjustmentNumber: newAdjustmentNumber,
                adjustmentDate: new Date(data.invoiceDate),
                adjustmentType: "SALES_INVOICE_DISPATCH",
                reason: `Sales Invoice ${updatedInvoice.invoiceNo} (Updated)`,
                status: "APPROVED",
                createdBy: currentUser.userId,
                updatedBy: currentUser.userId,
                approvedBy: currentUser.userId,
                approvedAt: new Date(),
                autoGenerated: true,
                sourceDocument: "SALES_INVOICE",
                sourceDocId: updatedInvoice.id,
              },
            });
            stockAdjustmentId = newAdj.id;
            stockAdjustmentCreated = true;
          }

          await tx.finishedGoodsStock.update({
            where: { storeId_productItemId: { storeId: targetStoreId, productItemId: BigInt(item.productId) } },
            data: { onHandQty: { decrement: qty } },
          });

          await tx.stockAdjustmentItem.create({
            data: {
              stockAdjustmentId,
              itemType: "FINISHED_GOODS",
              productItemId: BigInt(item.productId),
              storeId: targetStoreId,
              currentQty: fgStock.onHandQty,
              adjustedQty: fgStock.onHandQty.minus(qty),
              difference: -qty,
            },
          });
        }
      }

      return serializeInvoice(updatedInvoice);
    }, { maxWait: 10000, timeout: 30000 });
  }
}

export const salesInvoiceService = new SalesInvoiceService();
export default salesInvoiceService;
