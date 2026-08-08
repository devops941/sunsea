import { z } from 'zod';

// ─── Payroll Config ───────────────────────────────────────────────────────────
// Note: Prisma Decimal fields are serialized as strings in JSON (e.g. "1.5"), so we
// use z.coerce.number() for all numeric fields to accept both string and number input.
export const updatePayrollConfigSchema = z.object({
  body: z.object({
    dailySalaryFormula:        z.enum(['MONTHLY_BY_CALENDAR', 'MONTHLY_BY_WORKING', 'FIXED_DAILY']).optional(),
    salaryCalculationMethod:   z.enum(['CALENDAR_DAYS', 'WORKING_DAYS', 'FIXED_DAYS']).optional(),
    fixedDays:                 z.coerce.number().int().min(1).max(31).optional(),
    defaultWorkingHoursPerDay: z.coerce.number().min(1).max(24).optional(),
    weeklyOffDays:             z.array(z.coerce.number().int().min(0).max(6)).optional(),

    otEnabled:                 z.boolean().optional(),
    otMethod:                  z.enum(['HOURLY_RATE', 'FIXED_AMOUNT', 'PERCENTAGE_DAILY', 'SLAB']).optional(),
    otRatePerHour:             z.coerce.number().min(0).optional(),
    weekdayOtMultiplier:       z.coerce.number().min(0).optional(),
    holidayOtMultiplier:       z.coerce.number().min(0).optional(),
    weeklyOffOtMultiplier:     z.coerce.number().min(0).optional(),
    maxOtHoursPerDay:          z.coerce.number().min(0).optional(),
    maxOtHoursPerWeek:         z.coerce.number().min(0).optional(),
    otSlabs:                   z.array(z.any()).optional(),

    pfEnabled:                 z.boolean().optional(),
    pfWageFormula:             z.enum(['BASIC', 'GROSS']).optional(),
    employeePfPercent:         z.coerce.number().min(0).max(100).optional(),
    employerPfPercent:         z.coerce.number().min(0).max(100).optional(),
    maxPfWage:                 z.coerce.number().min(0).optional(),
    pfRoundingRule:            z.enum(['ROUND', 'FLOOR', 'CEILING']).optional(),

    esiEnabled:                z.boolean().optional(),
    employeeEsiPercent:        z.coerce.number().min(0).max(100).optional(),
    employerEsiPercent:        z.coerce.number().min(0).max(100).optional(),
    maxEsiSalary:              z.coerce.number().min(0).optional(),
    esiRoundingRule:           z.enum(['ROUND', 'FLOOR', 'CEILING']).optional(),

    paidLeavePerYear:          z.coerce.number().int().min(0).optional(),
    lateEntryGraceMinutes:     z.coerce.number().int().min(0).optional(),
    lateEntrySlabs:            z.array(z.any()).optional(),
    permissionSlabs:           z.array(z.any()).optional(),

    professionalTaxEnabled:    z.boolean().optional(),
    professionalTaxAmount:     z.coerce.number().min(0).optional(),
    components:                z.array(z.any()).optional(),
    roundingRule:              z.enum(['ROUND', 'FLOOR', 'CEILING']).optional(),
    decimalPrecision:          z.coerce.number().int().min(0).max(4).optional(),
  }),
  query: z.object({}),
  params: z.object({}),
});

// ─── Employee Payroll Config ──────────────────────────────────────────────────
export const upsertEmployeePayrollSchema = z.object({
  body: z.object({
    salaryType:     z.enum(['FIXED_MONTHLY', 'PF_MONTHLY', 'CASH_MONTHLY', 'DAILY_WEEKLY']),
    monthlySalary:  z.coerce.number().min(0),
    basicSalary:    z.coerce.number().min(0),
    da:             z.coerce.number().min(0).default(0),
    hra:            z.coerce.number().min(0).default(0),
    otherAllowance: z.coerce.number().min(0).default(0),
    dailySalary:    z.coerce.number().min(0).optional(),
    bankAccount:    z.string().max(50).optional(),
    ifscCode:       z.string().max(15).optional(),
    bankName:       z.string().max(80).optional(),
    pfNumber:       z.string().max(30).optional(),
    esiNumber:      z.string().max(30).optional(),
    paymentMode:    z.enum(['BANK', 'CASH']).default('CASH'),
  }),
  query: z.object({}),
  params: z.object({ employeeId: z.string() }),
});

// ─── Attendance ───────────────────────────────────────────────────────────────
export const bulkUpsertAttendanceSchema = z.object({
  body: z.object({
    period: z.string().regex(/^\d{4}-\d{2}$|^\d{4}-W\d{2}$/),
    records: z.array(z.object({
      employeeId:        z.number().int().positive(),
      date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status:            z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'WEEKLY_OFF', 'HOLIDAY', 'LEAVE_PAID', 'LEAVE_UNPAID']),
      otHours:           z.number().min(0).default(0),
      lateMinutes:       z.number().int().min(0).default(0),
      permissionMinutes: z.number().int().min(0).default(0),
      salaryAdvance:     z.number().min(0).default(0),
    })),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const getAttendanceSchema = z.object({
  body: z.object({}),
  query: z.object({
    period:     z.string(),
    employeeId: z.string().optional(),
  }),
  params: z.object({}),
});

// ─── Payroll Run ──────────────────────────────────────────────────────────────
export const createPayrollRunSchema = z.object({
  body: z.object({
    period:           z.string().regex(/^\d{4}-\d{2}$|^\d{4}-W\d{2}$/),
    type:             z.enum(['MONTHLY', 'WEEKLY']),
    employeeCategory: z.enum(['ALL', 'FIXED_MONTHLY', 'PF_MONTHLY', 'CASH_MONTHLY', 'DAILY_WEEKLY']).default('ALL'),
    calendarDays:     z.number().int().min(1).max(366).default(31),
    attendance: z.array(z.object({
      employeeId:        z.number().int().positive(),
      presentDays:       z.number().min(0),
      absentDays:        z.number().min(0),
      halfDays:          z.number().min(0),
      otHours:           z.number().min(0).default(0),
      lateMinutes:       z.number().int().min(0).default(0),
      dailyLateMinutes:  z.array(z.number().int().min(0)).optional(),
      permissionMinutes: z.number().int().min(0).default(0),
      advance:           z.number().min(0).default(0),
    })),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const runActionSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: z.object({ id: z.string() }),
});

export const listRunsSchema = z.object({
  body: z.object({}),
  query: z.object({
    period: z.string().optional(),
    type:   z.enum(['MONTHLY', 'WEEKLY']).optional(),
    status: z.string().optional(),
    page:   z.string().optional(),
    limit:  z.string().optional(),
  }),
  params: z.object({}),
});

// ─── Extended Compensation (Super Admin only) ─────────────────────────────────
export const upsertExtendedCompSchema = z.object({
  body: z.object({
    offRecordAmount: z.coerce.number({
      required_error: 'offRecordAmount is required',
      invalid_type_error: 'offRecordAmount must be a number',
    }).positive('offRecordAmount must be a positive number'),
  }),
  query:  z.object({}),
  params: z.object({ employeeId: z.string() }),
});

// ─── Salary Advance ───────────────────────────────────────────────────────────
export const createAdvanceSchema = z.object({
  body: z.object({
    employeeId:    z.coerce.number().int().positive(),
    amount:        z.coerce.number().positive(),
    disbursedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason:        z.string().max(200).optional(),
  }),
  query:  z.object({}),
  params: z.object({}),
});
