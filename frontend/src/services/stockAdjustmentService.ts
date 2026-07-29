import apiClient from "../api/apiClient";

const BASE_URL = "/stock-adjustments";

export const stockAdjustmentService = {
  fetchAll: async (params?: any) => {
    const response = await apiClient.get(BASE_URL, { params });
    return response.data;
  },
  
  fetchById: async (id: string | number) => {
    const response = await apiClient.get(`${BASE_URL}/${id}`);
    return response.data.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post(BASE_URL, data);
    return response.data;
  },

  update: async (id: string | number, data: any) => {
    const response = await apiClient.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  approve: async (id: string | number, status: string, reason?: string) => {
    const response = await apiClient.put(`${BASE_URL}/${id}/approve`, { status, reason });
    return response.data;
  },
  
  delete: async (id: string | number) => {
    const response = await apiClient.delete(`${BASE_URL}/${id}`);
    return response.data;
  },

  fetchProductionOrdersForIssue: async () => {
    const response = await apiClient.get(`${BASE_URL}/production-orders`);
    return response.data.data;
  },
};
