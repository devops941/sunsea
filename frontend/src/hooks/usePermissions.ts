import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import {
  fetchPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  fetchRolePermissions,
  assignRolePermissions,
  removeRolePermission,
} from "../features/permissions/permissionSlice";
import type { CreatePermissionDto, UpdatePermissionDto } from "../features/permissions/types";

export const usePermissions = () => {
  const dispatch = useAppDispatch();
  const { permissions, rolePermissions, loading, error } = useAppSelector((state) => state.permissions);

  const loadPermissions = useCallback(() => {
    dispatch(fetchPermissions());
  }, [dispatch]);

  const addPermission = useCallback(
    async (data: CreatePermissionDto) => {
      return await dispatch(createPermission(data)).unwrap();
    },
    [dispatch]
  );

  const editPermission = useCallback(
    async (id: number, data: UpdatePermissionDto) => {
      return await dispatch(updatePermission({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removePermission = useCallback(
    async (id: number) => {
      return await dispatch(deletePermission(id)).unwrap();
    },
    [dispatch]
  );

  const loadRolePermissions = useCallback(
    (roleId: number) => {
      dispatch(fetchRolePermissions(roleId));
    },
    [dispatch]
  );

  const assignPermissionsToRole = useCallback(
    async (roleId: number, permissionIds: number[]) => {
      return await dispatch(assignRolePermissions({ roleId, permissionIds })).unwrap();
    },
    [dispatch]
  );

  const removePermissionFromRole = useCallback(
    async (roleId: number, permissionId: number) => {
      return await dispatch(removeRolePermission({ roleId, permissionId })).unwrap();
    },
    [dispatch]
  );

  return {
    permissions,
    rolePermissions,
    loading,
    error,
    loadPermissions,
    addPermission,
    editPermission,
    removePermission,
    loadRolePermissions,
    assignPermissionsToRole,
    removePermissionFromRole,
  };
};
