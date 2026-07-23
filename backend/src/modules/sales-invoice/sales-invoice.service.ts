import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateSalesInvoiceInput } from "./sales-invoice.validation";

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

    return prisma.$transaction(async (tx) => {
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
      await tx.customer.update({
        where: { id: data.customerId },
        data: {
          outstandingAmount: {
            increment: grandTotal
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

      return serializeInvoice(invoice);
    }, {
      maxWait: 10000,
      timeout: 30000,
    });
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
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id, companyId },
    });
    if (!invoice) throw new ApiError(404, "Sales Invoice not found");

    await prisma.salesInvoice.delete({
      where: { id },
    });
    return true;
  }
}

export const salesInvoiceService = new SalesInvoiceService();
export default salesInvoiceService;
