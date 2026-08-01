import apiClient from "../api/apiClient";

export interface SalesReturnItem {
  id?: string;
  productId: number;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
  reason?: string;
  product?: { id: number; productName: string };
}

export interface SalesReturn {
  id: string;
  returnNo: string;
  returnDate: string;
  customerId: string;
  salesInvoiceId?: string | null;
  reason?: string | null;
  grandTotal: number;
  status: string;
  narration?: string | null;
  createdAt: string;
  customer?: { id: string; firmName: string; customerCode: string };
  items: SalesReturnItem[];
}

export interface CreateSalesReturnDto {
  customerId: string;
  salesInvoiceId?: string;
  reason?: string;
  narration?: string;
  companyId: string;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    reason?: string;
  }[];
}

export interface PurchaseReturnItem {
  id?: string;
  rawMaterialId: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
  reason?: string;
  rawMaterial?: { rawMaterialId: string; name: string };
}

export interface PurchaseReturn {
  id: string;
  returnNo: string;
  returnDate: string;
  supplierId: number;
  grnInvoiceId?: string | null;
  reason?: string | null;
  grandTotal: number;
  status: string;
  narration?: string | null;
  createdAt: string;
  supplier?: { id: number; legalName: string; supplierCode: string };
  items: PurchaseReturnItem[];
}

export interface CreatePurchaseReturnDto {
  supplierId: number;
  grnInvoiceId?: string;
  reason?: string;
  narration?: string;
  companyId: string;
  items: {
    rawMaterialId: string;
    quantity: number;
    unitPrice: number;
    reason?: string;
  }[];
}

export const returnService = {
  fetchSalesReturns: async (companyId?: string): Promise<SalesReturn[]> => {
    const response = await apiClient.get("/returns/sales", { params: { companyId } });
    return response.data?.data || [];
  },

  createSalesReturn: async (data: CreateSalesReturnDto): Promise<SalesReturn> => {
    const response = await apiClient.post("/returns/sales", data);
    return response.data?.data;
  },

  fetchPurchaseReturns: async (companyId?: string): Promise<PurchaseReturn[]> => {
    const response = await apiClient.get("/returns/purchase", { params: { companyId } });
    return response.data?.data || [];
  },

  createPurchaseReturn: async (data: CreatePurchaseReturnDto): Promise<PurchaseReturn> => {
    const response = await apiClient.post("/returns/purchase", data);
    return response.data?.data;
  },
};
