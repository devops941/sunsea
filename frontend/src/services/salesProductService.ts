import apiClient from "../api/apiClient";
import config from "../api/config";

export const salesProductService = {
  fetchAll: async (search?: string) => {
    const response = await apiClient.get(config.salesProduct.base, { params: { search } });
    return response.data?.data || response.data;
  },

  fetchById: async (id: number | string) => {
    const response = await apiClient.get(`${config.salesProduct.base}/${id}`);
    return response.data?.data || response.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post(config.salesProduct.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number | string, data: any) => {
    const response = await apiClient.put(`${config.salesProduct.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number | string) => {
    await apiClient.delete(`${config.salesProduct.base}/${id}`);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.salesProduct.nextId);
    return response.data?.data?.nextId || "";
  },
};
