import apiClient from "../api/apiClient";
import config from "../api/config";

export const hourlyProductionService = {
  getAll: async (params?: { productionDate?: string; search?: string }) => {
    const response = await apiClient.get(config.hourlyProduction.base, { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`${config.hourlyProduction.base}/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post(config.hourlyProduction.base, data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await apiClient.put(`${config.hourlyProduction.base}/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`${config.hourlyProduction.base}/${id}`);
    return response.data;
  },
};
