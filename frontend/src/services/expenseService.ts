import apiClient from "../api/apiClient";

export interface Expense {
  id: string;
  expenseNumber: string;
  expenseCategory?: string | null;
  date: string;
  expense: string;
  amount: number | string;
  description?: string | null;
  supplierId?: number | null;
  supplier?: { id: number; legalName?: string; supplierCode?: string } | null;
  paymentMethod?: string | null;
  status?: string | null;
  notes?: string | null;
  receiptInvoice?: string | null;
  companyId?: string;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Golden-Rule ledger picks used to auto-post the double-entry voucher. */
  debitLedgerId?: number | null;
  creditLedgerId?: number | null;
  debitLedger?: { id: number; name: string; code: string; group?: string | null } | null;
  creditLedger?: { id: number; name: string; code: string; group?: string | null } | null;
}

export interface CreateExpenseDto {
  expenseNumber?: string;
  expenseCategory?: string | null;
  date?: string;
  expense: string;
  amount: number;
  description?: string;
  supplierId?: number | null;
  paymentMethod?: string;
  status?: string;
  notes?: string;
  receiptInvoice?: string;
  debitLedgerId?: number | null;
  creditLedgerId?: number | null;
}

export const expenseService = {
  fetchAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: Expense[]; total: number }> => {
    const response = await apiClient.get("/expenses", { params });
    const resData = response.data?.data;
    if (resData && typeof resData === "object" && "data" in resData) {
      return { data: resData.data || [], total: resData.total || 0 };
    }
    const arr = Array.isArray(resData) ? resData : [];
    return { data: arr, total: arr.length };
  },

  fetchById: async (id: string): Promise<Expense> => {
    const response = await apiClient.get(`/expenses/${id}`);
    return response.data?.data;
  },

  create: async (data: CreateExpenseDto): Promise<Expense> => {
    const response = await apiClient.post("/expenses", data);
    return response.data?.data;
  },

  update: async (id: string, data: Partial<CreateExpenseDto>): Promise<Expense> => {
    const response = await apiClient.put(`/expenses/${id}`, data);
    return response.data?.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/expenses/${id}`);
  },

  fetchNextExpenseNo: async (): Promise<string> => {
    const response = await apiClient.get("/expenses/next-code");
    return response.data?.data || "";
  },
};

/**
 * Busy-style short display for auto-generated expense numbers.
 *   "EXP-001"  →  "E-1"     (strips prefix + drops leading zeros)
 *   "EXP-042"  →  "E-42"
 *   "CUSTOM"   →  "CUSTOM"  (untouched — user-typed numbers stay as-is)
 */
export function displayExpenseNo(expenseNo: string | undefined | null): string {
  if (!expenseNo) return "";
  const m = expenseNo.match(/^EXP-(\d+)$/i);
  if (!m) return expenseNo;
  return `E-${parseInt(m[1], 10)}`;
}
