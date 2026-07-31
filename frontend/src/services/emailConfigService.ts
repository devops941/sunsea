import apiClient from "../api/apiClient";
import config from "../api/config";

// We will add the endpoint base to config later, for now we can use hardcoded string or update config.


export const emailConfigService = {
  getConfig: async () => {
    const response = await apiClient.get(config?.email?.base);
    return response.data?.data || null;
  },

  saveConfig: async (data: any) => {
    const response = await apiClient.post(config?.email?.base, data);
    return response.data?.data;
  },

  sendEmailDirect: async (data: any) => {
    const response = await apiClient.post(`${config?.email?.base}/send`, data);
    return response.data;
  },

  sendEmailWithAttachment: async (formData: FormData) => {
    const response = await apiClient.post(`${config?.email?.base}/send-with-attachment`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }
};
