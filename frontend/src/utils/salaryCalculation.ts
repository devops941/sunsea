// ============================================================
// Salary Calculation Engine — Single Source of Truth
// All salary derivations across every module must use these
// functions. Never duplicate this logic elsewhere.
// ============================================================

export interface PayrollCalcConfig {
  salaryCalculationMethod: 'CALENDAR_DAYS' | 'WORKING_DAYS' | 'FIXED_DAYS';
  fixedDays: number;
  defaultWorkingHoursPerDay: number;
  weeklyOffDays: number[]; // 0 = Sunday … 6 = Saturday
}

export interface SalaryDerivatives {
  dailyWage: number;
  hourlyWage: number;
  weeklyEquivalent: number;
  monthlyEquivalent: number;
}

// ── Config helpers ────────────────────────────────────────────────────────────

/** Working days per month derived from company payroll config. */
export function getMonthlyWorkingDays(cfg: PayrollCalcConfig): number {
  if (cfg.salaryCalculationMethod === 'FIXED_DAYS') {
    return cfg.fixedDays > 0 ? cfg.fixedDays : 26;
  }
  if (cfg.salaryCalculationMethod === 'CALENDAR_DAYS') {
    return 30;
  }
  // WORKING_DAYS: days/week × 52 weeks / 12 months
  const daysPerWeek = 7 - (cfg.weeklyOffDays?.length ?? 1);
  return Math.round((daysPerWeek * 52) / 12);
}

/** Working days per week derived from company payroll config. */
export function getWeeklyWorkingDays(cfg: PayrollCalcConfig): number {
  return 7 - (cfg.weeklyOffDays?.length ?? 1);
}

// ── Derivation functions ──────────────────────────────────────────────────────

/** Monthly → Daily / Hourly / Weekly */
export function deriveFromMonthly(
  monthlySalary: number,
  cfg: PayrollCalcConfig,
): SalaryDerivatives {
  const workingDays = getMonthlyWorkingDays(cfg);
  const hoursPerDay = cfg.defaultWorkingHoursPerDay || 8;
  const daysPerWeek = getWeeklyWorkingDays(cfg);

  const dailyWage = workingDays > 0 ? monthlySalary / workingDays : 0;
  const hourlyWage = hoursPerDay > 0 ? dailyWage / hoursPerDay : 0;
  const weeklyEquivalent = dailyWage * daysPerWeek;

  return { dailyWage, hourlyWage, weeklyEquivalent, monthlyEquivalent: monthlySalary };
}

/** Weekly → Daily / Hourly / Monthly */
export function deriveFromWeekly(
  weeklySalary: number,
  cfg: PayrollCalcConfig,
): SalaryDerivatives {
  const daysPerWeek = getWeeklyWorkingDays(cfg);
  const hoursPerDay = cfg.defaultWorkingHoursPerDay || 8;

  const dailyWage = daysPerWeek > 0 ? weeklySalary / daysPerWeek : 0;
  const hourlyWage = hoursPerDay > 0 ? dailyWage / hoursPerDay : 0;
  const monthlyEquivalent = (weeklySalary * 52) / 12;

  return { dailyWage, hourlyWage, weeklyEquivalent: weeklySalary, monthlyEquivalent };
}

/** Daily → Hourly / Weekly / Monthly */
export function deriveFromDaily(
  dailyWage: number,
  cfg: PayrollCalcConfig,
): SalaryDerivatives {
  const workingDays = getMonthlyWorkingDays(cfg);
  const daysPerWeek = getWeeklyWorkingDays(cfg);
  const hoursPerDay = cfg.defaultWorkingHoursPerDay || 8;

  const hourlyWage = hoursPerDay > 0 ? dailyWage / hoursPerDay : 0;
  const weeklyEquivalent = dailyWage * daysPerWeek;
  const monthlyEquivalent = dailyWage * workingDays;

  return { dailyWage, hourlyWage, weeklyEquivalent, monthlyEquivalent };
}

/** Hourly → Daily / Weekly / Monthly */
export function deriveFromHourly(
  hourlyWage: number,
  cfg: PayrollCalcConfig,
): SalaryDerivatives {
  const hoursPerDay = cfg.defaultWorkingHoursPerDay || 8;
  const workingDays = getMonthlyWorkingDays(cfg);
  const daysPerWeek = getWeeklyWorkingDays(cfg);

  const dailyWage = hourlyWage * hoursPerDay;
  const weeklyEquivalent = dailyWage * daysPerWeek;
  const monthlyEquivalent = dailyWage * workingDays;

  return { dailyWage, hourlyWage, weeklyEquivalent, monthlyEquivalent };
}

// ── Formatter ─────────────────────────────────────────────────────────────────

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Human-readable label for the calculation method */
export function calcMethodLabel(method: string): string {
  const map: Record<string, string> = {
    CALENDAR_DAYS: 'Calendar Days (30)',
    WORKING_DAYS:  'Working Days',
    FIXED_DAYS:    'Fixed Days',
  };
  return map[method] ?? method;
}
