import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchSizes, createSize, updateSize, deleteSize } from "../features/sizes/sizeSlice";
import type { CreateSizeDto, UpdateSizeDto } from "../features/sizes/types";

export const useSizes = () => {
  const dispatch = useAppDispatch();
  const { data: sizes, loading, error } = useAppSelector((state) => state.sizes);

  const loadSizes = useCallback((args?: { search?: string; isActive?: boolean } | string) => {
    dispatch(fetchSizes(args ?? {}));
  }, [dispatch]);

  const addSize = useCallback((data: CreateSizeDto) => {
    return dispatch(createSize(data)).unwrap();
  }, [dispatch]);

  const editSize = useCallback((id: number, data: UpdateSizeDto) => {
    return dispatch(updateSize({ id, data })).unwrap();
  }, [dispatch]);

  const removeSize = useCallback((id: number) => {
    return dispatch(deleteSize(id)).unwrap();
  }, [dispatch]);

  return {
    sizes,
    loading,
    error,
    loadSizes,
    addSize,
    editSize,
    removeSize,
  };
};
