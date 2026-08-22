export type BusinessPlaceType = 
  | "HEAD_OFFICE"
  | "BRANCH_OFFICE"
  | "FACTORY"
  | "WAREHOUSE"
  | "RETAIL_STORE";

export interface BusinessPlace {
  id: string; // Stored as BigInt in DB but returned as string via API
  companyId: string;
  code: string;
  name: string;
  type: BusinessPlaceType;
  gstPlaceCode?: string | null;
  phone?: string | null;
  email?: string | null;
  isHeadOffice: boolean;
  isActive: boolean;
  address?: any;
}
export interface Company {
  id: string;
  companyCode?: string | null;
  companyName: string;
  legalName?: string | null;
  shortName?: string | null;
  gstin?: string | null;
  currencyCode: string;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  country?: string | null;
  isOnboarded: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  businessPlaces?: BusinessPlace[];
}

export interface UpdateCompanyDto {
  companyCode?: string | null;
  legalName?: string | null;
  companyName?: string | null;
  shortName?: string | null;
  gstin?: string | null;
  currencyCode?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  country?: string | null;
  isOnboarded?: boolean | null;
  isActive?: boolean | null;
  businessPlaces?: Partial<BusinessPlace>[];
  logoFile?: File | null;
  faviconFile?: File | null;
}
export interface CompanyState {
  data: Company | null;
  loading: boolean;
  error: string | null;
}
