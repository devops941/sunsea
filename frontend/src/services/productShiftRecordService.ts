import apiClient from "../api/apiClient";
import config from "../api/config";

export const productShiftRecordService = {
  fetchByProduct: async (productId: number): Promise<any> => {
    const response = await apiClient.get(`${config.productShiftRecord.base}/product/${productId}`);
    return response.data;
  },

  create: async (data: any): Promise<any> => {
    const response = await apiClient.post(config.productShiftRecord.base, data);
    return response.data;
  },

  fetchLeaderboard: async (date?: string): Promise<any> => {
    const params = date ? { date } : {};
    const response = await apiClient.get(`${config.productShiftRecord.base}/leaderboard`, { params });
    return response.data?.data || response.data;
  },

  resetLeaderboardCounts: async (): Promise<any> => {
    const response = await apiClient.post(`${config.productShiftRecord.base}/leaderboard/reset`);
    return response.data?.data || response.data;
  },
};
