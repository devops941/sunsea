import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaUser, FaPhone, FaUsers, FaIdCard, FaMapMarkerAlt,
  FaBriefcase, FaCalendarAlt, FaClock, FaMoneyBillWave,
  FaLock, FaArrowLeft, FaEdit,
} from "react-icons/fa";
import { employeeService } from "../../../services/employeeService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { usePermission } from "../../../hooks/usePermission";
import { usePayrollConfig } from "../../../hooks/usePayrollConfig";
import {
  deriveFromMonthly, deriveFromWeekly, deriveFromDaily, deriveFromHourly,
  getMonthlyWorkingDays, getWeeklyWorkingDays, calcShiftWorkingHours,
  formatINR, calcMethodLabel,
  type PayrollCalcConfig,
} from "../../../utils/salaryCalculation";

const STATUS_MAP: Record<string, string> = {
  active: "ACTIVE", inactive: "INACTIVE",
  resigned: "RESIGNED", terminated: "TERMINATED", retired: "RETIRED",
};

// ─── InfoRow (2-col grid cell) ────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | number | null | React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2 border-b border-line-soft/40 hover:bg-card-2/30 transition-colors min-w-0">
      <span className="text-[11px] text-ink-subtle w-[140px] shrink-0">{label}</span>
      <span className="text-[12px] font-semibold text-ink truncate">
        {value === null || value === undefined || value === ""
          ? <span className="text-ink-muted italic font-normal">—</span>
          : value}
      </span>
    </div>
  );
}

// ─── 2-col section body ───────────────────────────────────────────────────────
function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-line-soft/40">
      {children}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 bg-card-2/50 border-y border-line-soft/50">
      <Icon className="text-primary" size={11} />
      <span className="text-[10px] font-extrabold text-ink-subtle uppercase tracking-[2px]">{title}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(val: string | null | undefined): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function calcAge(dob: string | null | undefined): string {
  if (!dob) return "";
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return `${years} yrs`;
}

function getPhotoUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const base = import.meta.env.VITE_API_BASE_URL?.replace("/api", "") || "http://localhost:5000";
  return `${base}/${url.replace(/^\//, "")}`;
}

const SALARY_TYPE_LABELS: Record<string, string> = {
  monthly: "Monthly", weekly: "Weekly", daily: "Daily Wage", hourly: "Hourly",
};
const PRIMARY_SALARY_LABELS: Record<string, string> = {
  monthly: "Monthly Gross Salary", weekly: "Weekly Gross Salary",
  daily: "Daily Wage", hourly: "Hourly Rate",
};

// ─── CalcCard ─────────────────────────────────────────────────────────────────
const CARD_STYLES: Record<string, { bg: string; border: string; label: string; val: string }> = {
  slate:   { bg: "bg-card-2",         border: "border-line-soft",       label: "text-ink-muted",    val: "text-ink"         },
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",     label: "text-blue-400",     val: "text-blue-300"    },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20",  label: "text-emerald-400",  val: "text-emerald-300" },
  indigo:  { bg: "bg-indigo-500/10",  border: "border-indigo-500/20",   label: "text-indigo-400",   val: "text-indigo-300"  },
};

function CalcCard({ label, amount, note, color = "slate" }: { label: string; amount: string; note: string; color?: string }) {
  const s = CARD_STYLES[color] ?? CARD_STYLES.slate;
  return (
    <div className={`p-3 ${s.bg} border ${s.border} rounded-xl flex flex-col gap-1`}>
      <span className={`text-[9px] font-bold uppercase tracking-wider ${s.label}`}>{label}</span>
      <span className={`text-base font-extrabold ${s.val}`}>{amount}</span>
      <span className={`text-[9px] font-medium ${s.label}`}>{note}</span>
    </div>
  );
}

function StatFlag({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card-2 border border-line-soft">
      <span className={`w-2 h-2 rounded-full shrink-0 ${value ? "bg-emerald-500" : "bg-ink-muted/30"}`} />
      <span className="text-[11px] font-semibold text-ink-subtle">{label}</span>
      <span className={`ml-auto text-[11px] font-bold ${value ? "text-emerald-400" : "text-ink-muted"}`}>{value ? "Yes" : "No"}</span>
    </div>
  );
}

