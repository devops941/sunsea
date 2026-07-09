import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import {
  fetchRawMaterialCategories,
  createRawMaterialCategory,
  updateRawMaterialCategory,
  deleteRawMaterialCategory,
} from "../features/raw-material-categories/rawMaterialCategorySlice";
import type { CreateRawMaterialCategoryDto, UpdateRawMaterialCategoryDto } from "../features/raw-material-categories/types";

export const useRawMaterialCategories = () => {
  const dispatch = useAppDispatch();
  const {
    data: rawMaterialCategories,
    totalPages,
    loading,
    error,
  } = useAppSelector((state) => state.rawMaterialCategories);
  const loadCategories = useCallback(
    (params?: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    }) => {
      dispatch(fetchRawMaterialCategories(params));
    },
    [dispatch]
  );
  const addCategory = useCallback((data: CreateRawMaterialCategoryDto) => {
    return dispatch(createRawMaterialCategory(data)).unwrap();
  }, [dispatch]);

  const editCategory = useCallback((id: number, data: UpdateRawMaterialCategoryDto) => {
    return dispatch(updateRawMaterialCategory({ id, data })).unwrap();
  }, [dispatch]);

  const removeCategory = useCallback((id: number) => {
    return dispatch(deleteRawMaterialCategory(id)).unwrap();
  }, [dispatch]);

  return {
    rawMaterialCategories,
    totalPages,
    loading,
    error,
    loadCategories,
    addCategory,
    editCategory,
    removeCategory,
  };
};
