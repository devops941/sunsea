import apiClient from "../api/apiClient";
import config from "../api/config";

export type EodCategory = "RAW_MATERIAL" | "FINISHED_PRODUCT" | "WASTAGE";

export interface EodStockItem {
  id: string;
  category: EodCategory;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string | null;
  storeId: string;
  snapshotDate: string;
  startQty: number;
  eodQty: number | null;
  recordedAt: string | null;
}

export interface FetchEodStockParams {
  date?: string;
  category?: string;
  storeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EodStockResponse {
  success: boolean;
  asOf: string;
  data: EodStockItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const eodStockService = {
  fetchAll: async (params: FetchEodStockParams): Promise<EodStockResponse> => {
    const response = await apiClient.get(config.inventory.eodStock, { params });
    return response.data;
  },
};
