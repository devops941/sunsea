import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchColors, createColor, updateColor, deleteColor } from "../features/colors/colorSlice";
import type { CreateColorDto, UpdateColorDto } from "../features/colors/types";

export const useColors = () => {
  const dispatch = useAppDispatch();
  const { data: colors, loading, error } = useAppSelector((state) => state.colors);

  const loadColors = useCallback((args?: { search?: string; isActive?: boolean } | string) => {
    dispatch(fetchColors(args ?? {}));
  }, [dispatch]);

  const addColor = useCallback((data: CreateColorDto) => {
    return dispatch(createColor(data)).unwrap();
  }, [dispatch]);

  const editColor = useCallback((id: number, data: UpdateColorDto) => {
    return dispatch(updateColor({ id, data })).unwrap();
  }, [dispatch]);

  const removeColor = useCallback((id: number) => {
    return dispatch(deleteColor(id)).unwrap();
  }, [dispatch]);

  return {
    colors,
    loading,
    error,
    loadColors,
    addColor,
    editColor,
    removeColor,
  };
};
