import apiClient from '../api/apiClient';

export interface CustomerType {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCustomerTypeInput {
    name: string;
}

export const customerTypeService = {
    getAll: async () => {
        const response = await apiClient.get('/customer-types');
        return response.data?.data || response.data;
    },

    create: async (data: CreateCustomerTypeInput) => {
        const response = await apiClient.post('/customer-types', data);
        return response.data?.data || response.data;
    },

    update: async (id: number, data: CreateCustomerTypeInput) => {
        const response = await apiClient.put(`/customer-types/${id}`, data);
        return response.data?.data || response.data;
    },

    delete: async (id: number) => {
        const response = await apiClient.delete(`/customer-types/${id}`);
        return response.data?.data || response.data;
    },
};
