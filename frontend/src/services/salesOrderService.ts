// src/services/salesOrderService.ts
import apiClient from "../api/apiClient";
import config from "../api/config";

// ─── Types ────────────────────────────────────────────────────

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';


export type SalesOrderStatus =
    | 'DRAFT'
    | 'CONFIRMED'
    | 'QUOTATION_IN_PROGRESS'
    | 'QUOTATION_COMPLETED'
    | 'PENDING_CUSTOMER_APPROVAL'
    | 'CUSTOMER_APPROVED'
    | 'CUSTOMER_REJECTED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'IN_PRODUCTION'
    | 'PLANNED'
    | 'MATERIAL_PENDING'
    | 'MATERIAL_RESERVED'
    | 'MATERIAL_ISSUED'
    | 'SCHEDULED'
    | 'IN_PROGRESS'
    | 'ON_HOLD'
    | 'FG_RECEIVED'
    | 'READY_FOR_DISPATCH'
    | 'PARTIALLY_DISPATCHED'
    | 'DISPATCHED'
    | 'QUOTED'
    | 'INVOICED';

export type DiscountType = 'PERCENT' | 'FLAT';

export interface SalesOrder {
    id: number;
    orderNo: string;
    orderDate: string;
    customerId: string;
    customer?: {
        id: string;
        firmName: string;
        displayName: string;
        mobile?: { label: string; number: string }[];
    };
    mobile?: string | null;
    orderType?: string;
    orderSource?: string;
    sourceEmployeeId?: number | string | null;
    referredByCustomerId?: string | null;
    referredByName?: string | null;
    referenceText?: string | null;
    salesPersonName?: string | null;
    narration?: string | null;
    remarks?: string;
    internalNotes?: string;
    dispatchType?: string;
    billingAddressLine1?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingPincode?: string | null;
    shippingAddressLine1?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingPincode?: string | null;

    // ─── Workflow status ───────────────────────────────────────────────
    status?: SalesOrderStatus;

    // ─── Money totals (rolled up from items) ───────────────────────────
    subtotal: number;
    totalDiscount: number;
    netAmount: number;
    isInterState?: boolean;
    totalIgst?: number;
    totalCgst?: number;
    totalSgst?: number;
    totalTax?: number;

    customerRejectionReason?: string | null;
    createdBy?: string | null;
    createdAt: string;
    updatedAt: string;
    items: SalesOrderItem[];
    productionStatus?: string;
}

export interface SalesOrderItem {
    id: number;
    salesOrderId: number;
    productId: number;
    salesProductId?: number | null;
    product?: {
        id: number;
        productCode: string;
        productName: string;
    };
    quantity: number;

    // ─── Pricing + discount (per line) ──────────────────────────────────
    unitPrice: number;
    quotationUnitPrice?: number | null;
    discountType?: DiscountType;
    discountValue?: number;
    discountAmount?: number;
    lineSubtotal?: number;
    lineTotal?: number;
    taxableAmount?: number;
    rate?: number;

    // ─── GST (per line) ──────────────────────────────────
    cgstRate?: number;
    cgstAmount?: number;
    sgstRate?: number;
    sgstAmount?: number;
    igstRate?: number;
    igstAmount?: number;
}

export interface CreateSalesOrderDto {
    orderNo: string;
    orderDate: string;
    expectedCompletionDate?: string;
    customerId: string;
    paymentTermId?: number | null;
    billingAddressLine1: string;
    billingCity: string;
    billingState: string;
    billingPincode: string;
    shippingAddressLine1?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingPincode?: string | null;
    sameAsBilling: boolean;
    remarks?: string;
    internalNotes?: string;
    transportName?: string | null;
    salesPersonName?: string | null;
    items: Array<{
        productId: number;
        quantity: number;
    }>;
}

export type UpdateSalesOrderDto = Partial<CreateSalesOrderDto>;

