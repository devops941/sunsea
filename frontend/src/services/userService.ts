import apiClient from "../api/apiClient";
import config from "../api/config";
import type { User, CreateUserDto } from "../features/user/types";

export const userService = {
  fetchAll: async (): Promise<User[]> => {
    const response = await apiClient.get(config.user.base);
    return response.data?.data || response.data;
  },

  create: async (data: CreateUserDto): Promise<User> => {
    const response = await apiClient.post(config.user.base, data);
    return response.data?.data || response.data;
  },

  updateStatus: async (id: string, isActive: boolean): Promise<User> => {
    const response = await apiClient.patch(`/users/${id}/status`, { isActive });
    return response.data?.data || response.data;
  },
};
