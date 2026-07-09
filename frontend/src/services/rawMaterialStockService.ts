import apiClient from "../api/apiClient";
import type { 
    RawMaterialStock, 
    CreateRawMaterialStockDto, 
    UpdateRawMaterialStockDto 
} from "../features/raw-materials/types";

export const rawMaterialStockService = {
    fetchAll: async (params?: any): Promise<RawMaterialStock[]> => {
        const response = await apiClient.get("/raw-material-stocks", { params });
        return response.data.data;
    },

    // Get stock by ID
    fetchById: async (id: string): Promise<RawMaterialStock> => {
        const response = await apiClient.get(`/raw-material-stocks/${id}`);
        return response.data.data;
    },

    // Create stock
    create: async (data: CreateRawMaterialStockDto): Promise<RawMaterialStock> => {
        const response = await apiClient.post("/raw-material-stocks", data);
        return response.data.data;
    },

    // Update stock
    update: async (id: string, data: UpdateRawMaterialStockDto): Promise<RawMaterialStock> => {
        const response = await apiClient.put(`/raw-material-stocks/${id}`, data);
        return response.data.data;
    },

    // Delete stock
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/raw-material-stocks/${id}`);
    },
};
