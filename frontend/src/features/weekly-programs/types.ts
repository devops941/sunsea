import type { Machine } from "../machines/types";
import type { Product } from "../product/types"; // Assuming product type exists

export interface WeeklyMachineProgram {
  weeklyProgramId: string;
  weekStartDate: string;
  weekEndDate: string;
  machineId: string;
  dayOfWeek: number;
  shiftId: string;
  plannedProductItemId?: number | null;
  plannedQty: number;
  uom: string;
  priority: string;
  sourceSalesOrderId?: string | null;
  status: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  remarks?: string | null;
  createdAt?: string;
  updatedAt?: string;
  machine?: Machine;
  plannedProductItem?: Product;
  productionOrderId?: string | null;
  productionOrder?: any;
  shift?: any;
}

export interface WeeklyProgramState {
  data: WeeklyMachineProgram[];
  loading: boolean;
  error: string | null;
}
