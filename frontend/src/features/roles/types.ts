export interface Role {
  id: number;
  code?: string;
  name: string;
  description?: string;
  isSystem: boolean;
  status: string;
  createdAt: string;
}

export interface CreateRoleDto {
  code?: string;
  name: string;
  description?: string;
  status: string;
}

export type UpdateRoleDto = Partial<CreateRoleDto>;

export interface RoleState {
  data: Role[];
  loading: boolean;
  error: string | null;
}
