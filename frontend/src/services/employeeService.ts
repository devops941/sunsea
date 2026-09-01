import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Employee, CreateEmployeeDto, UpdateEmployeeDto } from "../features/employee/types";

export const employeeService = {
  fetchAll: async (params?: { search?: string; departmentId?: string | number; roleId?: string | number; status?: string; page?: number; limit?: number }): Promise<any> => {
    const response = await apiClient.get(config.employee.base, { params });
    return response.data?.data || response.data;
  },

  fetchById: async (id: string): Promise<Employee> => {
    const response = await apiClient.get(`${config.employee.base}/${id}`);
    return response.data?.data || response.data;
  },

  create: async (data: CreateEmployeeDto | FormData): Promise<any> => {
    const isForm = data instanceof FormData;
    const response = await apiClient.post(config.employee.base, data, {
      headers: isForm ? { "Content-Type": "multipart/form-data" } : {},
    });
    return response.data?.data || response.data;
  },

  update: async (id: string, data: UpdateEmployeeDto | FormData): Promise<any> => {
    const isForm = data instanceof FormData;
    const response = await apiClient.put(`${config.employee.base}/${id}`, data, {
      headers: isForm ? { "Content-Type": "multipart/form-data" } : {},
    });
    return response.data?.data || response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${config.employee.base}/${id}`);
  },

  fetchNextCode: async (): Promise<string> => {
    const response = await apiClient.get(config.employee.nextCode);
    return response.data?.data?.nextCode || "";
  },
};
