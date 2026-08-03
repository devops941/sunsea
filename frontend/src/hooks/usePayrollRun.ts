import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './reduxHooks';
import { setCurrentRun, addRun, updateRun, updateRunStatus } from '../features/payroll/payrollRunSlice';
import { MOCK_EMPLOYEES, MOCK_ATTENDANCE } from '../features/payroll/payrollRunSlice';
import { computeEmployeePayroll } from '../utils/payrollEngine';
import type { PayrollRun, SalaryType } from '../features/payroll/payrollTypes';

export const usePayrollRun = () => {
  const dispatch = useAppDispatch();
  const { runs, currentRun } = useAppSelector((state) => state.payrollRun);
  const settings = useAppSelector((state) => state.payrollSettings);

  /** Run the engine for the selected period and category. */
  const computePayroll = useCallback(
    (opts: { period: string; type: 'WEEKLY' | 'MONTHLY'; category: SalaryType | 'ALL'; calendarDays: number }) => {
      const { period, type, category, calendarDays } = opts;
      const employees = category === 'ALL'
        ? MOCK_EMPLOYEES
        : MOCK_EMPLOYEES.filter((e) => e.salaryType === category);

      const results = employees.map((emp) => {
        const att = MOCK_ATTENDANCE.find((a) => a.employeeId === emp.id && a.period === period)
          ?? { employeeId: emp.id, period, days: [] };
        return computeEmployeePayroll(emp, att, settings, calendarDays);
      });

      const run: PayrollRun = {
        id: `run-${Date.now()}`,
        period,
        type,
        status: 'DRAFT',
        employeeCategory: category,
        totalEmployees: results.length,
        totalNetSalary: results.reduce((s, r) => s + r.netSalary, 0),
        createdAt: new Date().toISOString(),
        results,
      };

      dispatch(addRun(run));
      dispatch(setCurrentRun(run));
      return run;
    },
    [dispatch, settings]
  );

  const approveRun = useCallback(
    (id: string) => dispatch(updateRunStatus({ id, status: 'APPROVED', timestamp: new Date().toISOString() })),
    [dispatch]
  );

  const lockRun = useCallback(
    (id: string) => dispatch(updateRunStatus({ id, status: 'LOCKED', timestamp: new Date().toISOString() })),
    [dispatch]
  );

  const previewRun = useCallback(
    (id: string) => dispatch(updateRunStatus({ id, status: 'PREVIEW', timestamp: new Date().toISOString() })),
    [dispatch]
  );

  const editRun = useCallback(
    (run: PayrollRun) => dispatch(updateRun(run)),
    [dispatch]
  );

  return { runs, currentRun, computePayroll, approveRun, lockRun, previewRun, editRun };
};
