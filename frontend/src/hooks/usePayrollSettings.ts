import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './reduxHooks';
import {
  updateSettings, resetSettings,
  addOtSlab, removeOtSlab, updateOtSlab,
  addPermissionSlab, removePermissionSlab, updatePermissionSlab,
  addComponent, removeComponent, updateComponent,
} from '../features/payroll/payrollSettingsSlice';
import type { PayrollSettings, SlabEntry, SalaryComponent } from '../features/payroll/payrollTypes';

export const usePayrollSettings = () => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.payrollSettings);

  return {
    settings,
    updateSettings:       useCallback((s: Partial<PayrollSettings>) => dispatch(updateSettings(s)),       [dispatch]),
    resetSettings:        useCallback(() => dispatch(resetSettings()),                                    [dispatch]),
    addOtSlab:            useCallback((s: SlabEntry) => dispatch(addOtSlab(s)),                           [dispatch]),
    removeOtSlab:         useCallback((id: string) => dispatch(removeOtSlab(id)),                         [dispatch]),
    updateOtSlab:         useCallback((s: SlabEntry) => dispatch(updateOtSlab(s)),                        [dispatch]),
    addPermissionSlab:    useCallback((s: SlabEntry) => dispatch(addPermissionSlab(s)),                   [dispatch]),
    removePermissionSlab: useCallback((id: string) => dispatch(removePermissionSlab(id)),                 [dispatch]),
    updatePermissionSlab: useCallback((s: SlabEntry) => dispatch(updatePermissionSlab(s)),                [dispatch]),
    addComponent:         useCallback((c: SalaryComponent) => dispatch(addComponent(c)),                  [dispatch]),
    removeComponent:      useCallback((id: string) => dispatch(removeComponent(id)),                      [dispatch]),
    updateComponent:      useCallback((c: SalaryComponent) => dispatch(updateComponent(c)),               [dispatch]),
  };
};
