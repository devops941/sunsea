import apiClient from "../api/apiClient";

export interface SupplierPayableSummary {
  supplierId: number;
  supplierCode: string;
  legalName: string;
  gstin?: string | null;
  vendorType?: string | null;
  phone?: string | null;
  /** YYYY-MM-DD of the latest voucher touching this supplier's ledger
   * (excluding the auto-posted opening balance JV). Null when no real txn yet. */
  lastTransactionDate?: string | null;
  openingBalance: number;
  totalBilled: number;
  totalPaid: number;
  totalReturned: number;
  debit?: number;
  credit?: number;
  netBalance?: number;
  balanceAsOnDate: number;
  overdueAmount: number;
  dueDays: number | null;
  isOverdue: boolean;
}

export interface SupplierPayableDetail {
  supplier: {
    id: number;
    supplierCode: string;
    legalName: string;
    gstin?: string | null;
    vendorType?: string | null;
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
    grnNumber?: string;
    date: string;
    dueDate?: string;
    amount: number;
    paidAmount: number;
    balance: number;
    status: string;
  }>;
  paymentHistory: Array<{
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

export const payableService = {
  getPayableSummaries: async (params?: {
    asOnDate?: string;
    startDate?: string;
    endDate?: string;
    supplierId?: string | number;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: SupplierPayableSummary[]; total: number; page: number; totalPages: number } | SupplierPayableSummary[]> => {
    const response = await apiClient.get("/accounts/payable", { params });
    if (response.data?.data && Array.isArray(response.data.data)) {
      return {
        data: response.data.data,
        total: response.data.total ?? response.data.data.length,
        page: response.data.page ?? 1,
        totalPages: response.data.totalPages ?? 1,
      };
    }
    return response.data?.data || response.data || [];
  },

  getSupplierPayableDetail: async (supplierId: number, params?: { startDate?: string; endDate?: string }): Promise<SupplierPayableDetail> => {
    const response = await apiClient.get(`/accounts/payable/${supplierId}`, { params });
    return response.data?.data || response.data;
  },
};
