import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { PayrollEmployee, EmployeeAttendance, PayrollRun, PayrollStatus, DayAttendance } from './payrollTypes';

// ─── Mock Employees ───────────────────────────────────────────────────────────
export const MOCK_EMPLOYEES: PayrollEmployee[] = [
  // Fixed Monthly (Admin/Office)
  { id: 'E001', employeeCode: 'EMP001', name: 'Rajan Kumar',  department: 'Admin',      designation: 'Manager',        employeeCategory: 'office_staff', salaryType: 'FIXED_MONTHLY', monthlySalary: 25000, basicSalary: 15000, da: 1500, hra: 3000, otherAllowance: 5500, bankAccount: 'HDFC-001', pfNumber: 'TN/12345/001' },
  { id: 'E002', employeeCode: 'EMP002', name: 'Meena Devi',   department: 'Admin',      designation: 'Accountant',     employeeCategory: 'office_staff', salaryType: 'FIXED_MONTHLY', monthlySalary: 18000, basicSalary: 10000, da: 1000, hra: 2000, otherAllowance: 5000, bankAccount: 'HDFC-002', pfNumber: 'TN/12345/002' },
  // PF Monthly (Factory Workers)
  { id: 'E003', employeeCode: 'EMP003', name: 'Arun S',       department: 'Production', designation: 'Operator',       employeeCategory: 'labour',       salaryType: 'PF_MONTHLY',    monthlySalary: 12500, basicSalary: 8000,  da: 800,  hra: 1600, otherAllowance: 2100, pfNumber: 'TN/12345/003', esiNumber: 'ESI-003' },
  { id: 'E004', employeeCode: 'EMP004', name: 'Sagar M',      department: 'Production', designation: 'Operator',       employeeCategory: 'labour',       salaryType: 'PF_MONTHLY',    monthlySalary: 10900, basicSalary: 7000,  da: 700,  hra: 1400, otherAllowance: 1800, pfNumber: 'TN/12345/004', esiNumber: 'ESI-004' },
  // Cash Monthly (Non-PF)
  { id: 'E005', employeeCode: 'EMP005', name: 'Rajesh T',     department: 'Warehouse',  designation: 'Helper',         employeeCategory: 'labour',       salaryType: 'CASH_MONTHLY',  monthlySalary: 9500,  basicSalary: 9500,  da: 0,    hra: 0,    otherAllowance: 0 },
  { id: 'E006', employeeCode: 'EMP006', name: 'Nathiya K',    department: 'Warehouse',  designation: 'Helper',         employeeCategory: 'labour',       salaryType: 'CASH_MONTHLY',  monthlySalary: 8500,  basicSalary: 8500,  da: 0,    hra: 0,    otherAllowance: 0 },
  { id: 'E007', employeeCode: 'EMP007', name: 'Priya S',      department: 'Warehouse',  designation: 'Helper',         employeeCategory: 'labour',       salaryType: 'CASH_MONTHLY',  monthlySalary: 9000,  basicSalary: 9000,  da: 0,    hra: 0,    otherAllowance: 0 },
  // Daily Wage Weekly
  { id: 'E008', employeeCode: 'EMP008', name: 'Kumar V',      department: 'Production', designation: 'Daily Worker',   employeeCategory: 'labour',       salaryType: 'DAILY_WEEKLY',  monthlySalary: 0,     basicSalary: 0,     da: 0,    hra: 0,    otherAllowance: 0, dailySalary: 500 },
  { id: 'E009', employeeCode: 'EMP009', name: 'Shankar R',    department: 'Production', designation: 'Daily Worker',   employeeCategory: 'labour',       salaryType: 'DAILY_WEEKLY',  monthlySalary: 0,     basicSalary: 0,     da: 0,    hra: 0,    otherAllowance: 0, dailySalary: 450 },
  { id: 'E010', employeeCode: 'EMP010', name: 'Mani P',       department: 'Production', designation: 'Daily Worker',   employeeCategory: 'labour',       salaryType: 'DAILY_WEEKLY',  monthlySalary: 0,     basicSalary: 0,     da: 0,    hra: 0,    otherAllowance: 0, dailySalary: 400 },
];

// ─── Helper to generate attendance for a period ───────────────────────────────
function genDays(employeeId: string, period: string, config: {
  totalDays: number; presentDays: number; absentDays: number; halfDays: number;
  otHours: number; lateMinutes: number; permissionMinutes: number;
}): EmployeeAttendance {
  const days: DayAttendance[] = [];
  let present = 0, absent = 0, half = 0;

  for (let i = 1; i <= config.totalDays; i++) {
    const date = `${period}-${String(i).padStart(2, '0')}`;
    const dow = new Date(date).getDay();
    if (dow === 0) { // Sunday = weekly off
      days.push({ date, status: 'WEEKLY_OFF', otHours: 0, lateMinutes: 0, permissionMinutes: 0 });
      continue;
    }
    let status: DayAttendance['status'] = 'PRESENT';
    if (absent < config.absentDays) { status = 'ABSENT'; absent++; }
    else if (half < config.halfDays) { status = 'HALF_DAY'; half++; }
    else { present++; }

    const isLast = i === config.totalDays;
    days.push({
      date, status,
      otHours: isLast ? config.otHours : 0,
      lateMinutes: isLast ? config.lateMinutes : 0,
      permissionMinutes: isLast ? config.permissionMinutes : 0,
    });
  }
  return { employeeId, period, days };
}

