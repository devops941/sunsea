import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Role, CreateRoleDto, UpdateRoleDto } from "../features/roles/types";

export const roleService = {
  fetchAll: async (options?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{ data: Role[]; total: number }> => {
    const response = await apiClient.get(config.role.base, { params: options });
    const rawData = response.data?.data?.roles || response.data?.roles || response.data?.data || response.data;
    const list: Role[] = Array.isArray(rawData) ? rawData : [];
    const total = response.data?.data?.total || response.data?.meta?.total || response.data?.total || list.length;
    return {
      data: response.data?.data || response.data,
      total: response.data?.meta?.total ?? (response.data?.data || response.data).length,
    };
  },

  getById: async (id: number): Promise<Role> => {
    const response = await apiClient.get(`${config.role.base}/${id}`);
    return response.data?.data || response.data;
  },

  create: async (data: CreateRoleDto): Promise<Role> => {
    const response = await apiClient.post(config.role.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number, data: UpdateRoleDto): Promise<Role> => {
    const response = await apiClient.patch(`${config.role.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.role.base}/${id}`);
  },
};

