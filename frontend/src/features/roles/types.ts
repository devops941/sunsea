export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  status: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string | null;
  createdUserName?: string;
  updatedBy?: string | null;
  editHistory?: Array<{
    updatedBy?: string;
    updatedByName?: string;
    updatedAt: string;
  }>;
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
  total: number;
  loading: boolean;
  error: string | null;
}
