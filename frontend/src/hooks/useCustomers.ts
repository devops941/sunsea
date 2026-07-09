import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from "../features/customer/customerSlice";
import type { CreateCustomerDto, UpdateCustomerDto } from "../features/customer/types";

export const useCustomers = () => {
  const dispatch = useAppDispatch();
  const { customers, loading, error } = useAppSelector((state) => state.customers);

  const loadCustomers = useCallback((search?: string) => {
    dispatch(fetchCustomers(search));
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
    loadCustomers,
    addCustomer,
    editCustomer,
    removeCustomer,
  };
};
