import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchCategories, createCategory, updateCategory, deleteCategory, categoryCreated, categoryUpdated, categoryDeleted } from "../features/categories/categorySlice";
import type { Category, CreateCategoryDto, UpdateCategoryDto } from "../features/categories/types";
import { useSocketSync } from "./useSocketSync";

export const useCategories = () => {
  const dispatch = useAppDispatch();
  const { data: categories, loading, error } = useAppSelector((state) => state.categories);

  useSocketSync<Category>("category", {
    created: categoryCreated,
    updated: categoryUpdated,
    deleted: categoryDeleted,
  });

  const loadCategories = useCallback((args?: { search?: string; isActive?: boolean } | string) => {
    dispatch(fetchCategories(args ?? {}));
  }, [dispatch]);

  const addCategory = useCallback((data: CreateCategoryDto) => {
    return dispatch(createCategory(data)).unwrap();
  }, [dispatch]);

  const editCategory = useCallback((id: number, data: UpdateCategoryDto) => {
    return dispatch(updateCategory({ id, data })).unwrap();
  }, [dispatch]);

  const removeCategory = useCallback((id: number) => {
    return dispatch(deleteCategory(id)).unwrap();
  }, [dispatch]);

  return {
    categories,
    loading,
    error,
    loadCategories,
    addCategory,
    editCategory,
    removeCategory,
  };
};
