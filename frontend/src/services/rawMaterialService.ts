import apiClient from "../api/apiClient";
import config from "../api/config";
import type { RawMaterial, CreateRawMaterialDto, UpdateRawMaterialDto } from "../features/raw-materials/types";

export const mapRawMaterial = (item: any): RawMaterial => ({
  rawMaterialId: item.rawMaterialId,
  materialName: item.materialName,

  minimumStock: item.minimumStock,

  storeId: item.storeId,
  store: item.store
    ? {
      storeId: item.store.storeId,
      storeName: item.store.storeName,
    }
    : null,

  locationId: item.locationId,

  storeLocation: item.storeLocation
    ? {
      id: item.storeLocation.id,
      locationCode: item.storeLocation.locationCode,
    }
    : null,

  batchNo: item.batchNo,

  baseUom: item.baseUom,
  reorderLevel: item.reorderLevel,
  rate: item.rate ?? item.unitPrice,

  onHandQty: item.onHandQty,
  reservedQty: item.reservedQty,

  categoryId: item.categoryId ?? null,
  category: item.category ?? null,

  narration: item.narration ?? item.remarks,
  lastMovementAt: item.lastMovementAt,

  status: item.status,
  isActive: item.isActive,
  itemType: item.itemType,

  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
});

export const rawMaterialService = {
  fetchAll: async (params?: {
    search?: string;
    storeId?: string;
    isActive?: boolean;
    itemType?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<any> => {
    const response = await apiClient.get(config.rawMaterial.base, { params });
    const payload = response.data?.data || response.data;
    // Handle paginated response shape
    if (payload && "rawMaterials" in payload) {
      return {
        rawMaterials: Array.isArray(payload.rawMaterials)
          ? payload.rawMaterials.map(mapRawMaterial)
          : [],
        total: payload.total,
        page: payload.page,
        limit: payload.limit,
        totalPages: payload.totalPages,
      };
    }
    // Fallback for plain array (legacy)
    return Array.isArray(payload) ? payload.map(mapRawMaterial) : [];
  },

  fetchById: async (id: string): Promise<RawMaterial> => {
    const response = await apiClient.get(`${config.rawMaterial.base}/${id}`);
    const item = response.data?.data || response.data;
    return mapRawMaterial(item);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.rawMaterial.nextId!);
    return response.data?.data?.nextId || response.data?.nextId;
  },

  create: async (data: CreateRawMaterialDto): Promise<RawMaterial> => {
    const response = await apiClient.post(config.rawMaterial.base, data);
    const item = response.data?.data || response.data;
    return mapRawMaterial(item);
  },

  update: async (id: string, data: UpdateRawMaterialDto): Promise<RawMaterial> => {
    const response = await apiClient.put(`${config.rawMaterial.base}/${id}`, data);
    const item = response.data?.data || response.data;
    return mapRawMaterial(item);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${config.rawMaterial.base}/${id}`);
  },
};
