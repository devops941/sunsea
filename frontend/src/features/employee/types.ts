export type EmployeeStatus = "active" | "inactive" | "resigned" | "terminated";

export interface Employee {
  id: string;
  empCode: string;
  fullName: string;
  mobile: string | null;
  email: string | null;
  dateOfJoining: string | null;
  departmentId: number | null;
  designationId: number | null;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
  department?: {
    id: number;
    code: string;
    name: string;
  } | null;
  designation?: {
    id: number;
    code: string;
    name: string;
  } | null;
}

export interface CreateEmployeeDto {
  empCode: string;
  fullName: string;
  mobile?: string;
  email?: string;
  dateOfJoining?: string;
  departmentId?: number;
  designationId?: number;
  status?: EmployeeStatus;
}

export interface UpdateEmployeeDto {
  empCode?: string;
  fullName?: string;
  mobile?: string;
  email?: string;
  dateOfJoining?: string;
  departmentId?: number;
  designationId?: number;
  status?: EmployeeStatus;
}

export interface EmployeeState {
  employees: Employee[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}
