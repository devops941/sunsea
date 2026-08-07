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
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new ApiError(404, "Customer not found");

    const company = await prisma.company.findUnique({ where: { id: currentUser.companyId } });
    if (!company) throw new ApiError(404, "Company not found");

    const isInterState = company.state?.toLowerCase().trim() !== customer.billingState?.toLowerCase().trim();

    // Calculate items and totals
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

    const grandTotal = subTotal + taxTotal;

    const rawPayments = (data as any).payments || [];
    const processedPayments = rawPayments.map((p: any) => ({
      id: p.id || crypto.randomUUID(),
      amount: Math.round(Number(p.amount) * 100) / 100,
      paymentMethod: p.paymentMethod,
      referenceNumber: p.referenceNumber || "",
      paymentDate: p.paymentDate,
      recordedBy: currentUser.userId,
      createdAt: new Date().toISOString()
    }));
    const totalPaid = Math.round(processedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) * 100) / 100;
    const computedStatus = totalPaid === 0 ? "UNPAID" : (totalPaid >= Number(grandTotal) ? "PAID" : "PARTIALLY_PAID");

    const invoice = await prisma.$transaction(async (tx) => {
      // Check if invoice number matches current year sequence
      // If it is in the current year, increment the setting's currentSequenceNumber
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
            data: {
              currentSequenceNumber: {
                increment: 1,
              },
            },
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
          salesOrderId: data.salesOrderId || null,
          subTotal,
          taxTotal,
          grandTotal,
          companyId: currentUser.companyId,
          createdBy: currentUser.userId,
          status: computedStatus,
          payments: processedPayments as any,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              firmName: true,
              displayName: true,
              email: true,
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
      });

      // Update customer outstandingAmount
      const unpaidPortion = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100);
      await tx.customer.update({
        where: { id: data.customerId },
        data: {
          outstandingAmount: {
            increment: unpaidPortion
          }
        }
      });

      // Update invoicedQty on SalesOrderItems (like receivedQty on PurchaseOrderItems)
      if (data.salesOrderId) {
        for (const item of data.items) {
          const qty = Number(item.qty);
          if (qty <= 0) continue;
          await tx.salesOrderItem.updateMany({
            where: {
              salesOrderId: data.salesOrderId,
              productId: BigInt(item.productId),
            },
            data: {
              invoicedQty: { increment: qty },
            },
          });
        }
      }

      // Create an approved stock adjustment for the dispatched items
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
        const qty = Number(item.qty);
        if (qty <= 0) continue;

        // Find existing FG stock for this product to get its storeId
        const fgStocks = await tx.finishedGoodsStock.findMany({
          where: { productItemId: BigInt(item.productId) },
          orderBy: { onHandQty: 'desc' },
        });

        if (fgStocks.length === 0) continue; // No stock found for this product, skip deduction

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

        // Decrease stock
        await tx.finishedGoodsStock.update({
          where: {
            storeId_productItemId: {
              storeId: targetStoreId,
              productItemId: BigInt(item.productId),
            },
          },
          data: { onHandQty: { decrement: qty } },
        });

        // Create stock adjustment item
        await tx.stockAdjustmentItem.create({
          data: {
            stockAdjustmentId: stockAdjustmentId!,
            itemType: "FINISHED_GOODS",
            productItemId: BigInt(item.productId),
            storeId: targetStoreId,
            currentQty: fgStock.onHandQty,
            adjustedQty: Number(fgStock.onHandQty) - qty,
            difference: -qty,
            remarks: `Invoice ${data.invoiceNo}`,
          },
        });

        // Create finished goods transaction
        await tx.finishedGoodsTransaction.create({
          data: {
            txnDateTime: new Date(),
            storeId: targetStoreId,
            productItemId: BigInt(item.productId),
            txnType: "STOCK_ADJUSTMENT_OUT",
            qty: new (require('decimal.js').Decimal)(qty),
            relatedDocNo: adjustmentNumber,
            remarks: `Invoice ${data.invoiceNo}`,
            createdBy: currentUser.userId,
          },
        });
      }

      return invoice;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    // Auto-post double-entry SALES Voucher after invoice creation transaction has committed
    try {
      const { voucherPostingService } = require("../accounts/voucherPosting.service");
      await voucherPostingService.postSalesVoucher(invoice.id);
    } catch (vErr) {
      console.error("[Auto-Post Voucher Error] Failed to post Sales Voucher for invoice:", vErr);
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
            billingAddressLine1: true,
            billingCity: true,
            billingState: true,
            billingPincode: true,
            shippingAddressLine1: true,
            shippingCity: true,
            shippingState: true,
            shippingPincode: true,
            mobile: true,
            transports: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNo: true,
            shippingAddressLine1: true,
            shippingCity: true,
            shippingState: true,
            shippingPincode: true,
            shippingCountry: true,
            mobile: true,
            transportName: true,
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

      // Verify that the invoice is not fully paid
      if (existing.status === "PAID") {
        throw new ApiError(400, "Fully paid invoices cannot be edited");
      }

      // 2. Revert old customer outstanding balance
      const oldPayments = existing.payments ? (typeof existing.payments === "string" ? JSON.parse(existing.payments) : existing.payments) as any[] : [];
      const oldTotalPaid = oldPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const oldUnpaidPortion = Math.max(0, Math.round((Number(existing.grandTotal) - oldTotalPaid) * 100) / 100);

      await tx.customer.update({
        where: { id: existing.customerId },
        data: {
          outstandingAmount: {
            decrement: oldUnpaidPortion,
          },
        },
      });

      // 3. Revert old invoicedQty on SalesOrderItems
      if (existing.salesOrderId) {
        for (const item of existing.items) {
          const qty = Number(item.quantity);
          if (qty <= 0) continue;
          await tx.salesOrderItem.updateMany({
            where: {
              salesOrderId: existing.salesOrderId,
              productId: item.productId,
            },
            data: {
              invoicedQty: { decrement: qty },
            },
          });
        }
      }

      // 4. Revert old stock adjustments & finished goods stocks
      const oldAdj = await tx.stockAdjustment.findFirst({
        where: {
          sourceDocument: "SALES_INVOICE",
          sourceDocId: existing.id,
        },
      });
      if (oldAdj) {
        const oldAdjItems = await tx.stockAdjustmentItem.findMany({
          where: { stockAdjustmentId: oldAdj.id },
        });
        for (const adjItem of oldAdjItems) {
          if (adjItem.productItemId === null) continue;
          const pid: bigint = adjItem.productItemId;
          await tx.finishedGoodsStock.update({
            where: {
              storeId_productItemId: {
                storeId: adjItem.storeId,
                productItemId: pid,
              },
            },
            data: {
              onHandQty: { increment: Number(adjItem.difference) * -1 },
            },
          });
        }
        await tx.stockAdjustmentItem.deleteMany({
          where: { stockAdjustmentId: oldAdj.id },
        });
        await tx.stockAdjustment.delete({
          where: { id: oldAdj.id },
        });
      }

      // 5. Calculate new items and totals
      const customer = await tx.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) throw new ApiError(404, "Customer not found");

      const company = await tx.company.findUnique({ where: { id: currentUser.companyId } });
      if (!company) throw new ApiError(404, "Company not found");

      const isInterState = company.state?.toLowerCase().trim() !== customer.billingState?.toLowerCase().trim();

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

      const grandTotal = subTotal + taxTotal;

      const rawPayments = (data as any).payments || [];
      const processedPayments = rawPayments.map((p: any) => ({
        id: p.id || crypto.randomUUID(),
        amount: Math.round(Number(p.amount) * 100) / 100,
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber || "",
        paymentDate: p.paymentDate,
        recordedBy: currentUser.userId,
        createdAt: new Date().toISOString()
      }));
      const totalPaid = Math.round(processedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) * 100) / 100;
      const computedStatus = totalPaid === 0 ? "UNPAID" : (totalPaid >= Number(grandTotal) ? "PAID" : "PARTIALLY_PAID");

      // 6. Delete old invoice items
      await tx.salesInvoiceItem.deleteMany({
        where: { salesInvoiceId: id },
      });

      // 7. Update SalesInvoice record
      const updatedInvoice = await tx.salesInvoice.update({
        where: { id },
        data: {
          customerId: data.customerId,
          invoiceDate: new Date(data.invoiceDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          notes: data.notes,
          salesOrderId: data.salesOrderId || null,
          subTotal,
          taxTotal,
          grandTotal,
          status: computedStatus,
          payments: processedPayments as any,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              firmName: true,
              displayName: true,
              email: true,
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
      });

      // 8. Apply new customer outstanding balance
      const newUnpaidPortion = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100);
      await tx.customer.update({
        where: { id: data.customerId },
        data: {
          outstandingAmount: {
            increment: newUnpaidPortion,
          },
        },
      });

      // 9. Apply new invoicedQty on SalesOrderItems
      if (data.salesOrderId) {
        for (const item of data.items) {
          const qty = Number(item.qty);
          if (qty <= 0) continue;
          await tx.salesOrderItem.updateMany({
            where: {
              salesOrderId: data.salesOrderId,
              productId: BigInt(item.productId),
            },
            data: {
              invoicedQty: { increment: qty },
            },
          });
        }
      }

      // 10. Apply new stock adjustments & finished goods stocks
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
          where: {
            storeId_productItemId: {
              storeId: targetStoreId,
              productItemId: BigInt(item.productId),
            },
          },
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

      return serializeInvoice(updatedInvoice);
    }, {
      maxWait: 10000,
      timeout: 30000,
    });
  }
}

export const salesInvoiceService = new SalesInvoiceService();
export default salesInvoiceService;
