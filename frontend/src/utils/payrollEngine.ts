/**
 * Payroll Calculation Engine — pure functions, settings-injected, no side effects.
 * All business formulas read from PayrollSettings; no hardcoded constants.
 */
import type {
  PayrollSettings,
  PayrollEmployee,
  EmployeeAttendance,
  PayrollResult,
  SlabEntry,
  AttendanceStatus,
} from '../features/payroll/payrollTypes';

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

/** Round a number using the configured rule at a given decimal precision. */
export function applyRounding(
  value: number,
  rule: 'ROUND' | 'FLOOR' | 'CEILING',
  precision = 0
): number {
  const factor = Math.pow(10, precision);
  switch (rule) {
    case 'FLOOR': return Math.floor(value * factor) / factor;
    case 'CEILING': return Math.ceil(value * factor) / factor;
    case 'ROUND':
    default: return Math.round(value * factor) / factor;
  }
}

/** Count attendance records matching a given status. */
export function countDays(
  days: { status: AttendanceStatus }[],
  status: AttendanceStatus
): number {
  return days.filter((d) => d.status === status).length;
}

/**
 * Look up the slab amount for a given number of minutes.
 * A slab matches when fromMinutes <= minutes <= toMinutes.
 * When toMinutes = 0, it means "and above" (open-ended upper bound).
 * Returns 0 if no slab matches.
 */
export function lookupSlab(minutes: number, slabs: SlabEntry[]): number {
  const match = slabs.find(
    (s) => minutes >= s.fromMinutes && (s.toMinutes === 0 || minutes <= s.toMinutes)
  );
  return match ? match.amount : 0;
}

// ──────────────────────────────────────────────
// Core Computation Functions
// ──────────────────────────────────────────────

/**
 * Compute daily rate based on the configured formula.
 *
 * MONTHLY_BY_CALENDAR : monthlySalary ÷ calendarDays
 * MONTHLY_BY_WORKING  : monthlySalary ÷ workingDays (calendar days – weekly-offs – holidays)
 * FIXED_DAILY         : employee.dailySalary (used for DAILY_WEEKLY type)
 */
export function computeDailyRate(
  employee: PayrollEmployee,
  settings: PayrollSettings,
  calendarDays: number,
  workingDays: number
): { dailyRate: number; formulaDivisor: number } {
  const { monthlySalary, dailySalary: dailySalaryStored, salaryType } = employee;
  const calDaysForFormula = calendarDays;
  const workingDaysPerMonth = workingDays;
  let dailyRate = 0;
  let formulaDivisor = 1;

  const st = salaryType?.toUpperCase() || '';

  if (st === 'DAILY' || st === 'DAILY_WEEKLY') {
    if (settings.dailySalaryFormula === 'FIXED_DAILY' || monthlySalary === 0) {
      dailyRate = dailySalaryStored ?? monthlySalary ?? 0;
      formulaDivisor = 1;
    } else if (settings.dailySalaryFormula === 'MONTHLY_BY_CALENDAR') {
      formulaDivisor = calDaysForFormula > 0 ? calDaysForFormula : 30;
      dailyRate = monthlySalary / formulaDivisor;
    } else {
      formulaDivisor = workingDaysPerMonth > 0 ? workingDaysPerMonth : 26;
      dailyRate = monthlySalary / formulaDivisor;
    }
  } else if (st === 'WEEKLY') {
    // If the salary is weekly, the monthlySalary field actually holds the weekly gross salary
    // The weekly salary is divided by 6 working days (Sunday is weekly off).
    formulaDivisor = 6;
    dailyRate = monthlySalary / formulaDivisor;
  } else {
    // MONTHLY
    if (settings.dailySalaryFormula === 'MONTHLY_BY_CALENDAR') {
      formulaDivisor = calDaysForFormula > 0 ? calDaysForFormula : 30;
      dailyRate = monthlySalary / formulaDivisor;
    } else {
      formulaDivisor = workingDaysPerMonth > 0 ? workingDaysPerMonth : 26;
      dailyRate = monthlySalary / formulaDivisor;
    }
  }
  return { dailyRate, formulaDivisor };
}

