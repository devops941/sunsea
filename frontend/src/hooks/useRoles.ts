import React, { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchRoles, createRole, updateRole, deleteRole, roleCreated, roleUpdated, roleDeleted } from "../features/roles/roleSlice";
import type { Role, CreateRoleDto, UpdateRoleDto } from "../features/roles/types";
import { useSocketSync } from "./useSocketSync";

export const useRoles = () => {
  const dispatch = useAppDispatch();
  const { data: roles, total, loading, error } = useAppSelector((state) => state.roles);

  const loadRoles = useCallback((page?: number, limit?: number, search?: string) => {
    dispatch(fetchRoles({ page, limit, search }));
  }, [dispatch]);

  // Listen for real-time updates from other clients
  useSocketSync<Role>("role", {
    created: roleCreated,
    updated: roleUpdated,
    deleted: roleDeleted,
  });

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
