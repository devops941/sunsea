import apiClient from "../api/apiClient";
import config from "../api/config";
import type {
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
  FetchCategoriesParams,
} from "../features/categories/types";

export const categoryService = {
  fetchAll: async (params?: FetchCategoriesParams): Promise<any> => {
    const response = await apiClient.get(config.category.base, { params });
    return response.data?.data || response.data;
  },

  fetchById: async (id: number): Promise<Category> => {
    const response = await apiClient.get(`${config.category.base}/${id}`);
    return response.data?.data || response.data;
  },

  fetchNextCode: async (type: string): Promise<string> => {
    const response = await apiClient.get(config.category.nextCode, {
      params: { type },
    });
    return response.data?.data?.nextCode || response.data?.nextCode;
  },

  create: async (data: CreateCategoryDto): Promise<Category> => {
    const response = await apiClient.post(config.category.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number, data: UpdateCategoryDto): Promise<Category> => {
    const response = await apiClient.put(`${config.category.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.category.base}/${id}`);
  },
};
