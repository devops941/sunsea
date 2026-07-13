import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from "../features/customer/types";

export const customerService = {
  fetchAll: async (search?: string): Promise<Customer[]> => {
    const response = await apiClient.get(config.customer.base, {
      params: { search }
    });
    return response.data?.data || response.data;
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
