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

  getSalesOrderReport: async (params?: { page?: number; limit?: number; [key: string]: any }) => {
    const response = await apiClient.get("/reports/sales-orders", { params });
    return response.data;
  },

  getPurchaseOrderReport: async (params?: { page?: number; limit?: number; [key: string]: any }) => {
    const response = await apiClient.get("/reports/purchase-orders", { params });
    return response.data;
  },

  getInventoryReport: async (params?: { page?: number; limit?: number; date?: string; category?: string; storeId?: string; search?: string }) => {
    const cleanParams: any = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== "" && value !== undefined && value !== null) {
          cleanParams[key] = value;
        }
      });
    }
    const response = await apiClient.get("/inventory/eod-stock", { params: cleanParams });
    return response.data;
  },
};
