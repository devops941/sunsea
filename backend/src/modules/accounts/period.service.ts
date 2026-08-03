import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

class PeriodService {
  async createPeriod(data: {
    periodName: string;
    startDate: string;
    endDate: string;
    companyId: string;
  }) {
    return (prisma as any).accountingPeriod.create({
      data: {
        periodName: data.periodName,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        companyId: data.companyId,
      },
    });
  }

  async listPeriods(companyId: string) {
    return (prisma as any).accountingPeriod.findMany({
      where: { companyId },
      orderBy: { startDate: "desc" },
    });
  }

  async closePeriod(id: number, closedBy?: string) {
    const period = await (prisma as any).accountingPeriod.findUnique({ where: { id } });
    if (!period) throw new ApiError(404, "Accounting period not found");
    if (period.isClosed) throw new ApiError(400, "Period is already closed");
    return (prisma as any).accountingPeriod.update({
      where: { id },
      data: { isClosed: true, closedAt: new Date(), closedBy: closedBy || null },
    });
  }

  async reopenPeriod(id: number) {
    const period = await (prisma as any).accountingPeriod.findUnique({ where: { id } });
    if (!period) throw new ApiError(404, "Accounting period not found");
    return (prisma as any).accountingPeriod.update({
      where: { id },
      data: { isClosed: false, closedAt: null, closedBy: null },
    });
  }

  /**
   * Check if a given date falls in a closed accounting period.
   * Throws ApiError(403) if locked.
   */
  async assertDateIsOpen(date: Date, companyId: string) {
    const closedPeriod = await (prisma as any).accountingPeriod.findFirst({
      where: {
        companyId,
        isClosed: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
    if (closedPeriod) {
      throw new ApiError(
        403,
        `Date ${date.toISOString().split("T")[0]} falls in a closed accounting period: "${closedPeriod.periodName}". Reopen the period before making entries.`
      );
    }
  }
}

export const periodService = new PeriodService();
