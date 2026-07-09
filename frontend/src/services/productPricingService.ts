import apiClient from "../api/apiClient";
import config from "../api/config";
import type { ProductPricing, CreateProductPricingDto, UpdateProductPricingDto } from "../features/product-pricing/types";

const mapProductPricing = (item: any): ProductPricing => {
  return {
    ...item,
    id: Number(item.id),
    productId: Number(item.productId),
    gstRate: item.gstRate ? Number(item.gstRate) : null,
    cess: item.cess ? Number(item.cess) : null,
    unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
    mrp: item.mrp ? Number(item.mrp) : null,
    minSalePrice: item.minSalePrice ? Number(item.minSalePrice) : null,
    distributorPrice: item.distributorPrice ? Number(item.distributorPrice) : null,
    wholesalePrice: item.wholesalePrice ? Number(item.wholesalePrice) : null,
    directPrice: item.directPrice ? Number(item.directPrice) : null,
  };
};

export const productPricingService = {
  fetchAll: async (search: string): Promise<ProductPricing[]> => {
    const response = await apiClient.get(`${config.productPricing.base}?search=${search}`);
    const list = response.data?.data || response.data;
    return Array.isArray(list) ? list.map(mapProductPricing) : [];
  },

  fetchById: async (id: number): Promise<ProductPricing> => {
    const response = await apiClient.get(`${config.productPricing.base}/${id}`);
    const item = response.data?.data || response.data;
    return mapProductPricing(item);
  },

  create: async (data: CreateProductPricingDto): Promise<ProductPricing> => {
    const response = await apiClient.post(config.productPricing.base, data);
    const item = response.data?.data || response.data;
    return mapProductPricing(item);
  },

  update: async (id: number, data: UpdateProductPricingDto): Promise<ProductPricing> => {
    const response = await apiClient.put(`${config.productPricing.base}/${id}`, data);
    const item = response.data?.data || response.data;
    return mapProductPricing(item);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.productPricing.base}/${id}`);
  },
};
