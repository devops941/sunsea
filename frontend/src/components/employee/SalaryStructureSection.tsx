/**
 * SalaryStructureSection
 * ──────────────────────
 * Enterprise-grade dynamic salary structure component for Employee Create / Edit.
 *
 * ► Dynamically renders fields based on selected Salary Type
 * ► Calculates derived values (daily / hourly / weekly / monthly) in real-time
 *   using Company Payroll Settings — never hardcoded
 * ► Shows a live read-only Salary Preview panel
 * ► Manages statutory flags & bank details
 */

import React, { useMemo } from 'react';
import {
  FaMoneyBillWave, FaUniversity, FaCalculator, FaClock,
  FaInfoCircle, FaCheckCircle,
} from 'react-icons/fa';

import TextInput from '../form/TextInput/TextInput';
import SelectInput from '../form/SelectInput/SelectInput';
import { usePayrollConfig } from '../../hooks/usePayrollConfig';
import {
  deriveFromMonthly,
  deriveFromWeekly,
  deriveFromDaily,
  deriveFromHourly,
  getMonthlyWorkingDays,
  getWeeklyWorkingDays,
  calcShiftWorkingHours,
  formatINR,
  calcMethodLabel,
  type PayrollCalcConfig,
} from '../../utils/salaryCalculation';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Subset of the parent FormState that this component reads/writes. */
export interface SalaryFormFields {
  // Core
  salaryType: string;
  // Monthly
  monthlySalary: string;
  basicSalary: string;
  da: string;
  hra: string;
  conveyanceAllowance: string;
  medicalAllowance: string;
  specialAllowance: string;
  otherAllowance: string;
  // Weekly
  weeklySalary: string;
  // Daily
  dailySalary: string;
  overtimeEligible: boolean;
  // Hourly
  hourlySalary: string;
  minWorkingHours: string;
  maxWorkingHours: string;
  // Statutory
  pfApplicable: boolean;
  pfNumber: string;
  uanNumber: string;
  esiApplicable: boolean;
  esiNumber: string;
  professionalTax: boolean;
  tdsApplicable: boolean;
  // Bank
  paymentMode: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
}

interface Props {
  form: SalaryFormFields;
  onChange: (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
      | { target: { name: string; value: any } }
  ) => void;
  onToggle: (name: string) => (v: boolean) => void;
  errors?: Partial<Record<string, string>>;
  selectedShift?: { id?: string | number; name?: string; startTime?: string; endTime?: string; breakDuration?: any; shiftCode?: string; shiftName?: string } | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  icon: React.ElementType;
  title: string;
  color?: string;
}> = ({ icon: Icon, title, color = 'text-primary' }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-line-soft">
    <Icon className={`${color} text-base`} />
    <h3 className="text-sm font-extrabold text-ink uppercase tracking-wide">{title}</h3>
  </div>
);

const Toggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => (
  <div className={`flex items-center gap-3 ${disabled ? 'opacity-50' : ''}`}>
    <label className="text-xs font-extrabold uppercase tracking-[0.5px] text-ink select-none">
      {label}
    </label>
    <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="sr-only"
        checked={value}
        disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
      />
      <div
        className={`block w-12 h-7 rounded-full transition-colors duration-300 ${value ? 'bg-primary' : 'bg-card-2 border border-line-soft'
          }`}
      />
      <div
        className={`dot absolute left-0.5 top-0.5 bg-white w-6 h-6 rounded-full shadow transition-transform duration-300 ${value ? 'translate-x-5' : 'translate-x-0'
          }`}
      />
    </label>
    <span className={`text-xs font-bold ${value ? 'text-primary' : 'text-ink-subtle'}`}>
      {value ? 'YES' : 'NO'}
    </span>
  </div>
);

// ─── Salary Preview Panel ────────────────────────────────────────────────────

interface PreviewProps {
  salaryType: string;
  primaryLabel: string;
  primaryAmount: number;
  derivatives: ReturnType<typeof deriveFromMonthly> | null;
  calcConfig: PayrollCalcConfig;
  loading: boolean;
}

