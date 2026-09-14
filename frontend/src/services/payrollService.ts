import apiClient from '../api/apiClient';

const BASE = '/payroll';

// ─── Types (API response shapes) ──────────────────────────────────────────────
export interface ApiPayrollConfig {
  id: number;
  companyId: string;
  dailySalaryFormula: string;
  salaryCalculationMethod: string;
  fixedDays: number;
  defaultWorkingHoursPerDay: number;
  weeklyOffDays: number[];
  otEnabled: boolean;
  otMethod: string;
  otRatePerHour: number;
  weekdayOtMultiplier: number;
  holidayOtMultiplier: number;
  weeklyOffOtMultiplier: number;
  maxOtHoursPerDay: number;
  maxOtHoursPerWeek: number;
  otSlabs: any[];
  teaOtRate: number;
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
  staffPermissionFreeMinutes?: number;
  staffExcessHourlyRate?: number;
  lateEntrySlabs: any[];
  permissionSlabs: any[];
  professionalTaxEnabled: boolean;
  professionalTaxAmount: number;
  components: any[];
  roundingRule: string;
  decimalPrecision: number;
}

export interface ApiEmployeePayroll {
  id: string;
  empCode: string;
  fullName: string;
  salaryType?: string;   // raw Employee.salaryType from the DB (monthly|weekly|daily|hourly)
  designation: string | null;
  department: { name: string } | null;
  payrollConfig: {
    salaryType: string;
    monthlySalary: number;
    basicSalary: number;
    da: number;
    hra: number;
    otherAllowance: number;
    dailySalary: number | null;
    bankAccount: string | null;
    ifscCode: string | null;
    bankName: string | null;
    pfNumber: string | null;
    esiNumber: string | null;
    paymentMode: string;
  } | null;
}

export interface AttendanceInput {
  employeeId: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  otHours: number;
  otDays: number;
  teaOtCount: number;
  lateMinutes: number;
  dailyLateMinutes: number[];  // per-day late minutes for per-day slab deduction
  permissionMinutes: number;
  advance: number;
}

export interface ApiPayrollResult {
  id: number;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  salaryType: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lopDays: number;
  halfDays: number;
  dailyRate: number;
  monthlySalary?: number;
  formulaDivisor?: number;
  earnedSalary: number;
  grossSalary: number;
  otHours: number;
  otPay: number;
  pfWage: number;
  employeePf: number;
  employerPf: number;
  employeeEsi: number;
  employerEsi: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  professionalTax: number;
  lateEntryDeduction: number;
  lateMinutes?: number;
  permissionDeduction: number;
  permissionMinutes?: number;
  salaryAdvance: number;
  loanRecovery: number;
  otherDeductions: number;
  totalDeductions: number;
  bankTransfer?: number;
  cashPayment?: number;
  cashPaid?: number;
  actualSalary?: number;
  netSalary: number;
  paymentMode: string;
  hasVariance: boolean;
  varianceNote?: string;
  cashInHand: number;
}

export interface ApiPayrollRun {
  id: number;
  runCode: string;
  period: string;
  type: 'MONTHLY' | 'WEEKLY';
  status: 'DRAFT' | 'APPROVED' | 'LOCKED';
  employeeCategory: string;
  calendarDays: number;
  totalEmployees: number;
  totalGross: number;
  totalNetSalary: number;
  totalPfEmployee: number;
  totalPfEmployer: number;
  totalEsiEmployee: number;
  totalEsiEmployer: number;
  totalAdditionalComp?: number;
  totalCombinedGross?: number;
  totalCombinedNet?: number;
  createdById: string;
  approvedById: string | null;
  lockedById: string | null;
  createdAt: string;
  approvedAt: string | null;
  lockedAt: string | null;
  results: ApiPayrollResult[];
}

export interface ApiSalaryAdvance {
  id: number;
  employeeId: string;
  amount: number;
  disbursedDate: string;
  reason?: string;
  recoveredAmount: number;
  status: 'PENDING' | 'PARTIAL' | 'CLEARED';
  createdAt: string;
  employee: { empCode: string; fullName: string };
}

