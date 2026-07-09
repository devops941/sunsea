import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchRoles, createRole, updateRole, deleteRole } from "../features/roles/roleSlice";
import type { CreateRoleDto, UpdateRoleDto } from "../features/roles/types";

export const useRoles = () => {
  const dispatch = useAppDispatch();
  const { data: roles, loading, error } = useAppSelector((state) => state.roles);

  const loadRoles = useCallback(() => {
    dispatch(fetchRoles());
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
    loading,
    error,
    loadRoles,
    addRole,
    editRole,
    removeRole,
  };
};
