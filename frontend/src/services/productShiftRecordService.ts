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
};
