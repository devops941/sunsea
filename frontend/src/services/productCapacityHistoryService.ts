import apiClient from "../api/apiClient";
import config from "../api/config";

export const productCapacityHistoryService = {
  fetchByProduct: async (productId: number): Promise<any[]> => {
    const response = await apiClient.get(`${config.productCapacityHistory.base}/product/${productId}`);
    const list = response.data?.data ?? response.data;
    return Array.isArray(list) ? list : [];
  },

  manualChange: async (data: {
    productId: number;
    date: string;
    shift: string;
    machine: string;
    operators: string;
    newCapacity: number;
  }): Promise<any> => {
    const response = await apiClient.post(`${config.productCapacityHistory.base}/manual`, data);
    return response.data?.data || response.data;
  },
};
