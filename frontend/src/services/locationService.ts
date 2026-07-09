import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Location, CreateLocationDto, UpdateLocationDto } from "../features/locations/types";

export const locationService = {
  fetchAll: async (
  params?: {
    search?: string;
    locationType?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }
): Promise<any> => {
  const response = await apiClient.get(config.location.base, {
    params,
  });

  return response.data?.data || response.data;
},

  fetchById: async (id: string): Promise<Location> => {
    const response = await apiClient.get(`${config.location.base}/${id}`);
    return response.data?.data || response.data;
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.location.nextId!);
    return response.data?.data?.nextId || response.data?.nextId;
  },

  create: async (data: CreateLocationDto): Promise<Location> => {
    const response = await apiClient.post(config.location.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: string, data: UpdateLocationDto): Promise<Location> => {
    const response = await apiClient.put(`${config.location.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${config.location.base}/${id}`);
  },
};
