import { useCallback } from "react";
import { useAppSelector } from "./reduxHooks";

/**
 * usePermission — Single Source of Truth for frontend authorization.
 *
 * Reads the permissions[] array from Redux auth state (decoded from JWT).
 * Super Admins bypass every check automatically.
 *
 * Usage:
 *   const { can, canAny, canAll, isSuperAdmin } = usePermission();
 *   if (can("users.create")) { ... }
 */
export const usePermission = () => {
  const { permissions, user } = useAppSelector((state) => state.auth);

  // Super Admin check — isSuperAdmin flag is set at login for ROLE_ADMIN accounts
  const isSuperAdmin = !!(user?.isSuperAdmin);

  /** True when the user holds the exact permission key OR is Super Admin. */
  const can = useCallback(
    (permission: string): boolean => {
      if (isSuperAdmin) return true;
      return permissions.includes(permission);
    },
    [permissions, isSuperAdmin]
  );

  /** True when the user holds AT LEAST ONE of the listed permissions OR is Super Admin. */
  const canAny = useCallback(
    (...perms: string[]): boolean => {
      if (isSuperAdmin) return true;
      return perms.some((p) => permissions.includes(p));
    },
    [permissions, isSuperAdmin]
  );

  /** True when the user holds ALL listed permissions OR is Super Admin. */
  const canAll = useCallback(
    (...perms: string[]): boolean => {
      if (isSuperAdmin) return true;
      return perms.every((p) => permissions.includes(p));
    },
    [permissions, isSuperAdmin]
  );

  return { can, canAny, canAll, isSuperAdmin, permissions };
};
