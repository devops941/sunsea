import { useState, useEffect, useCallback } from 'react';
import { customerGradeService, type CreateCustomerGradeInput, type CustomerGrade } from '../services/customerGradeService';
import { toast } from 'react-toastify';

export const useCustomerGrades = () => {
  const [customerGrades, setCustomerGrades] = useState<CustomerGrade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<any>(null);

  const fetchCustomerGrades = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await customerGradeService.getAll();
      setCustomerGrades(data || []);
    } catch (err: any) {
      setError(err);
      toast.error('Failed to load customer grades');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomerGrades();
  }, [fetchCustomerGrades]);

  const createCustomerGrade = async (data: CreateCustomerGradeInput) => {
    setIsCreating(true);
    try {
      const newGrade = await customerGradeService.create(data);
      setCustomerGrades((prev) => [...prev, newGrade].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Customer grade created successfully');
      return newGrade;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create customer grade');
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const updateCustomerGrade = async ({ id, data }: { id: number; data: CreateCustomerGradeInput }) => {
    setIsUpdating(true);
    try {
      const updatedGrade = await customerGradeService.update(id, data);
      setCustomerGrades((prev) => prev.map((g) => (g.id === id ? updatedGrade : g)).sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Customer grade updated successfully');
      return updatedGrade;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update customer grade');
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteCustomerGrade = async (id: number) => {
    try {
      await customerGradeService.delete(id);
      setCustomerGrades((prev) => prev.filter((g) => g.id !== id));
      toast.success('Customer grade deleted successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete customer grade');
      throw err;
    }
  };

  return {
    customerGrades,
    isLoading,
    error,
    createCustomerGrade,
    updateCustomerGrade,
    deleteCustomerGrade,
    isCreating,
    isUpdating,
  };
};
