import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Shift, CreateShiftDto, UpdateShiftDto } from "../features/shifts/types";

export const shiftService = {
  fetchAll: async (): Promise<Shift[]> => {
    const response = await apiClient.get(config.shift.base);
    return response.data?.data || response.data || [];
  },

  // BUG-SHF-002 fix: added fetchById so ShiftEdit can load data when location.state is missing
  fetchById: async (id: number): Promise<Shift> => {
    const response = await apiClient.get(`${config.shift.base}/${id}`);
    return response.data?.data || response.data;
  },

  create: async (data: CreateShiftDto): Promise<Shift> => {
    const response = await apiClient.post(config.shift.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number, data: UpdateShiftDto): Promise<Shift> => {
    const response = await apiClient.put(`${config.shift.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.shift.base}/${id}`);
  },

  fetchNextId: async () => {
    const response = await apiClient.get(config.shift.nextId);
    return response.data?.data?.nextId || response.data?.nextId;
  },
};
