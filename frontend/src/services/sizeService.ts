import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Size, CreateSizeDto, UpdateSizeDto } from "../features/sizes/types";

const mapSize = (item: any): Size => ({
  id: item.id,
  code: item.sizeCode,
  name: item.sizeName,
  description: item.description || "",
  status: item.isActive ? "ACTIVE" : "INACTIVE",
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export const sizeService = {
  fetchAll: async (search?: string, isActive?: boolean): Promise<Size[]> => {
    const response = await apiClient.get(config.product.size, {
      params: {
        search,
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    const list = response.data?.data || response.data;
    return Array.isArray(list) ? list.map(mapSize) : [];
  },

  fetchById: async (id: number): Promise<Size> => {
    const response = await apiClient.get(`${config.product.size}/${id}`);
    const item = response.data?.data || response.data;
    return mapSize(item);
  },

  create: async (data: CreateSizeDto): Promise<Size> => {
    const payload = {
      sizeCode: data.code,
      sizeName: data.name,
      description: data.description,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.post(config.product.size, payload);
    const item = response.data?.data || response.data;
    return mapSize(item);
  },

  update: async (id: number, data: UpdateSizeDto): Promise<Size> => {
    const payload = {
      sizeCode: data.code,
      sizeName: data.name,
      description: data.description,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.put(`${config.product.size}/${id}`, payload);
    const item = response.data?.data || response.data;
    return mapSize(item);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.product.size}/${id}`);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.product.sizeNextId);
    return response.data?.data?.nextId || "";
  },
};
