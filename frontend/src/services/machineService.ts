import apiClient from "../api/apiClient";
import config from "../api/config";

export const machineService = {
  getAll: async (params?: { search?: string; page?: number; limit?: number }) => {
    const response = await apiClient.get(config.machine.base, { params });
    return response.data?.data || response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`${config.machine.base}/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post(config.machine.base, data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await apiClient.put(`${config.machine.base}/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`${config.machine.base}/${id}`);
    return response.data;
  },

  fetchNextId: async () => {
    const response = await apiClient.get(config.machine.nextId);
    return response.data.data.nextId;
  },
};