const SalaryPreview: React.FC<PreviewProps> = ({
  salaryType, primaryLabel, primaryAmount, derivatives, calcConfig, loading,
}) => {
  const workingDays = getMonthlyWorkingDays(calcConfig);
  const weeklyDays = getWeeklyWorkingDays(calcConfig);
  const hoursPerDay = calcConfig.defaultWorkingHoursPerDay || 8;
  const methodLabel = calcMethodLabel(calcConfig.salaryCalculationMethod);

  const SALARY_TYPE_LABELS: Record<string, string> = {
    MONTHLY: 'Monthly',
    WEEKLY: 'Weekly',
    DAILY: 'Daily Wage',
    HOURLY: 'Hourly',
  };

  const isEmpty = primaryAmount <= 0;

  return (
    <div className="rounded-xl border border-line-soft bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-primary">
        <FaCalculator className="text-white text-sm" />
        <span className="text-sm font-bold text-white tracking-wide uppercase">
          Salary Preview
        </span>
        {loading && (
          <span className="ml-auto text-xs text-white/80 animate-pulse">
            Loading config…
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 bg-card text-ink">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-ink-subtle">
            <FaInfoCircle size={22} className="text-primary/70" />
            <p className="text-xs text-center font-medium">
              Enter a salary amount to see the live breakdown.
            </p>
          </div>
        ) : (
          <>
            {/* Primary row */}
            <PreviewRow
              label={primaryLabel}
              value={formatINR(primaryAmount)}
              highlight
            />

            {derivatives && (
              <>
                {salaryType !== 'DAILY' && salaryType !== 'HOURLY' && (
                  <PreviewRow label="Daily Wage" value={formatINR(derivatives.dailyWage)} />
                )}
                {salaryType !== 'HOURLY' && (
                  <PreviewRow label="Hourly Wage" value={formatINR(derivatives.hourlyWage)} />
                )}
                {salaryType !== 'WEEKLY' && (
                  <PreviewRow label="Weekly Equivalent" value={formatINR(derivatives.weeklyEquivalent)} />
                )}
                {salaryType !== 'MONTHLY' && (
                  <PreviewRow label="Monthly Equivalent" value={formatINR(derivatives.monthlyEquivalent)} />
                )}
              </>
            )}

            <div className="border-t border-line-soft pt-3 mt-2 space-y-2">
              <div className="text-[10px] font-bold uppercase text-primary tracking-widest mb-1">
                Company Policy
              </div>
              <PreviewMeta label="Salary Type" value={SALARY_TYPE_LABELS[salaryType] ?? salaryType} />
              <PreviewMeta label="Calc. Method" value={methodLabel} />
              <PreviewMeta label="Monthly Working Days" value={String(workingDays)} />
              <PreviewMeta label="Weekly Working Days" value={String(weeklyDays)} />
              <PreviewMeta label="Hours / Day" value={String(hoursPerDay)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const PreviewRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label, value, highlight,
}) => (
  <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${highlight ? 'bg-primary text-white' : 'bg-card-2 text-ink border border-line-soft'
    }`}>
    <span className={`text-xs font-medium ${highlight ? 'text-white/90' : 'text-ink-subtle'}`}>
      {label}
    </span>
    <span className={`text-sm font-bold tabular-nums ${highlight ? 'text-white' : 'text-ink'}`}>
      {value}
    </span>
  </div>
);

const PreviewMeta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-ink-subtle">{label}</span>
    <span className="font-semibold text-ink">{value}</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SalaryStructureSection: React.FC<Props> = ({ form, onChange, onToggle, errors = {}, selectedShift }) => {
  const { config, loading, configError } = usePayrollConfig();

  const shiftHours = useMemo(() => {
    if (!selectedShift) return null;
    return calcShiftWorkingHours(selectedShift, 0);
  }, [selectedShift]);

  const defaultHours = config.defaultWorkingHoursPerDay || 8;
  const hoursPerDay = (shiftHours && shiftHours > 0) ? shiftHours : defaultHours;

  const calcConfig: PayrollCalcConfig = {
    salaryCalculationMethod: (config.salaryCalculationMethod as any) || 'WORKING_DAYS',
    fixedDays: config.fixedDays || 26,
    defaultWorkingHoursPerDay: hoursPerDay,
    weeklyOffDays: config.weeklyOffDays || [0],
  };

  const salaryType = (form.salaryType || 'MONTHLY').toUpperCase();

  // ── Primary salary amount and label for this salary type
  const { primaryAmount, primaryLabel } = useMemo(() => {
    const parse = (s: string) => parseFloat(s) || 0;
    switch (salaryType) {
      case 'MONTHLY': return { primaryAmount: parse(form.monthlySalary), primaryLabel: 'Monthly Gross Salary' };
      case 'WEEKLY': return { primaryAmount: parse(form.weeklySalary), primaryLabel: 'Weekly Gross Salary' };
      case 'DAILY': return { primaryAmount: parse(form.dailySalary), primaryLabel: 'Daily Wage' };
      case 'HOURLY': return { primaryAmount: parse(form.hourlySalary), primaryLabel: 'Hourly Rate' };
      default: return { primaryAmount: 0, primaryLabel: 'Gross Salary' };
    }
  }, [salaryType, form.monthlySalary, form.weeklySalary, form.dailySalary, form.hourlySalary]);

  // ── Compute derivatives whenever primary salary or config changes
  const derivatives = useMemo(() => {
    if (primaryAmount <= 0) return null;
    switch (salaryType) {
      case 'MONTHLY': return deriveFromMonthly(primaryAmount, calcConfig);
      case 'WEEKLY': return deriveFromWeekly(primaryAmount, calcConfig);
      case 'DAILY': return deriveFromDaily(primaryAmount, calcConfig);
      case 'HOURLY': return deriveFromHourly(primaryAmount, calcConfig);
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryAmount, salaryType, config]);

  // ── Auto-calculation logic for breakdown components (Bank Transfer mode)
  const handleSalaryChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
      | { target: { name: string; value: any } }
  ) => {
    const { name, value } = e.target;
    onChange(e);

    const isGrossField = ['monthlySalary', 'weeklySalary', 'dailySalary', 'hourlySalary'].includes(name);

    if (isGrossField) {
      const gross = parseFloat(value) || 0;
      if (gross > 0) {
        const basic = Math.round(gross * 0.50);
        const da = Math.round(gross * 0.10);
        const hra = Math.round(gross * 0.10);
        const other = Math.max(0, gross - basic - da - hra);

        onChange({ target: { name: 'basicSalary', value: String(basic) } });
        onChange({ target: { name: 'da', value: String(da) } });
        onChange({ target: { name: 'hra', value: String(hra) } });
        onChange({ target: { name: 'otherAllowance', value: String(other) } });
      } else {
        onChange({ target: { name: 'basicSalary', value: '' } });
        onChange({ target: { name: 'da', value: '' } });
        onChange({ target: { name: 'hra', value: '' } });
        onChange({ target: { name: 'otherAllowance', value: '' } });
      }
    } else if (['basicSalary', 'hra', 'da'].includes(name)) {
      const gross = parseFloat(form.monthlySalary || form.weeklySalary || form.dailySalary || form.hourlySalary || '0') || 0;
      if (gross > 0) {
        const b = name === 'basicSalary' ? (parseFloat(value) || 0) : (parseFloat(form.basicSalary || '0') || 0);
        const d = name === 'da' ? (parseFloat(value) || 0) : (parseFloat(form.da || '0') || 0);
        const h = name === 'hra' ? (parseFloat(value) || 0) : (parseFloat(form.hra || '0') || 0);
        const other = Math.max(0, gross - b - d - h);
        onChange({ target: { name: 'otherAllowance', value: String(other) } });
      }
    } else if (name === 'paymentMode' && value === 'BANK') {
      const gross = parseFloat(form.monthlySalary || form.weeklySalary || form.dailySalary || form.hourlySalary || '0') || 0;
      if (gross > 0 && (!form.basicSalary || parseFloat(form.basicSalary) === 0)) {
        const basic = Math.round(gross * 0.50);
        const da = Math.round(gross * 0.10);
        const hra = Math.round(gross * 0.10);
        const other = Math.max(0, gross - basic - da - hra);

        onChange({ target: { name: 'basicSalary', value: String(basic) } });
        onChange({ target: { name: 'da', value: String(da) } });
        onChange({ target: { name: 'hra', value: String(hra) } });
        onChange({ target: { name: 'otherAllowance', value: String(other) } });
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Config error banner */}
      {configError && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          <FaInfoCircle className="mt-0.5 shrink-0" />
          <span>{configError}</span>
        </div>
      )}

      {/* ── Main layout: fields (left) + preview (right) ── */}
      <div className="flex flex-col xl:flex-row gap-6">

        {/* ───────── LEFT: dynamic salary fields ───────── */}
        <div className="flex-1 space-y-6">

          {/* ── Bank & Payment Details ── */}
          <div>
            <SectionHeader icon={FaUniversity} title="Bank & Payment Details" color="text-emerald-600" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              <SelectInput
                label="Payment Mode"
                name="paymentMode"
                value={form.paymentMode}
                onChange={handleSalaryChange}
                options={[
                  { value: 'BANK', label: 'Bank Transfer' },
                  { value: 'CASH', label: 'Cash' },
                ]}
              />
              {form.paymentMode === 'BANK' && (
                <>
                  <TextInput
                    label="Bank Name"
                    name="bankName"
                    value={form.bankName}
                    onChange={onChange}
                    required
                    error={errors.bankName}
                    placeholder="e.g. State Bank of India"
                  />
                  <TextInput
                    label="Bank Branch"
                    name="bankBranch"
                    value={form.bankBranch}
                    onChange={onChange}
                    required
                    error={errors.bankBranch}
                    placeholder="Branch name"
                  />
                  <TextInput
                    label="Account Number"
                    name="accountNumber"
                    value={form.accountNumber}
                    onChange={onChange}
                    required
                    error={errors.accountNumber}
                    placeholder="Account number"
                  />
                  <TextInput
                    label="IFSC Code"
                    name="ifscCode"
                    value={form.ifscCode}
                    onChange={onChange}
                    required
                    error={errors.ifscCode}
                    placeholder="e.g. SBIN0001234"
                  />
                  <TextInput
                    label="Account Holder Name"
                    name="accountHolderName"
                    value={form.accountHolderName}
                    onChange={onChange}
                    required
                    error={errors.accountHolderName}
                    placeholder="As per bank records"
                  />
                </>
              )}
            </div>
          </div>

          {/* Salary Type selector — always visible */}
          <div>
            <SectionHeader icon={FaMoneyBillWave} title="Salary Structure" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              <SelectInput
                label="Salary Type"
                name="salaryType"
                value={form.salaryType}
                onChange={handleSalaryChange}
                required
                error={errors.salaryType}
                options={[
                  { value: 'MONTHLY', label: 'Monthly' },
                  { value: 'WEEKLY', label: 'Weekly' },
                  // { value: 'DAILY', label: 'Daily Wage' },
                  // { value: 'HOURLY', label: 'Hourly' },
                ]}
              />

              {/* ── MONTHLY fields ── */}
              {salaryType === 'MONTHLY' && (
                <TextInput
                  label="Monthly Gross Salary (₹)"
                  name="monthlySalary"
                  type="number"
                  value={form.monthlySalary}
                  onChange={handleSalaryChange}
                  required
                  error={errors.monthlySalary}
                  placeholder="Total monthly CTC"
                />
              )}

              {/* ── WEEKLY fields ── */}
              {salaryType === 'WEEKLY' && (
                <TextInput
                  label="Weekly Gross Salary (₹)"
                  name="weeklySalary"
                  type="number"
                  value={form.weeklySalary}
                  onChange={handleSalaryChange}
                  required
                  error={errors.weeklySalary}
                  placeholder="Total weekly salary"
                />
              )}

              {/* ── DAILY WAGE fields ── */}
              {salaryType === 'DAILY' && (
                <TextInput
                  label="Daily Wage (₹)"
                  name="dailySalary"
                  type="number"
                  value={form.dailySalary}
                  onChange={handleSalaryChange}
                  required
                  error={errors.dailySalary}
                  placeholder="Per-day rate"
                />
              )}

              {/* ── HOURLY fields ── */}
              {salaryType === 'HOURLY' && (
                <>
                  <TextInput
                    label="Hourly Rate (₹)"
                    name="hourlySalary"
                    type="number"
                    value={form.hourlySalary}
                    onChange={handleSalaryChange}
                    required
                    error={errors.hourlySalary}
                    placeholder="Per-hour rate"
                  />
                  <TextInput
                    label="Minimum Working Hours / Day"
                    name="minWorkingHours"
                    type="number"
                    value={form.minWorkingHours}
                    onChange={onChange}
                    placeholder={String(calcConfig.defaultWorkingHoursPerDay)}
                  />
                  <TextInput
                    label="Maximum Working Hours / Day"
                    name="maxWorkingHours"
                    type="number"
                    value={form.maxWorkingHours}
                    onChange={onChange}
                    placeholder="e.g. 12"
                  />
                </>
              )}

              {/* ── Allowance & Component Breakdown (Bank Transfer Only) ── */}
              {form.paymentMode === 'BANK' && (
                <>
                  <TextInput
                    label="Basic Salary (₹)"
                    name="basicSalary"
                    type="number"
                    value={form.basicSalary}
                    onChange={handleSalaryChange}
                    error={errors.basicSalary}
                    placeholder="Basic salary"
                  />
                  <TextInput
                    label="DA (Dearness Allowance) (₹)"
                    name="da"
                    type="number"
                    value={form.da}
                    onChange={handleSalaryChange}
                    error={errors.da}
                    placeholder="DA amount"
                  />
                  <TextInput
                    label="HRA (House Rent Allowance) (₹)"
                    name="hra"
                    type="number"
                    value={form.hra}
                    onChange={handleSalaryChange}
                    error={errors.hra}
                    placeholder="HRA amount"
                  />
                  <TextInput
                    label="Other Allowance (₹)"
                    name="otherAllowance"
                    type="number"
                    value={form.otherAllowance}
                    onChange={onChange}
                    error={errors.otherAllowance}
                    placeholder="Other allowance"
                  />
                </>
              )}
            </div>

            {/* Live component balance calculator for Bank Transfer */}
            {form.paymentMode === 'BANK' && primaryAmount > 0 && (
              <div className="mt-4 text-xs font-medium">
                {(() => {
                  const gross = primaryAmount;
                  const basic = parseFloat(form.basicSalary || '0') || 0;
                  const da = parseFloat(form.da || '0') || 0;
                  const hra = parseFloat(form.hra || '0') || 0;
                  const other = parseFloat(form.otherAllowance || '0') || 0;
                  const total = basic + da + hra + other;
                  const diff = gross - total;

                  if (Math.abs(diff) < 0.01) {
                    return (
                      <div className="flex items-center justify-between text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl shadow-xs">
                        <span className="font-semibold flex items-center gap-1.5">
                          ✓ Salary components sum (Basic + DA + HRA + Other) equals Gross Salary (₹{gross.toLocaleString('en-IN')})
                        </span>
                        <span className="font-mono text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">100% Matched</span>
                      </div>
                    );
                  }

                  if (diff > 0) {
                    return (
                      <div className="flex items-center justify-between text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl shadow-xs">
                        <div>
                          <span className="font-bold">⚠️ Remaining Balance: ₹{diff.toLocaleString('en-IN')}</span>
                          <span className="ml-1 text-slate-600">
                            (Total components: ₹{total.toLocaleString('en-IN')} / Gross: ₹{gross.toLocaleString('en-IN')})
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="flex items-center justify-between text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl shadow-xs">
                      <span className="font-semibold">
                        ❌ Components sum (₹{total.toLocaleString('en-IN')}) exceeds Gross Salary (₹{gross.toLocaleString('en-IN')}) by ₹{Math.abs(diff).toLocaleString('en-IN')}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Overtime eligible — shown for Daily and Hourly */}
            {(salaryType === 'DAILY' || salaryType === 'HOURLY') && (
              <div className="mt-4 flex items-center gap-4 p-3 rounded-lg bg-orange-50 border border-orange-100">
                <FaClock className="text-orange-400 text-sm shrink-0" />
                <Toggle
                  label="Overtime Eligible"
                  value={form.overtimeEligible}
                  onChange={onToggle('overtimeEligible')}
                />
                <span className="text-xs text-slate-400 ml-auto">
                  {form.overtimeEligible
                    ? 'OT pay will be calculated per company OT policy'
                    : 'No overtime applicable'}
                </span>
              </div>
            )}


          </div>

          {/* ── Statutory Section ── */}
          {form.paymentMode === 'BANK' && (
            <div>
              <SectionHeader icon={FaCheckCircle} title="Statutory Deductions" color="text-violet-500" />
              <div className="flex flex-wrap gap-8">
                <Toggle label="PF Applicable" value={form.pfApplicable} onChange={onToggle('pfApplicable')} />
                <Toggle label="ESI Applicable" value={form.esiApplicable} onChange={onToggle('esiApplicable')} />
                <Toggle label="Professional Tax" value={form.professionalTax} onChange={onToggle('professionalTax')} />
              </div>

              {form.pfApplicable && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <TextInput
                    label="UAN Number"
                    name="uanNumber"
                    value={form.uanNumber}
                    onChange={onChange}
                    required
                    error={errors.uanNumber}
                    placeholder="Universal Account Number"
                  />
                </div>
              )}

              {form.esiApplicable && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-4 bg-green-50 rounded-xl border border-green-100">
                  <TextInput
                    label="ESIC Number"
                    name="esiNumber"
                    value={form.esiNumber}
                    onChange={onChange}
                    required
                    error={errors.esiNumber}
                    placeholder="ESIC number"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ───────── RIGHT: Live Salary Preview ───────── */}
        <div className="xl:w-72 shrink-0">
          <div className="sticky top-4">
            <SalaryPreview
              salaryType={salaryType}
              primaryLabel={primaryLabel}
              primaryAmount={primaryAmount}
              derivatives={derivatives}
              calcConfig={calcConfig}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalaryStructureSection;
