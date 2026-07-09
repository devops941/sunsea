import apiClient from "../api/apiClient";
import config from "../api/config";
import type { RawMaterialCategory, CreateRawMaterialCategoryDto, UpdateRawMaterialCategoryDto } from "../features/raw-material-categories/types";

const mapCategory = (item: any): RawMaterialCategory => ({
  id: item.id,
  code: item.categoryCode,
  name: item.categoryName,
  description: item.description || "",
  status: item.isActive ? "ACTIVE" : "INACTIVE",
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export const rawMaterialCategoryService = {
  fetchAll: async (
    params?: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    }
  ): Promise<any> => {
    const response = await apiClient.get(
      config.rawMaterialCategory.base,
      {
        params,
      }
    );

    const result = response.data?.data || response.data;

    // Backend pagination response
    if (
      result &&
      typeof result === "object" &&
      "rawMaterialCategories" in result
    ) {
      return {
        rawMaterialCategories: result.rawMaterialCategories.map(mapCategory),
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      };
    }

    // Fallback (old response)
    return Array.isArray(result)
      ? result.map(mapCategory)
      : [];
  },

  fetchById: async (id: number): Promise<RawMaterialCategory> => {
    const response = await apiClient.get(`${config.rawMaterialCategory.base}/${id}`);
    const item = response.data?.data || response.data;
    return mapCategory(item);
  },

  create: async (data: CreateRawMaterialCategoryDto): Promise<RawMaterialCategory> => {
    const payload = {
      categoryCode: data.code,
      categoryName: data.name,
      description: data.description,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.post(config.rawMaterialCategory.base, payload);
    const item = response.data?.data || response.data;
    return mapCategory(item);
  },

  update: async (id: number, data: UpdateRawMaterialCategoryDto): Promise<RawMaterialCategory> => {
    const payload = {
      categoryCode: data.code,
      categoryName: data.name,
      description: data.description,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.put(`${config.rawMaterialCategory.base}/${id}`, payload);
    const item = response.data?.data || response.data;
    return mapCategory(item);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.rawMaterialCategory.base}/${id}`);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.rawMaterialCategory.nextId);
    return response.data?.data?.nextId || "";
  },
};
export default rawMaterialCategoryService;
