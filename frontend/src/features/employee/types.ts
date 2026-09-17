export type EmployeeStatus = "active" | "inactive" | "resigned" | "terminated";
export type EmployeeCategory = "office_staff" | "labour";

export interface Employee {
  id: string;
  empCode: string;
  fullName: string;
  mobile: string | null;
  email: string | null;
  dateOfJoining: string | null;
  departmentId: number | null;
  designationId: number | null;
  employeeCategory: EmployeeCategory | null;
  status: EmployeeStatus;
  statusChangedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdUserName?: string;
  updatedBy?: string;
  editHistory?: Array<{ updatedBy?: string; updatedByName?: string; updatedAt?: string | Date }>;
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
  employeeCategory?: EmployeeCategory;
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
  employeeCategory?: EmployeeCategory;
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
