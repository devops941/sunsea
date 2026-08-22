// ============================================================
// Payroll Module — TypeScript Types (single source of truth)
// ============================================================

export type SalaryType = 'FIXED_MONTHLY' | 'PF_MONTHLY' | 'CASH_MONTHLY' | 'DAILY_WEEKLY' | 'WEEKLY';

export type PayrollStatus = 'DRAFT' | 'PREVIEW' | 'APPROVED' | 'LOCKED';

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'WEEKLY_OFF'
  | 'HOLIDAY'
  | 'LEAVE_PAID'
  | 'LEAVE_UNPAID';

// Slab entry used for OT pay and permission deductions
export interface SlabEntry {
  id: string;
  label: string;        // e.g. "10 minutes"
  fromMinutes: number;
  toMinutes: number;
  amount: number;
}

// A single salary component (Basic, HRA, DA, etc.)
export interface SalaryComponent {
  id: string;
  name: string;
  type: 'FIXED' | 'PERCENTAGE_OF_BASIC';
  value: number;
  isTaxable: boolean;
  isPfApplicable: boolean;
  isEsiApplicable: boolean;
  isActive: boolean;
}

// ──────────────────────────────────────────────
// PAYROLL SETTINGS  (single source of truth)
// ──────────────────────────────────────────────
export interface PayrollSettings {
  // 4.1 Company Policy
  payrollFrequency: 'MONTHLY' | 'WEEKLY' | 'DAILY';
  salaryCalculationMethod: 'CALENDAR_DAYS' | 'WORKING_DAYS' | 'FIXED_DAYS';
  fixedDays: number;
  defaultWorkingHoursPerDay: number;
  weeklyOffDays: number[]; // 0 = Sunday … 6 = Saturday

  // 4.2 Daily Salary Formula
  dailySalaryFormula: 'MONTHLY_BY_CALENDAR' | 'MONTHLY_BY_WORKING' | 'FIXED_DAILY';

  // 4.3 Overtime
  otEnabled: boolean;
  otMethod: 'HOURLY_RATE' | 'FIXED_AMOUNT' | 'PERCENTAGE_DAILY' | 'SLAB';
  otRatePerHour: number;
  weekdayOtMultiplier: number;
  holidayOtMultiplier: number;
  weeklyOffOtMultiplier: number;
  maxOtHoursPerDay: number;
  maxOtHoursPerWeek: number;
  otSlabs: SlabEntry[];

  // 4.4 PF
  pfEnabled: boolean;
  pfWageFormula: 'BASIC' | 'GROSS';
  employeePfPercent: number;
  employerPfPercent: number;
  maxPfWage: number;
  voluntaryPf: boolean;
  pfRoundingRule: 'ROUND' | 'FLOOR' | 'CEILING';
  pfEffectiveDate: string;

  // 4.5 ESI
  esiEnabled: boolean;
  employeeEsiPercent: number;
  employerEsiPercent: number;
  maxEsiSalary: number;
  esiRoundingRule: 'ROUND' | 'FLOOR' | 'CEILING';
  esiEffectiveDate: string;

  // 4.6 Leave Settings
  paidLeavePerYear: number;
  halfDayRule: boolean;
  leaveEncashment: boolean;
  lateEntryGraceMinutes: number;
  lateEntrySlabs: SlabEntry[];

  // 4.7 Attendance Settings
  standardWorkingHours: number;
  breakHours: number;
  lateEntryThresholdMinutes: number;
  earlyExitThresholdMinutes: number;
  halfDayCutoffHours: number;
  weeklyOffPaidDays: number;
  permissionSlabs: SlabEntry[];

  // 4.8 Salary Components
  components: SalaryComponent[];

  // 4.9 Deductions
  professionalTaxEnabled: boolean;
  professionalTaxAmount: number;

  // 4.10 Rounding
  roundingRule: 'ROUND' | 'FLOOR' | 'CEILING';
  decimalPrecision: number;
}

// ──────────────────────────────────────────────
// EMPLOYEE (payroll view)
// ──────────────────────────────────────────────
export interface PayrollEmployee {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  salaryType: SalaryType;
  monthlySalary: number;
  basicSalary: number;
  da: number;
  hra: number;
  otherAllowance: number;
  cashInHand: number;
  dailySalary?: number;
  bankAccount?: string;
  pfNumber?: string;
  esiNumber?: string;
}

// ──────────────────────────────────────────────
// ATTENDANCE
// ──────────────────────────────────────────────
export interface DayAttendance {
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  otHours: number;
  lateMinutes: number;
  permissionMinutes: number;
}

export interface EmployeeAttendance {
  employeeId: string;
  period: string; // YYYY-MM  or  YYYY-Wxx
  days: DayAttendance[];
}

// ──────────────────────────────────────────────
// PAYROLL RESULT  (engine output)
// ──────────────────────────────────────────────
export interface PayrollResult {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  salaryType: SalaryType;

  // Attendance summary
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lopDays: number;
  halfDays: number;
  paidLeaveDays: number;
  weeklyOffDays: number;
  holidayDays: number;

  // Earnings
  dailyRate: number;
  basicSalary: number;
  da: number;
  hra: number;
  otherAllowance: number;
  grossSalary: number;
  earnedSalary: number;
  otHours: number;
  otPay: number;
  incentive: number;

  // PF / ESI
  pfWage: number;
  employeePf: number;
  employerPf: number;
  employeeEsi: number;
  employerEsi: number;
  pfApplicable: boolean;
  esiApplicable: boolean;

  // Deductions
  professionalTax: number;
  lateEntryDeduction: number;
  permissionDeduction: number;
  salaryAdvance: number;
  loanRecovery: number;
  otherDeductions: number;
  totalDeductions: number;

  // Net
  netSalary: number;
  paymentMode: 'BANK' | 'CASH';

  // Variance
  hasVariance: boolean;
  varianceNote?: string;
}

// ──────────────────────────────────────────────
// PAYROLL RUN
// ──────────────────────────────────────────────
export interface PayrollRun {
  id: string;
  period: string;
  type: 'WEEKLY' | 'MONTHLY';
  status: PayrollStatus;
  employeeCategory: SalaryType | 'ALL';
  totalEmployees: number;
  totalNetSalary: number;
  createdAt: string;
  approvedAt?: string;
  lockedAt?: string;
  results: PayrollResult[];
}
