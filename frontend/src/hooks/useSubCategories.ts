import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchSubCategories, createSubCategory, updateSubCategory, deleteSubCategory } from "../features/subCategories/subCategorySlice";
import type { FetchSubCategoriesParams } from "../features/subCategories/subCategorySlice";
import type { CreateSubCategoryDto, UpdateSubCategoryDto } from "../features/subCategories/types";

export const useSubCategories = () => {
  const dispatch = useAppDispatch();
  const { data: subCategories, loading, error } = useAppSelector((state) => state.subCategories);

  // Accepts { search?, categoryId? } so callers can filter by parent
  // category, free-text search, both, or neither — e.g.
  // loadSubCategories({ categoryId: formData.categoryId })
  const loadSubCategories = useCallback((params: FetchSubCategoriesParams = {}) => {
    dispatch(fetchSubCategories(params));
  }, [dispatch]);

  const addSubCategory = useCallback((data: CreateSubCategoryDto) => {
    return dispatch(createSubCategory(data)).unwrap();
  }, [dispatch]);

  const editSubCategory = useCallback((id: number, data: UpdateSubCategoryDto) => {
    return dispatch(updateSubCategory({ id, data })).unwrap();
  }, [dispatch]);

  const removeSubCategory = useCallback((id: number) => {
    return dispatch(deleteSubCategory(id)).unwrap();
  }, [dispatch]);

  return {
    subCategories,
    loading,
    error,
    loadSubCategories,
    addSubCategory,
    editSubCategory,
    removeSubCategory,
  };
};