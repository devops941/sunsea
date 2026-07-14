import apiClient from "../api/apiClient";
import config from "../api/config";
import type { UOM, CreateUOMDto, UpdateUOMDto } from "../features/uoms/types";

const mapUOM = (item: any): UOM => ({
  id: item.id,
  code: item.uomCode,
  name: item.uomName,
  description: item.description || "",
  status: item.isActive ? "ACTIVE" : "INACTIVE",
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export const uomService = {
  fetchAll: async (search?: string): Promise<UOM[]> => {
    const response = await apiClient.get(config.product.uom, {
      params: { search },
    });
    const list = response.data?.data || response.data;
    return Array.isArray(list) ? list.map(mapUOM) : [];
  },
  fetchAllActive: async () => {
    const response = await apiClient.get(config.product.getActiveUom);
    const list = response.data?.data || response.data;
    return Array.isArray(list) ? list : [];
  },

  fetchById: async (id: number): Promise<UOM> => {
    const response = await apiClient.get(`${config.product.uom}/${id}`);
    const item = response.data?.data || response.data;
    return mapUOM(item);
  },

  create: async (data: CreateUOMDto): Promise<UOM> => {
    const payload = {
      uomCode: data.code,
      uomName: data.name,
      description: data.description,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.post(config.product.uom, payload);
    const item = response.data?.data || response.data;
    return mapUOM(item);
  },

  update: async (id: number, data: UpdateUOMDto): Promise<UOM> => {
    const payload = {
      uomCode: data.code,
      uomName: data.name,
      description: data.description,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.put(`${config.product.uom}/${id}`, payload);
    const item = response.data?.data || response.data;
    return mapUOM(item);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.product.uom}/${id}`);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.product.uomNextId);
    return response.data?.data?.nextId || "";
  },

  fetchDynamicCategories: async (): Promise<string[]> => {
    const response = await apiClient.get("/uom/categories");
    return response.data?.data || [];
  },

  fetchDynamicUnits: async (category?: string): Promise<{ code: string; label: string; category: string }[]> => {
    const response = await apiClient.get("/uom/units", {
      params: { category }
    });
    return response.data?.data || [];
  }
};
