import apiClient from "../api/apiClient";
import config from "../api/config";

export interface AccountLedger {
  id: number;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
  group: string;
  isActive: boolean;
  customerId?: string | null;
  supplierId?: number | null;
  customer?: { id: string; firmName: string; customerCode: string } | null;
  supplier?: { id: number; legalName: string; supplierCode: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLedgerDto {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
  group: string;
  isActive?: boolean;
}

export interface LedgerStatementEntry {
  id: string;
  voucherNo: string;
  voucherType: string;
  date: string;
  narration: string;
  particulars: string;
  accountName?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface LedgerStatementResult {
  ledger: AccountLedger;
  mode?: "one";
  startDate?: string | null;
  endDate?: string | null;
  openingBalance: number;
  closingBalance: number;
  entries: LedgerStatementEntry[];
}

export interface MultiLedgerStatementResult {
  mode: "multi";
  label: string;
  ledgerIds: number[];
  ledgerCount: number;
  startDate?: string | null;
  endDate?: string | null;
  openingBalance: number;
  closingBalance: number;
  entries: LedgerStatementEntry[];
}

export const accountService = {
  fetchLedgers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    group?: string;
    grouped?: boolean;
  }): Promise<{
    ledgers: AccountLedger[];
    grouped: Array<{ group: string; ledgers: AccountLedger[] }> | null;
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const response = await apiClient.get("/accounts/ledgers", { params });
    const data = response.data?.data || response.data;
    const grouped = response.data?.grouped ?? null;
    const pagination = response.data?.pagination;
    if (Array.isArray(data)) {
      return { ledgers: data, grouped, total: data.length, page: 1, totalPages: 1 };
    }
    return {
      ledgers: data || [],
      grouped,
      total: pagination?.totalItems || 0,
      page: pagination?.currentPage || 1,
      totalPages: pagination?.totalPages || 1,
    };
  },

  fetchLedgerById: async (id: number): Promise<AccountLedger> => {
    const response = await apiClient.get(`/accounts/ledgers/${id}`);
    return response.data?.data || response.data;
  },

  createLedger: async (data: CreateLedgerDto): Promise<AccountLedger> => {
    const response = await apiClient.post("/accounts/ledgers", data);
    return response.data?.data || response.data;
  },

  updateLedger: async (id: number, data: Partial<CreateLedgerDto>): Promise<AccountLedger> => {
    const response = await apiClient.patch(`/accounts/ledgers/${id}`, data);
    return response.data?.data || response.data;
  },

  fetchStatement: async (
    id: number,
    params?: { startDate?: string; endDate?: string; search?: string }
  ): Promise<LedgerStatementResult> => {
    const response = await apiClient.get(`/accounts/ledgers/${id}/statement`, { params });
    return response.data?.data || response.data;
  },

  /**
   * Combined ledger statement for multiple accounts.
   * Pass EITHER `ids` (comma-separated ledger ids) OR `group` (group name = all ledgers in that group).
   * Omit both to get "All Accounts" combined view.
   */
  fetchMultiStatement: async (params?: {
    ids?: number[];
    group?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    label?: string;
  }): Promise<MultiLedgerStatementResult> => {
    const query: Record<string, string> = {};
    if (params?.ids && params.ids.length > 0) query.ids = params.ids.join(",");
    if (params?.group) query.group = params.group;
    if (params?.startDate) query.startDate = params.startDate;
    if (params?.endDate) query.endDate = params.endDate;
    if (params?.search) query.search = params.search;
    if (params?.label) query.label = params.label;
    const response = await apiClient.get(`/accounts/ledger-statement/multi`, { params: query });
    return response.data?.data || response.data;
  },
};
