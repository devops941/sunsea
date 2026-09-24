import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from "../features/customer/types";

export const customerService = {
  // BUG-CUST-004 fix: added page and limit params for server-side pagination
  fetchAll: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
    status?: string;
    customerTypeId?: number;
    customerGradeId?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{ customers: Customer[]; total: number; page: number; totalPages: number }> => {
    const response = await apiClient.get(config.customer.base, {
      params: {
        search: params?.search,
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        status: params?.status,
        customerTypeId: params?.customerTypeId,
        customerGradeId: params?.customerGradeId,
        sortBy: params?.sortBy,
        sortOrder: params?.sortOrder,
      },
    });
    const data = response.data?.data || response.data;
    // Handle both paginated shape { customers, total, page, totalPages } and plain array (fallback)
    if (Array.isArray(data)) {
      return { customers: data, total: data.length, page: 1, totalPages: 1 };
    }
    return data;
  },

  fetchById: async (id: string): Promise<Customer> => {
    const response = await apiClient.get(`${config.customer.base}/${id}`);
    return response.data?.data || response.data;
  },

  create: async (data: CreateCustomerDto): Promise<Customer> => {
    const response = await apiClient.post(config.customer.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: string, data: UpdateCustomerDto): Promise<Customer> => {
    const response = await apiClient.put(`${config.customer.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${config.customer.base}/${id}`);
  },

  fetchNextCode: async (): Promise<string> => {
    const response = await apiClient.get(config.customer.base + "/next-code");
    return response?.data?.data || "";
  },

  fetchCreditStatus: async (id: string): Promise<any> => {
    const response = await apiClient.get(`${config.customer.base}/${id}/credit-status`);
    return response.data?.data || response.data;
  },
};
