import { useState, useEffect, useCallback } from 'react';
import { customerTypeService, type CreateCustomerTypeInput, type CustomerType } from '../services/customerTypeService';
import { toast } from 'react-toastify';

export const useCustomerTypes = () => {
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<any>(null);

  const fetchCustomerTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await customerTypeService.getAll();
      setCustomerTypes(data || []);
    } catch (err: any) {
      setError(err);
      toast.error('Failed to load customer types');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomerTypes();
  }, [fetchCustomerTypes]);

  const createCustomerType = async (data: CreateCustomerTypeInput) => {
    setIsCreating(true);
    try {
      const newType = await customerTypeService.create(data);
      setCustomerTypes((prev) => [...prev, newType].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Customer type created successfully');
      return newType;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create customer type');
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const updateCustomerType = async ({ id, data }: { id: number; data: CreateCustomerTypeInput }) => {
    setIsUpdating(true);
    try {
      const updatedType = await customerTypeService.update(id, data);
      setCustomerTypes((prev) => prev.map((t) => (t.id === id ? updatedType : t)).sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Customer type updated successfully');
      return updatedType;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update customer type');
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteCustomerType = async (id: number) => {
    try {
      await customerTypeService.delete(id);
      setCustomerTypes((prev) => prev.filter((t) => t.id !== id));
      toast.success('Customer type deleted successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete customer type');
      throw err;
    }
  };

  return {
    customerTypes,
    isLoading,
    error,
    createCustomerType,
    updateCustomerType,
    deleteCustomerType,
    isCreating,
    isUpdating,
  };
};