/**
 * Compute OT pay for the given OT hours.
 *
 * HOURLY_RATE      : otHours × otRatePerHour × multiplier
 * FIXED_AMOUNT     : otRatePerHour × multiplier (flat per OT event)
 * PERCENTAGE_DAILY : dailyRate × (otHours / standardHours) × multiplier
 * SLAB             : lookupSlab(otMinutes, otSlabs) × multiplier
 *
 * Multiplier priority: holiday > weeklyOff > weekday.
 */
export function computeOtPay(
  otHours: number,
  dailyRate: number,
  settings: PayrollSettings,
  isHoliday = false,
  isWeeklyOff = false
): number {
  if (!settings.otEnabled || otHours <= 0) return 0;

  const clampedHours = Math.min(otHours, settings.maxOtHoursPerDay);
  const multiplier = isHoliday
    ? settings.holidayOtMultiplier
    : isWeeklyOff
      ? settings.weeklyOffOtMultiplier
      : settings.weekdayOtMultiplier;

  switch (settings.otMethod) {
    case 'HOURLY_RATE':
      return clampedHours * settings.otRatePerHour;
    case 'FIXED_AMOUNT':
      return settings.otRatePerHour;
    case 'PERCENTAGE_DAILY': {
      const hoursInDay = settings.defaultWorkingHoursPerDay || 8;
      return dailyRate * (clampedHours / hoursInDay) * multiplier;
    }
    case 'SLAB':
      return lookupSlab(clampedHours * 60, settings.otSlabs);
    default:
      return 0;
  }
}

/**
 * Compute late entry deduction using the lateEntrySlabs table.
 * If total late minutes across the period exceed the grace window, look up the slab amount.
 */
export function computeLateEntryDeduction(
  lateMinutes: number,
  settings: PayrollSettings
): number {
  if (lateMinutes <= settings.lateEntryGraceMinutes) return 0;
  return lookupSlab(lateMinutes, settings.lateEntrySlabs);
}

/**
 * Compute permission deduction using the slab table.
 * All permission minutes across the period are summed, then looked up in one slab entry.
 */
export function computePermissionDeduction(
  permissionMinutes: number,
  settings: PayrollSettings
): number {
  if (permissionMinutes <= 0) return 0;
  return lookupSlab(permissionMinutes, settings.permissionSlabs);
}

/**
 * Compute PF contributions (employee + employer).
 * PF wage is capped at settings.maxPfWage.
 * Results are rounded per pfRoundingRule.
 */
export function computePf(
  pfWage: number,
  settings: PayrollSettings
): { employeePf: number; employerPf: number } {
  if (!settings.pfEnabled) return { employeePf: 0, employerPf: 0 };
  const cappedWage = Math.min(pfWage, settings.maxPfWage);
  return {
    employeePf: applyRounding(
      (cappedWage * settings.employeePfPercent) / 100,
      settings.pfRoundingRule
    ),
    employerPf: applyRounding(
      (cappedWage * settings.employerPfPercent) / 100,
      settings.pfRoundingRule
    ),
  };
}

/**
 * Compute ESI contributions.
 * ESI is only applicable when grossSalary <= maxEsiSalary.
 */
export function computeEsi(
  grossSalary: number,
  settings: PayrollSettings
): { employeeEsi: number; employerEsi: number; applicable: boolean } {
  if (!settings.esiEnabled || grossSalary > settings.maxEsiSalary) {
    return { employeeEsi: 0, employerEsi: 0, applicable: false };
  }
  return {
    employeeEsi: applyRounding(
      (grossSalary * settings.employeeEsiPercent) / 100,
      settings.esiRoundingRule
    ),
    employerEsi: applyRounding(
      (grossSalary * settings.employerEsiPercent) / 100,
      settings.esiRoundingRule
    ),
    applicable: true,
  };
}

// ──────────────────────────────────────────────
// Main Calculation  (one employee, one period)
// ──────────────────────────────────────────────

