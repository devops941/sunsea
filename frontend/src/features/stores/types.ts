export type StoreCategory = "RAW_MATERIAL" | "FINISHED_GOODS" | "WASTAGE";

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  RAW_MATERIAL: "Raw Material Store",
  FINISHED_GOODS: "Finished Goods Store",
  WASTAGE: "Wastage Store",
};

export const STORE_CATEGORY_OPTIONS = [
  { label: "Raw Material Store", value: "RAW_MATERIAL" },
  { label: "Finished Goods Store", value: "FINISHED_GOODS" },
  { label: "Wastage Store", value: "WASTAGE" },
];

export interface Store {
  id?: number | string;
  storeId: string;
  storeCode?: string | null;
  storeName: string;
  storeCategory?: StoreCategory | null;
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
  storeCategory?: StoreCategory | null;
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
  storeCategory?: StoreCategory | null;
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
