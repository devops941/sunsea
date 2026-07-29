import apiClient from "../api/apiClient";
import config from "../api/config";

export const productionWastageService = {
  getAll: async (params?: {
    productionOrderId?: string;
    machineId?: string;
    shiftId?: string;
    productId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get(config.productionWastage.base, { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`${config.productionWastage.base}/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post(config.productionWastage.base, data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await apiClient.put(`${config.productionWastage.base}/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`${config.productionWastage.base}/${id}`);
    return response.data;
  },

  approve: async (id: string) => {
    const response = await apiClient.post(`${config.productionWastage.base}/${id}/approve`);
    return response.data;
  },

  reject: async (id: string) => {
    const response = await apiClient.post(`${config.productionWastage.base}/${id}/reject`);
    return response.data;
  },
};
