export interface Department {
  id: number;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    employees: number;
  };
}

export interface CreateDepartmentDto {
  name: string;
  description?: string | null;
}

export type UpdateDepartmentDto = Partial<CreateDepartmentDto>;

export interface DepartmentState {
  data: Department[];
  total: number;
  loading: boolean;
  error: string | null;
}
