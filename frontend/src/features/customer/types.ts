export interface CustomerAddress {
  id: string;
  address: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  customerId: string;
  is_default: boolean;
  label: string;
  state_code: string;
}

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
  billingCountry?: string | null;
  shippingAddressLine1?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPincode?: string | null;
  shippingCountry?: string | null;
  stateCode?: string;
  creditLimit?: number | string | null;
  creditDays?: number | null;
  priceList?: string | null;
  collectionAgentId?: string | null;
  routeId?: string | null;
  bankAccount?: any;
  status: string;
  addresses?: CustomerAddress[];
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
  //pan?: string;
  //gstRegType?: string;
  stateCode?: string;
  //tdsSection?: string;
  //tcsRate?: number;
  billingAddressLine1: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  billingCountry?: string;
  shippingAddressLine1?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
  shippingCountry?: string;
  creditLimit?: number;
  creditDays?: number;
  priceList?: string;
  routeId?: string | null;
  collectionAgentId?: string | null;
  bankAccount?: any;
  status?: string;
  createdBy?: string;
  addresses?: any[];
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
  //pan?: string;
  //gstRegType?: string;
  stateCode?: string;
  //tdsSection?: string;
  //tcsRate?: number;
  billingAddressLine1?: string;
  billingCity?: string;
  billingState?: string;
  billingPincode?: string;
  billingCountry?: string;
  shippingAddressLine1?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
  shippingCountry?: string;
  creditLimit?: number;
  creditDays?: number;
  priceList?: string;
  routeId?: string | null;
  collectionAgentId?: string | null;
  bankAccount?: any;
  status?: string;
  addresses?: any[];
}

export interface CustomerState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  // BUG-CUST-004 fix: added pagination metadata
  total: number;
  page: number;
  totalPages: number;
}
