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

  /**
   * Update an existing voucher (Busy-style List → Modify flow).
   * Items, when supplied, fully REPLACE existing journal items on the
   * server. Voucher id + voucherNo stay the same so ledger history remains
   * connected via id.
   */
  updateVoucher: async (
    id: number,
    data: {
      date?: string;
      narration?: string | null;
      items?: CreateVoucherDto["items"];
    }
  ): Promise<Voucher> => {
    const response = await apiClient.patch(`/vouchers/${id}`, data);
    return response.data?.data;
  },

  /** Peek the next sequential voucher number that would be assigned for a given type. */
  fetchNextVoucherNo: async (type: VoucherType): Promise<string> => {
    const response = await apiClient.get("/vouchers/next-no", { params: { type } });
    return response.data?.data?.voucherNo || "";
  },

  deleteVoucher: async (id: number): Promise<void> => {
    await apiClient.delete(`/vouchers/${id}`);
  },
};

/**
 * Busy-style voucher-number display. Different voucher types use different
 * short prefixes in the UI while sharing the same DB uniqueness guarantee:
 *
 *   PAY-1 → "1"     (Payment shows as plain integer)
 *   RCT-1 → "R-1"   (Receipt keeps a short "R-" tag)
 *   JRN-1 → "J-1"
 *   CTR-1 → "C-1"
 *
 * Older random-format numbers ("PAY-123456-7890") that don't match the
 * sequential pattern fall through to raw display so nothing looks broken.
 */
const SHORT_PREFIX_BY_TYPE_LETTER: Record<string, string> = {
  PAY: "",
  RCT: "R-",
  JRN: "J-",
  CTR: "C-",
  SLS: "S-",
  PUR: "P-",
  SRT: "SR-",
  PRT: "PR-",
  EXP: "E-",
};

export function displayVoucherNo(voucherNo: string | undefined | null): string {
  if (!voucherNo) return "";
  // Fast path — clean sequential format like "PAY-2", "RCT-5".
  const clean = voucherNo.match(/^([A-Z]+)-(\d+)$/);
  if (clean) {
    const [, prefix, num] = clean;
    const shortPrefix = SHORT_PREFIX_BY_TYPE_LETTER[prefix] ?? `${prefix}-`;
    return `${shortPrefix}${num}`;
  }
  // Multi-segment invoice numbers like "SLS-INV-2026-27-0001" (from the Sales
  // module) — take the FIRST alphabetic prefix (used for short-prefix lookup)
  // and the LAST numeric segment (the actual sequence). Preserves original
  // leading zeros so users still see "0001" not "1" if they typed it that way.
  const multi = voucherNo.match(/^([A-Z]+)-.*?-(\d+)$/);
  if (multi) {
    const [, prefix, num] = multi;
    const shortPrefix = SHORT_PREFIX_BY_TYPE_LETTER[prefix] ?? `${prefix}-`;
    const trimmed = String(parseInt(num, 10));
    return `${shortPrefix}${trimmed}`;
  }
  // Anything else — return as-is so nothing looks broken.
  return voucherNo;
}
