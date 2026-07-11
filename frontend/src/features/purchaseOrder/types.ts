// types.ts

export type PurchaseOrderStatus =
    | "DRAFT"
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "RECEIVED"
    | "COMPLETED"
    | "CANCELLED";

export interface Address {
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
}

export interface Supplier {
    id: string;
    supplierCode: string;
    supplierName: string;
    contactPerson?: string;
    mobile?: string;
    email?: string;
    gstin?: string;
}

export interface Product {
    id: string;
    productCode: string;
    productName: string;
    unit?: string;
    unitPrice?: number;
}

export interface PurchaseOrderItem {
    id?: string;
    productId: string;
    product?: Product;
    uom: string;
    quantity: number;
    unitPrice: number;
    tax: number;
    taxableAmount?: number;
    cgstRate?: number;
    cgstAmount?: number;
    sgstRate?: number;
    sgstAmount?: number;
    igstRate?: number;
    igstAmount?: number;
    lineTotal: number;
}

export interface PurchaseOrder {
    id: string;
    poNumber: string;
    poDate: string;
    expectedDeliveryDate: string;
    supplierId: string;
    supplier?: Supplier;
    storeId?: string;

    billingAddressLine1: string;
    billingCity: string;
    billingState: string;
    billingPincode: string;

    shippingAddressLine1: string;
    shippingCity: string;
    shippingState: string;
    shippingPincode: string;

    sameAsBilling: boolean;
    remarks?: string;
    rejectReason?: string;
    status: PurchaseOrderStatus;

    subtotal: number;
    discountType?: "PERCENT" | "FLAT";
    discountValue?: number;
    totalDiscount: number;
    totalTax: number;
    totalCgst?: number;
    totalSgst?: number;
    totalIgst?: number;
    netAmount: number;

    companyId?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
    items: PurchaseOrderItem[];
}

export interface PurchaseOrderFormData {
    poNumber: string;
    poDate: string;
    expectedDeliveryDate: string;
    supplierId: string;
    storeId?: string;
    status: PurchaseOrderStatus;
    createdByOn: string;

    billingAddressLine1: string;
    billingCity: string;
    billingState: string;
    billingPincode: string;

    sameAsBilling?: boolean;

    shippingAddressLine1: string;
    shippingCity: string;
    shippingState: string;
    shippingPincode: string;

    remarks: string;
    items: PurchaseOrderItem[];
    subtotal: number;
    discountType?: "PERCENT" | "FLAT";
    discountValue?: number;
    totalDiscount: number;
    totalTax: number;
    totalCgst?: number;
    totalSgst?: number;
    totalIgst?: number;
    netAmount: number;
}

export interface CreatePurchaseOrderDto {
    poDate: string;
    expectedDeliveryDate: string;
    supplierId: string;
    billingAddressLine1: string;
    billingCity: string;
    billingState: string;
    billingPincode: string;
    shippingAddressLine1: string;
    shippingCity: string;
    shippingState: string;
    shippingPincode: string;
    sameAsBilling?: boolean;
    remarks?: string;
    status?: PurchaseOrderStatus;
    items: Array<{
        productId: string;
        uom: string;
        quantity: number;
        unitPrice: number;
        tax: number;
        taxableAmount?: number;
        cgstRate?: number;
        cgstAmount?: number;
        sgstRate?: number;
        sgstAmount?: number;
        igstRate?: number;
        igstAmount?: number;
    }>;
    subtotal?: number;
    totalDiscount?: number;
    totalTax?: number;
    totalCgst?: number;
    totalSgst?: number;
    totalIgst?: number;
    netAmount?: number;
}

export type UpdatePurchaseOrderDto = Partial<CreatePurchaseOrderDto> & {
    status?: PurchaseOrderStatus;
};

export interface PurchaseOrderQueryParams {
    page?: number;
    pageSize?: number;
    search?: string;
    supplierId?: string;
    status?: PurchaseOrderStatus;
    fromDate?: string;
    toDate?: string;
}

export interface PurchaseOrderState {
    purchaseOrders: PurchaseOrder[];
    loading: boolean;
    error: string | null;
}