// ─── PayrollRows ──────────────────────────────────────────────────────────────
function PayrollRows({ employee, payrollConfig }: { employee: any; payrollConfig: any }) {
  const salaryType  = (employee.salaryType || "monthly").toLowerCase();
  const grossAmount = Number(employee.grossSalary || 0);
  const basicAmount = Number(employee.basicSalary || 0);
  const shiftHours  = calcShiftWorkingHours(employee.shift, 0);
  const hoursPerDayVal = shiftHours > 0 ? shiftHours : (payrollConfig?.defaultWorkingHoursPerDay || 8);

  const calcConfig: PayrollCalcConfig = {
    salaryCalculationMethod:   payrollConfig?.salaryCalculationMethod || "WORKING_DAYS",
    fixedDays:                 payrollConfig?.fixedDays               || 26,
    defaultWorkingHoursPerDay: hoursPerDayVal,
    weeklyOffDays:             payrollConfig?.weeklyOffDays            || [0],
  };

  const derivatives = grossAmount > 0
    ? salaryType === "monthly" ? deriveFromMonthly(grossAmount, calcConfig)
    : salaryType === "weekly"  ? deriveFromWeekly(grossAmount,  calcConfig)
    : salaryType === "daily"   ? deriveFromDaily(grossAmount,   calcConfig)
    : salaryType === "hourly"  ? deriveFromHourly(grossAmount,  calcConfig)
    : null : null;

  const workingDays = getMonthlyWorkingDays(calcConfig);
  const weeklyDays  = getWeeklyWorkingDays(calcConfig);
  const hoursPerDay = calcConfig.defaultWorkingHoursPerDay;
  const methodLabel = calcMethodLabel(calcConfig.salaryCalculationMethod);

  const pfRate        = payrollConfig?.employeePfPercent  || 12;
  const maxPf         = payrollConfig?.maxPfWage           || 15000;
  const pfWageFormula = payrollConfig?.pfWageFormula       || "BASIC";
  const pfBase        = pfWageFormula === "GROSS" ? grossAmount : basicAmount || grossAmount;
  const pf            = employee.pfApplicable  ? (Math.min(pfBase, maxPf) * pfRate) / 100  : 0;
  const esiRate       = payrollConfig?.employeeEsiPercent || 0.75;
  const maxEsi        = payrollConfig?.maxEsiSalary        || 21000;
  const esi           = employee.esiApplicable && grossAmount <= maxEsi ? (grossAmount * esiRate) / 100 : 0;

  return (
    <>
      {/* Salary structure — 2-col */}
      <FieldGrid>
        <InfoRow label="Salary Type"                                     value={SALARY_TYPE_LABELS[salaryType] ?? salaryType} />
        <InfoRow label={PRIMARY_SALARY_LABELS[salaryType] ?? "Gross"}    value={grossAmount > 0 ? formatINR(grossAmount) : null} />
        {basicAmount > 0                           && <InfoRow label="Basic Salary"            value={formatINR(basicAmount)} />}
        {Number(employee.da  || 0) > 0             && <InfoRow label="DA (Dearness Allow.)"   value={formatINR(Number(employee.da))} />}
        {Number(employee.hra || 0) > 0             && <InfoRow label="HRA (House Rent Allow.)" value={formatINR(Number(employee.hra))} />}
        {Number(employee.otherAllowance || 0) > 0  && <InfoRow label="Other Allowance"         value={formatINR(Number(employee.otherAllowance))} />}
      </FieldGrid>

      {/* Salary breakdown cards */}
      {derivatives && (
        <div className="px-5 py-3 border-b border-line-soft/40">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            {salaryType !== "daily" && salaryType !== "hourly" && (
              <CalcCard label="Daily Wage" amount={formatINR(derivatives.dailyWage)}
                note={`÷ ${salaryType === "weekly" ? `${weeklyDays}d/wk` : `${workingDays} days`}`} color="slate" />
            )}
            {salaryType !== "hourly" && (
              <CalcCard label="Hourly Rate" amount={formatINR(derivatives.hourlyWage)} note={`Daily ÷ ${hoursPerDay}h`} color="indigo" />
            )}
            {salaryType !== "weekly" && (
              <CalcCard label="Weekly Equiv." amount={formatINR(derivatives.weeklyEquivalent)} note={`Daily × ${weeklyDays}d`} color="blue" />
            )}
            {salaryType !== "monthly" && (
              <CalcCard label="Monthly Equiv." amount={formatINR(derivatives.monthlyEquivalent)}
                note={salaryType === "weekly" ? "Wkly × 52 ÷ 12" : `Daily × ${workingDays}d`} color="emerald" />
            )}
          </div>
          <div className="flex flex-wrap gap-3 px-3 py-2 rounded-lg bg-card-2 border border-line-soft text-[10px] text-ink-subtle">
            <span><span className="font-semibold text-ink">Method:</span> {methodLabel}</span>
            <span><span className="font-semibold text-ink">Monthly Days:</span> {workingDays}</span>
            <span><span className="font-semibold text-ink">Weekly Days:</span> {weeklyDays}</span>
            <span><span className="font-semibold text-ink">Hrs/Day:</span> {hoursPerDay}</span>
          </div>
        </div>
      )}

      {/* Statutory */}
      {employee.paymentMode === "BANK" && (
        <>
          <div className="px-5 py-3 border-b border-line-soft/40">
            <div className="grid grid-cols-3 gap-2">
              <StatFlag label="PF Applicable"    value={!!employee.pfApplicable}    />
              <StatFlag label="ESI Applicable"   value={!!employee.esiApplicable}   />
              <StatFlag label="Professional Tax" value={!!employee.professionalTax} />
            </div>
          </div>
          <FieldGrid>
            <InfoRow label="PF Number"   value={employee.pfNumber}  />
            <InfoRow label="UAN Number"  value={employee.uanNumber} />
            <InfoRow label="ESIC Number" value={employee.esiNumber} />
          </FieldGrid>
          <div className="px-5 py-3 border-b border-line-soft/40">
            <div className="grid grid-cols-2 gap-2">
              <CalcCard label="Est. Employee PF / Month"
                amount={employee.pfApplicable ? formatINR(pf) : "₹0.00"}
                note={!employee.pfApplicable ? "Not applicable" : `${pfRate}% of ${pfWageFormula === "GROSS" ? "Gross" : "Basic"} (cap ${formatINR(maxPf)})`}
                color="blue" />
              <CalcCard label="Est. Employee ESI / Month"
                amount={employee.esiApplicable ? formatINR(esi) : "₹0.00"}
                note={!employee.esiApplicable ? "Not applicable" : esi === 0 ? `Exceeds ceiling (${formatINR(maxEsi)})` : `${esiRate}% of Gross`}
                color="emerald" />
            </div>
          </div>
        </>
      )}

      {/* Bank details — 2-col */}
      <FieldGrid>
        <InfoRow label="Payment Mode"   value={employee.paymentMode || "—"} />
        <InfoRow label="Bank Name"      value={employee.bankName}           />
        <InfoRow label="Branch"         value={employee.bankBranch}         />
        <InfoRow label="Account Number" value={employee.accountNumber}      />
        <InfoRow label="IFSC Code"      value={employee.ifscCode}           />
        <InfoRow label="Account Holder" value={employee.accountHolderName}  />
      </FieldGrid>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmployeeViewPage() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const { can }     = usePermission();
  const canEdit     = can("employees.edit");
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [imgError, setImgError] = useState(false);
  const { config: payrollConfig } = usePayrollConfig();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    employeeService.fetchById(id)
      .then(setEmployee)
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || "Failed to load employee");
        navigate("/employees");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (!employee) return null;

  const initials = employee.fullName
    ?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  const cashInHand    = Number(employee.payrollConfig?.cashInHand || 0);
  const onRecordGross = Number(employee.grossSalary || employee.monthlySalary || 0);
  const totalCTC      = onRecordGross + cashInHand;

  return (
    <div className="max-w-4xl xl:mr-auto space-y-3">

      {/* Top nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/employees")}
          className="flex items-center gap-1.5 text-xs text-ink-subtle hover:text-primary transition-colors font-medium"
        >
          <FaArrowLeft size={11} /> Back to Employees
        </button>
        {canEdit && (
          <button
            onClick={() => navigate(`/employees/edit/${employee.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <FaEdit size={11} /> Edit Employee
          </button>
        )}
      </div>

      {/* ── Single Card ───────────────────────────────────────────────────── */}
      <div className="bg-card border border-line-soft rounded-2xl overflow-hidden">

        {/* Hero */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-line-soft">
          {employee.photoUrl && !imgError ? (
            <img
              src={getPhotoUrl(employee.photoUrl)}
              alt={employee.fullName}
              onError={() => setImgError(true)}
              className="w-12 h-12 rounded-xl object-cover border border-line-soft shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm font-bold text-ink">{employee.fullName}</h1>
              <StatusBadge status={STATUS_MAP[employee.status] ?? employee.status?.toUpperCase() ?? "INACTIVE"} />
            </div>
            <p className="text-[11px] text-ink-muted mt-0.5">{employee.empCode}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {employee.designation && (
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-semibold border border-accent/20">{employee.designation}</span>
              )}
              {employee.department?.name && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold border border-indigo-500/20">{employee.department.name}</span>
              )}
              {employee.employeeType && (
                <span className="px-2 py-0.5 rounded-full bg-card-2 text-ink-subtle text-[10px] font-semibold border border-line-soft capitalize">{employee.employeeType}</span>
              )}
            </div>
          </div>
        </div>

        {/* 1. Basic Information */}
        <SectionHeader icon={FaUser} title="Basic Information" />
        <FieldGrid>
          <InfoRow label="Employee Code"  value={employee.empCode} />
          <InfoRow label="Full Name"      value={employee.fullName} />
          <InfoRow label="Gender"         value={employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1) : null} />
          <InfoRow label="Date of Birth"  value={employee.dateOfBirth ? `${formatDate(employee.dateOfBirth)} (${calcAge(employee.dateOfBirth)})` : null} />
          <InfoRow label="Blood Group"    value={employee.bloodGroup} />
          <InfoRow label="Marital Status" value={employee.maritalStatus ? employee.maritalStatus.charAt(0).toUpperCase() + employee.maritalStatus.slice(1) : null} />
        </FieldGrid>

        {/* 2. Contact Details */}
        <SectionHeader icon={FaPhone} title="Contact Details" />
        <FieldGrid>
          <InfoRow label="Work Mobile"       value={employee.mobile} />
          <InfoRow label="Work Email"        value={employee.email} />
          <InfoRow label="Personal Mobile"   value={employee.personalMobile} />
          <InfoRow label="Personal Email"    value={employee.personalEmail} />
          <InfoRow label="Emergency Contact" value={employee.emergencyContactName} />
          <InfoRow label="Emergency Number"  value={employee.emergencyContactNumber} />
        </FieldGrid>

        {/* 3. Family Details */}
        <SectionHeader icon={FaUsers} title="Family Details" />
        <FieldGrid>
          <InfoRow label="Father's Name"         value={employee.fatherName} />
          <InfoRow label="Mother's Name"         value={employee.motherName} />
          <InfoRow label="Spouse's Name"         value={employee.spouseName} />
          <InfoRow label="Guardian's Name"       value={employee.guardianName} />
          <InfoRow label="Guardian Relationship" value={employee.guardianRelationship} />
        </FieldGrid>

        {/* 4. Identity Documents */}
        <SectionHeader icon={FaIdCard} title="Identity Documents" />
        <FieldGrid>
          <InfoRow label="Aadhaar Number"  value={employee.aadhaarNumber} />
          <InfoRow label="PAN Number"      value={employee.panNumber} />
          <InfoRow label="Driving License" value={employee.drivingLicense} />
          <InfoRow label="Voter ID"        value={employee.voterId} />
        </FieldGrid>

        {/* 5. Address */}
        <SectionHeader icon={FaMapMarkerAlt} title="Address" />
        <div className="grid grid-cols-2 border-b border-line-soft/40">
          <div className="border-r border-line-soft/40 px-5 py-3">
            <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-ink-muted mb-2">Permanent Address</p>
            <InfoRow label="Line 1"   value={employee.permanentAddressLine1} />
            <InfoRow label="Line 2"   value={employee.permanentAddressLine2} />
            <InfoRow label="City"     value={employee.permanentCity} />
            <InfoRow label="State"    value={employee.permanentState} />
            <InfoRow label="Pincode"  value={employee.permanentPincode} />
          </div>
          <div className="px-5 py-3">
            <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-ink-muted mb-2">Present Address</p>
            <InfoRow label="Line 1"   value={employee.presentAddressLine1} />
            <InfoRow label="Line 2"   value={employee.presentAddressLine2} />
            <InfoRow label="City"     value={employee.presentCity} />
            <InfoRow label="State"    value={employee.presentState} />
            <InfoRow label="Pincode"  value={employee.presentPincode} />
          </div>
        </div>

        {/* 6. Official Info */}
        <SectionHeader icon={FaBriefcase} title="Official Information" />
        <FieldGrid>
          <InfoRow label="Department"    value={employee.department?.name} />
          <InfoRow label="Role"          value={employee.role?.name || employee.user?.role?.name} />
          <InfoRow label="Employee Type" value={employee.employeeType ? employee.employeeType.charAt(0).toUpperCase() + employee.employeeType.slice(1) : null} />
          <InfoRow label="Status"        value={<StatusBadge status={STATUS_MAP[employee.status] ?? employee.status?.toUpperCase() ?? "INACTIVE"} />} />
        </FieldGrid>

        {/* 7. Joining Details */}
        <SectionHeader icon={FaCalendarAlt} title="Joining Details" />
        <FieldGrid>
          <InfoRow label="Date of Joining"     value={formatDate(employee.dateOfJoining)} />
          <InfoRow label="Relieving Date"      value={formatDate(employee.relievingDate)} />
          <InfoRow label="Previous Experience" value={employee.previousExperience} />
        </FieldGrid>

        {/* 8. Shift */}
        <SectionHeader icon={FaClock} title="Shift Assignment" />
        <FieldGrid>
          <InfoRow label="Shift"      value={employee.shift?.shiftName || employee.shiftId} />
          <InfoRow label="Shift Code" value={employee.shiftId} />
        </FieldGrid>

        {/* 9. Payroll & Statutory */}
        <SectionHeader icon={FaMoneyBillWave} title="Payroll & Statutory" />
        <PayrollRows employee={employee} payrollConfig={payrollConfig} />

        {/* 9b. Total CTC */}
        {cashInHand > 0 && (
          <>
            <SectionHeader icon={FaMoneyBillWave} title="Total Compensation Summary" />
            <div className="px-5 py-3 border-b border-line-soft/40">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <CalcCard label="Net Pay (Monthly)" amount={formatINR(onRecordGross)} note="On-record gross"  color="slate"   />
                <CalcCard label="Cash in Hand"      amount={formatINR(cashInHand)}    note="Off-payroll"     color="indigo"  />
                <CalcCard label="Total Monthly CTC" amount={formatINR(totalCTC)}      note="Net + Cash"      color="emerald" />
              </div>
              <p className="text-[10px] text-ink-muted text-center italic">
                {formatINR(onRecordGross)} + {formatINR(cashInHand)} = {formatINR(totalCTC)}
              </p>
            </div>
          </>
        )}

        {/* 10. Login Account */}
        <SectionHeader icon={FaLock} title="Login Account" />
        <FieldGrid>
          <InfoRow label="Username" value={employee.user?.username} />
          <InfoRow label="Role"     value={employee.user?.role?.name} />
          <InfoRow label="Login Status" value={
            employee.user
              ? <StatusBadge status={employee.user.status?.toUpperCase() || "INACTIVE"} />
              : <span className="text-ink-muted italic text-[11px] font-normal">No account</span>
          } />
          <InfoRow label="Must Change Password" value={
            employee.user
              ? <span className={`text-[11px] font-semibold ${employee.user.mustChangePw ? "text-amber-400" : "text-emerald-400"}`}>
                  {employee.user.mustChangePw ? "Yes" : "No"}
                </span>
              : null
          } />
        </FieldGrid>


      </div>{/* end single card */}
    </div>
  );
}
