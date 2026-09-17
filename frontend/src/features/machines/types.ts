export interface Machine {
  machineId: string;
  machineName: string;
  technologyType: string;
  machineType: string;
  manufacturer?: string | null;
  modelNumber?: string | null;
  cycleTime?: number | null;
  operatorId?: string | null;
  machineStatus?: string;
  isActive: boolean;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  createdUserName?: string;
  updatedBy?: string;
  editHistory?: Array<{ updatedBy?: string; updatedByName?: string; updatedAt?: string | Date }>;
}
export interface MachineState {
  data: Machine[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}
