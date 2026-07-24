import apiClient from "../api/apiClient";
import config from "../api/config";
import type { RawMaterial, CreateRawMaterialDto, UpdateRawMaterialDto } from "../features/raw-materials/types";

const mapRawMaterial = (item: any): RawMaterial => ({
  rawMaterialId: item.rawMaterialId,
  materialName: item.materialName,

  categoryId: item.categoryId,
  category: item.category
    ? {
      id: item.category.id,
      code: item.category.categoryCode,
      name: item.category.categoryName,
      description: item.category.description || "",
      status: item.category.isActive ? "ACTIVE" : "INACTIVE",
      createdAt: item.category.createdAt,
      updatedAt: item.category.updatedAt,
    }
    : null,

  hsnCode: item.hsnCode,
  minimumStock: item.minimumStock,
  leadTimeDays: item.leadTimeDays,

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
  unitPrice: item.unitPrice,

  onHandQty: item.onHandQty,
  reservedQty: item.reservedQty,
  avgCost: item.avgCost,

  remarks: item.remarks,
  lastMovementAt: item.lastMovementAt,
  gstTaxRateId: item.gstTaxRateId,

  status: item.status,
  isActive: item.isActive,
  itemType: item.itemType,

  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
});

export const rawMaterialService = {
  fetchAll: async (params?: { search?: string; storeId?: string }): Promise<RawMaterial[]> => {
    const response = await apiClient.get(config.rawMaterial.base, { params });
    const list = response.data?.data || response.data;
    return Array.isArray(list) ? list.map(mapRawMaterial) : [];
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
