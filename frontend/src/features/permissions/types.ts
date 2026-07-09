export interface Permission {
  id: number;
  key: string;
  module: string;
  action: string;
  scope: string | null;
  description: string | null;
}

export interface CreatePermissionDto {
  key: string;
  module: string;
  action: string;
  scope?: string;
  description?: string;
}

export interface UpdatePermissionDto {
  module?: string;
  action?: string;
  scope?: string;
  description?: string;
}

export interface RolePermission {
  roleId: number;
  permissionId: number;
  permission: Permission;
}

export interface RoleWithPermissions {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  status: string;
  createdAt: string;
  rolePermissions: RolePermission[];
}

export interface PermissionState {
  permissions: Permission[];
  rolePermissions: Record<number, Permission[]>;
  loading: boolean;
  error: string | null;
}
