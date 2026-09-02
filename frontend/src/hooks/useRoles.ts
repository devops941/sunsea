import { useCallback, useMemo, useRef } from "react";
import type { Role, CreateRoleDto, UpdateRoleDto } from "../features/roles/types";
import { roleService } from "../services/roleService";
import { useListCache, invalidateCache, markStaleByPrefix } from "./useListCache";
import { useSocketSync } from "./useSocketSync";

const CACHE_PREFIX = "roles:";

export const useRoles = () => {
  // Track current fetch params so the cache key stays in sync
  const paramsRef = useRef<{ page: number; limit: number; search: string }>({
    page: 1, limit: 15, search: "",
  });

  const cacheKey = `${CACHE_PREFIX}${paramsRef.current.page}:${paramsRef.current.limit}:${paramsRef.current.search}`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const { page, limit, search } = paramsRef.current;
    const res = await roleService.fetchAll({
      page,
      limit,
      search: search || undefined,
    });
    return { data: res.data || [], total: res.total || 0 };
  }, []);

  const { data: rawRoles, total, loading, refreshing, refresh } = useListCache<Role>({
    cacheKey,
    socketModule: "role",
    fetcher,
  });

  // After any mutation (create/edit/delete), mark all role caches stale
  // so the next render shows cached data instantly + refetches silently.
  const invalidateAndRefresh = useCallback(() => {
    markStaleByPrefix(CACHE_PREFIX);
    refresh();
  }, [refresh]);

  // Socket live-sync — refetch on any role event from other clients
  useSocketSync("role", undefined, invalidateAndRefresh);

  // Filter out super admin roles from display
  const roles = useMemo(() => {
    if (!rawRoles) return [];
    return rawRoles.filter((role) => {
      const nameLower = (role.name || "").toLowerCase();
      const codeLower = (role.code || "").toLowerCase();
      return (
        !nameLower.includes("super admin") &&
        !nameLower.includes("superadmin") &&
        !codeLower.includes("super_admin") &&
        !codeLower.includes("superadmin") &&
        codeLower !== "role_admin"
      );
    });
  }, [rawRoles]);

  const loadRoles = useCallback((page?: number, limit?: number, search?: string) => {
    paramsRef.current = {
      page: page || 1,
      limit: limit || 15,
      search: search || "",
    };
    // Invalidate current cache key so useListCache refetches with new params
    invalidateCache(cacheKey);
    refresh();
  }, [cacheKey, refresh]);

  const addRole = useCallback(
    async (data: CreateRoleDto) => {
      const result = await roleService.create(data);
      invalidateAndRefresh();
      return result;
    },
    [invalidateAndRefresh]
  );

  const editRole = useCallback(
    async (id: number, data: UpdateRoleDto) => {
      const result = await roleService.update(id, data);
      invalidateAndRefresh();
      return result;
    },
    [invalidateAndRefresh]
  );

  const removeRole = useCallback(
    async (id: number) => {
      await roleService.delete(id);
      invalidateAndRefresh();
    },
    [invalidateAndRefresh]
  );

  return {
    roles,
    total,
    loading,
    refreshing,
    error: null as string | null,
    loadRoles,
    addRole,
    editRole,
    removeRole,
    refresh,
  };
};
