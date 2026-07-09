import type { ProductionOrder } from "../production-orders/types";

export interface HourlyProduction {
  hourlyProductionId: number | string;
  productionOrderId: string;
  hourIndex: number;
  qtyProduced: number | string;
  rejectQty?: number | string;
  scrapQty?: number | string;
  downtime?: number | string;
  operatorId?: string | null;
  remarks?: string | null;
  productionDate?: string;
  machineId?: string;
  shiftId?: number | string;
  createdAt?: string;
  updatedAt?: string;
  productionOrder?: ProductionOrder;
  machine?: any;
  shift?: any;
}

export interface HourlyProductionState {
  data: HourlyProduction[];
  loading: boolean;
  error: string | null;
}
