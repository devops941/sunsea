import apiClient from "../api/apiClient";
import config from "../api/config";
import type {
    SupplierMaterialPrice,
    SupplierMaterialPriceRow,
    CreateSupplierMaterialPriceDto,
    ReviseSupplierMaterialPriceDto,
} from "../features/supplier/types";

const BASE = config.suppliermaterialprice.base; // "/supplier-material-prices"

export const supplierMaterialPriceService = {
    // Current (validTo === null) price for every raw material this supplier
    // sells, joined with material name + revision count.
    // GET /supplier-material-prices/current?supplierId=123
    fetchCurrent: async (supplierId: string): Promise<SupplierMaterialPriceRow[]> => {
        // console.log("config.suppliermaterialprice.base =", BASE);
        const response = await apiClient.get(`${BASE}/current`, {
            params: { supplierId },
        });
        return response.data?.data || response.data;
    },

    // Full price history (closed + current rows) for one raw material under
    // this supplier.
    // GET /supplier-material-prices/history?supplierId=123&rawMaterialId=abc
    fetchHistory: async (
        supplierId: string,
        rawMaterialId: string
    ): Promise<SupplierMaterialPrice[]> => {
        const response = await apiClient.get(`${BASE}/history`, {
            params: { supplierId, rawMaterialId },
        });
        return response.data?.data || response.data;
    },

    // Adds the very first price row for a material (used when a material is
    // newly attached to a supplier and has no price yet).
    // POST /supplier-material-prices
    create: async (
        supplierId: string,
        data: CreateSupplierMaterialPriceDto
    ): Promise<SupplierMaterialPrice> => {
        const response = await apiClient.post(BASE, { supplierId, ...data });
        return response.data?.data || response.data;
    },

    // Revises the price for a material: backend closes the existing current
    // row (sets validTo) and inserts a new current row, atomically. This is
    // the only path that should ever change an active price.
    // POST /supplier-material-prices/revise
    revise: async (
        supplierId: string,
        data: ReviseSupplierMaterialPriceDto
    ): Promise<SupplierMaterialPrice> => {
        const response = await apiClient.post(`${BASE}/revise`, { supplierId, ...data });
        return response.data?.data || response.data;
    },

    // Deletes a single historical price row (corrections only).
    // DELETE /supplier-material-prices/:priceRowId
    delete: async (priceRowId: string): Promise<void> => {
        await apiClient.delete(`${BASE}/${priceRowId}`);
    },
};