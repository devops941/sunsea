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
}

const dashboardService = {
  getSummary: async () => {
    const res = await apiClient.get(`/dashboard/summary`);
    return res.data?.data as DashboardSummary;
  },
  getAccountsSummary: async () => {
    const res = await apiClient.get(`/dashboard/accounts-summary`);
    return res.data?.data as AccountsSummary;
  },
};

export default dashboardService;
