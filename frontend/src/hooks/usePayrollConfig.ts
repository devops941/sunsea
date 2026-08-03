import { useState, useEffect } from 'react';
import { payrollService, type ApiPayrollConfig } from '../services/payrollService';

// Sensible defaults used when the API is unreachable (e.g. first-time setup)
const DEFAULT_CONFIG: ApiPayrollConfig = {
  id: 0,
  companyId: '',
  dailySalaryFormula: 'MONTHLY_BY_WORKING',
  salaryCalculationMethod: 'WORKING_DAYS',
  fixedDays: 26,
  defaultWorkingHoursPerDay: 8,
  weeklyOffDays: [0], // Sunday off by default
  otEnabled: false,
  otMethod: 'HOURLY_RATE',
  otRatePerHour: 0,
  weekdayOtMultiplier: 1.5,
  holidayOtMultiplier: 2,
  weeklyOffOtMultiplier: 2,
  maxOtHoursPerDay: 4,
  maxOtHoursPerWeek: 20,
  otSlabs: [],
  pfEnabled: false,
  pfWageFormula: 'BASIC',
  employeePfPercent: 12,
  employerPfPercent: 13,
  maxPfWage: 15000,
  pfRoundingRule: 'ROUND',
  esiEnabled: false,
  employeeEsiPercent: 0.75,
  employerEsiPercent: 3.25,
  maxEsiSalary: 21000,
  esiRoundingRule: 'ROUND',
  paidLeavePerYear: 12,
  lateEntryGraceMinutes: 5,
  lateEntrySlabs: [],
  permissionSlabs: [],
  professionalTaxEnabled: false,
  professionalTaxAmount: 0,
  components: [],
  roundingRule: 'ROUND',
  decimalPrecision: 2,
};

export interface UsePayrollConfigResult {
  config: ApiPayrollConfig;
  loading: boolean;
  configError: string | null;
}

/**
 * Fetches and caches the company-level PayrollConfig from the API.
 * Falls back to DEFAULT_CONFIG when the API is unavailable so that
 * salary calculations still work during employee creation.
 */
export function usePayrollConfig(): UsePayrollConfigResult {
  const [config, setConfig] = useState<ApiPayrollConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await payrollService.getConfig();
        if (!cancelled && data) setConfig(data);
      } catch {
        if (!cancelled) {
          setConfigError('Payroll config unavailable — using default calculation values.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { config, loading, configError };
}
