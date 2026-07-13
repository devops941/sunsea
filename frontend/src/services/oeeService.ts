import apiClient from "../api/apiClient";

const BASE = "/oee";

export const oeeService = {
  /** Get today OEE + machine status for a specific machine */
  getMachineOeeSummary: (machineId: string, date?: string) => {
    const params = date ? `?date=${date}` : "";
    return apiClient.get(`${BASE}/machine/${machineId}/summary${params}`).then((r) => r.data?.data);
  },

  /** Get full OEE + production summary for a production order */
  getProductionOrderOee: (productionOrderId: string) => {
    return apiClient.get(`${BASE}/production-order/${productionOrderId}`).then((r) => r.data?.data);
  },

  /** Get all machine statuses with today OEE (for live board) */
  getAllMachinesStatus: (date?: string) => {
    const params = date ? `?date=${date}` : "";
    return apiClient.get(`${BASE}/machines/status${params}`).then((r) => r.data?.data);
  },
};
