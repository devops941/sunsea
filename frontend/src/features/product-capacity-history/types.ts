export interface ProductCapacityHistory {
  id: number;
  productId: number;
  previousCapacity: number;
  newCapacity: number;
  productionDate: string;
  machineId: string;
  shiftId: string;
  productionOrderId: string;
  targetQty: number;
  actualQty: number;
  achievementPct: number;
  operators: string | null;
  updatedBy: string | null;
  createdAt: string;
  product?: {
    productName: string;
    productCode: string;
    capacityLitres: number | null;
  };
}

export interface ProductCapacityHistoryState {
  records: ProductCapacityHistory[];
  loading: boolean;
  error: string | null;
}
