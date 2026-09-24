import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Product, CreateProductDto, UpdateProductDto } from "../features/product/types";

const mapProduct = (p: any): Product => {
  return {
    ...p,
    uom: p.uom ? {
      id: p.uom.id,
      code: p.uom.uomCode,
      name: p.uom.uomName,
      description: p.uom.description || "",
      status: p.uom.isActive ? "ACTIVE" : "INACTIVE",
      createdAt: p.uom.createdAt,
      updatedAt: p.uom.updatedAt
    } : null
  };
};

export const productService = {
  fetchAll: async (params?: {
    search?: string;
    categoryId?: string;
    isActive?: boolean;
    productType?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<any> => {
    const response = await apiClient.get(config.product.base, {
      params
    });
    const resData = response.data?.data || response.data;
    if (resData && Array.isArray(resData.products)) {
      if (params?.page !== undefined || params?.limit !== undefined || params?.sortBy !== undefined) {
        return {
          ...resData,
          products: resData.products.map(mapProduct),
        };
      }
      return resData.products.map(mapProduct);
    }
    if (Array.isArray(resData)) {
      return resData.map(mapProduct);
    }
    return resData;
  },

  fetchById: async (id: string): Promise<Product> => {
    const response = await apiClient.get(`${config.product.base}/${id}`);
    const item = response.data?.data || response.data;
    return mapProduct(item);
  },

  create: async (data: FormData | CreateProductDto): Promise<Product> => {
    const response = await apiClient.post(config.product.base, data);
    const item = response.data?.data || response.data;
    return mapProduct(item);
  },

  update: async (id: string, data: UpdateProductDto): Promise<Product> => {
    const response = await apiClient.put(`${config.product.base}/${id}`, data);
    const item = response.data?.data || response.data;
    return mapProduct(item);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${config.product.base}/${id}`);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.product.productNextId);
    return response.data?.data?.nextId || "";
  },
};
