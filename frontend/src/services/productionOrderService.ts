import apiClient from "../api/apiClient";
import config from "../api/config";

// ─── Types ────────────────────────────────────────────────────

export interface ProductionOrder {
    data: any;
    id: number;
    productionOrderId: string;
    orderDate: string;
    dueDate: string;
    productItemId: number | string;
    productItem?: {
        id: number;
        productCode: string;
        productName: string;
        weightPerPiece?: number;
    };
    salesOrderDetails?: {
        orderNo: string;
        customerName: string;
    };
    targetQty: number;
    producedQty: number;
    rejectedQty: number;
    scrapQty: number;
    uom: string;
    priority: string;
    orderType: string;
    batchNo?: string;
    lotNo?: string | null;
    sourceSalesOrderId?: string | null;
    sourceSalesOrderLineId?: string | null;
    colorType?: string | null;
    sourceStoreId?: string | null;
    destinationStoreId?: string;
    bomId?: string;
    routingId?: string;
    status: string;
    remarks?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateProductionOrderDto {
    productionOrderId: string;
    orderDate: string;
    dueDate: string;
    priority: string;
    orderType: string;
    batchNo?: string;
    lotNo?: string;
    sourceSalesOrderId?: string | number;
    salesOrderId?: string | number;
    colorType?: string;
    products?: Array<{ productId: number | string; quantity: number }>;
    rawMaterials?: Array<{ rawMaterialId: string | number; requiredQty: number; uom: string; storeId?: string | number; remarks?: string }>;
    sourceStoreId?: string;
    destinationStoreId?: string;
    bomId?: string;
    routingId?: string;
    status: string;
    remarks?: string;
}


export type UpdateProductionOrderDto = Partial<CreateProductionOrderDto>;

export interface ProductionOrderQueryParams {
    page?: number;
    pageSize?: number;
    search?: string;
    sourceSalesOrderId?: string;
    status?: string;
}

// ─── Production Order Service ─────────────────────────────────────

export const productionOrderService = {
    // ─── 1️⃣ GET METHOD - Fetch All Orders ────────────────────
    fetchAll: async (params?: ProductionOrderQueryParams): Promise<{
        data: ProductionOrder[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> => {
        const response = await apiClient.get(config.productionOrder.base, { params });
        return response.data?.data || response.data;
    },

    // ─── 2️⃣ GET METHOD - Fetch Single Order by ID ────────────
    getById: async (id: number | string): Promise<ProductionOrder> => {
        const response = await apiClient.get(`${config.productionOrder.base}/${id}`);
        return response.data?.data || response.data;
    },

    // ─── 3️⃣ POST METHOD - Create New Order ───────────────────
    create: async (data: CreateProductionOrderDto): Promise<ProductionOrder> => {
        const response = await apiClient.post(config.productionOrder.base, data);
        return response.data?.data || response.data;
    },

    fetchNextId: async (): Promise<string> => {
        const response = await apiClient.get(config.productionOrder.nextId);
        return response.data?.data?.nextId || response.data?.nextId || response.data;
    },

    // ─── 4️⃣ PUT METHOD - Update Entire Order ─────────────────
    update: async (id: number | string, data: UpdateProductionOrderDto): Promise<ProductionOrder> => {
        const response = await apiClient.put(`${config.productionOrder.base}/${id}`, data);
        return response.data?.data || response.data;
    },

    // ─── 6️⃣ DELETE METHOD - Delete Order ─────────────────────
    delete: async (id: number | string): Promise<{ success: boolean; message: string }> => {
        const response = await apiClient.delete(`${config.productionOrder.base}/${id}`);
        return response.data?.data || response.data;
    },

    issueMaterials: async (id: number | string, data: { items: Array<{ rawMaterialId: string; storeId: string; qty: number; remarks?: string }> }): Promise<any> => {
        const response = await apiClient.post(`${config.productionOrder.base}/${id}/issue-materials`, data);
        return response.data?.data || response.data;
    },
};
