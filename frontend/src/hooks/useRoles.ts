import { useCallback, useMemo, useState } from "react";
import type { Role, CreateRoleDto, UpdateRoleDto } from "../features/roles/types";
import { roleService } from "../services/roleService";
import { useListCache, markStaleByPrefix } from "./useListCache";

const CACHE_PREFIX = "roles:";

export const useRoles = () => {
  // Params as state so cacheKey updates reactively → useListCache checks cache first
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [search, setSearch] = useState("");

  const cacheKey = `${CACHE_PREFIX}${page}:${limit}:${search}`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await roleService.fetchAll({
      page,
      limit,
      search: search || undefined,
    });
    return { data: res.data || [], total: res.total || 0 };
  }, [page, limit, search]);

  const { data: rawRoles, total, loading, refreshing, refresh } = useListCache<Role>({
    cacheKey,
    socketModule: "role",
    fetcher,
  });

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

  // Page calls loadRoles(page, limit, search) — just update state.
  // cacheKey changes → useListCache checks cache → instant if cached, fetch if not.
  const loadRoles = useCallback((p?: number, l?: number, s?: string) => {
    setPage(p || 1);
    setLimit(l || 15);
    setSearch(s || "");
  }, []);

  const addRole = useCallback(
    async (data: CreateRoleDto) => {
      const result = await roleService.create(data);
      markStaleByPrefix(CACHE_PREFIX);
      refresh();
      return result;
    },
    [refresh]
  );

  const editRole = useCallback(
    async (id: number, data: UpdateRoleDto) => {
      const result = await roleService.update(id, data);
      markStaleByPrefix(CACHE_PREFIX);
      refresh();
      return result;
    },
    [refresh]
  );

  const removeRole = useCallback(
    async (id: number) => {
      await roleService.delete(id);
      markStaleByPrefix(CACHE_PREFIX);
      refresh();
    },
    [refresh]
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
