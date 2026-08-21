import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../app/store";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../features/categories/categorySlice";
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  FetchCategoriesParams,
} from "../features/categories/types";

export const useCategories = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error, total, page, totalPages } = useSelector(
    (state: RootState) => state.categories
  );

  const loadCategories = useCallback(
    (params?: FetchCategoriesParams) => {
      dispatch(fetchCategories(params));
    },
    [dispatch]
  );

  const addCategory = useCallback(
    async (data: CreateCategoryDto) => {
      return await dispatch(createCategory(data)).unwrap();
    },
    [dispatch]
  );

  const editCategory = useCallback(
    async (id: number, data: UpdateCategoryDto) => {
      return await dispatch(updateCategory({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removeCategory = useCallback(
    async (id: number) => {
      return await dispatch(deleteCategory(id)).unwrap();
    },
    [dispatch]
  );

  return {
    categories: data,
    loading,
    error,
    total,
    page,
    totalPages,
    loadCategories,
    addCategory,
    editCategory,
    removeCategory,
  };
};
