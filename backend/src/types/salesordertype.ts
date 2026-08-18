export interface AddressInput {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
}

export interface SalesOrderItemInput {
    productId: string; // BigInt as string over the wire
    quantity: number;
}

export interface CreateSalesOrderInput {
    orderNo: string;
    orderDate: string; // ISO date string
    expectedCompletionDate?: string;

    customerId: string; // uuid

    paymentTermId?: number;

    billingAddress?: AddressInput;
    shippingAddress?: AddressInput;

    items: SalesOrderItemInput[];

    remarks?: string;
    narration?: string;

    createdBy?: string; // uuid, from auth context
}

export type UpdateSalesOrderInput = Partial<CreateSalesOrderInput>;

export interface MdApprovalDecisionInput {
    approverId: string; // uuid
    decision: "APPROVED" | "REJECTED";
    rejectionReason?: string;
}

export interface CustomerApprovalDecisionInput {
    decision: "APPROVED" | "REJECTED";
    rejectionReason?: string;
}

export interface SalesOrderListQuery {
    page?: string;
    pageSize?: string;
    mdApprovalStatus?: string;
    customerApprovalStatus?: string;
    customerId?: string;
    search?: string; // matches orderNo
}