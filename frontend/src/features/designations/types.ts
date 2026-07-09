export interface Designation {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDesignationDto {
  code: string;
  name: string;
  departmentId: number;
}

export type UpdateDesignationDto = Partial<CreateDesignationDto>;

export interface DesignationState {
  data: Designation[];
  loading: boolean;
  error: string | null;
}
