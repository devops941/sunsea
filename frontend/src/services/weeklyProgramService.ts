import apiClient from "../api/apiClient";

const BASE = "/daily-production-plans";

export const weeklyProgramService = {
  getAll: async (params?: any) => {
    const response = await apiClient.get(BASE, { params });
    return response.data?.data || response.data || [];
  },

  getPending: async () => {
    const response = await apiClient.get(`${BASE}/pending`);
    return response.data?.data || response.data || [];
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`${BASE}/${id}`);
    return response.data?.data || response.data;
  },

  fetchNextId: async () => {
    const response = await apiClient.get(`${BASE}/next-id`);
    return response.data?.data?.nextId || response.data?.nextId || "";
  },

  create: async (data: any) => {
    const response = await apiClient.post(BASE, data);
    return response.data?.data || response.data;
  },

  update: async (id: string, data: any) => {
    const response = await apiClient.put(`${BASE}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`${BASE}/${id}`);
    return response.data?.data || response.data;
  },
};
