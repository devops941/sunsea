export interface ProductShiftRecord {
  id: number;
  productId: number;
  productionOrderId: string;
  machineId: string;
  shiftId: string;
  achievedQty: number;
  targetQty: number;
  recordedDate: string;
  operatorIds?: string | null;
  isHighest: boolean;
  createdAt: string;
  product?: { productName: string; productCode: string };
  shift?: { shiftName: string; shiftCode: string };
  machine?: { machineName: string };
  productionOrder?: { productionOrderId: string; producedQty: number; targetQty: number };
}

export interface ProductShiftRecordState {
  records: ProductShiftRecord[];
  highest: ProductShiftRecord | null;
  loading: boolean;
  error: string | null;
}
