import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchUOMs, createUOM, updateUOM, deleteUOM, fetchActiveUOMs } from "../features/uoms/uomSlice";
import type { CreateUOMDto, UpdateUOMDto } from "../features/uoms/types";

export const useUOMs = () => {
  const dispatch = useAppDispatch();
  const { data: uoms, loading, error, activeData: activeUOMs,
    activeLoading,
    activeError,
  } = useAppSelector((state) => state.uoms);

  const loadUOMs = useCallback((search?: string) => {
    dispatch(fetchUOMs(search ?? ''));
  }, [dispatch]);

  const loadActiveUOMs = useCallback(() => {
    dispatch(fetchActiveUOMs());
  }, [dispatch]);

  const addUOM = useCallback((data: CreateUOMDto) => {
    return dispatch(createUOM(data)).unwrap();
  }, [dispatch]);

  const editUOM = useCallback((id: number, data: UpdateUOMDto) => {
    return dispatch(updateUOM({ id, data })).unwrap();
  }, [dispatch]);

  const removeUOM = useCallback((id: number) => {
    return dispatch(deleteUOM(id)).unwrap();
  }, [dispatch]);

  return {
    uoms,
    loading,
    error,
    loadUOMs,
    activeUOMs,
    activeLoading,
    activeError,
    loadActiveUOMs,
    addUOM,
    editUOM,
    removeUOM,
  };
};
