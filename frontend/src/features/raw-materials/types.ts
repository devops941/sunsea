import type { Store } from "../stores/types";
import type { RawMaterialCategory } from "../raw-material-categories/types";
export interface RawMaterial {
  rawMaterialId: string;
  materialName: string;

  categoryId?: number | null;
  category?: RawMaterialCategory | null;

  hsnCode?: string | null;

  minimumStock?: number | string | null;

  baseUom: string;

  reorderLevel?: number | string | null;
  rate?: number | string | null;

  storeId?: string | null;
  store?: {
    storeId: string;
    storeName: string;
  } | null;

  locationId?: string | null;
  batchNo?: string | null;

  onHandQty?: number | string;
  reservedQty?: number | string;

  narration?: string | null;
  lastMovementAt?: string | null;

  status?: string;
  isActive: boolean;
  itemType?: string | null;
  remarks?: string | null;

  createdAt?: string;
  updatedAt?: string;

  createdBy?: string | null;
  updatedBy?: string | null;

  storeLocation?: {
    id: string;
    locationCode: string;
  } | null;
}
export interface CreateRawMaterialDto {
  rawMaterialId: string;
  materialCode?: string;

  materialName: string;
  categoryId?: number | null;
  hsnCode?: string | null;

  minimumStock?: number | null;
  storeId?: string | null;

  baseUom: string;
  reorderLevel?: number | null;
  rate?: number | null;

  onHandQty?: number | null;
  reservedQty?: number | null;
  batchNo?: string | null;
  narration?: string | null;
  lastMovementAt?: string | null;

  isActive?: boolean;
}
export interface UpdateRawMaterialDto {
  materialName?: string;
  categoryId?: number | null;
  hsnCode?: string | null;

  minimumStock?: number | null;

  storeId?: string | null;
  baseUom?: string;

  reorderLevel?: number | null;
  rate?: number | null;

  batchNo?: string | null;

  onHandQty?: number | null;
  reservedQty?: number | null;

  narration?: string | null;
  lastMovementAt?: string | null;

  status?: string;
  isActive?: boolean;
}

export interface RawMaterialState {
  data: RawMaterial[];
  loading: boolean;
  error: string | null;
}

export interface RawMaterialStock {
  id: string;
  storeId: string;
  rawMaterialId: string;
  locationId?: string | null;
  batchNo?: string | null;
  onHandQty: number | string;
  reservedQty?: number | string;
  avgCost?: number | string;
  status?: string;
  remarks?: string | null;
  lastMovementAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  store?: Store;
  rawMaterial?: RawMaterial;
  materialName?: string;
  baseUom?: string;
}

export interface CreateRawMaterialStockDto {
  storeId: string;
  rawMaterialId: string;
  locationId?: string | null;
  batchNo?: string | null;
  onHandQty?: number | string;
  reservedQty?: number | string;
  avgCost?: number | string;
  status?: string;
  remarks?: string | null;
}

export interface UpdateRawMaterialStockDto {
  locationId?: string | null;
  batchNo?: string | null;
  onHandQty?: number | string;
  reservedQty?: number | string;
  avgCost?: number | string;
  status?: string;
  remarks?: string | null;
}

export interface RawMaterialStockState {
  data: RawMaterialStock[];
  loading: boolean;
  error: string | null;
}
