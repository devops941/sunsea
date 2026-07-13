import apiClient from "../api/apiClient";
import config from "../api/config";

export const weeklyProgramService = {
  getAll: async (params?: any) => {
    const response = await apiClient.get(config.weeklyProgram.base, { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`${config.weeklyProgram.base}/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post(config.weeklyProgram.base, data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await apiClient.put(`${config.weeklyProgram.base}/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`${config.weeklyProgram.base}/${id}`);
    return response.data;
  },

  fetchNextId: async () => {
    const response = await apiClient.get(config.weeklyProgram.nextId);
    return response.data.data.nextId;
  },

  getPending: async () => {
    const response = await apiClient.get(`${config.weeklyProgram.base}/pending`);
    return response.data;
  },

  getDailyPlanningData: async (params: { machineId: string; weekStartDate: string }) => {
    const response = await apiClient.get(`${config.weeklyProgram.base}/daily-planning/data`, { params });
    return response.data.data;
  },
};
