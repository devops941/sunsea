import apiClient from "../api/apiClient";

export interface MachineOperationAssignment {
  id: string;
  machineId: string;
  weekStartDate: string;
  weekEndDate: string;
  operatorRoleId?: number | null;
  inchargeRoleId?: number | null;
  operatorEmployeeId?: string | null;
  inchargeEmployeeId?: string | null;
  remarks?: string | null;
  isActive: boolean;
  assignedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  machine?: {
    machineId: string;
    machineName: string;
    machineType?: string;
    machineStatus?: string;
    isActive?: boolean;
  };
  operatorRole?: { id: number; name: string; code: string };
  inchargeRole?: { id: number; name: string; code: string };
  operatorEmployee?: { id: string; empCode: string; fullName: string; email?: string };
  inchargeEmployee?: { id: string; empCode: string; fullName: string; email?: string };
}

export const machineOperationAssignmentService = {
  getAssignments: async (params?: Record<string, any>) => {
    const response = await apiClient.get("/machine-operation-assignments", { params });
    return response.data;
  },

  getAssignmentById: async (id: string) => {
    const response = await apiClient.get(`/machine-operation-assignments/${id}`);
    return response.data;
  },

  resolveAssignment: async (params: { machineId: string; shiftId: string; date?: string }) => {
    const response = await apiClient.get("/machine-operation-assignments/resolve", { params });
    return response.data;
  },

  getRoles: async () => {
    const response = await apiClient.get("/machine-operation-assignments/roles");
    return response.data;
  },

  getEmployeesByRole: async (roleId?: number) => {
    const response = await apiClient.get("/machine-operation-assignments/employees-by-role", {
      params: { roleId },
    });
    return response.data;
  },

  createAssignment: async (data: any) => {
    const response = await apiClient.post("/machine-operation-assignments", data);
    return response.data;
  },

  updateAssignment: async (id: string, data: any) => {
    const response = await apiClient.put(`/machine-operation-assignments/${id}`, data);
    return response.data;
  },

  toggleStatus: async (id: string, isActive: boolean) => {
    const response = await apiClient.patch(`/machine-operation-assignments/${id}/status`, { isActive });
    return response.data;
  },

  getHistoryByMachine: async (machineId: string) => {
    const response = await apiClient.get(`/machine-operation-assignments/machine/${machineId}/history`);
    return response.data;
  },

  getCurrentByMachine: async (machineId: string, date?: string) => {
    const response = await apiClient.get(`/machine-operation-assignments/machine/${machineId}/current`, {
      params: { date },
    });
    return response.data;
  },
};