// ─── Mock Attendance for 2026-08 ──────────────────────────────────────────────
export const MOCK_ATTENDANCE: EmployeeAttendance[] = [
  genDays('E001', '2026-08', { totalDays: 31, presentDays: 26, absentDays: 0, halfDays: 0, otHours: 2,   lateMinutes: 0,  permissionMinutes: 0  }),
  genDays('E002', '2026-08', { totalDays: 31, presentDays: 24, absentDays: 2, halfDays: 0, otHours: 0,   lateMinutes: 15, permissionMinutes: 10 }),
  genDays('E003', '2026-08', { totalDays: 31, presentDays: 26, absentDays: 0, halfDays: 0, otHours: 4,   lateMinutes: 0,  permissionMinutes: 0  }),
  genDays('E004', '2026-08', { totalDays: 31, presentDays: 25, absentDays: 1, halfDays: 0, otHours: 2,   lateMinutes: 20, permissionMinutes: 15 }),
  genDays('E005', '2026-08', { totalDays: 31, presentDays: 26, absentDays: 0, halfDays: 0, otHours: 3,   lateMinutes: 0,  permissionMinutes: 0  }),
  genDays('E006', '2026-08', { totalDays: 31, presentDays: 25, absentDays: 0, halfDays: 1, otHours: 2,   lateMinutes: 30, permissionMinutes: 25 }),
  genDays('E007', '2026-08', { totalDays: 31, presentDays: 26, absentDays: 0, halfDays: 0, otHours: 1.5, lateMinutes: 0,  permissionMinutes: 0  }),
  // Weekly workers — only July-Aug week
  genDays('E008', '2026-08', { totalDays: 31, presentDays: 5,  absentDays: 0, halfDays: 1, otHours: 2,   lateMinutes: 0,  permissionMinutes: 0  }),
  genDays('E009', '2026-08', { totalDays: 31, presentDays: 6,  absentDays: 0, halfDays: 0, otHours: 1,   lateMinutes: 0,  permissionMinutes: 0  }),
  genDays('E010', '2026-08', { totalDays: 31, presentDays: 4,  absentDays: 1, halfDays: 0, otHours: 0.5, lateMinutes: 0,  permissionMinutes: 0  }),
];

// ─── Mock Payroll Runs ────────────────────────────────────────────────────────
const mockRuns: PayrollRun[] = [
  {
    id: 'run-001', period: '2026-07', type: 'MONTHLY', status: 'LOCKED',
    employeeCategory: 'ALL', totalEmployees: 7, totalNetSalary: 212430,
    createdAt: '2026-07-31T10:00:00Z', approvedAt: '2026-07-31T11:00:00Z', lockedAt: '2026-08-01T09:00:00Z',
    results: [],
  },
  {
    id: 'run-002', period: '2026-W31', type: 'WEEKLY', status: 'APPROVED',
    employeeCategory: 'DAILY_WEEKLY', totalEmployees: 3, totalNetSalary: 8350,
    createdAt: '2026-08-01T09:00:00Z', approvedAt: '2026-08-01T14:00:00Z',
    results: [],
  },
  {
    id: 'run-003', period: '2026-08', type: 'MONTHLY', status: 'DRAFT',
    employeeCategory: 'ALL', totalEmployees: 7, totalNetSalary: 0,
    createdAt: '2026-08-01T15:00:00Z',
    results: [],
  },
];

// ─── Slice state ──────────────────────────────────────────────────────────────
interface PayrollRunState {
  runs: PayrollRun[];
  currentRun: PayrollRun | null;
}

const initialState: PayrollRunState = {
  runs: mockRuns,
  currentRun: null,
};

const payrollRunSlice = createSlice({
  name: 'payrollRun',
  initialState,
  reducers: {
    setCurrentRun: (state, action: PayloadAction<PayrollRun | null>) => {
      state.currentRun = action.payload;
    },
    addRun: (state, action: PayloadAction<PayrollRun>) => {
      state.runs.unshift(action.payload);
    },
    updateRun: (state, action: PayloadAction<PayrollRun>) => {
      const idx = state.runs.findIndex((r) => r.id === action.payload.id);
      if (idx !== -1) state.runs[idx] = action.payload;
      if (state.currentRun?.id === action.payload.id) state.currentRun = action.payload;
    },
    updateRunStatus: (
      state,
      action: PayloadAction<{ id: string; status: PayrollStatus; timestamp: string }>
    ) => {
      const { id, status, timestamp } = action.payload;
      const run = state.runs.find((r) => r.id === id);
      if (run) {
        run.status = status;
        if (status === 'APPROVED') run.approvedAt = timestamp;
        if (status === 'LOCKED') run.lockedAt = timestamp;
      }
      if (state.currentRun?.id === id) {
        state.currentRun.status = status;
      }
    },
  },
});

export const { setCurrentRun, addRun, updateRun, updateRunStatus } = payrollRunSlice.actions;
export default payrollRunSlice.reducer;