/**
 * Compute the full payroll result for one employee for a period.
 *
 * Steps:
 *  1. Count attendance day types
 *  2. Compute daily rate from formula
 *  3. Compute paid days (present + 0.5×half + paidLeave + weeklyOff + holiday)
 *  4. Compute gross salary (basic + DA + HRA + other)
 *  5. Earned salary = grossSalary × paidDays / totalDays
 *  6. Aggregate OT pay across all days
 *  7. Permission deduction from slab (aggregate minutes)
 *  8. PF on pfWage (basic or gross) — only for PF-eligible salary types
 *  9. ESI on earnedSalary + otPay — auto-disables above ceiling
 * 10. Professional tax if enabled
 * 11. Net = earnedSalary + otPay − all deductions
 * 12. Apply global rounding rule
 */
export function computeEmployeePayroll(
  employee: PayrollEmployee,
  attendance: EmployeeAttendance,
  settings: PayrollSettings,
  calendarDays: number,
  salaryAdvanceAmount = 0
): PayrollResult {
  const { days } = attendance;

  // 1. Attendance counts
  const weeklyOffCount = countDays(days, 'WEEKLY_OFF');
  const holidayCount = countDays(days, 'HOLIDAY');
  const presentDays = countDays(days, 'PRESENT');
  const absentDays = countDays(days, 'ABSENT');
  const halfDays = countDays(days, 'HALF_DAY');
  const paidLeaveDays = countDays(days, 'LEAVE_PAID');
  const unpaidLeaveDays = countDays(days, 'LEAVE_UNPAID');
  const lopDays = absentDays + unpaidLeaveDays;
  const paidDays = presentDays + halfDays * 0.5 + paidLeaveDays + weeklyOffCount + holidayCount;
  const totalDays = days.length || calendarDays;

  // 2. Daily rate
  const workingDays = calendarDays - weeklyOffCount - holidayCount;
  const { dailyRate } = computeDailyRate(employee, settings, calendarDays, workingDays);

  // 3. Gross salary & earned salary — each salary type has its own formula
  const st = employee.salaryType?.toUpperCase() || '';
  const isWeekly = st === 'WEEKLY';

  let grossSalary: number;
  let earnedSalary: number;

  const initialCashInHand = Number(employee.cashInHand) || 0;
  const dailyCashRate = (initialCashInHand > 0 && totalDays > 0)
    ? initialCashInHand / totalDays
    : 0;
  let earnedCashInHand = initialCashInHand;

  if (isWeekly) {
    // WEEKLY: monthlySalary field stores the weekly gross salary (e.g. ₹5,000/week).
    grossSalary = employee.monthlySalary;
    earnedSalary = applyRounding(
      dailyRate * paidDays,
      settings.roundingRule,
      settings.decimalPrecision
    );
    earnedCashInHand = applyRounding(
      dailyCashRate * paidDays,
      settings.roundingRule,
      settings.decimalPrecision
    );
  } else {
    // MONTHLY: gross = sum of salary components, prorated by paid days / total days
    const { basicSalary, da, hra, otherAllowance } = employee;
    grossSalary = basicSalary + da + hra + otherAllowance;
    earnedSalary = applyRounding(
      totalDays > 0 ? (grossSalary * paidDays) / totalDays : 0,
      settings.roundingRule,
      settings.decimalPrecision
    );
    earnedCashInHand = applyRounding(
      totalDays > 0 ? (initialCashInHand * paidDays) / totalDays : 0,
      settings.roundingRule,
      settings.decimalPrecision
    );
  }

  // 5. OT + permission + late entry (Office Staff vs. Labour Rules)
  let totalOtHours = 0;
  let totalOtPay = 0;
  let totalPermMin = 0;
  let totalLateMin = 0;

  for (const day of days) {
    const isHoliday = day.status === 'HOLIDAY';
    const isWeeklyOff = day.status === 'WEEKLY_OFF';
    totalOtHours += Math.min(day.otHours, settings.maxOtHoursPerDay);
    totalOtPay += computeOtPay(day.otHours, dailyRate, settings, isHoliday, isWeeklyOff);
    totalPermMin += day.permissionMinutes;
    totalLateMin += day.lateMinutes;
  }

  totalOtHours = Math.min(totalOtHours, settings.maxOtHoursPerWeek);
  totalOtPay = applyRounding(totalOtPay, settings.roundingRule, settings.decimalPrecision);

  let lateEntryDeduction = 0;
  let permissionDeduction = 0;

  const empCat = String(employee.employeeCategory || (employee as any).category || '').toLowerCase();
  const isDailyWeeklyType = ['DAILY_WEEKLY', 'WEEKLY'].includes(employee.salaryType || '');
  const isOfficeStaff = !isDailyWeeklyType && (empCat === 'office_staff' || !empCat);

  if (isOfficeStaff) {
    // ── OFFICE STAFF RULE ──
    // 1. Late minutes pool with permission minutes.
    // 2. Free permission pool per period (configurable, default 240 minutes = 4 hrs).
    // 3. Excess time beyond free pool deducted in 1-hour chunks at configurable rate (default ₹50/hr).
    // 4. Late entry slab deduction is bypassed (₹0).
    const freeMins = Number(settings.staffPermissionFreeMinutes ?? 240);
    const hourlyRate = Number(settings.staffExcessHourlyRate ?? 50);
    const totalPooledMinutes = totalPermMin + totalLateMin;
    const excessMinutes = Math.max(0, totalPooledMinutes - freeMins);
    const excessHours = Math.ceil(excessMinutes / 60);
    permissionDeduction = excessHours * hourlyRate;
    lateEntryDeduction = 0;
  } else {
    // ── LABOUR RULE ──
    // 1. Daily grace time (configurable, default 10 min).
    // 2. Late arrivals > grace time deducted via slabs.
    // 3. Permission deduction follows standard permission slabs.
    const graceMins = Number(settings.lateEntryGraceMinutes ?? 10);
    const hasSlabs = settings.lateEntrySlabs?.length > 0;
    let totalLateDeduction = 0;
    for (const day of days) {
      if (day.lateMinutes > graceMins) {
        const slabAmount = hasSlabs ? lookupSlab(day.lateMinutes, settings.lateEntrySlabs) : 0;
        if (slabAmount > 0) {
          totalLateDeduction += slabAmount;
        } else {
          // No matching slab or no slabs configured — use per-minute rate
          const lateRate = dailyRate / ((settings.standardWorkingHours || 8) * 60);
          totalLateDeduction += (day.lateMinutes - graceMins) * lateRate;
        }
      }
    }
    lateEntryDeduction = applyRounding(
      totalLateDeduction,
      settings.roundingRule,
      settings.decimalPrecision
    );
    permissionDeduction = applyRounding(
      computePermissionDeduction(totalPermMin, settings),
      settings.roundingRule,
      settings.decimalPrecision
    );
  }

  // 6. PF — only for PF-eligible salary types (60% of gross bank salary)
  const pfEligible = employee.salaryType === 'PF_MONTHLY' || employee.salaryType === 'FIXED_MONTHLY';
  const grossForPf = earnedSalary + totalOtPay;
  const pfWageBase = settings.pfWageFormula === 'BASIC' && employee.basicSalary > 0
    ? (employee.basicSalary * paidDays) / (totalDays || 1)
    : Math.round(grossForPf * 0.60);
  const pfWageRaw = Math.min(pfWageBase, settings.maxPfWage);
  const pfWage = applyRounding(pfWageRaw, settings.pfRoundingRule);
  const { employeePf, employerPf } = pfEligible && settings.pfEnabled
    ? computePf(pfWage, settings)
    : { employeePf: 0, employerPf: 0 };
  const pfApplicable = pfEligible && settings.pfEnabled;

  // 7. ESI (0.75% of gross bank salary)
  const grossForEsi = earnedSalary + totalOtPay;
  const { employeeEsi, employerEsi, applicable: esiApplicable } = computeEsi(grossForEsi, settings);

  // 8. Professional tax
  const professionalTax = settings.professionalTaxEnabled ? settings.professionalTaxAmount : 0;

  // 9. Deduction Separation & Net
  let bankNet = 0;
  let finalCashInHand = 0;
  let totalDeductions = 0;

  const isWeeklySalary = ['DAILY_WEEKLY', 'DAILY', 'WEEKLY'].includes(st);
  const isRoundOffApplicable = !isWeekly && !isWeeklySalary;

  if (initialCashInHand > 0 && pfApplicable) {
    // PF Applicable employee with Cash in Hand:
    const bankDeductions = employeePf + employeeEsi + professionalTax;
    const cashDeductions = salaryAdvanceAmount + lateEntryDeduction + permissionDeduction;

    // Bank salary transfer is NEVER affected by cash round off (exact rupees)
    bankNet = Math.round(Math.max(0, earnedSalary + totalOtPay - bankDeductions));
    const rawCash = Math.round(Math.max(0, earnedCashInHand - cashDeductions));
    finalCashInHand = isRoundOffApplicable ? (Math.ceil(rawCash / 10) * 10) : rawCash;
    totalDeductions = bankDeductions + cashDeductions;
  } else {
    // Standard employee: all deductions apply against gross
    const standardDeductions = employeePf + employeeEsi + professionalTax + lateEntryDeduction + permissionDeduction + salaryAdvanceAmount;
    totalDeductions = standardDeductions;
    const rawNet = earnedSalary + totalOtPay - standardDeductions;
    const clampedNet = isWeekly ? rawNet : Math.max(0, rawNet);

    const isBankMode = employee.paymentMode === 'BANK' && !pfApplicable && initialCashInHand === 0;
    if (isBankMode) {
      bankNet = Math.round(clampedNet);
      finalCashInHand = 0;
    } else {
      bankNet = 0;
      const rawCash = Math.round(clampedNet);
      finalCashInHand = isRoundOffApplicable ? (Math.ceil(rawCash / 10) * 10) : rawCash;
    }
  }

  const netSalary = bankNet + finalCashInHand;

  // 10. Variance: only meaningful for monthly salary types
  const hasVariance = !isWeekly && employee.monthlySalary > 0
    && Math.abs(netSalary - employee.monthlySalary) / employee.monthlySalary > 0.2;

  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: employee.name,
    department: employee.department,
    salaryType: employee.salaryType,
    totalDays,
    presentDays,
    absentDays,
    lopDays,
    halfDays,
    paidLeaveDays,
    weeklyOffDays: weeklyOffCount,
    holidayDays: holidayCount,
    dailyRate,
    basicSalary: applyRounding((employee.basicSalary * paidDays) / (totalDays || 1), settings.roundingRule, settings.decimalPrecision),
    da: applyRounding((employee.da * paidDays) / (totalDays || 1), settings.roundingRule, settings.decimalPrecision),
    hra: applyRounding((employee.hra * paidDays) / (totalDays || 1), settings.roundingRule, settings.decimalPrecision),
    otherAllowance: applyRounding((employee.otherAllowance * paidDays) / (totalDays || 1), settings.roundingRule, settings.decimalPrecision),
    grossSalary,
    earnedSalary,
    otHours: totalOtHours,
    otPay: totalOtPay,
    incentive: 0,
    pfWage,
    employeePf,
    employerPf,
    employeeEsi,
    employerEsi,
    pfApplicable,
    esiApplicable,
    professionalTax,
    lateEntryDeduction,
    permissionDeduction,
    salaryAdvance: salaryAdvanceAmount,
    loanRecovery: 0,
    otherDeductions: 0,
    totalDeductions,
    netSalary,
    cashInHand: finalCashInHand,
    paymentMode: (employee.salaryType === 'CASH_MONTHLY' || employee.salaryType === 'DAILY_WEEKLY') ? 'CASH' : 'BANK',
    hasVariance,
    varianceNote: hasVariance ? `Net ₹${netSalary} deviates >20% from monthly salary ₹${employee.monthlySalary}` : undefined,
  };
}
