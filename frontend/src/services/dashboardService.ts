// src/services/dashboardService.ts
import apiClient from "../api/apiClient";
import config from "../api/config";

export interface DashboardSummary {
  salesOrders: any[];
  purchaseOrders: any[];
  productionOrders: any[];
  productsCount: number;
  employeesCount: number;
  machines: any[];
  weeklyPrograms: any[];
  rawMaterials: any[];
  rawMaterialStocks: any[];
  finishedGoodsStocks: any[];
  dailyPlans: any[];
  salesInvoices?: any[];
}

const dashboardService = {
  getSummary: async () => {
    const res = await apiClient.get(`/dashboard/summary`);
    return res.data?.data as DashboardSummary;
  },
};

export default dashboardService;
