import apiClient from "../api/apiClient";

export type VoucherType =
  | "PAYMENT"
  | "RECEIPT"
  | "JOURNAL"
  | "CONTRA"
  | "SALES"
  | "PURCHASE"
  | "SALES_RETURN"
  | "PURCHASE_RETURN"
  | "EXPENSE";

export interface JournalItem {
  id?: string;
  debitLedgerId?: number | null;
  creditLedgerId?: number | null;
  debitAmount: number;
  creditAmount: number;
  narration?: string | null;
  debitLedger?: { id: number; name: string; code: string; group?: { id?: number; name?: string } | null } | null;
  creditLedger?: { id: number; name: string; code: string; group?: { id?: number; name?: string } | null } | null;
}

export interface VoucherDocItem {
  description: string;
  uom?: string;
  quantity: number;
  unitPrice: number;
  tax?: number;
  lineTotal: number;
}

export interface VoucherRefDoc {
  id?: string;
  grnId?: string;
  invoiceNo?: string;
  grnNumber?: string;
  poNumber?: string;
  supplierId?: number;
  supplierName?: string;
  customerName?: string;
  storeName?: string;
  status?: string;
  items?: VoucherDocItem[];
}

export interface Voucher {
  id: number;
  voucherNo: string;
  type: VoucherType;
  date: string;
  narration?: string | null;
  refDocType?: string | null;
  refDocId?: string | null;
  createdAt: string;
  status?: string;
  refDoc?: VoucherRefDoc | null;
  items: JournalItem[];
}

export interface CreateVoucherDto {
  type: VoucherType;
  voucherNo?: string;
  date?: string;
  narration?: string;
  refDocType?: string;
  refDocId?: string;
  items: {
    debitLedgerId?: number | null;
    creditLedgerId?: number | null;
    debitAmount: number;
    creditAmount: number;
    narration?: string;
  }[];
}

export const voucherService = {
  fetchVouchers: async (params?: {
    type?: VoucherType;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ vouchers: Voucher[]; total: number; page: number; totalPages: number }> => {
    const response = await apiClient.get("/vouchers", { params });
    const data = response.data?.data;
    return data || { vouchers: [], total: 0, page: 1, totalPages: 1 };
  },

  fetchVoucherById: async (id: number): Promise<Voucher> => {
    const response = await apiClient.get(`/vouchers/${id}`);
    return response.data?.data;
  },

  createVoucher: async (data: CreateVoucherDto): Promise<Voucher> => {
    const response = await apiClient.post("/vouchers", data);
    return response.data?.data;
  },
};
