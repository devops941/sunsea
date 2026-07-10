import apiClient from "../api/apiClient";
import config from "../api/config";
import type { LoginDto } from "../features/auth/types";

export const authService = {
    login: async (credentials: LoginDto) => {
        const response = await apiClient.post(`${config?.auth?.login}`, credentials);
        return response.data;
    },

    getCurrentUser: async () => {
        const response = await apiClient.get(`${config?.auth?.getCurrentUser}`);
        return response.data;
    },

    logout: async () => {
        const response = await apiClient.post(`${config?.auth?.logout}`);
        return response.data;
    },

    getSessions: async () => {
        const response = await apiClient.get(`${config?.auth?.sessions}`);
        return response.data;
    },

    logoutAllSessions: async () => {
        const response = await apiClient.post(`${config?.auth?.logoutAllSessions}`);
        return response.data;
    },
};

export default authService;
