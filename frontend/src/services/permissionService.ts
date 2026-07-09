import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Permission, CreatePermissionDto, UpdatePermissionDto, RoleWithPermissions } from "../features/permissions/types";

export const permissionService = {
  fetchAll: async (): Promise<Permission[]> => {
    const response = await apiClient.get(config.permission.base);
    return response.data?.data || response.data;
  },

  create: async (data: CreatePermissionDto): Promise<Permission> => {
    const response = await apiClient.post(config.permission.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number, data: UpdatePermissionDto): Promise<Permission> => {
    const response = await apiClient.patch(`${config.permission.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.permission.base}/${id}`);
  },

  fetchRolePermissions: async (roleId: number): Promise<RoleWithPermissions> => {
    const response = await apiClient.get(`${config.permission.rolePermissions}/${roleId}`);
    return response.data?.data || response.data;
  },

  assignPermissions: async (roleId: number, permissionIds: number[]): Promise<void> => {
    await apiClient.post(config.permission.assignRolePermissions, { roleId, permissionIds });
  },

  removePermission: async (roleId: number, permissionId: number): Promise<void> => {
    await apiClient.delete(config.permission.removeRolePermissions, { data: { roleId, permissionId } });
  },
};
