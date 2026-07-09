import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchDesignations, createDesignation, updateDesignation, deleteDesignation } from "../features/designations/designationSlice";
import type { CreateDesignationDto, UpdateDesignationDto } from "../features/designations/types";

export const useDesignations = () => {
  const dispatch = useAppDispatch();
  const { data: designations, loading, error } = useAppSelector((state) => state.designations);

  const loadDesignations = useCallback(
    (departmentId?: number) => {
      dispatch(
        fetchDesignations(departmentId)
      );
    },
    [dispatch]
  );

  const addDesignation = useCallback(
    async (data: CreateDesignationDto) => {
      return await dispatch(createDesignation(data)).unwrap();
    },
    [dispatch]
  );

  const editDesignation = useCallback(
    async (id: number, data: UpdateDesignationDto) => {
      return await dispatch(updateDesignation({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removeDesignation = useCallback(
    async (id: number) => {
      return await dispatch(deleteDesignation(id)).unwrap();
    },
    [dispatch]
  );

  return {
    designations,
    loading,
    error,
    loadDesignations,
    addDesignation,
    editDesignation,
    removeDesignation,
  };
};
