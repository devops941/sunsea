export interface Store {
  id?: number | string; // Typically backend uses UUIDs or specific ID formats. In the payload it was STR002.
  storeId: string;
  storeCode?: string | null;
  storeName: string;
  storeTypeId?: number | null;
  storeTypeRef?: { id: number; name: string; code: string } | null;
  locationId?: string | null;
  locationDesc?: string | null;
  inchargeId?: string | number | null;
  incharge?: { fullName: string } | null;
  allowNegative?: boolean;
  costMethod?: string;
  gstPlace?: string | null;
  status?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string | null;
}

export interface CreateStoreDto {
  storeId: string;
  storeCode?: string | null;
  storeName: string;
  storeTypeId?: number;
  locationId?: string | null;
  locationDesc?: string | null;
  inchargeId?: string | number | null;
  allowNegative?: boolean;
  costMethod?: string;
  gstPlace?: string | null;
  status?: string;
  isActive?: boolean;
}

export interface UpdateStoreDto {
  storeCode?: string | null;
  storeName?: string;
  storeTypeId?: number;
  locationId?: string | null;
  locationDesc?: string | null;
  inchargeId?: string | number | null;
  allowNegative?: boolean;
  costMethod?: string;
  gstPlace?: string | null;
  status?: string;
  isActive?: boolean;
}

export interface StoreState {
    data: Store[];
    total: number;
    page: number;
    totalPages: number;
    loading: boolean;
    error: string | null;
}