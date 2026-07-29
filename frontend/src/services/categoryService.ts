import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Category, CreateCategoryDto, UpdateCategoryDto } from "../features/categories/types";

export const mapCategory = (item: any): Category => ({
  id: item.id,
  code: item.categoryCode || item.code,
  name: item.categoryName || item.name,
  description: item.description || "",
  status: item.isActive !== undefined ? (item.isActive ? "ACTIVE" : "INACTIVE") : item.status,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export const categoryService = {
  fetchAll: async (search: string, isActive?: boolean): Promise<Category[]> => {
    const response = await apiClient.get(config.product.category, {
      params: {
        search,
        ...(isActive !== undefined ? { isActive } : {}),
      }
    });
    const list = response.data?.data || response.data;
    return Array.isArray(list) ? list.map(mapCategory) : [];
  },

  fetchById: async (id: number): Promise<Category> => {
    const response = await apiClient.get(`${config.product.category}/${id}`);
    const item = response.data?.data || response.data;
    return mapCategory(item);
  },

  create: async (data: CreateCategoryDto): Promise<Category> => {
    const payload = {
      categoryCode: data.code,
      categoryName: data.name,
      description: data.description,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.post(config.product.category, payload);
    const item = response.data?.data || response.data;
    return mapCategory(item);
  },

  update: async (id: number, data: UpdateCategoryDto): Promise<Category> => {
    const payload = {
      categoryCode: data.code,
      categoryName: data.name,
      description: data.description,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.put(`${config.product.category}/${id}`, payload);
    const item = response.data?.data || response.data;
    return mapCategory(item);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.product.category}/${id}`);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.product.categoryNextId);
    return response.data?.data?.nextId || "";
  },
};
