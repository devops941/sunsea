// src/services/dashboardService.ts
import apiClient from "../api/apiClient";

export interface DashboardSummary {
  salesOrders: any[];
  purchaseOrders: any[];
  productionOrders: any[];
  productsCount: number;
  employeesCount: number;
  machines: any[];
  weeklyPrograms: any[];
  rawMaterials: any[];
  rawMaterialStocks: any[];
  finishedGoodsStocks: any[];
  dailyPlans: any[];
  salesInvoices?: any[];
}

export interface AccountsSummaryAlert {
  level: "info" | "warn" | "danger";
  message: string;
  link?: string;
  details?: Array<{ name: string; amount: string }>;
}

export interface AccountsSummaryTxn {
  id: number;
  voucherNo: string;
  type: string;
  date: string;
  narration: string | null;
  amount: number;
  debitLedger: string;
  creditLedger: string;
}

export interface CreditDaysOverdueItem {
  customerId: string;
  name: string;
  daysSince: number;
  creditDays: number;
  outstanding: number;
  lastDate: string;
}

export interface AccountsSummary {
  totalSales: number;
  salesVoucherCount: number;
  totalPurchase: number;
  purchaseVoucherCount: number;
  totalReceivable: number;
  receivableCustomerCount: number;
  totalPayable: number;
  payableSupplierCount: number;
  totalCashInHand: number;
  totalBankBalance: number;
  cashBankAccountCount: number;
  cashAccountCount: number;
  bankAccountCount: number;
  stockValue: number;
  stockItemCount: number;
  todayReceipts: number;
  todayPayments: number;
  todayReceiptCount: number;
  todayPaymentCount: number;
  recentTransactions: AccountsSummaryTxn[];
  alerts: AccountsSummaryAlert[];
  purchaseOverdue: CreditDaysOverdueItem[];
  paymentOverdue: CreditDaysOverdueItem[];
}

export interface TvSeriesPoint { day: string; value: number }
export interface TvTrend { label: string; series: TvSeriesPoint[]; trend: number | null }
export interface TvLine { name: string; pct: number; status: string }
export interface TvPipelineStage { key: string; label: string; count: number; delayed?: boolean }
export interface TvAlert { level: "CRITICAL" | "HIGH" | "MEDIUM"; text: string }
export interface TvReorderItem { name: string; stock: string; status: "CRITICAL" | "LOW" }
export interface TvAgingBucket { label: string; value: string; pct: number; tone: "good" | "warn" | "bad" }

export interface TvSummary {
  generatedAt: string;
  sales: {
    today: number; todayLabel: string; todayTrend: number | null;
    mtd: number; mtdLabel: string; mtdTrend: number | null;
    lastMonth: number; lastMonthLabel: string;
  };
  orders: { total: number; active: number; delayed: number; trend: number | null };
  production: {
    planned: number; plannedLabel: string;
    produced: number; producedLabel: string;
    pending: number; pendingLabel: string;
    achievement: number;
    lines: TvLine[];
  };
  pipeline: TvPipelineStage[];
  inventory: {
    healthyPct: number; criticalCount: number; lowCount: number;
    skuTotal: number; finishedUnits: number;
    split: { label: string; pct: number }[];
    reorderItems: TvReorderItem[];
  };
  finance: {
    receivable: number; receivableLabel: string;
    overdue: number; overdueLabel: string;
    overdueCustomers: number;
    receivableParties: number;
    aging: TvAgingBucket[];
  };
  downtime: { line: string; reason: string; minutes: number }[];
  topProducts: { name: string; value: string; pct: number }[];
  trends: { sales: TvTrend; efficiency: TvTrend; orders: TvTrend };
  alerts: TvAlert[];
}

const dashboardService = {
  getSummary: async () => {
    const res = await apiClient.get(`/dashboard/summary`);
    return res.data?.data as DashboardSummary;
  },
  getAccountsSummary: async (period: string = "year") => {
    const res = await apiClient.get(`/dashboard/accounts-summary?period=${period}`);
    return res.data?.data as AccountsSummary;
  },
  getTvSummary: async (signal?: AbortSignal) => {
    const res = await apiClient.get(`/dashboard/tv-summary`, { signal });
    return res.data?.data as TvSummary;
  },
};

export default dashboardService;
