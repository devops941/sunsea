import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Department, CreateDepartmentDto, UpdateDepartmentDto } from "../features/departments/types";

export const departmentService = {
  fetchAll: async (): Promise<Department[]> => {
    const response = await apiClient.get(config.department.base);
    return response.data?.data || response.data;
  },

  create: async (data: CreateDepartmentDto): Promise<Department> => {
    const response = await apiClient.post(config.department.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number, data: UpdateDepartmentDto): Promise<Department> => {
    const response = await apiClient.patch(`${config.department.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.department.base}/${id}`);
  },
};
