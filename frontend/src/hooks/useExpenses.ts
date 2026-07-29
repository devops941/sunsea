import { useState, useCallback } from "react";
import apiClient from "../api/apiClient";

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadExpenses = useCallback(async (params?: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/expenses", {
        params: typeof params === "string" ? { search: params } : params,
      });
      if (response.data && response.data.success) {
        const resData = response.data.data;
        if (resData && typeof resData === "object" && "data" in resData) {
          setExpenses(resData.data || []);
          setTotal(resData.total || 0);
        } else {
          setExpenses(resData || []);
          setTotal(Array.isArray(resData) ? resData.length : 0);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  const addExpense = useCallback(async (data: any) => {
    setError(null);
    try {
      const response = await apiClient.post("/expenses", data);
      if (response.data && response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data?.message || "Failed to create expense");
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message);
    }
  }, []);

  const editExpense = useCallback(async (id: string, data: any) => {
    setError(null);
    try {
      const response = await apiClient.put(`/expenses/${id}`, data);
      if (response.data && response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data?.message || "Failed to update expense");
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message);
    }
  }, []);

  const removeExpense = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await apiClient.delete(`/expenses/${id}`);
      if (response.data && response.data.success) {
        return true;
      }
      throw new Error(response.data?.message || "Failed to delete expense");
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message);
    }
  }, []);

  const fetchNextExpenseCode = useCallback(async () => {
    try {
      const response = await apiClient.get("/expenses/next-code");
      if (response.data && response.data.success) {
        return response.data.data;
      }
    } catch (err) {
      console.error("Error fetching next expense code:", err);
    }
    return "";
  }, []);

  return {
    expenses,
    loading,
    error,
    total,
    loadExpenses,
    addExpense,
    editExpense,
    removeExpense,
    fetchNextExpenseCode,
  };
};
