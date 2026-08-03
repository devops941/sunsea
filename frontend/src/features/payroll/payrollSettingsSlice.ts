import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { PayrollSettings, SlabEntry, SalaryComponent } from './payrollTypes';

// ─── Default slabs ────────────────────────────────────────────────────────────
const defaultOtSlabs: SlabEntry[] = [
  { id: 'ot-1', label: '10 minutes', fromMinutes: 1,  toMinutes: 10, amount: 10 },
  { id: 'ot-2', label: '15 minutes', fromMinutes: 11, toMinutes: 20, amount: 20 },
  { id: 'ot-3', label: '30 minutes', fromMinutes: 21, toMinutes: 40, amount: 30 },
  { id: 'ot-4', label: '60 minutes', fromMinutes: 41, toMinutes: 90, amount: 40 },
];

const defaultPermissionSlabs: SlabEntry[] = [
  { id: 'perm-1', label: '10 minutes', fromMinutes: 1,  toMinutes: 10, amount: 10 },
  { id: 'perm-2', label: '15 minutes', fromMinutes: 11, toMinutes: 20, amount: 20 },
  { id: 'perm-3', label: '30 minutes', fromMinutes: 21, toMinutes: 40, amount: 30 },
  { id: 'perm-4', label: '60 minutes', fromMinutes: 41, toMinutes: 90, amount: 40 },
];

// ─── Default salary components ────────────────────────────────────────────────
const defaultComponents: SalaryComponent[] = [
  { id: 'comp-1', name: 'Basic',             type: 'FIXED',               value: 0,    isTaxable: true,  isPfApplicable: true,  isEsiApplicable: true,  isActive: true  },
  { id: 'comp-2', name: 'DA',                type: 'PERCENTAGE_OF_BASIC', value: 10,   isTaxable: true,  isPfApplicable: false, isEsiApplicable: true,  isActive: true  },
  { id: 'comp-3', name: 'HRA',               type: 'PERCENTAGE_OF_BASIC', value: 20,   isTaxable: false, isPfApplicable: false, isEsiApplicable: false, isActive: true  },
  { id: 'comp-4', name: 'Special Allowance', type: 'FIXED',               value: 0,    isTaxable: true,  isPfApplicable: false, isEsiApplicable: false, isActive: true  },
  { id: 'comp-5', name: 'Conveyance',        type: 'FIXED',               value: 1600, isTaxable: false, isPfApplicable: false, isEsiApplicable: false, isActive: false },
];

// ─── Initial state ────────────────────────────────────────────────────────────
const initialState: PayrollSettings = {
  // 4.1
  payrollFrequency: 'MONTHLY',
  salaryCalculationMethod: 'WORKING_DAYS',
  fixedDays: 26,
  defaultWorkingHoursPerDay: 8,
  weeklyOffDays: [0], // Sunday

  // 4.2
  dailySalaryFormula: 'MONTHLY_BY_WORKING',

  // 4.3
  otEnabled: true,
  otMethod: 'HOURLY_RATE',
  otRatePerHour: 50,
  weekdayOtMultiplier: 1,
  holidayOtMultiplier: 2,
  weeklyOffOtMultiplier: 1.5,
  maxOtHoursPerDay: 4,
  maxOtHoursPerWeek: 20,
  otSlabs: defaultOtSlabs,

  // 4.4
  pfEnabled: true,
  pfWageFormula: 'BASIC',
  employeePfPercent: 12,
  employerPfPercent: 13,
  maxPfWage: 15000,
  voluntaryPf: false,
  pfRoundingRule: 'ROUND',
  pfEffectiveDate: '2024-04-01',

  // 4.5
  esiEnabled: true,
  employeeEsiPercent: 0.75,
  employerEsiPercent: 3.25,
  maxEsiSalary: 21000,
  esiRoundingRule: 'ROUND',
  esiEffectiveDate: '2024-04-01',

  // 4.6
  paidLeavePerYear: 12,
  halfDayRule: true,
  leaveEncashment: false,
  lateEntryGraceMinutes: 5,
  lateEntrySlabs: [] as SlabEntry[],

  // 4.7
  standardWorkingHours: 8,
  breakHours: 0.5,
  lateEntryThresholdMinutes: 30,
  earlyExitThresholdMinutes: 30,
  halfDayCutoffHours: 4,
  weeklyOffPaidDays: 4,
  permissionSlabs: defaultPermissionSlabs,

  // 4.8
  components: defaultComponents,

  // 4.9
  professionalTaxEnabled: true,
  professionalTaxAmount: 200,

  // 4.10
  roundingRule: 'ROUND',
  decimalPrecision: 2,
};

// ─── Slice ────────────────────────────────────────────────────────────────────
const payrollSettingsSlice = createSlice({
  name: 'payrollSettings',
  initialState,
  reducers: {
    updateSettings: (state, action: PayloadAction<Partial<PayrollSettings>>) => {
      return { ...state, ...action.payload };
    },
    resetSettings: () => initialState,

    // OT slabs
    addOtSlab: (state, action: PayloadAction<SlabEntry>) => {
      state.otSlabs.push(action.payload);
    },
    removeOtSlab: (state, action: PayloadAction<string>) => {
      state.otSlabs = state.otSlabs.filter((s) => s.id !== action.payload);
    },
    updateOtSlab: (state, action: PayloadAction<SlabEntry>) => {
      const idx = state.otSlabs.findIndex((s) => s.id === action.payload.id);
      if (idx !== -1) state.otSlabs[idx] = action.payload;
    },

    // Permission slabs
    addPermissionSlab: (state, action: PayloadAction<SlabEntry>) => {
      state.permissionSlabs.push(action.payload);
    },
    removePermissionSlab: (state, action: PayloadAction<string>) => {
      state.permissionSlabs = state.permissionSlabs.filter((s) => s.id !== action.payload);
    },
    updatePermissionSlab: (state, action: PayloadAction<SlabEntry>) => {
      const idx = state.permissionSlabs.findIndex((s) => s.id === action.payload.id);
      if (idx !== -1) state.permissionSlabs[idx] = action.payload;
    },

    // Salary components
    addComponent: (state, action: PayloadAction<SalaryComponent>) => {
      state.components.push(action.payload);
    },
    removeComponent: (state, action: PayloadAction<string>) => {
      state.components = state.components.filter((c) => c.id !== action.payload);
    },
    updateComponent: (state, action: PayloadAction<SalaryComponent>) => {
      const idx = state.components.findIndex((c) => c.id === action.payload.id);
      if (idx !== -1) state.components[idx] = action.payload;
    },
  },
});

export const {
  updateSettings, resetSettings,
  addOtSlab, removeOtSlab, updateOtSlab,
  addPermissionSlab, removePermissionSlab, updatePermissionSlab,
  addComponent, removeComponent, updateComponent,
} = payrollSettingsSlice.actions;

export default payrollSettingsSlice.reducer;
