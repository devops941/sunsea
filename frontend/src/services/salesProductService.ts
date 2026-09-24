import apiClient from "../api/apiClient";
import config from "../api/config";

export const salesProductService = {
  fetchAll: async (params?: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } | string): Promise<any> => {
    const queryParams = typeof params === "string" ? { search: params } : params;
    const response = await apiClient.get(config.salesProduct.base, { params: queryParams });
    const resData = response.data?.data || response.data;
    if (resData && Array.isArray(resData.salesProducts)) {
      if (typeof params === "object" && (params?.page !== undefined || params?.limit !== undefined || params?.sortBy !== undefined)) {
        return resData;
      }
      return resData.salesProducts;
    }
    if (Array.isArray(resData)) {
      return resData;
    }
    return resData;
  },

  fetchById: async (id: number | string) => {
    const response = await apiClient.get(`${config.salesProduct.base}/${id}`);
    return response.data?.data || response.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post(config.salesProduct.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number | string, data: any) => {
    const response = await apiClient.put(`${config.salesProduct.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number | string) => {
    await apiClient.delete(`${config.salesProduct.base}/${id}`);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.salesProduct.nextId);
    return response.data?.data?.nextId || "";
  },
};
