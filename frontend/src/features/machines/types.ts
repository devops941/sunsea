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
}
export interface MachineState {
  data: Machine[];
  loading: boolean;
  error: string | null;
}
