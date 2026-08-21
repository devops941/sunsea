import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Store, CreateStoreDto, UpdateStoreDto } from "../features/stores/types";

export const storeService = {
  fetchAll: async (
    params?: {
      search?: string;
      storeCategory?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    }
  ): Promise<any> => {
    const response = await apiClient.get(config.store.base, {
      params,
    });

    return response.data?.data || response.data;
  },
  fetchById: async (id: string): Promise<Store> => {
    const response = await apiClient.get(`${config.store.base}/${id}`);
    return response.data?.data || response.data;
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.store.nextId!);
    return response.data?.data?.nextId || response.data?.nextId;
  },

  create: async (data: CreateStoreDto): Promise<Store> => {
    const response = await apiClient.post(config.store.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: string, data: UpdateStoreDto): Promise<Store> => {
    const response = await apiClient.put(`${config.store.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${config.store.base}/${id}`);
  },
};
