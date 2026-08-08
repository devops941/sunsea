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

/** Calculate working hours for a given shift object (startTime, endTime, breakDuration) */
export function calcShiftWorkingHours(
  shift: { startTime?: string; endTime?: string; breakDuration?: any } | null | undefined,
  fallback = 8
): number {
  if (!shift || !shift.startTime || !shift.endTime) return fallback;
  try {
    const parseMins = (t: string) => {
      const match = String(t).match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) return null;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ampm = match[3]?.toUpperCase();
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };

    const startMinutes = parseMins(shift.startTime);
    let endMinutes = parseMins(shift.endTime);
    if (startMinutes === null || endMinutes === null) return fallback;

    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60; // Overnight shift
    }

    let diffMinutes = endMinutes - startMinutes;
    if (shift.breakDuration) {
      const bMins = parseFloat(String(shift.breakDuration)) || 0;
      diffMinutes -= bMins;
    }

    if (diffMinutes <= 0) return fallback;
    const hrs = diffMinutes / 60;
    return Math.round(hrs * 100) / 100;
  } catch {
    return fallback;
  }
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
  const monthlyEquivalent = (dailyWage * 30);

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
    WORKING_DAYS: 'Working Days',
    FIXED_DAYS: 'Fixed Days',
  };
  return map[method] ?? method;
}
