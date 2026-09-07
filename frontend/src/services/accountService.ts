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
  customer?: {
    id: string;
    firmName: string;
    customerCode: string;
    customerGrade?: { name: string } | null;
    customerType?: { name: string } | null;
  } | null;
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
  openingBalance?: number;
  openingBalanceType?: "DEBIT" | "CREDIT";
}

export interface LedgerStatementItemDetail {
  description: string;
  uom?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/** Extra invoice-level info surfaced under an entry when Show Items Details = Y.
 *  Populated only for entries backed by a Sales Invoice today (transport +
 *  bundle count + bill sundry lines like Lorry Freight / Discount / etc.). */
export interface LedgerStatementEntryMeta {
  transport?: string | null;
  numberOfBundle?: number | null;
  billSundry?: Array<{ label: string; amount: number }>;
}

export interface LedgerStatementEntry {
  id: string;
  voucherId?: number | string;
  voucherNo: string;
  voucherType: string;
  refDocType?: string | null;
  refDocId?: string | null;
  date: string;
  narration: string;
  particulars: string;
  accountName?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  /** Line-items of the source document (Sales Invoice / GRN). Present only when
   *  the voucher was auto-posted from an invoice, otherwise undefined. */
  items?: LedgerStatementItemDetail[];
  /** Invoice-level extras (transport, bundle count, bill sundry). */
  meta?: LedgerStatementEntryMeta;
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
  // Per-account opening / closing balances keyed by account name — used to
  // render Busy-style "Closing Balance" rows per account section.
  accountBalances?: Record<string, {
    name: string;
    opening: number;
    openingSide: "Dr" | "Cr";
    closing: number;
    closingSide: "Dr" | "Cr";
  }>;
}

export interface DayBookRow {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  date: string;
  typeShort: string;
  particulars: string;
  ledgerCode: string | null;
  isCash: boolean;
  cashAmount: number;
  amount: number;
  narration: string | null;
}

export interface DayBookResult {
  startDate: string | null;
  endDate: string | null;
  openingCashBalance: number;
  closingCashBalance: number;
  debitRows: DayBookRow[];
  creditRows: DayBookRow[];
  totals: {
    cashDrTotal: number;
    cashCrTotal: number;
    amountDrTotal: number;
    amountCrTotal: number;
    grandCashDr: number;
    grandCashCr: number;
    grandAmountDr: number;
    grandAmountCr: number;
  };
  voucherCount: number;
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

  /**
   * Set (or reset) the opening balance of a bank / cash ledger.
   * The backend posts an idempotent JV against Opening Balance Equity —
   * customer / supplier ledgers are never touched.
   */
  setBankOpeningBalance: async (id: number, openingBalance: number): Promise<{ ledgerId: number; openingBalance: number }> => {
    const response = await apiClient.post(`/accounts/ledgers/${id}/opening-balance`, { openingBalance });
    return response.data?.data || response.data;
  },

  /**
   * Repair legacy customer/supplier opening balance vouchers whose contra
   * side was wrongly routed to a bank/cash ledger. Safe to call any number
   * of times — a no-op after the first successful run.
   */
  repairPartyOpeningVouchers: async (): Promise<{ removed: number; ok: boolean }> => {
    const response = await apiClient.post(`/accounts/repair-opening-vouchers`);
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
  /**
   * Day Book (Busy-style two-column cashbook) — returns Dr-side rows and
   * Cr-side rows for every voucher in the date range, plus opening/closing
   * cash balance and totals for the cash reconciliation invariant.
   */
  fetchDayBook: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<DayBookResult> => {
    const response = await apiClient.get(`/accounts/day-book`, { params });
    return response.data?.data || response.data;
  },

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
