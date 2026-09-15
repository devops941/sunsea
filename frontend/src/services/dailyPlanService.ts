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

  bulkCreate: async (data: {
    items: Array<{
      productionOrderId: string;
      machineId: string;
      shiftId: string;
      productionDate: string;
      plannedQty: number;
      weeklyProgramId?: string | null;
    }>;
    status?: "DRAFT" | "PLANNED";
    weekStart?: string | null;
  }) => {
    const response = await apiClient.post(`${BASE}/bulk-create`, data);
    return response.data;
  },

  bulkDelete: async (data: { dailyPlanIds: string[] }) => {
    const response = await apiClient.post(`${BASE}/bulk-delete`, data);
    return response.data;
  },

  getRmRequirements: async (
    params: string | { date?: string; weekStart?: string; shiftId?: string; machineId?: string; productId?: string }
  ) => {
    const queryParams = typeof params === "string" ? { date: params } : params;
    const response = await apiClient.get(`${BASE}/rm-requirements`, { params: queryParams });
    return response.data;
  },

  getRmIssuedDates: async (weekStart: string): Promise<string[]> => {
    const response = await apiClient.get(`${BASE}/rm-issued-dates`, { params: { weekStart } });
    return response.data?.data ?? response.data ?? [];
  },

  checkWeek: async (weekStart: string): Promise<{
    exists: boolean;
    planCount: number;
    weekStart: string;
    weekEnd: string;
    machines: string[];
    statuses: string[];
    samplePlans: Array<{
      dailyPlanId: string;
      productionDate: string;
      machineName: string;
      shiftName: string;
      productName: string;
      plannedQty: number;
      status: string;
    }>;
  }> => {
    const response = await apiClient.get(`${BASE}/check-week`, { params: { weekStart } });
    return response.data?.data ?? response.data;
  },

  getWeekProducts: async (
    machineId: string,
    weekStart: string
  ): Promise<Array<{
    productionOrderId: string;
    weeklyProgramId?: string;
    product: { id: number | string; productName: string; productCode?: string };
  }>> => {
    const response = await apiClient.get(`${BASE}/week-products`, { params: { machineId, weekStart } });
    return response.data?.data ?? response.data ?? [];
  },

  issueRawMaterials: async (
    date: string,
    items: Array<{ rawMaterialId: string; storeId: string; issuedQty: number; remarks?: string }>
  ) => {
    const response = await apiClient.post(`${BASE}/issue-raw-materials`, { date, items });
    return response.data;
  },
};

