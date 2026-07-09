export interface Customer {
  id: string;
  companyId: string;
  customerCode: string;
  firmName: string;
  displayName?: string | null;
  customerType: string;
  contactPerson?: string | null;
  designation?: string | null;
  mobile: string;
  altPhone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  gstRegType?: string | null;
  tdsSection?: string | null;
  tcsRate?: number | string | null;
  billingAddressLine1: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  shippingAddressLine1?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPincode?: string | null;
  stateCode: string;
  creditLimit?: number | string | null;
  creditDays?: number | null;
  priceList?: string | null;
  collectionAgentId?: string | null;
  routeId?: string | null;
  bankAccount?: any;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdUser?: {
    userId: string;
    fullName: string;
    email?: string | null;
  } | null;
}

export interface CreateCustomerDto {
  companyId?: string;
  customerCode: string;
  firmName: string;
  displayName?: string;
  customerType: string[];
  contactPerson?: string;
  designation?: string;
  mobile: string;
  altPhone?: string;
  whatsapp?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  gstRegType?: string;
  stateCode: string;
  tdsSection?: string;
  tcsRate?: number;
  billingAddressLine1: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  shippingAddressLine1?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
  creditLimit?: number;
  creditDays?: number;
  priceList?: string;
  routeId?: string | null;
  collectionAgentId?: string | null;
  bankAccount?: any;
  status?: string;
  createdBy?: string;
}

export interface UpdateCustomerDto {
  firmName?: string;
  displayName?: string;
  customerType?: string[];
  contactPerson?: string;
  designation?: string;
  mobile?: string;
  altPhone?: string;
  whatsapp?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  gstRegType?: string;
  stateCode?: string;
  tdsSection?: string;
  tcsRate?: number;
  billingAddressLine1?: string;
  billingCity?: string;
  billingState?: string;
  billingPincode?: string;
  shippingAddressLine1?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
  creditLimit?: number;
  creditDays?: number;
  priceList?: string;
  routeId?: string | null;
  collectionAgentId?: string | null;
  bankAccount?: any;
  status?: string;
}

export interface CustomerState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
}
