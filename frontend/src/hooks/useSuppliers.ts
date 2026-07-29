import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier, supplierCreated, supplierUpdated, supplierDeleted } from "../features/supplier/supplierSlice";
import type { Supplier, CreateSupplierDto, UpdateSupplierDto } from "../features/supplier/types";
import { useSocketSync } from "./useSocketSync";

export const useSuppliers = () => {
  const dispatch = useAppDispatch();
  const { suppliers, loading, error } = useAppSelector((state) => state.suppliers);

  useSocketSync<Supplier>("supplier", {
    created: supplierCreated,
    updated: supplierUpdated,
    deleted: supplierDeleted,
  });

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
