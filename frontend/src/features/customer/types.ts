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

export interface CustomerTransport {
  transportName: string;
  phone: string;
  addressLine1: string;
  country: string;
  state: string;
  city: string;
  pincode: string;
}

export interface Customer {
  id: string;
  companyId: string;
  customerCode: string;
  firmName: string;
  displayName?: string | null;
  customerType?: { id: number; name: string } | null;
  customerGrade?: { id: number; name: string } | null;
  mobile: any;
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
  openingBalance?: number | string | null;
  openingBalanceType?: string | null;
  priceList?: string | null;
  collectionAgentId?: string | null;
  routeId?: string | null;
  status: string;
  addresses?: CustomerAddress[];
  transports?: CustomerTransport[];
  netBalance?: number;
  balanceAmount?: number;
  balanceType?: string;
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
  mobile: any;
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
  openingBalance?: number;
  openingBalanceType?: string;
  priceList?: string;
  routeId?: string | null;
  collectionAgentId?: string | null;
  status?: string;
  createdBy?: string;
  addresses?: any[];
}

export interface UpdateCustomerDto {
  firmName?: string;
  displayName?: string;
  mobile?: any;
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
  openingBalance?: number;
  priceList?: string;
  routeId?: string | null;
  collectionAgentId?: string | null;
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
