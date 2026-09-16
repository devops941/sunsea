import apiClient from "../api/apiClient";
import config from "../api/config";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoodsDispatchItem {
  id: number;
  dispatchId: number;
  productionOrderId: string;
  productItemId: number;
  dispatchQty: number;
  uom: string;
  receivedQty?: number;
  remarks?: string;
  product?: { productName: string; productCode: string };
  productionOrder?: { productionOrderId: string; batchNo?: string; producedQty?: number; orderDate?: string };
}

export interface GoodsDispatch {
  id: number;
  dispatchNumber: string;
  dispatchDate: string;
  vehicleNumber: string;
  driverName: string;
  driverMobile?: string;
  dcNumber?: string;
  loadingTime?: string;
  remarks?: string;
  status: string;
  gateApprovedBy?: string;
  gateApprovedAt?: string;
  gateRemarks?: string;
  storeReceivedBy?: string;
  storeReceivedAt?: string;
  storeRemarks?: string;
  destinationStoreId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  items: GoodsDispatchItem[];
  store?: { storeName: string; storeId: string };
}

export interface EligibleProductionOrder {
  productionOrderId: string;
  orderDate: string;
  dueDate: string;
  batchNo?: string;
  lotNo?: string;
  uom: string;
  status: string;
  producedQty: number;
  totalDispatchedQty: number;
  pendingDispatchQty: number;
  productItem?: { id: number; productName: string; productCode: string };
  machine?: { machineId: string; machineName: string };
  destinationStoreId?: string;
}

export interface CreateGoodsDispatchDto {
  dispatchDate: string;
  vehicleNumber: string;
  driverName: string;
  driverMobile?: string;
  dcNumber: string;
  loadingTime?: string;
  remarks?: string;
  destinationStoreId?: string;
  items: {
    productionOrderId: string;
    productItemId: number;
    dispatchQty: number;
    uom: string;
    remarks?: string;
  }[];
}

export interface UpdateGoodsDispatchDto {
  dispatchDate?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverMobile?: string;
  dcNumber?: string;
  loadingTime?: string;
  remarks?: string;
  destinationStoreId?: string;
}

export interface GoodsDispatchQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface EligibleOrdersQueryParams {
  search?: string;
  productItemId?: string;
  machineId?: string;
  batchNo?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const goodsDispatchService = {
  fetchNextNumber: async (): Promise<string> => {
    const res = await apiClient.get(config.goodsDispatch.nextNumber);
    return res.data?.data?.nextNumber || "";
  },

  fetchEligibleOrders: async (params?: EligibleOrdersQueryParams): Promise<EligibleProductionOrder[]> => {
    const res = await apiClient.get(config.goodsDispatch.eligibleOrders, { params });
    return res.data?.data || [];
  },

  fetchAll: async (params?: GoodsDispatchQueryParams) => {
    const res = await apiClient.get(config.goodsDispatch.base, { params });
    return res.data?.data || res.data;
  },

  fetchById: async (id: number | string): Promise<GoodsDispatch> => {
    const res = await apiClient.get(`${config.goodsDispatch.base}/${id}`);
    return res.data?.data || res.data;
  },

  create: async (data: CreateGoodsDispatchDto): Promise<GoodsDispatch> => {
    const res = await apiClient.post(config.goodsDispatch.base, data);
    return res.data?.data || res.data;
  },

  update: async (id: number | string, data: UpdateGoodsDispatchDto): Promise<GoodsDispatch> => {
    const res = await apiClient.put(`${config.goodsDispatch.base}/${id}`, data);
    return res.data?.data || res.data;
  },

  gateApprove: async (id: number | string, data: { action: "APPROVE" | "REJECT"; remarks?: string }) => {
    const res = await apiClient.post(`${config.goodsDispatch.base}/${id}/gate-approve`, data);
    return res.data?.data || res.data;
  },

  storeReceive: async (
    id: number | string,
    data: { action: "APPROVE" | "REJECT"; remarks?: string; receivedItems?: { itemId: number; receivedQty: number }[] }
  ) => {
    const res = await apiClient.post(`${config.goodsDispatch.base}/${id}/store-receive`, data);
    return res.data?.data || res.data;
  },
};
