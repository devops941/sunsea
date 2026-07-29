import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchDepartments, createDepartment, updateDepartment, deleteDepartment, departmentCreated, departmentUpdated, departmentDeleted } from "../features/departments/departmentSlice";
import type { Department, CreateDepartmentDto, UpdateDepartmentDto } from "../features/departments/types";
import { useSocketSync } from "./useSocketSync";

export const useDepartments = () => {
  const dispatch = useAppDispatch();
  const { data: departments, total, loading, error } = useAppSelector((state) => state.departments);

  useSocketSync<Department>("department", {
    created: departmentCreated,
    updated: departmentUpdated,
    deleted: departmentDeleted,
  });

  const loadDepartments = useCallback((page?: number, limit?: number, search?: string) => {
    dispatch(fetchDepartments({ page, limit, search }));
  }, [dispatch]);

  const addDepartment = useCallback(
    async (data: CreateDepartmentDto) => {
      return await dispatch(createDepartment(data)).unwrap();
    },
    [dispatch]
  );

  const editDepartment = useCallback(
    async (id: number, data: UpdateDepartmentDto) => {
      return await dispatch(updateDepartment({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removeDepartment = useCallback(
    async (id: number) => {
      return await dispatch(deleteDepartment(id)).unwrap();
    },
    [dispatch]
  );

  return {
    departments,
    total,
    loading,
    error,
    loadDepartments,
    addDepartment,
    editDepartment,
    removeDepartment,
  };
};
