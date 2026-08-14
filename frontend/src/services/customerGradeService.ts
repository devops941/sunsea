import apiClient from '../api/apiClient';

export interface CustomerGrade {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCustomerGradeInput {
    name: string;
}

export const customerGradeService = {
    getAll: async () => {
        const response = await apiClient.get('/customer-grades');
        return response.data?.data || response.data;
    },

    create: async (data: CreateCustomerGradeInput) => {
        const response = await apiClient.post('/customer-grades', data);
        return response.data?.data || response.data;
    },

    update: async (id: number, data: CreateCustomerGradeInput) => {
        const response = await apiClient.put(`/customer-grades/${id}`, data);
        return response.data?.data || response.data;
    },

    delete: async (id: number) => {
        const response = await apiClient.delete(`/customer-grades/${id}`);
        return response.data?.data || response.data;
    },
};
