import React from "react";
import { usePermission } from "../../hooks/usePermission";

/**
 * PermissionGuard — Hides children completely when user lacks the required permission.
 *
 * Per RBAC spec: buttons and content DISAPPEAR — they are never just disabled.
 *
 * Usage:
 *   <PermissionGuard permission="users.create">
 *     <button>Add User</button>
 *   </PermissionGuard>
 */
interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
}) => {
  const { can } = usePermission();
  if (!can(permission)) return null;
  return <>{children}</>;
};

/**
 * AnyPermissionGuard — Renders children when user holds AT LEAST ONE permission.
 *
 * Usage:
 *   <AnyPermissionGuard permissions={["users.edit", "users.delete"]}>
 *     <ActionsMenu />
 *   </AnyPermissionGuard>
 */
interface AnyPermissionGuardProps {
  permissions: string[];
  children: React.ReactNode;
}

export const AnyPermissionGuard: React.FC<AnyPermissionGuardProps> = ({
  permissions,
  children,
}) => {
  const { canAny } = usePermission();
  if (!canAny(...permissions)) return null;
  return <>{children}</>;
};

/**
 * AllPermissionsGuard — Renders children only when user holds ALL permissions.
 *
 * Usage:
 *   <AllPermissionsGuard permissions={["users.edit", "users.delete"]}>
 *     <DangerZone />
 *   </AllPermissionsGuard>
 */
interface AllPermissionsGuardProps {
  permissions: string[];
  children: React.ReactNode;
}

export const AllPermissionsGuard: React.FC<AllPermissionsGuardProps> = ({
  permissions,
  children,
}) => {
  const { canAll } = usePermission();
  if (!canAll(...permissions)) return null;
  return <>{children}</>;
};

export default PermissionGuard;
