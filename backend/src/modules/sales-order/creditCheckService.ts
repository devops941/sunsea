import { prisma } from "../../config/prisma";

export const creditCheckService = {
  getCustomerOutstandingBalance: async (customerId: string): Promise<number> => {
    const unpaidInvoices = await prisma.salesInvoice.findMany({
      where: {
        customerId,
        status: { not: "PAID" },
      },
      select: {
        grandTotal: true,
      },
    });

    return unpaidInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
  },

  hasOverdueInvoice: async (customerId: string): Promise<boolean> => {
    const today = new Date();
    const overdueInvoice = await prisma.salesInvoice.findFirst({
      where: {
        customerId,
        status: { not: "PAID" },
        dueDate: { lt: today },
      },
    });

    return !!overdueInvoice;
  },

  checkCustomerCredit: async (customerId: string, newOrderAmount: number) => {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { creditLimit: true },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const creditLimit = Number(customer.creditLimit || 0);
    const outstanding = await creditCheckService.getCustomerOutstandingBalance(customerId);
    const totalExposure = outstanding + newOrderAmount;
    const withinLimit = totalExposure <= creditLimit;
    const exceededBy = withinLimit ? 0 : totalExposure - creditLimit;

    const hasOverdue = await creditCheckService.hasOverdueInvoice(customerId);

    return {
      withinLimit,
      hasOverdue,
      outstanding,
      creditLimit,
      exceededBy,
    };
  },

  hasBlockingPendingOrder: async (customerId: string): Promise<{ blocked: boolean; blockingOrder?: { id: number; orderNo: string } }> => {
    const blockingOrder = await prisma.salesOrder.findFirst({
      where: {
        customerId,
        status: "PENDING_CUSTOMER_APPROVAL" as any,
      },
      select: {
        id: true,
        orderNo: true,
      },
    });

    return {
      blocked: !!blockingOrder,
      blockingOrder: blockingOrder || undefined,
    };
  },
};

export default creditCheckService;
