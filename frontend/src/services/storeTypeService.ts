import apiClient from "../api/apiClient";
import config from "../api/config";
import type { CreateStoreTypeDto, UpdateStoreTypeDto, StoreType } from "../features/store-types/types";

export const storeTypeService = {
  fetchAll: async (
    params?: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    }
  ): Promise<any> => {
    const response = await apiClient.get(config.storeType.base, {
      params,
    });

    return response.data?.data || response.data;
  },

  fetchById: async (id: number): Promise<StoreType> => {
    const response = await apiClient.get(`${config.storeType.base}/${id}`);
    return response.data?.data || response.data;
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.storeType.nextId!);
    return response.data?.data?.nextId || response.data?.nextId;
  },

  create: async (data: CreateStoreTypeDto): Promise<StoreType> => {
    const response = await apiClient.post(config.storeType.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number, data: UpdateStoreTypeDto): Promise<StoreType> => {
    const response = await apiClient.patch(`${config.storeType.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.storeType.base}/${id}`);
  },
};
