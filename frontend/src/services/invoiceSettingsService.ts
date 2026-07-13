import apiClient from "../api/apiClient";
import config from "../api/config";

export interface InvoiceSettingDto {
  id?: string;
  companyId?: string;
  invoicePrefix: string;
  sequenceLength: number;
  currentSequenceNumber: number;
  financialYearStart: string;
  financialYearEnd: string;
  autoFinancialYear: boolean;
  formatTemplate: string;
}

const BASE_URL = config.invoiceSettings?.base || "/invoice-settings";

export const invoiceSettingsService = {
  getConfig: async (): Promise<InvoiceSettingDto> => {
    const response = await apiClient.get(`${BASE_URL}/config`);
    return response.data?.data || response.data;
  },

  saveConfig: async (data: InvoiceSettingDto): Promise<InvoiceSettingDto> => {
    const response = await apiClient.post(`${BASE_URL}/config`, data);
    return response.data?.data || response.data;
  },
};
