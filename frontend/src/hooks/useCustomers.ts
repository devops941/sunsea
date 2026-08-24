import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer, customerCreated, customerUpdated, customerDeleted } from "../features/customer/customerSlice";
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from "../features/customer/types";
import { useSocketSync } from "./useSocketSync";

export const useCustomers = () => {
  const dispatch = useAppDispatch();
  // BUG-CUST-004 fix: expose pagination metadata from state
  const { customers, loading, error, total, page, totalPages } = useAppSelector((state) => state.customers);

  useSocketSync<Customer>("customer", {
    created: customerCreated,
    updated: customerUpdated,
    deleted: customerDeleted,
  });

  // BUG-CUST-004 fix: accept page, limit, and status params for server-side pagination and filtering
  const loadCustomers = useCallback((params?: { search?: string; page?: number; limit?: number; status?: string; customerTypeId?: number; customerGradeId?: number } | string) => {
    if (typeof params === "string") {
      dispatch(fetchCustomers({ search: params }));
    } else {
      dispatch(fetchCustomers(params ?? {}));
    }
  }, [dispatch]);

  const addCustomer = useCallback(
    async (data: CreateCustomerDto) => {
      return await dispatch(createCustomer(data)).unwrap();
    },
    [dispatch]
  );

  const editCustomer = useCallback(
    async (id: string, data: UpdateCustomerDto) => {
      return await dispatch(updateCustomer({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removeCustomer = useCallback(
    async (id: string) => {
      return await dispatch(deleteCustomer(id)).unwrap();
    },
    [dispatch]
  );

  return {
    customers,
    loading,
    error,
    total,
    page,
    totalPages,
    loadCustomers,
    addCustomer,
    editCustomer,
    removeCustomer,
  };
};
