import apiClient from "../api/apiClient";

export interface PettyCashEntry {
  id: string;
  entryNo: string;
  entryDate: string;
  category: string;
  description: string;
  amount: number;
  type: "IN" | "OUT";
  paidTo?: string | null;
  receiptNo?: string | null;
  companyId: string;
  createdAt?: string;
}

export interface PettyCashSummary {
  totalIn: number;
  totalOut: number;
  currentBalance: number;
}

export interface CreatePettyCashDto {
  entryDate?: string;
  category: string;
  description: string;
  amount: number;
  type: "IN" | "OUT";
  paidTo?: string;
  receiptNo?: string;
  companyId: string;
}

export const pettyCashService = {
  fetchEntries: async (params?: {
    startDate?: string;
    endDate?: string;
    type?: "IN" | "OUT";
    category?: string;
    companyId?: string;
  }): Promise<{ entries: PettyCashEntry[]; summary: PettyCashSummary }> => {
    const response = await apiClient.get("/petty-cash", { params });
    return response.data?.data || { entries: [], summary: { totalIn: 0, totalOut: 0, currentBalance: 0 } };
  },

  createEntry: async (data: CreatePettyCashDto): Promise<PettyCashEntry> => {
    const response = await apiClient.post("/petty-cash", data);
    return response.data?.data;
  },
};
