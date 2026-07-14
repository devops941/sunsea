export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  status: string;
  createdAt: string;
  _count?: {
    users: number;
  };
}

export interface CreateRoleDto {
  code: string;
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
