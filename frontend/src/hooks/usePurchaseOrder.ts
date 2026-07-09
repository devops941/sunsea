import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import {
  fetchPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from "../features/purchaseOrder/purchaseOrderSlice";
import type { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from "../features/purchaseOrder/types";

export const usePurchaseOrders = () => {
  const dispatch = useAppDispatch();
  const { purchaseOrders, loading, error } = useAppSelector(
    (state) => state.purchaseOrder
  );

  const loadPurchaseOrders = useCallback(() => {
    dispatch(fetchPurchaseOrders());
  }, [dispatch]);

  const addPurchaseOrder = useCallback(
    async (data: CreatePurchaseOrderDto) => {
      return await dispatch(createPurchaseOrder(data)).unwrap();
    },
    [dispatch]
  );

  const editPurchaseOrder = useCallback(
    async (id: string, data: UpdatePurchaseOrderDto) => {
      return await dispatch(updatePurchaseOrder({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removePurchaseOrder = useCallback(
    async (id: any) => {
      return await dispatch(deletePurchaseOrder(id)).unwrap();
    },
    [dispatch]
  );


  return {
    purchaseOrders,
    loading,
    error,
    loadPurchaseOrders,
    addPurchaseOrder,
    editPurchaseOrder,
    removePurchaseOrder,
  };
};