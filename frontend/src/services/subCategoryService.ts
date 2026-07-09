import apiClient from "../api/apiClient";
import config from "../api/config";

import type {
  SubCategory,
  CreateSubCategoryDto,
  UpdateSubCategoryDto,
} from "../features/subCategories/types";

import type { FetchSubCategoriesParams } from "../features/subCategories/subCategorySlice";

/**
 * Normalize backend → frontend model
 */
const mapSubCategory = (item: any): SubCategory => ({
  id: item.id,
  code: item.subCategoryCode,
  name: item.subCategoryName,
  parentCategoryId: item.categoryId,
  description: item.description || "",
  status: item.isActive ? "ACTIVE" : "INACTIVE",
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  category: item.category
    ? {
      id: item.category.id,
      code: item.category.categoryCode,
      name: item.category.categoryName,
    }
    : undefined,
});

const BASE_URL = config.product.subCategory;

export const subCategoryService = {
  /**
   * Fetch all subcategories with optional filters:
   * ?categoryId=8
   * ?search=cap
   * ?categoryId=8&search=cap
   */
  fetchAll: async (
    params: FetchSubCategoriesParams = {}
  ): Promise<SubCategory[]> => {
    const query: Record<string, string> = {};

    if (params.search) {
      query.search = params.search;
    }

    if (params.categoryId !== undefined && params.categoryId !== "") {
      query.categoryId = String(params.categoryId);
    }

    if (params.isActive !== undefined) {
      query.isActive = String(params.isActive);
    }

    const response = await apiClient.get(BASE_URL, { params: query });

    const list = response.data?.data ?? response.data;
    return Array.isArray(list) ? list.map(mapSubCategory) : [];
  },

  fetchById: async (id: number): Promise<SubCategory> => {
    const response = await apiClient.get(`${BASE_URL}/${id}`);
    const item = response.data?.data ?? response.data;
    return mapSubCategory(item);
  },

  create: async (data: CreateSubCategoryDto): Promise<SubCategory> => {
    const payload = {
      subCategoryCode: data.code,
      subCategoryName: data.name,
      categoryId: data.parentCategoryId
        ? String(data.parentCategoryId)
        : undefined,
      description: data.description,
      isActive: data.status === "ACTIVE",
    };

    const response = await apiClient.post(BASE_URL, payload);
    const item = response.data?.data ?? response.data;
    return mapSubCategory(item);
  },

  update: async (
    id: number,
    data: UpdateSubCategoryDto
  ): Promise<SubCategory> => {
    const payload = {
      subCategoryCode: data.code,
      subCategoryName: data.name,
      categoryId: data.parentCategoryId
        ? String(data.parentCategoryId)
        : undefined,
      description: data.description,
      isActive: data.status === "ACTIVE",
    };

    const response = await apiClient.put(`${BASE_URL}/${id}`, payload);
    const item = response.data?.data ?? response.data;
    return mapSubCategory(item);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE_URL}/${id}`);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.product.subCategoryNextId);
    return response.data?.data?.nextId || "";
  },
};