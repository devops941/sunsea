import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchCategories, createCategory, updateCategory, deleteCategory } from "../features/categories/categorySlice";
import type { CreateCategoryDto, UpdateCategoryDto } from "../features/categories/types";

export const useCategories = () => {
  const dispatch = useAppDispatch();
  const { data: categories, loading, error } = useAppSelector((state) => state.categories);

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
