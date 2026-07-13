import apiClient from "../api/apiClient";

const BASE = "/daily-production-plans";

export const dailyPlanService = {
  getAll: async (params?: {
    weeklyProgramId?: string;
    productionOrderId?: string;
    machineId?: string;
    shiftId?: string;
    productionDate?: string;
    status?: string;
  }) => {
    const response = await apiClient.get(BASE, { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`${BASE}/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post(BASE, data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await apiClient.put(`${BASE}/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`${BASE}/${id}`);
    return response.data;
  },
};
