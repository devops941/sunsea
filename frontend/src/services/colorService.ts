import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Color, CreateColorDto, UpdateColorDto } from "../features/colors/types";

const mapColor = (item: any): Color => ({
  id: item.id,
  code: item.colorCode,
  name: item.colorName,
  hexCode: item.hexCode || "",
  hexCode2: item.hexCode2 || "",
  colorType: item.colorType || "",
  status: item.isActive ? "ACTIVE" : "INACTIVE",
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export const colorService = {
  fetchAll: async (search: string = "", isActive?: boolean): Promise<Color[]> => {
    const response = await apiClient.get(config.product.color, {
      params: {
        search,
        ...(isActive !== undefined ? { isActive } : {}),
      }
    });
    const list = response.data?.data || response.data;
    return Array.isArray(list) ? list.map(mapColor) : [];
  },

  fetchById: async (id: number): Promise<Color> => {
    const response = await apiClient.get(`${config.product.color}/${id}`);
    const item = response.data?.data || response.data;
    return mapColor(item);
  },

  create: async (data: CreateColorDto): Promise<Color> => {
    console.log(data, "asjkdlkjsa")
    const payload = {
      colorCode: data.code,
      colorName: data.name,
      hexCode: data.hexCode,
      hexCode2: data.hexCode2 ? data.hexCode2 : '',
      colorType: data.colorType,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.post(config.product.color, payload);
    const item = response.data?.data || response.data;
    return mapColor(item);
  },

  update: async (id: number, data: UpdateColorDto): Promise<Color> => {
    const payload = {
      colorCode: data.code,
      colorName: data.name,
      hexCode: data.hexCode,
      hexCode2: data.hexCode2 ? data.hexCode2 : '',
      colorType: data.colorType,
      isActive: data.status === "ACTIVE"
    };
    const response = await apiClient.put(`${config.product.color}/${id}`, payload);
    const item = response.data?.data || response.data;
    return mapColor(item);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.product.color}/${id}`);
  },

  fetchNextId: async (): Promise<string> => {
    const response = await apiClient.get(config.product.colorNextId);
    return response.data?.data?.nextId || "";
  },
};
