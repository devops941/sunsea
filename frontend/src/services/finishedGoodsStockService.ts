import apiClient from "../api/apiClient";
import type { 
    FinishedGoodsStock, 
    CreateFinishedGoodsStockDto, 
    UpdateFinishedGoodsStockDto 
} from "../features/finished-goods-stock/types";

export const finishedGoodsStockService = {
    fetchAll: async (params?: any): Promise<any> => {
        const response = await apiClient.get("/finished-goods-stocks", { params });
        const resData = response.data?.data;
        if (resData && typeof resData === "object" && "data" in resData) {
            return resData;
        }
        return resData || [];
    },

    // Get stock by ID (Composite key)
    fetchById: async (storeId: string, productItemId: string): Promise<FinishedGoodsStock> => {
        const response = await apiClient.get(`/finished-goods-stocks/${storeId}/${productItemId}`);
        return response.data.data;
    },

    // Create stock
    create: async (data: CreateFinishedGoodsStockDto): Promise<FinishedGoodsStock> => {
        const response = await apiClient.post("/finished-goods-stocks", data);
        return response.data.data;
    },

    // Update stock
    update: async (storeId: string, productItemId: string, data: UpdateFinishedGoodsStockDto): Promise<FinishedGoodsStock> => {
        const response = await apiClient.put(`/finished-goods-stocks/${storeId}/${productItemId}`, data);
        return response.data.data;
    },

    // Delete stock
    delete: async (storeId: string, productItemId: string): Promise<void> => {
        await apiClient.delete(`/finished-goods-stocks/${storeId}/${productItemId}`);
    },
};
