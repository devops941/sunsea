import apiClient from "../api/apiClient";

export interface CustomerReceivableSummary {
  customerId: string;
  customerCode: string;
  firmName: string;
  contactPerson?: string | null;
  gstin?: string | null;
  phone?: string | null;
  customerType?: string | null;
  /** YYYY-MM-DD of the latest voucher touching this customer's ledger
   * (excluding the auto-posted opening balance JV). Null when no real txn yet. */
  lastTransactionDate?: string | null;
  openingBalance: number;
  totalBilled: number;
  totalPaid: number;
  totalReturned: number;
  debit: number;
  credit: number;
  netBalance: number;
  balanceAsOnDate: number;
  overdueAmount: number;
  dueDays: number | null;
  isOverdue: boolean;
}

export interface CustomerReceivableDetail {
  customer: {
    id: string;
    customerCode: string;
    firmName: string;
    gstin?: string | null;
    customerType?: string | null;
    openingBalance: number;
  };
  ledger: any;
  summary: {
    openingBalance: number;
    totalBilled: number;
    totalPaid: number;
    totalReturned: number;
    closingBalance: number;
  };
  invoices: Array<{
    id: string;
    invoiceNo: string;
    date: string;
    dueDate?: string;
    amount: number;
    paidAmount: number;
    balance: number;
    status: string;
  }>;
  collectionHistory: Array<{
    id: string;
    voucherNo: string;
    date: string;
    amount: number;
    paymentMode?: string;
    referenceNo?: string;
    narration?: string;
  }>;
  statementEntries: Array<{
    id: string;
    voucherNo: string;
    voucherType: string;
    date: string;
    narration: string;
    particulars: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
}

export const receivableService = {
  getReceivables: async (params?: { asOnDate?: string; startDate?: string; endDate?: string; customerId?: string; search?: string; page?: number; limit?: number }): Promise<CustomerReceivableSummary[]> => {
    const res = await apiClient.get("/accounts/receivable", { params });
    return res.data.data;
  },

  getCustomerDetail: async (customerId: string, params?: { startDate?: string; endDate?: string }): Promise<CustomerReceivableDetail> => {
    const res = await apiClient.get(`/accounts/receivable/${customerId}`, { params });
    return res.data.data;
  },
};
