import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Role, CreateRoleDto, UpdateRoleDto } from "../features/roles/types";

export const roleService = {
  fetchAll: async (): Promise<Role[]> => {
    const response = await apiClient.get(config.role.base);
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
