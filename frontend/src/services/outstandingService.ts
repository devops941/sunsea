import apiClient from "../api/apiClient";

export type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

export interface OutstandingBill {
  id: string | number;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  billAmount: number;
  paidAmount: number;
  balance: number;
  ageDays: number;
  bucket: AgingBucket;
}

export interface OutstandingParty {
  partyId: string | number;
  partyCode: string;
  partyName: string;
  gstin?: string | null;
  phone?: string | null;
  totalOutstanding: number;
  bills: OutstandingBill[];
  bucketTotals: Record<AgingBucket, number>;
}

export interface OutstandingReport {
  asOnDate: string;
  parties: OutstandingParty[];
  grandTotal: number;
  grandBucketTotals: Record<AgingBucket, number>;
}

export const outstandingService = {
  getReceivable: async (asOnDate?: string): Promise<OutstandingReport> => {
    const params = asOnDate ? { asOnDate } : {};
    const res = await apiClient.get("/accounts/outstanding/receivable", { params });
    return res.data?.data as OutstandingReport;
  },
  getPayable: async (asOnDate?: string): Promise<OutstandingReport> => {
    const params = asOnDate ? { asOnDate } : {};
    const res = await apiClient.get("/accounts/outstanding/payable", { params });
    return res.data?.data as OutstandingReport;
  },
};
