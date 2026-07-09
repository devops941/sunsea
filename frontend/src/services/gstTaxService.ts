// src/services/gstTaxService.ts
import apiClient from "../api/apiClient";
import config from "../api/config";

// ─── Types ────────────────────────────────────────────────────

export type GstTaxType = 'INTRA_STATE' | 'INTER_STATE';

export type GstTaxStatus = 'ACTIVE' | 'INACTIVE';

export interface GstTax {
    id: string;
    taxName: string;
    taxType: GstTaxType;
    taxRate: number;
    status: GstTaxStatus;
    createdBy?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateGstTaxDto {
    taxName: string;
    taxType: GstTaxType;
    taxRate: number;
    status?: GstTaxStatus;
}

export type UpdateGstTaxDto = Partial<CreateGstTaxDto>;

export interface GstTaxQueryParams {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: GstTaxStatus;
    taxType?: GstTaxType;
}

// ─── GST Tax Service ──────────────────────────────────────────

export const gstTaxService = {
    // ─── 1️⃣ GET METHOD - Fetch All GST Taxes ─────────────────
    fetchAll: async (params?: GstTaxQueryParams): Promise<{
        data: GstTax[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> => {
        const response = await apiClient.get(config.gstTax.getAllGstTax, { params });
        return response.data?.data || response.data;
    },

    // ─── 2️⃣ GET METHOD - Fetch Single GST Tax by ID ──────────
    fetchById: async (id: number | string): Promise<GstTax> => {
        const response = await apiClient.get(`${config.gstTax.getById}/${id}`);
        return response.data?.data || response.data;
    },

    // ─── 3️⃣ POST METHOD - Create New GST Tax ─────────────────
    create: async (data: CreateGstTaxDto): Promise<GstTax> => {
        const response = await apiClient.post(config.gstTax.addGstTax, data);
        return response.data?.data || response.data;
    },

    // ─── 4️⃣ PUT METHOD - Update GST Tax ──────────────────────
    update: async (id: number | string, data: UpdateGstTaxDto): Promise<GstTax> => {
        const response = await apiClient.put(`${config.gstTax.updateGstTax}/${id}`, data);
        return response.data?.data || response.data;
    },

    // ─── 5️⃣ DELETE METHOD - Delete GST Tax ───────────────────
    delete: async (id: number | string): Promise<{ success: boolean; message: string }> => {
        const response = await apiClient.delete(`${config.gstTax.deleteGstTax}/${id}`);
        return response.data?.data || response.data;
    },
};