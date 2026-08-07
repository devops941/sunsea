import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { getIO } from '../../socket/socket';

/** Convert a period string (YYYY-MM or YYYY-Www) to a date range { start, end } in YYYY-MM-DD */
function periodToDateRange(period: string): { start: string; end: string } {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, '0')}` };
  }
  const match = period.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return { start: period, end: period };
  const year = Number(match[1]);
  const week = Number(match[2]);
  // ISO week 1 = week containing Jan 4
  const jan4 = new Date(year, 0, 4);
  const dow  = jan4.getDay() || 7; // Mon=1 … Sun=7
  const mon  = new Date(jan4);
  mon.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7);
  const sun  = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt  = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(mon), end: fmt(sun) };
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SalaryType = 'FIXED_MONTHLY' | 'PF_MONTHLY' | 'CASH_MONTHLY' | 'DAILY_WEEKLY' | 'WEEKLY';

interface AttendanceInput {
  employeeId: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  otHours: number;
  lateMinutes: number;
  dailyLateMinutes?: number[];  // per-day late minutes for per-day slab deduction
  permissionMinutes: number;
  advance: number;
}

interface PayrollSettings {
  dailySalaryFormula: string;
  salaryCalculationMethod: string;
  fixedDays: number;
  defaultWorkingHoursPerDay: number;
  otEnabled: boolean;
  otMethod: string;
  otRatePerHour: number;
  weekdayOtMultiplier: number;
  holidayOtMultiplier: number;
  maxOtHoursPerDay: number;
  maxOtHoursPerWeek: number;
  otSlabs: Array<{ fromMinutes: number; toMinutes: number; amount: number }>;
  pfEnabled: boolean;
  pfWageFormula: string;
  employeePfPercent: number;
  employerPfPercent: number;
  maxPfWage: number;
  pfRoundingRule: string;
  esiEnabled: boolean;
  employeeEsiPercent: number;
  employerEsiPercent: number;
  maxEsiSalary: number;
  esiRoundingRule: string;
  paidLeavePerYear: number;
  lateEntryGraceMinutes: number;
  lateEntrySlabs: Array<{ fromMinutes: number; toMinutes: number; amount: number }>;
  permissionSlabs: Array<{ fromMinutes: number; toMinutes: number; amount: number }>;
  professionalTaxEnabled: boolean;
  professionalTaxAmount: number;
  roundingRule: string;
  decimalPrecision: number;
}

interface EmployeePayrollData {
  id: bigint;
  empCode: string;
  fullName: string;
  departmentId: number | null;
  designation: string | null;
  payrollConfig: {
    salaryType: string;
    monthlySalary: any;
    basicSalary: any;
    da: any;
    hra: any;
    otherAllowance: any;
    dailySalary: any;
    bankAccount: string | null;
    pfNumber: string | null;
    esiNumber: string | null;
    paymentMode: string;
  } | null;
  department: { name: string } | null;
}

// ─── Payroll Engine (server-side) ─────────────────────────────────────────────

function applyRounding(value: number, rule: string): number {
  switch (rule) {
    case 'FLOOR':   return Math.floor(value);
    case 'CEILING': return Math.ceil(value);
    default:        return Math.round(value);
  }
}

// toMinutes = 0 means "and above" (open-ended upper bound)
function lookupSlab(minutes: number, slabs: Array<{ fromMinutes: number; toMinutes: number; amount: number }>): number {
  for (const slab of slabs) {
    if (minutes >= slab.fromMinutes && (slab.toMinutes === 0 || minutes <= slab.toMinutes)) return slab.amount;
  }
  return 0;
}

export function getEffectivePayrollConfig(emp: any) {
  if (emp.payrollConfig) return emp.payrollConfig;

  let salaryType = 'FIXED_MONTHLY';
  if (emp.salaryType === 'daily') {
    salaryType = 'DAILY_WEEKLY';
  } else if (emp.salaryType === 'weekly') {
    // Weekly salary employees get their own independent calculation path
    salaryType = 'WEEKLY';
  } else if (emp.pfApplicable) {
    salaryType = 'PF_MONTHLY';
  } else if (emp.salaryType === 'monthly') {
    salaryType = 'FIXED_MONTHLY';
  }

  const grossSalary = Number(emp.grossSalary || emp.basicSalary || 0);
  const basicSalary = Number(emp.basicSalary || (grossSalary ? Math.round(grossSalary * 0.5) : 0));
  const da = 0;
  const hra = 0;
  const otherAllowance = Math.max(0, grossSalary - basicSalary);
  const dailySalary = Number(emp.basicSalary || (grossSalary ? Math.round(grossSalary / 26) : 0));

  return {
    id: `emp-cfg-${emp.id}`,
    employeeId: String(emp.id),
    salaryType,
    monthlySalary: grossSalary,
    basicSalary,
    da,
    hra,
    otherAllowance,
    dailySalary,
    bankAccount: emp.accountNumber || null,
    pfNumber: emp.pfNumber || null,
    esiNumber: emp.esiNumber || null,
    pfApplicable: emp.pfApplicable ?? true,
    esiApplicable: emp.esiApplicable ?? true,
    professionalTax: emp.professionalTax ?? true,
    paymentMode: emp.accountNumber ? 'BANK' : 'CASH',
  };
}

function computeResult(
  emp: EmployeePayrollData,
  att: AttendanceInput,
  settings: PayrollSettings,
  calendarDays: number,
  loanRecoveryAmount = 0,
  otherDeductionAmount = 0,
  salaryAdvanceOverride = 0,
  runType: 'MONTHLY' | 'WEEKLY' = 'MONTHLY',
  monthCalendarDays = 0   // actual month's days (28-31) for MONTHLY_BY_CALENDAR formula
) {
  const pc = getEffectivePayrollConfig(emp);
  if (!pc) return null;

  const salaryType    = pc.salaryType as SalaryType;
  const monthlySalary = Number(pc.monthlySalary);
  const basicSalary   = Number(pc.basicSalary);
  const dailySalaryStored = pc.dailySalary ? Number(pc.dailySalary) : 0; // stored per-day field (fallback only)

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Daily Rate
  //
  // Business rule: daily rate is ALWAYS derived from Monthly Gross ÷ Working Days
  // (configured in settings as fixedDays, default 26).
  //
  // For DAILY_WEEKLY employees:
  //   • Primary: monthlySalary / fixedDays  (e.g. ₹20,000 / 26 = ₹769.23)
  //   • Fallback: dailySalaryStored (pure per-diem workers with no monthly equivalent)
  //
  // For monthly salary types (MONTHLY_BY_CALENDAR): use calendar days of that month.
  // ─────────────────────────────────────────────────────────────────────────────
  const workingDaysPerMonth = settings.fixedDays > 0 ? settings.fixedDays : 26;
  // For MONTHLY_BY_CALENDAR formula we need the actual month's days (Aug=31, Sep=30).
  // In weekly runs calendarDays=7, so we use the separately computed monthCalendarDays.
  const calDaysForFormula = monthCalendarDays > 0 ? monthCalendarDays : calendarDays;
  let dailyRate = 0;

  let formulaDivisor = 1;

  const st = String(salaryType).toUpperCase();
  if (st === 'DAILY_WEEKLY' || st === 'DAILY') {
    if (settings.dailySalaryFormula === 'FIXED_DAILY' || monthlySalary === 0) {
      // Pure per-diem: use the stored per-day rate directly
      dailyRate = dailySalaryStored || monthlySalary;
      formulaDivisor = 1;
    } else if (settings.dailySalaryFormula === 'MONTHLY_BY_CALENDAR') {
      // Monthly ÷ Calendar Days: Aug=31, Sep=30, etc.
      formulaDivisor = calDaysForFormula > 0 ? calDaysForFormula : 30;
      dailyRate = monthlySalary / formulaDivisor;
    } else {
      // MONTHLY_BY_WORKING (default): Monthly ÷ Fixed Working Days (e.g. 26)
      formulaDivisor = workingDaysPerMonth;
      dailyRate = monthlySalary / formulaDivisor;
    }
  } else if (st === 'WEEKLY') {
    // For weekly salary, monthlySalary field stores the weekly gross salary (e.g. 5000)
    // So the daily rate is the weekly amount ÷ 7 days.
    formulaDivisor = 7;
    dailyRate = monthlySalary / formulaDivisor;
  } else {
    // Fixed / PF / Cash monthly employees
    if (settings.dailySalaryFormula === 'MONTHLY_BY_CALENDAR') {
      formulaDivisor = calDaysForFormula > 0 ? calDaysForFormula : 30;
      dailyRate = monthlySalary / formulaDivisor;
    } else {
      formulaDivisor = workingDaysPerMonth;
      dailyRate = monthlySalary / formulaDivisor;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Payable Days & LOP
  // ─────────────────────────────────────────────────────────────────────────────
  const presentDays = att.presentDays + att.halfDays * 0.5; // 4 + 0.5×1 = 4.5
  const lopDays     = att.absentDays  + att.halfDays * 0.5; // 1 + 0.5×1 = 1.5
  const totalDays   = calendarDays;

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Earned Salary
  //
  // DAILY_WEEKLY: pay only for days worked  → dailyRate × presentDays
  // Monthly types: full month salary minus LOP deduction → monthlySalary − (lopDays × dailyRate)
  // ─────────────────────────────────────────────────────────────────────────────
  let earnedSalary: number;
  if (salaryType === 'DAILY_WEEKLY') {
    // Daily wage workers: pay only for days actually worked
    earnedSalary = dailyRate * presentDays;
  } else if (salaryType === 'WEEKLY') {
    // Weekly salary: start from weekly gross, deduct absent days only
    // Weekly off and holidays are paid (they are part of the weekly gross)
    earnedSalary = monthlySalary - (lopDays * dailyRate);
  } else {
    // Monthly: full month salary minus LOP deductions
    earnedSalary = monthlySalary - (lopDays * dailyRate);
  }
  earnedSalary = Math.max(0, earnedSalary);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4 — OT Pay
  //
  // Use the OT method configured in Payroll Settings — no special override per
  // salary type.  The user configures what is correct for their business:
  //   HOURLY_RATE      → otHours × otRatePerHour          (e.g. 1.5 × ₹40 = ₹60)
  //   PERCENTAGE_DAILY → (dailyRate / workingHrs) × otHrs × multiplier
  //   SLAB             → lookup fixed amounts by OT minutes
  // ─────────────────────────────────────────────────────────────────────────────
  const otEnabled = settings.otEnabled !== false; // treat null/undefined as enabled
  let otPay = 0;
  if (otEnabled && att.otHours > 0) {
    const maxOtPerDay   = settings.maxOtHoursPerDay  > 0 ? settings.maxOtHoursPerDay  : 99;
    const maxOtPerWeek  = settings.maxOtHoursPerWeek > 0 ? settings.maxOtHoursPerWeek : 99;
    // Cap at per-day limit × paid days, then further cap at the weekly ceiling
    const otH           = Math.min(
      att.otHours,
      maxOtPerDay  * (att.presentDays || 1),
      maxOtPerWeek * Math.ceil((att.presentDays || 1) / 5),  // weeks in period
    );
    const workingHours  = settings.defaultWorkingHoursPerDay > 0 ? settings.defaultWorkingHoursPerDay : 8;
    const otMultiplier  = settings.weekdayOtMultiplier > 0 ? settings.weekdayOtMultiplier : 1.5;

    if (settings.otMethod === 'HOURLY_RATE' && settings.otRatePerHour > 0) {
      // Flat monetary rate per OT hour × actual capped OT hours (e.g. ₹80/hr × 3hr = ₹240)
      otPay = otH * settings.otRatePerHour;
    } else if (settings.otMethod === 'FIXED_AMOUNT' && settings.otRatePerHour > 0) {
      // Single fixed allowance paid whenever any OT is recorded in the period (e.g. ₹500 flat)
      // The field `otRatePerHour` stores the flat amount in this mode.
      otPay = settings.otRatePerHour;
    } else if (settings.otMethod === 'SLAB' && settings.otSlabs?.length > 0) {
      otPay = lookupSlab(Math.round(otH * 60), settings.otSlabs);
    } else {
      // PERCENTAGE_DAILY (default): derive hourly rate from daily salary, apply OT multiplier
      // e.g. dailyRate=1000, 8hr/day → ₹125/hr × 1.5 × 3hr = ₹562.50
      otPay = (dailyRate / workingHours) * otH * otMultiplier;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5 — Gross Pay = Earned + OT
  // ─────────────────────────────────────────────────────────────────────────────
  const grossSalary = earnedSalary + otPay;

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6 — PF (Provident Fund)
  // ─────────────────────────────────────────────────────────────────────────────
  const isPfApp = pc.pfApplicable ?? (emp as any).pfApplicable ?? true;
  const hasPf   = isPfApp && (settings.pfEnabled ?? true);
  let pfWage = 0, employeePf = 0, employerPf = 0;
  if (hasPf) {
    const maxPfCap  = Number(settings.maxPfWage) > 0 ? Number(settings.maxPfWage) : 15000;
    const baseWage  = settings.pfWageFormula === 'GROSS'
      ? grossSalary
      : (basicSalary > 0 ? basicSalary : Math.round(grossSalary * 0.5));
    pfWage          = Math.min(baseWage, maxPfCap);
    const empPfRate = Number(settings.employeePfPercent)  > 0 ? Number(settings.employeePfPercent)  : 12;
    const emrPfRate = Number(settings.employerPfPercent)  > 0 ? Number(settings.employerPfPercent)  : 12;
    employeePf = applyRounding(pfWage * empPfRate / 100, settings.pfRoundingRule);
    employerPf = applyRounding(pfWage * emrPfRate / 100, settings.pfRoundingRule);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7 — ESI
  // ESI applies only when gross ≤ max ESI salary (₹21,000 by default).
  // ─────────────────────────────────────────────────────────────────────────────
  const isEsiApp = pc.esiApplicable ?? (emp as any).esiApplicable ?? true;
  const maxEsiCap = Number(settings.maxEsiSalary) > 0 ? Number(settings.maxEsiSalary) : 21000;
  const hasEsi    = isEsiApp && (settings.esiEnabled ?? true) && grossSalary <= maxEsiCap;
  let employeeEsi = 0, employerEsi = 0;
  if (hasEsi) {
    const empEsiRate = Number(settings.employeeEsiPercent) > 0 ? Number(settings.employeeEsiPercent) : 0.75;
    const emrEsiRate = Number(settings.employerEsiPercent) > 0 ? Number(settings.employerEsiPercent) : 3.25;
    employeeEsi = applyRounding(grossSalary * empEsiRate / 100, settings.esiRoundingRule);
    employerEsi = applyRounding(grossSalary * emrEsiRate / 100, settings.esiRoundingRule);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 8 — Professional Tax
  // PT is a monthly statutory deduction. Skip for WEEKLY runs to avoid applying
  // it every week — it will be collected once during the monthly payroll run.
  // Company-wide setting is the primary gate: if professionalTaxEnabled = false,
  // PT is NEVER deducted regardless of any per-employee flag.
  // Slab is applied to monthlySalary (not earned/gross of this period).
  // ─────────────────────────────────────────────────────────────────────────────
  let professionalTax = 0;
  const isPtApp = (emp as any).professionalTax ?? (pc as any)?.professionalTax ?? false;
  if ((settings.professionalTaxEnabled || isPtApp) && runType === 'MONTHLY') {
    const ptBasis = monthlySalary; // always use monthly salary as PT slab basis
    if (Number(settings.professionalTaxAmount) > 0) {
      professionalTax = Number(settings.professionalTaxAmount);
    } else {
      if      (ptBasis > 75000) professionalTax = 1083;
      else if (ptBasis > 60000) professionalTax = 850;
      else if (ptBasis > 45000) professionalTax = 600;
      else if (ptBasis > 30000) professionalTax = 350;
      else if (ptBasis > 21000) professionalTax = 208;
      else                      professionalTax = 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 9 — Per-minute rate (shared by Late & Permission deduction fallback)
  // ─────────────────────────────────────────────────────────────────────────────
  const workingMins    = (settings.defaultWorkingHoursPerDay > 0 ? settings.defaultWorkingHoursPerDay : 8) * 60;
  const perMinuteRate  = dailyRate / workingMins;

  // ─ Late entry deduction ─
  // Per-day calculation: each day's late minutes are checked independently against slabs.
  // If dailyLateMinutes[] is provided by the frontend, use it; otherwise fall back to total.
  let lateEntryDeduction = 0;
  const graceMins = settings.lateEntryGraceMinutes || 0;
  if (att.dailyLateMinutes && att.dailyLateMinutes.length > 0) {
    // Per-day slab lookup
    for (const dayLate of att.dailyLateMinutes) {
      if (dayLate > graceMins) {
        if (settings.lateEntrySlabs?.length > 0) {
          lateEntryDeduction += lookupSlab(dayLate, settings.lateEntrySlabs);
        } else {
          lateEntryDeduction += Math.round(perMinuteRate * (dayLate - graceMins));
        }
      }
    }
  } else if (att.lateMinutes > graceMins) {
    // Fallback: total late minutes (legacy — no per-day data)
    if (settings.lateEntrySlabs?.length > 0) {
      lateEntryDeduction = lookupSlab(att.lateMinutes, settings.lateEntrySlabs);
    } else {
      lateEntryDeduction = Math.round(perMinuteRate * (att.lateMinutes - graceMins));
    }
  }

  // ─ Permission deduction ─
  let permissionDeduction = 0;
  if (att.permissionMinutes > 0) {
    if (settings.permissionSlabs?.length > 0) {
      permissionDeduction = lookupSlab(att.permissionMinutes, settings.permissionSlabs);
    } else {
      // Fallback: deduct per-minute rate
      permissionDeduction = Math.round(perMinuteRate * att.permissionMinutes);
    }
  }

  // ─ Total deductions ─
  // salaryAdvanceOverride is loaded server-side from the SalaryAdvance table filtered by period.
  // att.advance comes from the frontend attendance payload — ignored here to prevent double-counting.
  const totalDeductions =
    employeePf + employeeEsi + professionalTax +
    lateEntryDeduction + permissionDeduction +
    salaryAdvanceOverride + loanRecoveryAmount + otherDeductionAmount;

  // ─ Net salary ─
  // For WEEKLY runs: allow negative net salary when salary advance exceeds earned salary.
  // The payslip will display a negative balance — employee owes the difference.
  // For MONTHLY runs: clamp at 0 (excess advance carries forward to next period).
  const rawNet = grossSalary - totalDeductions;
  const netSalary = applyRounding(
    runType === 'WEEKLY' ? rawNet : Math.max(0, rawNet),
    settings.roundingRule
  );

  // ─ Variance detection (>20% deviation vs monthly salary for cash workers) ─
  let hasVariance = false;
  let varianceNote: string | undefined;
  if (salaryType === 'CASH_MONTHLY' && monthlySalary > 0) {
    const expectedNet = monthlySalary - (lopDays * dailyRate);
    const deviation   = Math.abs(netSalary - expectedNet) / expectedNet;
    if (deviation > 0.2) {
      hasVariance  = true;
      varianceNote = `Net ₹${Math.round(netSalary)} vs expected ₹${Math.round(expectedNet)} (${Math.round(deviation * 100)}% deviation)`;
    }
  }

  return {
    employeeId:         emp.id,
    employeeCode:       emp.empCode,
    employeeName:       emp.fullName,
    department:         emp.department?.name ?? '',
    salaryType,
    totalDays,
    presentDays,
    absentDays:         att.absentDays,
    lopDays,
    halfDays:           att.halfDays,
    dailyRate,
    monthlySalary,
    formulaDivisor,
    earnedSalary,
    grossSalary,
    otHours:            att.otHours,
    otPay,
    pfWage,
    employeePf,
    employerPf,
    employeeEsi,
    employerEsi,
    pfApplicable:       hasPf,
    esiApplicable:      hasEsi,
    professionalTax,
    lateEntryDeduction,
    lateMinutes:        att.lateMinutes,
    permissionDeduction,
    permissionMinutes:  att.permissionMinutes,
    salaryAdvance:      salaryAdvanceOverride,
    loanRecovery:       loanRecoveryAmount,
    otherDeductions:    otherDeductionAmount,
    totalDeductions,
    netSalary,
    paymentMode:        pc.paymentMode,
    hasVariance,
    varianceNote,
  };
}

// ─── Service class ────────────────────────────────────────────────────────────
class PayrollService {

  // ── Config ──────────────────────────────────────────────────────────────────
  async getConfig(companyId: string) {
    let config = await prisma.payrollConfig.findUnique({ where: { companyId } });
    if (!config) {
      config = await prisma.payrollConfig.create({
        data: { companyId },
      });
    }
    return config;
  }

  async updateConfig(companyId: string, data: Record<string, unknown>) {
    const config = await prisma.payrollConfig.upsert({
      where:  { companyId },
      update: data,
      create: { companyId, ...data },
    });
    getIO().emit('payroll:config:updated', config);
    return config;
  }

  // ── Employee Payroll Config ──────────────────────────────────────────────────
  async getEmployeePayrollConfig(employeeId: bigint) {
    return prisma.employeePayrollConfig.findUnique({ where: { employeeId } });
  }

  async upsertEmployeePayrollConfig(employeeId: bigint, data: Record<string, unknown>) {
    const cfg = await prisma.employeePayrollConfig.upsert({
      where:  { employeeId },
      update: data,
      create: { employeeId, salaryType: 'CASH_MONTHLY', monthlySalary: 0, basicSalary: 0, ...data },
    });

    // Keep Employee table in sync
    const empUpdate: Record<string, any> = {};
    if (data.monthlySalary !== undefined) empUpdate.grossSalary = data.monthlySalary;
    if (data.basicSalary !== undefined) empUpdate.basicSalary = data.basicSalary;
    if (data.bankAccount !== undefined) empUpdate.accountNumber = data.bankAccount;
    if (data.bankName !== undefined) empUpdate.bankName = data.bankName;
    if (data.ifscCode !== undefined) empUpdate.ifscCode = data.ifscCode;
    if (data.paymentMode !== undefined) empUpdate.paymentMode = data.paymentMode;

    if (Object.keys(empUpdate).length > 0) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: empUpdate,
      }).catch(() => {});
    }

    getIO().emit('payroll:employee:updated', cfg);
    return cfg;
  }

  async listEmployeesWithPayroll(category?: string) {
    const employees = await prisma.employee.findMany({
      where:   { status: 'active' },
      include: {
        payrollConfig: true,
        department:    { select: { name: true } },
      },
      orderBy: { empCode: 'asc' },
    });

    const enriched = employees.map(e => ({
      ...e,
      payrollConfig: getEffectivePayrollConfig(e),
    }));

    if (category && category !== 'ALL') {
      return enriched.filter(e => e.payrollConfig?.salaryType === category);
    }
    return enriched;
  }

  // ── Attendance ───────────────────────────────────────────────────────────────
  async getAttendance(period: string, employeeId?: bigint) {
    // For YYYY-MM periods query by date prefix so records saved under weekly
    // sub-periods (e.g. 2026-W32) are also returned when loading a full month.
    const isMonthPeriod = /^\d{4}-\d{2}$/.test(period);
    return prisma.attendanceRecord.findMany({
      where: {
        ...(isMonthPeriod
          ? { date: { startsWith: period } }   // match any date like 2026-08-xx
          : { period }                          // exact weekly period match
        ),
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });
  }

  async bulkUpsertAttendance(records: Array<{
    employeeId: bigint; date: string; period: string;
    status: string; otHours: number; lateMinutes: number;
    permissionMinutes: number; salaryAdvance: number;
  }>) {
    const ops = records.map(r =>
      prisma.attendanceRecord.upsert({
        where:  { employeeId_date: { employeeId: r.employeeId, date: r.date } },
        update: { status: r.status, otHours: r.otHours, lateMinutes: r.lateMinutes, permissionMinutes: r.permissionMinutes, salaryAdvance: r.salaryAdvance, period: r.period },
        create: r,
      })
    );
    return prisma.$transaction(ops);
  }

  // ── Payroll Run ──────────────────────────────────────────────────────────────
  async listRuns(opts: { period?: string; type?: string; status?: string; page: number; limit: number }) {
    const where: Record<string, unknown> = {};
    if (opts.period) {
      if (/^\d{4}-\d{2}$/.test(opts.period)) {
        const [yearStr, monthStr] = opts.period.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth   = new Date(year, month, 1);

        where.OR = [
          { period: opts.period },
          { period: { startsWith: opts.period } },
          { createdAt: { gte: startOfMonth, lt: endOfMonth } },
        ];
      } else {
        where.period = opts.period;
      }
    }
    if (opts.type)   where.type   = opts.type;
    if (opts.status) where.status = opts.status;

    const [runs, total] = await Promise.all([
      prisma.payrollRun.findMany({
        where,
        include: { results: { orderBy: { employeeCode: 'asc' }, include: { employee: true } } },
        orderBy: { createdAt: 'desc' },
        skip:    (opts.page - 1) * opts.limit,
        take:    opts.limit,
      }),
      prisma.payrollRun.count({ where }),
    ]);
    return { runs, total, page: opts.page, limit: opts.limit };
  }

  async getRun(id: number) {
    const run = await prisma.payrollRun.findUnique({
      where:   { id },
      include: { results: { orderBy: { employeeCode: 'asc' }, include: { employee: true } } },
    });
    if (!run) throw new ApiError(404, 'Payroll run not found');
    return run;
  }

  async computeRun(opts: {
    period: string;
    type: 'MONTHLY' | 'WEEKLY';
    employeeCategory: string;
    calendarDays: number;
    attendance: AttendanceInput[];
    createdById: string;
    companyId: string;
  }) {
    const io = getIO();

    // 0. Check for duplicate payroll run in same period
    const existingRun = await prisma.payrollRun.findFirst({
      where: {
        period:           opts.period,
        type:             opts.type,
        employeeCategory: opts.employeeCategory,
        status:           { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED', 'COMPLETED'] },
      },
    });

    if (existingRun) {
      throw new ApiError(
        400,
        `A payroll run for period ${opts.period} (${opts.type} - ${opts.employeeCategory}) already exists (Run: ${existingRun.runCode}, Status: ${existingRun.status}). Please manage or approve the existing run.`
      );
    }

    // 1. Load settings
    const config = await this.getConfig(opts.companyId);
    const settings: PayrollSettings = {
      dailySalaryFormula:        config.dailySalaryFormula,
      salaryCalculationMethod:   config.salaryCalculationMethod,
      fixedDays:                 config.fixedDays,
      defaultWorkingHoursPerDay: Number(config.defaultWorkingHoursPerDay),
      otEnabled:                 config.otEnabled,
      otMethod:                  config.otMethod,
      otRatePerHour:             Number(config.otRatePerHour),
      weekdayOtMultiplier:       Number(config.weekdayOtMultiplier),
      holidayOtMultiplier:       Number(config.holidayOtMultiplier),
      maxOtHoursPerDay:          Number(config.maxOtHoursPerDay),
      maxOtHoursPerWeek:         Number(config.maxOtHoursPerWeek),
      otSlabs:                   (config.otSlabs as any[]) ?? [],
      pfEnabled:                 config.pfEnabled,
      pfWageFormula:             config.pfWageFormula,
      employeePfPercent:         Number(config.employeePfPercent),
      employerPfPercent:         Number(config.employerPfPercent),
      maxPfWage:                 Number(config.maxPfWage),
      pfRoundingRule:            config.pfRoundingRule,
      esiEnabled:                config.esiEnabled,
      employeeEsiPercent:        Number(config.employeeEsiPercent),
      employerEsiPercent:        Number(config.employerEsiPercent),
      maxEsiSalary:              Number(config.maxEsiSalary),
      esiRoundingRule:           config.esiRoundingRule,
      paidLeavePerYear:          config.paidLeavePerYear,
      lateEntryGraceMinutes:     config.lateEntryGraceMinutes,
      lateEntrySlabs:            (config.lateEntrySlabs  as any[]) ?? [],
      permissionSlabs:           (config.permissionSlabs as any[]) ?? [],
      professionalTaxEnabled:    config.professionalTaxEnabled,
      professionalTaxAmount:     Number(config.professionalTaxAmount),
      roundingRule:              config.roundingRule,
      decimalPrecision:          config.decimalPrecision,
    };

    // 2. Load employees
    const rawEmployees = await prisma.employee.findMany({
      where: {
        status: 'active',
      },
      include: {
        payrollConfig: true,
        department:    { select: { name: true } },
      },
    });

    const employees = rawEmployees
      .map(e => ({
        ...e,
        payrollConfig: getEffectivePayrollConfig(e),
      }))
      .filter(e => {
        const isWeekly = e.payrollConfig?.salaryType === 'DAILY_WEEKLY'
          || e.payrollConfig?.salaryType === 'WEEKLY'
          || (e as any).salaryType === 'daily'
          || (e as any).salaryType === 'weekly';
        if (opts.type === 'WEEKLY' && !isWeekly) return false;
        if (opts.type === 'MONTHLY' && isWeekly) return false;
        if (opts.employeeCategory !== 'ALL' && e.payrollConfig?.salaryType !== opts.employeeCategory) return false;
        return true;
      });

    // 3. Load permanent deductions for all employees in one query
    const permanentDeductionRows = await prisma.employeePermanentDeduction.findMany({
      where: {
        employeeId: { in: employees.map(e => e.id) },
        isActive: true,
      },
    });

    // Group by employeeId for O(1) lookup
    const permanentDeductionMap = new Map<bigint, { loan: number; other: number }>();
    for (const row of permanentDeductionRows) {
      const existing = permanentDeductionMap.get(row.employeeId) ?? { loan: 0, other: 0 };
      if (row.type === 'LOAN_EMI') {
        existing.loan += Number(row.amount);
      } else {
        existing.other += Number(row.amount);
      }
      permanentDeductionMap.set(row.employeeId, existing);
    }

    // Load salary advances disbursed within THIS period only.
    // IMPORTANT: ISO period 2026-W31 = July 27–Aug 2 in ISO calendar, but the user's
    // "Week 1 Aug 1–7" is saved with period='2026-W31' because Aug 1 (Sat) falls in W31.
    // So we derive the date range from the actual attendance records instead of ISO week math.
    const attendanceDates = await prisma.attendanceRecord.findMany({
      where: {
        period:     opts.period,
        employeeId: { in: employees.map(e => e.id) },
      },
      select:  { date: true },
      distinct: ['date'],
      orderBy: { date: 'asc' },
    });
    let periodStart: string;
    let periodEnd: string;
    if (attendanceDates.length > 0) {
      periodStart = attendanceDates[0].date;
      periodEnd   = attendanceDates[attendanceDates.length - 1].date;
    } else {
      const range  = periodToDateRange(opts.period);
      periodStart  = range.start;
      periodEnd    = range.end;
    }

    // Compute actual month calendar days for MONTHLY_BY_CALENDAR daily salary formula.
    // calendarDays passed from frontend is 7 for weekly runs, so we must derive this separately.
    const refDateForMonth = new Date(periodStart);
    const monthCalendarDays = new Date(
      refDateForMonth.getFullYear(),
      refDateForMonth.getMonth() + 1,
      0
    ).getDate(); // e.g. Aug=31, Sep=30

    const salaryAdvanceRows = await prisma.salaryAdvance.findMany({
      where: {
        employeeId:    { in: employees.map(e => e.id) },
        status:        { in: ['PENDING', 'PARTIAL'] },
        disbursedDate: { gte: new Date(periodStart), lte: new Date(periodEnd) },
      },
    });

    // Sum outstanding balance (amount - recoveredAmount) per employee, capped to what's left
    const salaryAdvanceMap = new Map<bigint, number>();
    for (const row of salaryAdvanceRows) {
      const outstanding = Number(row.amount) - Number(row.recoveredAmount);
      if (outstanding > 0) {
        salaryAdvanceMap.set(row.employeeId, (salaryAdvanceMap.get(row.employeeId) ?? 0) + outstanding);
      }
    }

    // 4. Emit start
    const runCode = `PR-${opts.period}-${Date.now().toString().slice(-5)}`;
    io.emit('payroll:computing', { runCode, period: opts.period, total: employees.length });

    // 5. Compute per employee with progress
    const results: ReturnType<typeof computeResult>[] = [];
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i] as EmployeePayrollData;
      const attInput = opts.attendance.find(a => BigInt(a.employeeId) === emp.id);
      if (!attInput) continue;

      const permDed = permanentDeductionMap.get(emp.id) ?? { loan: 0, other: 0 };
      const pendingAdvance = salaryAdvanceMap.get(emp.id) ?? 0;
      const result = computeResult(emp, attInput, settings, opts.calendarDays, permDed.loan, permDed.other, pendingAdvance, opts.type, monthCalendarDays);
      if (result) results.push(result);

      // Emit per-employee progress
      io.emit('payroll:progress', {
        runCode,
        current: i + 1,
        total: employees.length,
        employee: { id: emp.id.toString(), name: emp.fullName, code: emp.empCode },
        result: result ? {
          netSalary:    result.netSalary,
          grossSalary:  result.grossSalary,
          hasVariance:  result.hasVariance,
        } : null,
      });

      // Small async yield so other events can process
      await new Promise(resolve => setImmediate(resolve));
    }

    // 5. Aggregate totals
    const totalGross       = results.reduce((s, r) => s + r!.grossSalary, 0);
    const totalNetSalary   = results.reduce((s, r) => s + r!.netSalary, 0);
    const totalPfEmployee  = results.reduce((s, r) => s + r!.employeePf, 0);
    const totalPfEmployer  = results.reduce((s, r) => s + r!.employerPf, 0);
    const totalEsiEmployee = results.reduce((s, r) => s + r!.employeeEsi, 0);
    const totalEsiEmployer = results.reduce((s, r) => s + r!.employerEsi, 0);

    // 6. Save run + results in a transaction
    const run = await prisma.$transaction(async (tx) => {
      const newRun = await tx.payrollRun.create({
        data: {
          runCode,
          period:           opts.period,
          type:             opts.type,
          status:           'DRAFT',
          employeeCategory: opts.employeeCategory,
          calendarDays:     opts.calendarDays,
          totalEmployees:   results.length,
          totalGross,
          totalNetSalary,
          totalPfEmployee,
          totalPfEmployer,
          totalEsiEmployee,
          totalEsiEmployer,
          createdById:      opts.createdById,
        },
      });

      await tx.payrollResult.createMany({
        data: results.map(r => ({
          payrollRunId:       newRun.id,
          employeeId:         r!.employeeId,
          employeeCode:       r!.employeeCode,
          employeeName:       r!.employeeName,
          department:         r!.department,
          salaryType:         r!.salaryType,
          totalDays:          r!.totalDays,
          presentDays:        r!.presentDays,
          absentDays:         r!.absentDays,
          lopDays:            r!.lopDays,
          halfDays:           r!.halfDays,
          dailyRate:          r!.dailyRate,
          earnedSalary:       r!.earnedSalary,
          grossSalary:        r!.grossSalary,
          otHours:            r!.otHours,
          otPay:              r!.otPay,
          pfWage:             r!.pfWage,
          employeePf:         r!.employeePf,
          employerPf:         r!.employerPf,
          employeeEsi:        r!.employeeEsi,
          employerEsi:        r!.employerEsi,
          pfApplicable:       r!.pfApplicable,
          esiApplicable:      r!.esiApplicable,
          professionalTax:    r!.professionalTax,
          lateEntryDeduction: r!.lateEntryDeduction,
          permissionDeduction:r!.permissionDeduction,
          salaryAdvance:      r!.salaryAdvance,
          loanRecovery:       r!.loanRecovery,
          otherDeductions:    r!.otherDeductions,
          totalDeductions:    r!.totalDeductions,
          netSalary:          r!.netSalary,
          paymentMode:        r!.paymentMode,
          hasVariance:        r!.hasVariance,
          varianceNote:       r!.varianceNote ?? null,
        })),
      });

      const dbRun = await tx.payrollRun.findUnique({
        where:   { id: newRun.id },
        include: { results: { orderBy: { employeeCode: 'asc' }, include: { employee: true } } },
      });

      if (dbRun && dbRun.results) {
        dbRun.results = dbRun.results.map(dbRes => {
          const comp = results.find(r => r!.employeeId === dbRes.employeeId);
          if (comp) {
            return {
              ...dbRes,
              monthlySalary: comp.monthlySalary,
              formulaDivisor: comp.formulaDivisor,
              lateMinutes: comp.lateMinutes,
              permissionMinutes: comp.permissionMinutes,
            } as any;
          }
          return dbRes;
        });
      }
      return dbRun;
    });

    // 7. Emit completed
    io.emit('payroll:completed', {
      runCode,
      runId:         run!.id,
      period:        opts.period,
      totalEmployees: results.length,
      totalGross,
      totalNetSalary,
      variances:     results.filter(r => r!.hasVariance).length,
    });

    return run;
  }

  async approveRun(id: number, userId: string) {
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new ApiError(404, 'Payroll run not found');
    if (run.status !== 'DRAFT') throw new ApiError(400, `Run is ${run.status}, can only approve DRAFT runs`);

    const updated = await prisma.payrollRun.update({
      where: { id },
      data:  { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
      include: { results: { orderBy: { employeeCode: 'asc' }, include: { employee: true } } },
    });
    getIO().emit('payroll:approved', { runId: id, period: run.period, approvedById: userId });
    return updated;
  }

  async lockRun(id: number, userId: string) {
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new ApiError(404, 'Payroll run not found');
    if (run.status !== 'APPROVED') throw new ApiError(400, `Run is ${run.status}, can only lock APPROVED runs`);

    const updated = await prisma.payrollRun.update({
      where: { id },
      data:  { status: 'LOCKED', lockedById: userId, lockedAt: new Date() },
      include: { results: { orderBy: { employeeCode: 'asc' }, include: { employee: true } } },
    });

    // ── Auto-recover SalaryAdvance records for each employee ─────────────────
    for (const result of updated.results) {
      const toRecover = Number(result.salaryAdvance);
      if (toRecover <= 0) continue;

      // Load PENDING/PARTIAL advances for this employee, oldest first
      const advances = await prisma.salaryAdvance.findMany({
        where: { employeeId: result.employee.id, status: { in: ['PENDING', 'PARTIAL'] } },
        orderBy: { disbursedDate: 'asc' },
      });

      let remaining = toRecover;
      for (const adv of advances) {
        if (remaining <= 0) break;
        const outstanding = Number(adv.amount) - Number(adv.recoveredAmount);
        if (outstanding <= 0) continue;

        const recoverNow   = Math.min(remaining, outstanding);
        const newRecovered = Number(adv.recoveredAmount) + recoverNow;
        const newStatus    = newRecovered >= Number(adv.amount) ? 'CLEARED' : 'PARTIAL';

        await prisma.salaryAdvance.update({
          where: { id: adv.id },
          data:  { recoveredAmount: newRecovered, status: newStatus },
        });

        remaining -= recoverNow;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    getIO().emit('payroll:locked', { runId: id, period: run.period, lockedById: userId });
    return updated;
  }

  async deleteRun(id: number) {
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new ApiError(404, 'Payroll run not found');
    if (run.status === 'LOCKED') throw new ApiError(400, 'Cannot delete a locked payroll run');
    await prisma.payrollRun.delete({ where: { id } });
    getIO().emit('payroll:deleted', { runId: id });
  }

  // ── Salary Advance ─────────────────────────────────────────────────────────────
  async listAdvances(employeeId?: bigint, status?: string, dateFrom?: string, dateTo?: string) {
    return prisma.salaryAdvance.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(dateFrom ? { disbursedDate: { gte: new Date(dateFrom) } } : {}),
        ...(dateTo   ? { disbursedDate: { lte: new Date(dateTo)   } } : {}),
      },
      include: { employee: { select: { empCode: true, fullName: true } } },
      orderBy: { disbursedDate: 'desc' },
    });
  }

  async createAdvance(data: { employeeId: bigint; amount: number; disbursedDate: Date; reason?: string }) {
    return prisma.salaryAdvance.create({
      data: { ...data, status: 'PENDING' },
      include: { employee: { select: { empCode: true, fullName: true } } },
    });
  }

  async deleteAdvance(id: number) {
    const adv = await prisma.salaryAdvance.findUnique({ where: { id } });
    if (!adv) throw new ApiError(404, 'Advance not found');
    if (Number(adv.recoveredAmount) > 0) throw new ApiError(400, 'Cannot delete a partially or fully recovered advance');
    await prisma.salaryAdvance.delete({ where: { id } });
  }

  // ── Payslip ─────────────────────────────────────────────────────────────────
  async getPayslip(runId: number, resultId: number) {
    const result = await prisma.payrollResult.findFirst({
      where: { id: resultId, payrollRunId: runId },
      include: {
        payrollRun: true,
        employee: {
          include: {
            department:    true,
            payrollConfig: true,
          },
        },
      },
    });
    if (!result) throw new ApiError(404, 'Payslip not found');

    const company = await prisma.company.findFirst({
      select: {
        companyName:  true,
        legalName:    true,
        addressLine1: true,
        addressLine2: true,
        city:         true,
        state:        true,
        zipcode:      true,
        phone:        true,
        email:        true,
        website:      true,
        gstin:        true,
        logoUrl:      true,
      },
    });

    // Aggregate late + permission minutes from attendance for this period
    const attRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: result.employeeId,
        period:     result.payrollRun.period,
      },
      select: { lateMinutes: true, permissionMinutes: true },
    });
    const lateMinutes       = attRecords.reduce((s, r) => s + r.lateMinutes,       0);
    const permissionMinutes = attRecords.reduce((s, r) => s + r.permissionMinutes, 0);

    const emp = result.employee;
    const pc  = emp.payrollConfig;

    return {
      company,
      run: {
        id:       result.payrollRun.id,
        runCode:  result.payrollRun.runCode,
        period:   result.payrollRun.period,
        type:     result.payrollRun.type,
        status:   result.payrollRun.status,
        lockedAt: result.payrollRun.lockedAt?.toISOString() ?? null,
      },
      employee: {
        id:           emp.id.toString(),
        empCode:      emp.empCode,
        fullName:     emp.fullName,
        designation:  emp.designation  ?? null,
        employeeType: emp.employeeType ?? null,
        pfNumber:     pc?.pfNumber     ?? emp.pfNumber   ?? null,
        esiNumber:    pc?.esiNumber    ?? emp.esiNumber  ?? null,
        uanNumber:    emp.uanNumber    ?? null,
        panNumber:    emp.panNumber    ?? null,
        bankName:     pc?.bankName     ?? emp.bankName   ?? null,
        accountNumber: pc?.bankAccount ?? emp.accountNumber ?? null,
        ifscCode:     pc?.ifscCode     ?? emp.ifscCode   ?? null,
        department:   emp.department?.name ?? '',
        dateOfJoining: emp.dateOfJoining?.toISOString() ?? null,
        payrollConfig: pc ? {
          salaryType:     pc.salaryType,
          monthlySalary:  Number(pc.monthlySalary),
          basicSalary:    Number(pc.basicSalary),
          hra:            Number(pc.hra),
          da:             Number(pc.da),
          otherAllowance: Number(pc.otherAllowance),
          paymentMode:    pc.paymentMode,
        } : null,
      },
      result: {
        id:                  result.id,
        employeeCode:        result.employeeCode,
        employeeName:        result.employeeName,
        salaryType:          result.salaryType,
        totalDays:           result.totalDays,
        presentDays:         Number(result.presentDays),
        absentDays:          Number(result.absentDays),
        lopDays:             Number(result.lopDays),
        halfDays:            Number(result.halfDays),
        lateMinutes,
        permissionMinutes,
        dailyRate:           Number(result.dailyRate),
        earnedSalary:        Number(result.earnedSalary),
        grossSalary:         Number(result.grossSalary),
        otHours:             Number(result.otHours),
        otPay:               Number(result.otPay),
        pfWage:              Number(result.pfWage),
        employeePf:          Number(result.employeePf),
        employerPf:          Number(result.employerPf),
        employeeEsi:         Number(result.employeeEsi),
        employerEsi:         Number(result.employerEsi),
        pfApplicable:        result.pfApplicable,
        esiApplicable:       result.esiApplicable,
        professionalTax:     Number(result.professionalTax),
        lateEntryDeduction:  Number(result.lateEntryDeduction),
        permissionDeduction: Number(result.permissionDeduction),
        salaryAdvance:       Number(result.salaryAdvance),
        loanRecovery:        Number(result.loanRecovery),
        otherDeductions:     Number(result.otherDeductions),
        totalDeductions:     Number(result.totalDeductions),
        netSalary:           Number(result.netSalary),
        paymentMode:         result.paymentMode,
      },
    };
  }
}

export const payrollService = new PayrollService();
