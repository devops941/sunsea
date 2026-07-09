import type { Store } from "../stores/types";
import type { RawMaterialCategory } from "../raw-material-categories/types";
export interface RawMaterial {
  rawMaterialId: string;
  materialName: string;

  categoryId?: number | null;
  category?: RawMaterialCategory | null;

  hsnCode?: string | null;

  minimumStock?: number | string | null;
  leadTimeDays?: number | string | null;

  baseUom: string;

  reorderLevel?: number | string | null;
  unitPrice?: number | string | null;

  storeId?: string | null;
  store?: {
    storeId: string;
    storeName: string;
  } | null;

  locationId?: string | null;
  batchNo?: string | null;

  onHandQty?: number | string;
  reservedQty?: number | string;
  avgCost?: number | string;

  remarks?: string | null;
  lastMovementAt?: string | null;
  gstTaxRateId?: string | null;

  status?: string;
  isActive: boolean;

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
  leadTimeDays?: number | null;
  storeId?: string | null;

  baseUom: string;
  reorderLevel?: number | null;
  unitPrice?: number | null;

  onHandQty?: number | null;
  reservedQty?: number | null;
  avgCost?: number | null;
  batchNo?: string | null;
  remarks?: string | null;
  lastMovementAt?: string | null;
  gstTaxRateId?: string | null;

  isActive?: boolean;
}
export interface UpdateRawMaterialDto {
  materialName?: string;
  categoryId?: number | null;
  hsnCode?: string | null;

  minimumStock?: number | null;
  leadTimeDays?: number | null;

  storeId?: string | null;
  baseUom?: string;

  reorderLevel?: number | null;
  unitPrice?: number | null;

  batchNo?: string | null;

  onHandQty?: number | null;
  reservedQty?: number | null;
  avgCost?: number | null;

  remarks?: string | null;
  lastMovementAt?: string | null;
  gstTaxRateId?: string | null;

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
