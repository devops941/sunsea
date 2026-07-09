import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Supplier, CreateSupplierDto, UpdateSupplierDto } from "../features/supplier/types";

export const supplierService = {
  fetchAll: async (search?: string): Promise<Supplier[]> => {
    const response = await apiClient.get(config.supplier.base, { params: { search } });
    // Handle paginated structure if API returns { suppliers: [...], pagination: ... }
    return response.data?.data?.suppliers || response.data?.data || response.data;
  },

  fetchById: async (id: string): Promise<Supplier> => {
    const response = await apiClient.get(`${config.supplier.base}/${id}`);
    return response.data?.data || response.data;
  },

  create: async (data: CreateSupplierDto): Promise<Supplier> => {
    const response = await apiClient.post(config.supplier.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: string, data: UpdateSupplierDto): Promise<Supplier> => {
    const response = await apiClient.put(`${config.supplier.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${config.supplier.base}/${id}`);
  },

  fetchNextCode: async (): Promise<string> => {
    const response = await apiClient.get(config.supplier.base + "/next-code");
    return response?.data?.data || "";
  },


};
