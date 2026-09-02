import { useCallback, useState } from "react";
import type { Permission, CreatePermissionDto, UpdatePermissionDto, RoleWithPermissions } from "../features/permissions/types";
import { permissionService } from "../services/permissionService";
import { useListCache, markStaleByPrefix } from "./useListCache";
import { useDetailCache, invalidateDetailCache, markDetailStaleByPrefix } from "./useDetailCache";

const PERM_CACHE_PREFIX = "permissions:";
const ROLE_PERM_CACHE_PREFIX = "rolePermissions:";

export const usePermissions = () => {
  // ── All permissions list (cached) ──────────────────────────────────────
  const permCacheKey = `${PERM_CACHE_PREFIX}all`;

  const permFetcher = useCallback(async (_signal: AbortSignal) => {
    const data = await permissionService.fetchAll();
    return { data: data || [], total: data?.length || 0 };
  }, []);

  const { data: permissions, loading: permLoading, refresh: refreshPerms } = useListCache<Permission>({
    cacheKey: permCacheKey,
    socketModule: "permission",
    fetcher: permFetcher,
  });

  // ── Role permissions (cached per role) ─────────────────────────────────
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<number, Permission[]>>({});

  const rolePermCacheKey = `${ROLE_PERM_CACHE_PREFIX}${activeRoleId ?? ""}`;

  const rolePermFetcher = useCallback(async (_signal: AbortSignal) => {
    if (!activeRoleId) return null;
    return await permissionService.fetchRolePermissions(activeRoleId);
  }, [activeRoleId]);

  const { data: rolePermData, loading: rolePermLoading, refresh: refreshRolePerms } = useDetailCache<RoleWithPermissions | null>({
    cacheKey: rolePermCacheKey,
    socketModule: "rolePermission",
    socketMatchId: activeRoleId,
    fetcher: rolePermFetcher,
    enabled: !!activeRoleId,
  });

  // Sync detail cache data into the rolePermissions map
  if (rolePermData && activeRoleId) {
    const perms = rolePermData.rolePermissions?.map((rp) => rp.permission) || [];
    if (rolePermissions[activeRoleId] !== perms) {
      // Only update if different reference
      const current = rolePermissions[activeRoleId];
      if (!current || current.length !== perms.length || !perms.every((p, i) => current[i]?.id === p.id)) {
        setRolePermissions(prev => ({ ...prev, [activeRoleId]: perms }));
      }
    }
  }

  const loading = permLoading || rolePermLoading;

  // ── Load functions (keep same API as before) ───────────────────────────
  const loadPermissions = useCallback(() => {
    // useListCache auto-fetches; this is a no-op for backward compat
  }, []);

  const loadRolePermissions = useCallback((roleId: number) => {
    setActiveRoleId(roleId);
  }, []);

  // ── Mutations ──────────────────────────────────────────────────────────
  const addPermission = useCallback(async (data: CreatePermissionDto) => {
    const result = await permissionService.create(data);
    markStaleByPrefix(PERM_CACHE_PREFIX);
    refreshPerms();
    return result;
  }, [refreshPerms]);

  const editPermission = useCallback(async (id: number, data: UpdatePermissionDto) => {
    const result = await permissionService.update(id, data);
    markStaleByPrefix(PERM_CACHE_PREFIX);
    refreshPerms();
    return result;
  }, [refreshPerms]);

  const removePermission = useCallback(async (id: number) => {
    await permissionService.delete(id);
    markStaleByPrefix(PERM_CACHE_PREFIX);
    refreshPerms();
  }, [refreshPerms]);

  const assignPermissionsToRole = useCallback(async (roleId: number, permissionIds: number[]) => {
    await permissionService.assignPermissions(roleId, permissionIds);
    // Optimistic update: add permissions locally
    const added = permissions.filter(p => permissionIds.includes(p.id));
    setRolePermissions(prev => {
      const current = prev[roleId] || [];
      const merged = [...current, ...added.filter(a => !current.some(c => c.id === a.id))];
      return { ...prev, [roleId]: merged };
    });
    // Invalidate cache for this role so next mount gets fresh data
    invalidateDetailCache(`${ROLE_PERM_CACHE_PREFIX}${roleId}`);
  }, [permissions]);

  const removePermissionFromRole = useCallback(async (roleId: number, permissionId: number) => {
    await permissionService.removePermission(roleId, permissionId);
    // Optimistic update: remove permission locally
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: (prev[roleId] || []).filter(p => p.id !== permissionId),
    }));
    invalidateDetailCache(`${ROLE_PERM_CACHE_PREFIX}${roleId}`);
  }, []);

  return {
    permissions,
    rolePermissions,
    loading,
    error: null as string | null,
    loadPermissions,
    addPermission,
    editPermission,
    removePermission,
    loadRolePermissions,
    assignPermissionsToRole,
    removePermissionFromRole,
  };
};