export interface SalesOrderQueryParams {
    page?: number;
    pageSize?: number;
    search?: string;
    customerId?: string;
    status?: SalesOrderStatus | SalesOrderStatus[];
    mdApprovalStatus?: ApprovalStatus;
    customerApprovalStatus?: ApprovalStatus;
    fromDate?: string;
    toDate?: string;
    dispatchType?: string;
    orderSource?: string;
    customerGradeId?: number | string;
    customerTypeId?: number | string;
    quotationOnly?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface OrderStatusSummary {
    id: number;
    orderNo: string;
    status: SalesOrderStatus;
    mdApprovalStatus: ApprovalStatus;
    customerApprovalStatus: ApprovalStatus;
    canEdit: boolean;
    canDelete: boolean;
    canEditDiscounts: boolean;
    canSubmitForMdApproval: boolean;
    canApproveMd: boolean;
    canApproveCustomer: boolean;
    canReopen: boolean;
    totalItems: number;
    subtotal: number;
    totalDiscount: number;
    netAmount: number;
    orderDate: string;
    expectedCompletionDate: string;
    customerName: string;
}

export interface UpdateDiscountsDto {
    items: Array<{
        itemId: number;
        discountType: DiscountType;
        discountValue: number;
    }>;
}

export interface MdApprovalDecisionDto {
    decision: 'APPROVED' | 'REJECTED';
    approverId: string;
    rejectionReason?: string;
}

export interface CustomerApprovalDecisionDto {
    decision: 'APPROVED' | 'REJECTED';
    rejectionReason?: string;
}

// ─── Sales Order Service ─────────────────────────────────────

export const salesOrderService = {
    // ─── 1️⃣ GET METHOD - Fetch All Orders ────────────────────
    fetchAll: async (params?: SalesOrderQueryParams): Promise<{
        data: SalesOrder[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> => {
        const finalParams = {
            ...params,
            status: Array.isArray(params?.status)
                ? params.status.join(',')
                : params?.status,
        };

        const response = await apiClient.get(config.salesOrder.getAllSalesOrder, { params: finalParams, });
        return response.data?.data || response.data;
    },

    // ─── 2️⃣ GET METHOD - Fetch Single Order by ID ────────────
    // Used by: "click order no" → fetch order + all items + product details
    fetchById: async (id: number | string): Promise<SalesOrder> => {
        const response = await apiClient.get(`${config.salesOrder.getById}/${id}`);
        return response.data?.data || response.data;
    },

    // ─── 3️⃣ POST METHOD - Create New Order ───────────────────
    create: async (data: CreateSalesOrderDto): Promise<SalesOrder> => {
        const response = await apiClient.post(config.salesOrder.addSalesOrder, data);
        return response.data?.data || response.data;
    },

    getNextOrderNo: async (): Promise<string> => {
        const response = await apiClient.get(config.salesOrder.getNextOrderNo);
        return response.data?.data?.nextCode;
    },

    getNextQuotationNo: async (): Promise<string> => {
        const response = await apiClient.get(`${config.salesOrder.getAllSalesOrder}/next-quotation-code`);
        return response.data?.data?.nextCode;
    },

    // ─── 4️⃣ PUT METHOD - Update Entire Order ─────────────────
    // Only works while status === 'DRAFT' (backend enforces this)
    update: async (id: number | string, data: UpdateSalesOrderDto): Promise<SalesOrder> => {
        const response = await apiClient.put(`${config.salesOrder.updateSalesOrder}/${id}`, data);
        return response.data?.data || response.data;
    },

    // ─── 5️⃣ PATCH METHOD - Update Per-Item Discounts ─────────
    // Send ALL items you want to discount in one call — recalculates
    // lineSubtotal/discountAmount/lineTotal per item and rolls up
    // subtotal/totalDiscount/netAmount on the order. DRAFT only.
    updateDiscounts: async (
        id: number | string,
        data: UpdateDiscountsDto
    ): Promise<SalesOrder> => {
        const response = await apiClient.patch(
            `${config.salesOrder.updateDiscounts}/${id}/discounts`,
            data
        );
        return response.data?.data || response.data;
    },

    // ─── 6️⃣ PATCH METHOD - Submit For MD Approval ────────────
    // DRAFT -> PENDING_MD_APPROVAL. No body needed.
    submitForMdApproval: async (id: number | string): Promise<SalesOrder> => {
        const response = await apiClient.patch(
            `${config.salesOrder.submitMdApproval}/${id}/submit-md-approval`
        );
        return response.data?.data || response.data;
    },

    // ─── 7️⃣ PATCH METHOD - Reopen a Rejected Order ───────────
    // MD_REJECTED / CUSTOMER_REJECTED -> DRAFT (resets both approval trails)
    reopen: async (id: number | string): Promise<SalesOrder> => {
        const response = await apiClient.patch(
            `${config.salesOrder.reopen}/${id}/reopen`
        );
        return response.data?.data || response.data;
    },

    // ─── 8️⃣ PATCH METHOD - MD Approval Decision ──────────────
    approveMd: async (
        id: number | string,
        data: MdApprovalDecisionDto
    ): Promise<SalesOrder> => {
        const response = await apiClient.patch(
            `${config.salesOrder.mdApprove}/${id}/md-approve`,
            data
        );
        return response.data?.data || response.data;
    },

    // ─── 9️⃣ PATCH METHOD - Customer Approval Decision ────────
    approveCustomer: async (
        id: number | string,
        data: CustomerApprovalDecisionDto
    ): Promise<SalesOrder> => {
        const response = await apiClient.patch(
            `${config.salesOrder.customerApprove}/${id}/customer-approve`,
            data
        );
        return response.data?.data || response.data;
    },

    /** Downloads quotation/estimate PDF — format is determined by the logged-in user's role on the backend */
    downloadQuotation: async (id: number | string, orderNo?: string): Promise<void> => {
        const response = await apiClient.get(
            `${config.salesOrder.getById}/${id}/download-quotation`,
            { responseType: 'blob' }
        );
        // Prefer Content-Disposition header; fallback to orderNo passed from list
        const disposition = response.headers['content-disposition'] || '';
        const headerMatch = disposition.match(/filename="?([^";\r\n"]+)"?/);
        const filename = headerMatch
            ? headerMatch[1]
            : orderNo
                ? `${orderNo}.pdf`
                : `${id}.pdf`;

        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 200);
    },

    emailQuotation: async (
        id: number | string,
        recipientEmail: string,
        subject: string,
        message: string
    ): Promise<any> => {
        const response = await apiClient.post(`${config.salesOrder.getById}/${id}/email-quotation`, {
            recipientEmail,
            subject,
            message,
        });
        return response.data?.data || response.data;
    },

    whatsappQuotation: async (
        id: number | string,
        to: string,
        message: string
    ): Promise<any> => {
        const response = await apiClient.post(`${config.salesOrder.getById}/${id}/whatsapp-quotation`, {
            to,
            message,
        });
        return response.data?.data || response.data;
    },

    // ─── 🔟 GET METHOD - Get Order Status Summary ─────────────
    // Lightweight: returns flags like canEdit/canApproveMd/canReopen
    // so the UI can show/hide action buttons without re-fetching everything
    fetchStatus: async (id: number | string): Promise<OrderStatusSummary> => {
        const response = await apiClient.get(`${config.salesOrder.getStatus}/${id}/status`);
        return response.data?.data || response.data;
    },

    // ─── 1️⃣1️⃣ DELETE METHOD - Delete Order ──────────────────
    delete: async (id: number | string): Promise<{ success: boolean; message: string }> => {
        const response = await apiClient.delete(`${config.salesOrder.deleteSalesOrder}/${id}`);
        return response.data?.data || response.data;
    },
    updateDiscount: async (orderId: number, items: { itemId: number; discountType: string; discountValue: number }[]) => {
        return apiClient.patch(`${config.salesOrder.getAllSalesOrder}/${orderId}/discounts`, { items });
    },
    checkCreditBlock: async (customerId: string): Promise<any> => {
        const response = await apiClient.get(`${config.salesOrder.getAllSalesOrder}/credit-block-check`, {
            params: { customerId }
        });
        return response.data?.data || response.data;
    },

    submitForApproval: async (id: number | string): Promise<SalesOrder> => {
        const response = await apiClient.patch(`${config.salesOrder.getAllSalesOrder}/${id}/submit-approval`);
        return response.data?.data || response.data;
    },

    confirmOrder: async (id: number | string): Promise<SalesOrder> => {
        const response = await apiClient.patch(`${config.salesOrder.getAllSalesOrder}/${id}/confirm`);
        return response.data?.data || response.data;
    },

    convertToSalesOrder: async (id: number | string): Promise<SalesOrder> => {
        const response = await apiClient.patch(`${config.salesOrder.getAllSalesOrder}/${id}/convert-to-order`);
        return response.data?.data || response.data;
    },

    markInQuotation: async (id: number | string): Promise<void> => {
        await apiClient.patch(`${config.salesOrder.getAllSalesOrder}/${id}/mark-in-quotation`);
    },

    // Returns only CONFIRMED sales orders for a customer (used for "Load from Previous Order" dropdown).
    getSourceOrders: async (customerId: string): Promise<SalesOrder[]> => {
        const response = await apiClient.get(`${config.salesOrder.getAllSalesOrder}/source-orders`, { params: { customerId } });
        return response.data?.data || [];
    },
};