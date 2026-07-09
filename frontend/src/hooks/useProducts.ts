import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import { fetchProducts, createProduct, updateProduct, deleteProduct } from "../features/product/productSlice";
import type { CreateProductDto, UpdateProductDto } from "../features/product/types";

export const useProducts = () => {
  const dispatch = useAppDispatch();
  const { products, loading, error } = useAppSelector((state) => state.products);

  const loadProducts = useCallback((search?: string) => {
    dispatch(fetchProducts(search));
  }, [dispatch]);

  const addProduct = useCallback(
    async (data: CreateProductDto) => {
      return await dispatch(createProduct(data)).unwrap();
    },
    [dispatch]
  );

  const editProduct = useCallback(
    async (id: string, data: UpdateProductDto) => {
      return await dispatch(updateProduct({ id, data })).unwrap();
    },
    [dispatch]
  );

  const removeProduct = useCallback(
    async (id: string) => {
      return await dispatch(deleteProduct(id)).unwrap();
    },
    [dispatch]
  );

  return {
    products,
    loading,
    error,
    loadProducts,
    addProduct,
    editProduct,
    removeProduct,
  };
};
