import apiClient from "../api/apiClient";

export interface SalesReturnItem {
  id?: string;
  productId: number;
  salesInvoiceItemId?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  lineTotal?: number;
  reason?: string;
  description?: string;
  product?: { id: number; productName: string };
}

export interface SalesReturn {
  id: string;
  returnNo: string;
  returnDate: string;
  customerId: string;
  salesInvoiceId?: string | null;
  reason?: string | null;
  refundMode?: string;
  subTotal?: number;
  taxAmount?: number;
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
  refundMode?: "CREDIT_NOTE" | "CASH" | "BANK";
  narration?: string;
  companyId: string;
  items: {
    productId: number;
    salesInvoiceItemId?: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
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
  description?: string;
  rawMaterial?: { rawMaterialId: string; name?: string; materialName?: string };
}

export interface PurchaseReturn {
  id: string;
  returnNo: string;
  returnDate: string;
  supplierId: number;
  grnInvoiceId?: string | null;
  grnInvoice?: { id: string; invoiceNo: string };
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
  storeId?: string;
  refundMode?: "CREDIT_NOTE" | "CASH" | "BANK";
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
