import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchRoles, createRole, updateRole, deleteRole } from "../features/roles/roleSlice";
import type { CreateRoleDto, UpdateRoleDto } from "../features/roles/types";

export const useRoles = () => {
  const dispatch = useAppDispatch();
  const { data: roles, total, loading, error } = useAppSelector((state) => state.roles);

  const loadRoles = useCallback((page?: number, limit?: number, search?: string) => {
    dispatch(fetchRoles({ page, limit, search }));
  }, [dispatch]);

  const addRole = useCallback(
    async (data: CreateRoleDto) => {
      return await dispatch(createRole(data)).unwrap();
    },
    [dispatch]
  );

  const editRole = useCallback(
    async (id: number, data: UpdateRoleDto) => {
      return await dispatch(updateRole({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removeRole = useCallback(
    async (id: number) => {
      return await dispatch(deleteRole(id)).unwrap();
    },
    [dispatch]
  );

  return {
    roles,
    total,
    loading,
    error,
    loadRoles,
    addRole,
    editRole,
    removeRole,
  };
};
