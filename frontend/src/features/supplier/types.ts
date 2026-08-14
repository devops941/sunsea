export interface Address {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface SupplierAddress {
  id?: string;
  address: Address;
}

export interface Supplier {
  id: string | number;
  companyId: string;
  supplierCode: string;
  legalName: string;
  displayName?: string | null;
  contactPerson?: string | null;
  mobile: any;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  gstRegType?: string | null;
  billingAddressLine1: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  billingCountry?: string | null;
  stateCode: string;
  openingBalance?: number | string | null;
  openingBalanceType?: string | null;
  status: string;
  addresses?: SupplierAddress[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierDto {
  companyId?: string;
  supplierCode: string;
  legalName: string;
  displayName?: string | null;
  contactPerson?: string | null;
  mobile: any;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  gstRegType?: string | null;
  billingAddressLine1: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  billingCountry?: string | null;
  stateCode: string;
  openingBalance?: number | null;
  openingBalanceType?: string;
  status?: string;
  addresses?: SupplierAddress[];
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> { }

export interface SupplierState {
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
}

// ----------------------------
// suppliermaterialprice

// Add these to your existing features/suppliers/types.ts
// (mirrors the Prisma `SupplierMaterialPrice` model)

export interface SupplierMaterialPrice {
  id: string;
  supplierId: number;
  rawMaterialId: string;
  price: number;
  validFrom: string; // ISO date string
  validTo: string | null;
  createdAt: string;
}

// What the "current price list" endpoint returns - the base model joined
// with the raw material name and a count of historical revisions, so the
// list screen doesn't need a second round trip per row.
export interface SupplierMaterialPriceRow extends SupplierMaterialPrice {
  materialName: string;
  revisionCount: number;
}

export interface CreateSupplierMaterialPriceDto {
  rawMaterialId: string;
  price: number;
  validFrom: string;
}

export interface ReviseSupplierMaterialPriceDto {
  rawMaterialId: string;
  price: number;
  validFrom: string; // effective date of the new price
}