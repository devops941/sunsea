import { useState, useCallback } from "react";
import { productPricingService } from "../services/productPricingService";
import type { ProductPricing, CreateProductPricingDto, UpdateProductPricingDto } from "../features/product-pricing/types";

export const useProductPricing = () => {
  const [productPricings, setProductPricings] = useState<ProductPricing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProductPricings = useCallback(async (search: string = "") => {
    try {
      setLoading(true);
      setError(null);
      const data = await productPricingService.fetchAll(search);
      setProductPricings(data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to fetch product pricings");
    } finally {
      setLoading(false);
    }
  }, []);

  const addProductPricing = async (data: CreateProductPricingDto) => {
    try {
      setLoading(true);
      setError(null);
      const newPricing = await productPricingService.create(data);
      setProductPricings(prev => [newPricing, ...prev]);
      return newPricing;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to create product pricing";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const editProductPricing = async (id: number, data: UpdateProductPricingDto) => {
    try {
      setLoading(true);
      setError(null);
      const updatedPricing = await productPricingService.update(id, data);
      setProductPricings(prev => prev.map(p => (p.id === id ? updatedPricing : p)));
      return updatedPricing;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update product pricing";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const removeProductPricing = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await productPricingService.delete(id);
      setProductPricings(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to delete product pricing";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    productPricings,
    loading,
    error,
    loadProductPricings,
    addProductPricing,
    editProductPricing,
    removeProductPricing,
  };
};
