import apiClient from "../api/apiClient";
import config from "../api/config";

export const billOfMaterialService = {
  fetchAll: async (search?: string) => {
    const response = await apiClient.get(config.billOfMaterial.base, { params: { search } });
    return response.data?.data || response.data;
  },

  fetchById: async (id: number | string) => {
    const response = await apiClient.get(`${config.billOfMaterial.base}/${id}`);
    return response.data?.data || response.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post(config.billOfMaterial.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number | string, data: any) => {
    const response = await apiClient.put(`${config.billOfMaterial.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number | string) => {
    await apiClient.delete(`${config.billOfMaterial.base}/${id}`);
  },
};
