export interface ProductionOrderItem {
  id?: number;
  productionOrderId?: number;
  rawMaterialId: string;
  quantity: number | string;
  uom: string;
  rawMaterial?: any;
}

export interface ProductionOrder {
  id?: number | string; // Often APIs map this to id or productionOrderId
  productionOrderId?: string;
  orderDate: string;
  dueDate: string;
  productItemId: string | number;
  targetQty: string | number;
  plannedQty?: string | number;
  producedQty?: string | number;
  rejectedQty?: string | number;
  scrapQty?: string | number;
  uom: string;
  priority?: string;
  orderType?: string;
  batchNo?: string | null;
  lotNo?: string | null;
  machineId?: string | null;
  machineMachineId?: string | null;
  Machine?: any;
  machine?: any;
  shiftId?: number | string | null;
  shift?: any;
  sourceSalesOrderId?: string | null;
  sourceSalesOrderLineId?: string | number | null;
  sourceStoreId?: string | null;
  destinationStoreId?: string | null;
  billOfMaterialId?: number | null;
  routingId?: string | null;
  status?: string;
  remarks?: string | null;
  productItem?: any;
  hourlyProductions?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionOrderState {
  data: ProductionOrder[];
  loading: boolean;
  error: string | null;
}

