import { useCallback, useState } from "react";
import type { Department, CreateDepartmentDto, UpdateDepartmentDto } from "../features/departments/types";
import { departmentService } from "../services/departmentService";
import { useListCache, markStaleByPrefix } from "./useListCache";

const CACHE_PREFIX = "departments:";

export const useDepartments = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [search, setSearch] = useState("");

  const cacheKey = `${CACHE_PREFIX}${page}:${limit}:${search}`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await departmentService.fetchAll({
      page,
      limit,
      search: search || undefined,
    });
    return { data: res.data || [], total: res.total || 0 };
  }, [page, limit, search]);

  const { data: departments, total, loading, refreshing, refresh } = useListCache<Department>({
    cacheKey,
    socketModule: "department",
    fetcher,
  });

  const loadDepartments = useCallback((p?: number, l?: number, s?: string) => {
    setPage(p || 1);
    setLimit(l || 15);
    setSearch(s || "");
  }, []);

  const addDepartment = useCallback(
    async (data: CreateDepartmentDto) => {
      const result = await departmentService.create(data);
      markStaleByPrefix(CACHE_PREFIX);
      refresh();
      return result;
    },
    [refresh]
  );

  const editDepartment = useCallback(
    async (id: number, data: UpdateDepartmentDto) => {
      const result = await departmentService.update(id, data);
      markStaleByPrefix(CACHE_PREFIX);
      refresh();
      return result;
    },
    [refresh]
  );

  const removeDepartment = useCallback(
    async (id: number) => {
      await departmentService.delete(id);
      markStaleByPrefix(CACHE_PREFIX);
      refresh();
    },
    [refresh]
  );

  return {
    departments,
    total,
    loading,
    refreshing,
    error: null as string | null,
    loadDepartments,
    addDepartment,
    editDepartment,
    removeDepartment,
    refresh,
  };
};
