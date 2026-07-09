import apiClient from "../api/apiClient";
import config from "../api/config";
import type { Company, UpdateCompanyDto } from "../features/company/types";

export const companyService = {
  getCompany: async (): Promise<Company> => {
    const response = await apiClient.get(config.company.base);
    return response.data?.data || response.data;
  },

  updateCompany: async (id: string, data: UpdateCompanyDto): Promise<Company> => {
    const response = await apiClient.put(`${config.company.base}/${id}`, data);
    return response.data?.data || response.data;
  },
};

