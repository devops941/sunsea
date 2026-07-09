import apiClient from "../api/apiClient";
import config from "../api/config";

import type {
  PurchaseOrder,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from "../features/purchaseOrder/types";

export const purchaseOrderService = {
  fetchAll: async (params?: any): Promise<any> => {
    const response = await apiClient.get(config.purchaseOrder.base, { params });
    return response.data?.data || response.data;
  },

  updateStatus: async (id: string, status: string, rejectReason?: string): Promise<PurchaseOrder> => {
    const response = await apiClient.put(
      `${config.purchaseOrder.base}/${id}`,
      { status, rejectReason }
    );
    return response.data?.data || response.data;
  },

  fetchById: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.get(
      `${config.purchaseOrder.base}/${id}`
    );
    return response.data?.data || response.data;
  },

  create: async (
    data: CreatePurchaseOrderDto
  ): Promise<PurchaseOrder> => {
    const response = await apiClient.post(
      config.purchaseOrder.base,
      data
    );
    return response.data?.data || response.data;
  },

  update: async (
    id: string,
    data: UpdatePurchaseOrderDto
  ): Promise<PurchaseOrder> => {
    const response = await apiClient.put(
      `${config.purchaseOrder.base}/${id}`,
      data
    );
    return response.data?.data || response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${config.purchaseOrder.base}/${id}`);
  },

  fetchNextCode: async (): Promise<string> => {
    const response = await apiClient.get(
      `${config.purchaseOrder.base}/next-code`
    );
    return response.data?.data || "";
  },
};