import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../features/supplier/supplierSlice";
import type { CreateSupplierDto, UpdateSupplierDto } from "../features/supplier/types";

export const useSuppliers = () => {
  const dispatch = useAppDispatch();
  const { suppliers, loading, error } = useAppSelector((state) => state.suppliers);

  const loadSuppliers = useCallback((search?: string) => {
    dispatch(fetchSuppliers(search));
  }, [dispatch]);

  const addSupplier = useCallback(
    async (data: CreateSupplierDto) => {
      return await dispatch(createSupplier(data)).unwrap();
    },
    [dispatch]
  );

  const editSupplier = useCallback(
    async (id: string, data: UpdateSupplierDto) => {
      return await dispatch(updateSupplier({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removeSupplier = useCallback(
    async (id: string) => {
      return await dispatch(deleteSupplier(id)).unwrap();
    },
    [dispatch]
  );

  return {
    suppliers,
    loading,
    error,
    loadSuppliers,
    addSupplier,
    editSupplier,
    removeSupplier,
  };
};
