import apiClient from "../api/apiClient";

export const reportsService = {
  getMachineReport: async (startDate?: string, endDate?: string) => {
    const params = startDate && endDate ? { startDate, endDate } : {};
    const response = await apiClient.get("/reports/machines", { params });
    return response.data;
  },

  getWeeklyProgramReport: async (startDate?: string, endDate?: string) => {
    const params = startDate && endDate ? { startDate, endDate } : {};
    const response = await apiClient.get("/reports/weekly-programs", { params });
    return response.data;
  },

  getProductionOrderReport: async (productionOrderId: string) => {
    const response = await apiClient.get(`/reports/production-orders/${productionOrderId}`);
    return response.data;
  },
};
