export interface Department {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentDto {
  code: string;
  name: string;
}

export type UpdateDepartmentDto = Partial<CreateDepartmentDto>;

export interface DepartmentState {
  data: Department[];
  loading: boolean;
  error: string | null;
}
