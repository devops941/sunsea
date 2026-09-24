import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchEmployees, createEmployee, updateEmployee, deleteEmployee, employeeCreated, employeeUpdated, employeeDeleted } from "../features/employee/employeeSlice";
import type { Employee, CreateEmployeeDto, UpdateEmployeeDto } from "../features/employee/types";
import { useSocketSync } from "./useSocketSync";

export const useEmployees = () => {
  const dispatch = useAppDispatch();
  const { employees, loading, error, total, page, totalPages } = useAppSelector((state) => state.employees);

  useSocketSync<Employee>("employee", {
    created: employeeCreated,
    updated: employeeUpdated,
    deleted: employeeDeleted,
  });

  const loadEmployees = useCallback((params?: { search?: string; departmentId?: string | number; roleId?: string | number; status?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc" }) => {
    dispatch(fetchEmployees(params));
  }, [dispatch]);

  const addEmployee = useCallback(
    async (data: CreateEmployeeDto) => {
      return await dispatch(createEmployee(data)).unwrap();
    },
    [dispatch]
  );

  const editEmployee = useCallback(
    async (id: string, data: UpdateEmployeeDto) => {
      return await dispatch(updateEmployee({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removeEmployee = useCallback(
    async (id: string) => {
      return await dispatch(deleteEmployee(id)).unwrap();
    },
    [dispatch]
  );

  return {
    employees,
    loading,
    error,
    total,
    page,
    totalPages,
    loadEmployees,
    addEmployee,
    editEmployee,
    removeEmployee,
  };
};