export interface ApiPayslipData {
  company: {
    companyName:  string;
    legalName:    string | null;
    addressLine1: string | null;
    city:         string | null;
    state:        string | null;
    zipcode:      string | null;
    phone:        string | null;
    email:        string | null;
    website:      string | null;
    gstin:        string | null;
    logoUrl:      string | null;
  } | null;
  run: {
    id:       number;
    runCode:  string;
    period:   string;
    type:     'MONTHLY' | 'WEEKLY';
    status:   string;
    lockedAt: string | null;
  };
  employee: {
    id:            string;
    empCode:       string;
    fullName:      string;
    designation:   string | null;
    employeeType:  string | null;
    pfNumber:      string | null;
    esiNumber:     string | null;
    uanNumber:     string | null;
    panNumber:     string | null;
    bankName:      string | null;
    accountNumber: string | null;
    ifscCode:      string | null;
    department:    string;
    dateOfJoining: string | null;
    payrollConfig: {
      salaryType:     string;
      monthlySalary:  number;
      basicSalary:    number;
      hra:            number;
      da:             number;
      otherAllowance: number;
      paymentMode:    string;
    } | null;
  };
  result: {
    id:                  number;
    employeeCode:        string;
    employeeName:        string;
    salaryType:          string;
    totalDays:           number;
    presentDays:         number;
    absentDays:          number;
    lopDays:             number;
    halfDays:            number;
    lateMinutes:         number;
    permissionMinutes:   number;
    dailyRate:           number;
    earnedSalary:        number;
    grossSalary:         number;
    otHours:             number;
    otPay:               number;
    pfWage:              number;
    employeePf:          number;
    employerPf:          number;
    employeeEsi:         number;
    employerEsi:         number;
    pfApplicable:        boolean;
    esiApplicable:       boolean;
    professionalTax:     number;
    lateEntryDeduction:  number;
    permissionDeduction: number;
    salaryAdvance:       number;
    loanRecovery:        number;
    otherDeductions:     number;
    totalDeductions:     number;
    netSalary:           number;
    cashInHand:          number;
    paymentMode:         string;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

/** Payroll Config */
export const payrollService = {

  // Config
  getConfig: async (): Promise<ApiPayrollConfig> => {
    const { data } = await apiClient.get(`${BASE}/config`);
    return data.data;
  },

  updateConfig: async (payload: Partial<ApiPayrollConfig>): Promise<ApiPayrollConfig> => {
    const { data } = await apiClient.put(`${BASE}/config`, payload);
    return data.data;
  },

  // Employees
  listEmployees: async (category?: string): Promise<ApiEmployeePayroll[]> => {
    const params = category ? { category } : {};
    const { data } = await apiClient.get(`${BASE}/employees`, { params });
    return data.data;
  },

  getEmployeeConfig: async (employeeId: number) => {
    const { data } = await apiClient.get(`${BASE}/employees/${employeeId}/config`);
    return data.data;
  },

  upsertEmployeeConfig: async (employeeId: number, payload: any) => {
    const { data } = await apiClient.put(`${BASE}/employees/${employeeId}/config`, payload);
    return data.data;
  },

  // Attendance
  getAttendance: async (period: string, employeeId?: number) => {
    const params: Record<string, any> = { period };
    if (employeeId) params.employeeId = employeeId;
    const { data } = await apiClient.get(`${BASE}/attendance`, { params });
    return data.data;
  },

  bulkUpsertAttendance: async (period: string, records: any[], clearedDates?: { employeeId: number; date: string }[]) => {
    const { data } = await apiClient.post(`${BASE}/attendance`, { period, records, clearedDates });
    return data.data;
  },

  // Payroll Runs
  listRuns: async (params?: { period?: string; type?: string; status?: string; year?: string; month?: string; week?: string; page?: number; limit?: number }) => {
    const { data } = await apiClient.get(`${BASE}/runs`, { params });
    return data.data as { runs: ApiPayrollRun[]; total: number; page: number; limit: number };
  },

  getRun: async (id: number): Promise<ApiPayrollRun> => {
    const { data } = await apiClient.get(`${BASE}/runs/${id}`);
    return data.data;
  },

  computeRun: async (payload: {
    period: string;
    type: 'MONTHLY' | 'WEEKLY';
    employeeCategory: string;
    calendarDays: number;
    attendance: AttendanceInput[];
  }): Promise<ApiPayrollRun> => {
    const { data } = await apiClient.post(`${BASE}/runs`, payload);
    return data.data;
  },

  approveRun: async (id: number): Promise<ApiPayrollRun> => {
    const { data } = await apiClient.post(`${BASE}/runs/${id}/approve`);
    return data.data;
  },

  lockRun: async (id: number): Promise<ApiPayrollRun> => {
    const { data } = await apiClient.post(`${BASE}/runs/${id}/lock`);
    return data.data;
  },

  deleteRun: async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE}/runs/${id}`);
  },

  // Salary Advances
  listAdvances: async (params?: { employeeId?: number; status?: string; dateFrom?: string; dateTo?: string }): Promise<ApiSalaryAdvance[]> => {
    const { data } = await apiClient.get(`${BASE}/advances`, { params });
    return data.data;
  },

  createAdvance: async (payload: { employeeId: number; amount: number; disbursedDate: string; reason?: string }): Promise<ApiSalaryAdvance> => {
    const { data } = await apiClient.post(`${BASE}/advances`, payload);
    return data.data;
  },

  deleteAdvance: async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE}/advances/${id}`);
  },

  // Payslip
  getPayslip: async (runId: number, resultId: number): Promise<ApiPayslipData> => {
    const { data } = await apiClient.get(`${BASE}/runs/${runId}/payslip/${resultId}`);
    return data.data;
  },

  // Bonus Calculation
  getBonusCalculation: async (params: { startDate: string; endDate: string; category?: string }): Promise<ApiBonusCalculationResponse> => {
    const { data } = await apiClient.get(`${BASE}/bonus`, { params });
    return data.data;
  },

  // Extended Compensation (Super Admin only)
};

export interface ApiBonusMonthMeta {
  monthKey: string;
  label: string;
  year: number;
  month: number;
  daysInMonth: number;
}

export interface ApiBonusMonthlyData {
  monthKey: string;
  label: string;
  totalDays: number;
  presentDays: number;
  leaveDays: number;
}

export interface ApiBonusEmployeeRow {
  sNo: number;
  employeeId: string;
  rollNo: string;
  employeeName: string;
  department: string;
  dateOfJoining: string | null;
  formattedDoj: string;
  experienceYears: number;
  monthlySalary: number;
  salaryType: string;
  monthlyData: ApiBonusMonthlyData[];
  totalLeaveDays: number;
  totalPresentDays: number;
  perDayBonus: number;
  bonus: number;
  paidAmount: number;
  balance: number;
}

export interface ApiBonusSummary {
  totalEmployees: number;
  totalGrossSalary: number;
  totalPresentDays: number;
  totalLeaveDays: number;
  totalBonus: number;
  totalPaidAmount: number;
  totalBalance: number;
}

export interface ApiBonusCalculationResponse {
  startDate: string;
  endDate: string;
  months: ApiBonusMonthMeta[];
  employees: ApiBonusEmployeeRow[];
  summary: ApiBonusSummary;
}

