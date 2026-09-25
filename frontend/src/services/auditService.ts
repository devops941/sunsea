import apiClient from "../api/apiClient";

export const getAuditLogs = async (entityName: string, entityId: string) => {
  const response = await apiClient.get(`/audit-logs/${entityName}/${entityId}`);
  return response.data;
};

export const getAllAuditLogs = async (
  params: {
    page?: number;
    limit?: number;
    entity?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    date?: string;
  } = {}
) => {
  const response = await apiClient.get(`/audit-logs`, { params });
  return response.data;
};
