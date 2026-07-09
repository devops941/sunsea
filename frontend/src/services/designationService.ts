import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Designation, CreateDesignationDto, UpdateDesignationDto } from "../features/designations/types";

export const designationService = {
  fetchAll: async (departmentId?: number): Promise<Designation[]> => {
    const response = await apiClient.get(
      config.designation.base,
      {
        params: departmentId
          ? { departmentId }
          : {},
      }
    );

    return response.data?.data || response.data;
  },

  create: async (data: CreateDesignationDto): Promise<Designation> => {
    const response = await apiClient.post(config.designation.base, data);
    return response.data?.data || response.data;
  },

  update: async (id: number, data: UpdateDesignationDto): Promise<Designation> => {
    const response = await apiClient.patch(`${config.designation.base}/${id}`, data);
    return response.data?.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${config.designation.base}/${id}`);
  },
};
