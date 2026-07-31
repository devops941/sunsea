import { useState, useEffect } from "react";
import { uomService } from "../services/uomService";

export interface DynamicUnit {
  code: string;
  label: string;
  category: string;
}

// Global cache objects to reuse fetched UOM data across standard pages
let categoriesCache: string[] | null = null;
let unitsCache: DynamicUnit[] | null = null;
let categoriesPromise: Promise<string[]> | null = null;
let unitsPromise: Promise<DynamicUnit[]> | null = null;

import { usePermission } from "./usePermission";

export const useUOM = () => {
  const [categories, setCategories] = useState<string[]>(categoriesCache || []);
  const [units, setUnits] = useState<DynamicUnit[]>(unitsCache || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { can } = usePermission();

  const fetchAllUomData = async (forceRetry = false) => {
    setLoading(true);
    setError(null);
    try {
      if (forceRetry) {
        categoriesCache = null;
        unitsCache = null;
        categoriesPromise = null;
        unitsPromise = null;
      }

      if (!categoriesCache) {
        if (!categoriesPromise) {
          categoriesPromise = uomService.fetchDynamicCategories();
        }
        categoriesCache = await categoriesPromise;
      }

      if (!unitsCache) {
        if (!unitsPromise) {
          unitsPromise = uomService.fetchDynamicUnits();
        }
        unitsCache = await unitsPromise;
      }

      setCategories(categoriesCache);
      setUnits(unitsCache);
    } catch (err: any) {
      setError(err?.message || "Failed to load UOM metadata");
      categoriesPromise = null;
      unitsPromise = null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (can("uoms.view") && (categories.length === 0 || units.length === 0)) {
      fetchAllUomData();
    }
  }, [categories.length, units.length, can]);

  return {
    categories,
    units,
    loading,
    error,
    retry: () => fetchAllUomData(true),
  };
};
