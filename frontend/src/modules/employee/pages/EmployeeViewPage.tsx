import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaUser, FaPhone, FaUsers, FaIdCard, FaMapMarkerAlt,
  FaBriefcase, FaCalendarAlt, FaClock, FaMoneyBillWave,
  FaLock, FaClipboardList, FaArrowLeft, FaEdit,
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
  active: "ACTIVE",
  inactive: "INACTIVE",
  resigned: "RESIGNED",
  terminated: "TERMINATED",
  retired: "RETIRED",
};

function InfoRow({ label, value }: { label: string; value?: string | number | null | React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-800 break-words">
        {value === null || value === undefined || value === "" ? (
          <span className="text-slate-300 italic">—</span>
        ) : value}
      </span>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200">
        <Icon className="text-primary" size={14} />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{title}</span>
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
        {children}
      </div>
    </div>
  );
}

function FullWidthSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200">
        <Icon className="text-primary" size={14} />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{title}</span>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function calcAge(dob: string | null | undefined): string {
  if (!dob) return "";
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return `${years} yrs`;
}

function getPhotoUrl(photoUrl?: string | null): string {
  if (!photoUrl) return "";
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://") || photoUrl.startsWith("data:")) {
    return photoUrl;
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace("/api", "") || "http://localhost:5000";
  return `${baseUrl}/${photoUrl.replace(/^\//, "")}`;
}

// ─── Salary type helpers ──────────────────────────────────────────────────────

const SALARY_TYPE_LABELS: Record<string, string> = {
  monthly: "Monthly", weekly: "Weekly", daily: "Daily Wage", hourly: "Hourly",
};

const PRIMARY_SALARY_LABELS: Record<string, string> = {
  monthly: "Monthly Gross Salary",
  weekly:  "Weekly Gross Salary",
  daily:   "Daily Wage",
  hourly:  "Hourly Rate",
};

// ─── Payroll Section Component ────────────────────────────────────────────────

function PayrollSection({ employee, payrollConfig }: { employee: any; payrollConfig: any }) {
  const salaryType = (employee.salaryType || "monthly").toLowerCase();
  const grossAmount = Number(employee.grossSalary || 0);
  const basicAmount = Number(employee.basicSalary || 0);

  const shiftHours = calcShiftWorkingHours(employee.shift, 0);
  const hoursPerDayVal = (shiftHours && shiftHours > 0) ? shiftHours : (payrollConfig?.defaultWorkingHoursPerDay || 8);

  const calcConfig: PayrollCalcConfig = {
    salaryCalculationMethod: payrollConfig?.salaryCalculationMethod || "WORKING_DAYS",
    fixedDays:               payrollConfig?.fixedDays               || 26,
    defaultWorkingHoursPerDay: hoursPerDayVal,
    weeklyOffDays:           payrollConfig?.weeklyOffDays            || [0],
  };

  // Derive all salary equivalents using the centralized engine
  const derivatives = grossAmount > 0
    ? salaryType === "monthly" ? deriveFromMonthly(grossAmount, calcConfig)
    : salaryType === "weekly"  ? deriveFromWeekly(grossAmount,  calcConfig)
    : salaryType === "daily"   ? deriveFromDaily(grossAmount,   calcConfig)
    : salaryType === "hourly"  ? deriveFromHourly(grossAmount,  calcConfig)
    : null
    : null;

  const workingDays  = getMonthlyWorkingDays(calcConfig);
  const weeklyDays   = getWeeklyWorkingDays(calcConfig);
  const hoursPerDay  = calcConfig.defaultWorkingHoursPerDay;
  const methodLabel  = calcMethodLabel(calcConfig.salaryCalculationMethod);

  // PF calculation
  const pfRate  = payrollConfig?.employeePfPercent  || 12;
  const maxPf   = payrollConfig?.maxPfWage           || 15000;
  const pfWageFormula = payrollConfig?.pfWageFormula || "BASIC";
  const pfBase  = pfWageFormula === "GROSS" ? grossAmount : basicAmount || grossAmount;
  const pfWage  = Math.min(pfBase, maxPf);
  const pf      = employee.pfApplicable  ? (pfWage  * pfRate) / 100  : 0;

  // ESI calculation
  const esiRate = payrollConfig?.employeeEsiPercent || 0.75;
  const maxEsi  = payrollConfig?.maxEsiSalary        || 21000;
  const esi     = employee.esiApplicable && grossAmount <= maxEsi
    ? (grossAmount * esiRate) / 100
    : 0;

  const SubHeader = ({ text }: { text: string }) => (
    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1 mb-4 mt-2">
      {text}
    </p>
  );

  const StatFlag = ({ label, value }: { label: string; value: boolean }) => (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${value ? "bg-green-500" : "bg-slate-300"}`} />
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <span className={`ml-auto text-xs font-bold ${value ? "text-green-600" : "text-slate-400"}`}>
        {value ? "Yes" : "No"}
      </span>
    </div>
  );

  const CALC_CARD_STYLES: Record<string, { bg: string; border: string; label: string; val: string }> = {
    slate:   { bg: "bg-slate-50",   border: "border-slate-200",  label: "text-slate-400",  val: "text-slate-800"  },
    blue:    { bg: "bg-blue-50",    border: "border-blue-100",   label: "text-blue-400",   val: "text-blue-800"   },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-100",label: "text-emerald-400",val: "text-emerald-800" },
    indigo:  { bg: "bg-indigo-50",  border: "border-indigo-100", label: "text-indigo-400", val: "text-indigo-800"  },
  };

  const CalcCard = ({ label, amount, note, color = "slate" }: {
    label: string; amount: string; note: string; color?: string;
  }) => {
    const s = CALC_CARD_STYLES[color] ?? CALC_CARD_STYLES.slate;
    return (
      <div className={`p-4 ${s.bg} border ${s.border} rounded-2xl flex flex-col gap-1.5`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${s.label}`}>{label}</span>
        <span className={`text-xl font-extrabold ${s.val}`}>{amount}</span>
        <span className={`text-[10px] font-medium ${s.label}`}>{note}</span>
      </div>
    );
  };

  return (
    <FullWidthSection icon={FaMoneyBillWave} title="Payroll & Statutory">

      {/* ── Salary Structure ── */}
      <SubHeader text="Salary Structure" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5 mb-6">
        <InfoRow
          label="Salary Type"
          value={SALARY_TYPE_LABELS[salaryType] ?? salaryType}
        />
        <InfoRow
          label={PRIMARY_SALARY_LABELS[salaryType] ?? "Gross Salary"}
          value={grossAmount > 0 ? formatINR(grossAmount) : null}
        />
        {basicAmount > 0 && (
          <InfoRow label="Basic Salary" value={formatINR(basicAmount)} />
        )}
        {Number(employee.da || 0) > 0 && (
          <InfoRow label="DA (Dearness Allowance)" value={formatINR(Number(employee.da))} />
        )}
        {Number(employee.hra || 0) > 0 && (
          <InfoRow label="HRA (House Rent Allowance)" value={formatINR(Number(employee.hra))} />
        )}
        {Number(employee.otherAllowance || 0) > 0 && (
          <InfoRow label="Other Allowance" value={formatINR(Number(employee.otherAllowance))} />
        )}
      </div>

      {/* ── Salary Breakdown (derived via centralized engine) ── */}
      {derivatives && (
        <>
          <SubHeader text="Salary Breakdown" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {salaryType !== "daily" && salaryType !== "hourly" && (
              <CalcCard
                label="Daily Wage"
                amount={formatINR(derivatives.dailyWage)}
                note={`${PRIMARY_SALARY_LABELS[salaryType]} ÷ ${salaryType === "weekly" ? `${weeklyDays} days/week` : `${workingDays} working days`}`}
                color="slate"
              />
            )}
            {salaryType !== "hourly" && (
              <CalcCard
                label="Hourly Rate"
                amount={formatINR(derivatives.hourlyWage)}
                note={`Daily ÷ ${hoursPerDay} hrs/day`}
                color="indigo"
              />
            )}
            {salaryType !== "weekly" && (
              <CalcCard
                label="Weekly Equivalent"
                amount={formatINR(derivatives.weeklyEquivalent)}
                note={`Daily × ${weeklyDays} days/week`}
                color="blue"
              />
            )}
            {salaryType !== "monthly" && (
              <CalcCard
                label="Monthly Equivalent"
                amount={formatINR(derivatives.monthlyEquivalent)}
                note={
                  salaryType === "weekly"
                    ? "Weekly × 52 ÷ 12"
                    : `Daily × ${workingDays} working days`
                }
                color="emerald"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-4 mb-6 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500">
              <span className="font-semibold">Calculation Method:</span> {methodLabel}
            </span>
            <span className="text-xs text-slate-500">
              <span className="font-semibold">Monthly Working Days:</span> {workingDays}
            </span>
            <span className="text-xs text-slate-500">
              <span className="font-semibold">Weekly Working Days:</span> {weeklyDays}
            </span>
            <span className="text-xs text-slate-500">
              <span className="font-semibold">Hours / Day:</span> {hoursPerDay}
            </span>
          </div>
        </>
      )}

      {/* ── Statutory Flags & Estimates (only for Bank Transfer) ── */}
      {employee.paymentMode === 'BANK' && (
        <>
          <SubHeader text="Statutory Deductions" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatFlag label="PF Applicable"    value={!!employee.pfApplicable}    />
            <StatFlag label="ESI Applicable"   value={!!employee.esiApplicable}   />
            <StatFlag label="Professional Tax" value={!!employee.professionalTax} />
          </div>

          {/* PF / ESI / UAN numbers */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5 mb-6">
            <InfoRow label="PF Number"  value={employee.pfNumber}  />
            <InfoRow label="UAN Number" value={employee.uanNumber} />
            <InfoRow label="ESIC Number" value={employee.esiNumber} />
          </div>

          {/* ── Statutory Estimates ── */}
          <SubHeader text="Estimated Statutory Contributions" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <CalcCard
              label="Estimated Employee PF / Month"
              amount={employee.pfApplicable ? formatINR(pf) : "₹0.00"}
              note={
                !employee.pfApplicable
                  ? "PF not applicable"
                  : `${pfRate}% of ${pfWageFormula === "GROSS" ? "Gross" : "Basic"} (capped at ${formatINR(maxPf)})`
              }
              color="blue"
            />
            <CalcCard
              label="Estimated Employee ESI / Month"
              amount={employee.esiApplicable ? formatINR(esi) : "₹0.00"}
              note={
                !employee.esiApplicable
                  ? "ESI not applicable"
                  : esi === 0
                  ? `Gross salary exceeds ESI ceiling (${formatINR(maxEsi)})`
                  : `${esiRate}% of Gross Salary`
              }
              color="emerald"
            />
          </div>
        </>
      )}

      {/* ── Bank Details ── */}
      <SubHeader text="Bank Details" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
        <InfoRow label="Payment Mode"    value={employee.paymentMode || "—"} />
        <InfoRow label="Bank Name"       value={employee.bankName}           />
        <InfoRow label="Branch"          value={employee.bankBranch}         />
        <InfoRow label="Account Number"  value={employee.accountNumber}      />
        <InfoRow label="IFSC Code"       value={employee.ifscCode}           />
        <InfoRow label="Account Holder"  value={employee.accountHolderName}  />
      </div>

    </FullWidthSection>
  );
}

// ─── Total Compensation Summary ──────────────────────────────────────────────

function TotalCompSummarySection({
  employee,
}: {
  employee: any;
}) {
  const onRecordGross  = Number(employee.grossSalary || employee.monthlySalary || 0);
  const cashInHand     = Number(employee.payrollConfig?.cashInHand || 0);
  const totalCTC       = onRecordGross + cashInHand;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/60 shadow-sm overflow-hidden mt-6">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 bg-indigo-600 text-white">
        <FaMoneyBillWave size={15} />
        <span className="text-xs font-bold uppercase tracking-wider">Total Compensation Summary</span>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Net Pay (Monthly)</span>
            <span className="text-lg font-bold text-slate-800 tabular-nums">{formatINR(onRecordGross)}</span>
          </div>
          <div className="p-4 rounded-xl bg-white border border-indigo-200 shadow-xs flex flex-col gap-1">
            <span className="text-xs font-medium text-indigo-600">Cash in Hand</span>
            <span className="text-lg font-bold text-indigo-700 tabular-nums">{formatINR(cashInHand)}</span>
          </div>
          <div className="p-4 rounded-xl bg-indigo-600 text-white shadow-xs flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">Total Monthly CTC</span>
            <span className="text-xl font-extrabold text-white tabular-nums">{formatINR(totalCTC)}</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center italic">
          Net Pay ({formatINR(onRecordGross)}) + Cash in Hand ({formatINR(cashInHand)}) = {formatINR(totalCTC)}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeeViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();
  const canEdit           = can("employees.edit");
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  // Company payroll settings — drives all salary derivations
  const { config: payrollConfig } = usePayrollConfig();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    employeeService.fetchById(id)
      .then((emp) => setEmployee(emp))
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || "Failed to load employee");
        navigate("/employees");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!employee) return null;

  const initials = employee.fullName
    ?.split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

      {/* Top nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/employees")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors font-medium"
        >
          <FaArrowLeft size={13} />
          Back to Employees
        </button>
        {canEdit && (
          <button
            onClick={() => navigate(`/employees/edit/${employee.id}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <FaEdit size={13} />
            Edit Employee
          </button>
        )}
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
        {employee.photoUrl && !imgError ? (
          <img
            src={getPhotoUrl(employee.photoUrl)}
            alt={employee.fullName}
            onError={() => setImgError(true)}
            className="w-24 h-24 rounded-full object-cover border-4 border-primary/20 flex-shrink-0"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold flex-shrink-0 border-4 border-primary/20">
            {initials}
          </div>
        )}
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold text-slate-800">{employee.fullName}</h1>
          <p className="text-slate-500 font-medium mt-0.5">{employee.empCode}</p>
          <div className="flex flex-wrap gap-3 mt-3 justify-center sm:justify-start">
            {employee.designation && (
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                {employee.designation}
              </span>
            )}
            {employee.department?.name && (
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                {employee.department.name}
              </span>
            )}
            {employee.employeeType && (
              <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold capitalize">
                {employee.employeeType}
              </span>
            )}
            <StatusBadge status={STATUS_MAP[employee.status] ?? employee.status?.toUpperCase() ?? "INACTIVE"} />
          </div>
        </div>
      </div>

      {/* 1. Basic Info */}
      <Section icon={FaUser} title="Basic Information">
        <InfoRow label="Employee Code" value={employee.empCode} />
        <InfoRow label="Full Name" value={employee.fullName} />
        <InfoRow label="Gender" value={employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1) : null} />
        <InfoRow label="Date of Birth" value={employee.dateOfBirth ? `${formatDate(employee.dateOfBirth)} (${calcAge(employee.dateOfBirth)})` : null} />
        <InfoRow label="Blood Group" value={employee.bloodGroup} />
        <InfoRow label="Marital Status" value={employee.maritalStatus ? employee.maritalStatus.charAt(0).toUpperCase() + employee.maritalStatus.slice(1) : null} />
      </Section>

      {/* 2. Contact Details */}
      <Section icon={FaPhone} title="Contact Details">
        <InfoRow label="Work Mobile" value={employee.mobile} />
        <InfoRow label="Work Email" value={employee.email} />
        <InfoRow label="Personal Mobile" value={employee.personalMobile} />
        <InfoRow label="Personal Email" value={employee.personalEmail} />
        <InfoRow label="Emergency Contact" value={employee.emergencyContactName} />
        <InfoRow label="Emergency Number" value={employee.emergencyContactNumber} />
      </Section>

      {/* 3. Family Details */}
      <Section icon={FaUsers} title="Family Details">
        <InfoRow label="Father's Name" value={employee.fatherName} />
        <InfoRow label="Mother's Name" value={employee.motherName} />
        <InfoRow label="Spouse's Name" value={employee.spouseName} />
        <InfoRow label="Guardian's Name" value={employee.guardianName} />
        <InfoRow label="Guardian Relationship" value={employee.guardianRelationship} />
      </Section>

      {/* 4. Identity Documents */}
      <Section icon={FaIdCard} title="Identity Documents">
        <InfoRow label="Aadhaar Number" value={employee.aadhaarNumber} />
        <InfoRow label="PAN Number" value={employee.panNumber} />
        <InfoRow label="Driving License" value={employee.drivingLicense} />
        <InfoRow label="Voter ID" value={employee.voterId} />
      </Section>

      {/* 5. Address */}
      <FullWidthSection icon={FaMapMarkerAlt} title="Address">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">Permanent Address</p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Address Line 1" value={employee.permanentAddressLine1} />
              <InfoRow label="Address Line 2" value={employee.permanentAddressLine2} />
              <InfoRow label="City" value={employee.permanentCity} />
              <InfoRow label="State" value={employee.permanentState} />
              <InfoRow label="Pincode" value={employee.permanentPincode} />
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">Present Address</p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Address Line 1" value={employee.presentAddressLine1} />
              <InfoRow label="Address Line 2" value={employee.presentAddressLine2} />
              <InfoRow label="City" value={employee.presentCity} />
              <InfoRow label="State" value={employee.presentState} />
              <InfoRow label="Pincode" value={employee.presentPincode} />
            </div>
          </div>
        </div>
      </FullWidthSection>

      {/* 6. Official Info */}
      <Section icon={FaBriefcase} title="Official Information">
        <InfoRow label="Department" value={employee.department?.name} />
        <InfoRow label="Role" value={employee.role?.name || employee.user?.role?.name} />
        <InfoRow label="Employee Type" value={employee.employeeType ? employee.employeeType.charAt(0).toUpperCase() + employee.employeeType.slice(1) : null} />
        <InfoRow label="Status" value={<StatusBadge status={STATUS_MAP[employee.status] ?? employee.status?.toUpperCase() ?? "INACTIVE"} />} />
      </Section>

      {/* 7. Joining Details */}
      <Section icon={FaCalendarAlt} title="Joining Details">
        <InfoRow label="Date of Joining" value={formatDate(employee.dateOfJoining)} />
        {/* <InfoRow label="Probation Period" value={employee.probationPeriod != null ? `${employee.probationPeriod} days` : null} />
        <InfoRow label="Notice Period" value={employee.noticePeriod != null ? `${employee.noticePeriod} days` : null} /> */}
        <InfoRow label="Relieving Date" value={formatDate(employee.relievingDate)} />
        <InfoRow label="Previous Experience" value={employee.previousExperience} />
      </Section>

      {/* 8. Shift */}
      <Section icon={FaClock} title="Shift Assignment">
        <InfoRow label="Shift" value={employee.shift?.shiftName || employee.shiftId} />
        <InfoRow label="Shift Code" value={employee.shiftId} />
      </Section>

      {/* 9. Payroll */}
      <PayrollSection employee={employee} payrollConfig={payrollConfig} />

      {/* 9b. Total Compensation Summary */}
      {Number(employee.payrollConfig?.cashInHand || 0) > 0 && (
        <TotalCompSummarySection employee={employee} />
      )}

      {/* 10. Login Account */}
      <Section icon={FaLock} title="Login Account">
        <InfoRow label="Username" value={employee.user?.username} />
        <InfoRow label="Role" value={employee.user?.role?.name} />
        <InfoRow
          label="Login Status"
          value={
            employee.user ? (
              <StatusBadge status={employee.user.status?.toUpperCase() || "INACTIVE"} />
            ) : (
              <span className="text-slate-400 italic text-xs">No account</span>
            )
          }
        />
        <InfoRow
          label="Must Change Password"
          value={
            employee.user ? (
              <span className={employee.user.mustChangePw ? "text-amber-600 font-semibold text-xs" : "text-green-600 font-semibold text-xs"}>
                {employee.user.mustChangePw ? "Yes" : "No"}
              </span>
            ) : null
          }
        />
      </Section>

      {/* 11. Audit */}
      <Section icon={FaClipboardList} title="Audit Information">
        <InfoRow label="Employee ID" value={String(employee.id)} />
        <InfoRow label="Created At" value={formatDate(employee.createdAt)} />
        <InfoRow label="Created By" value={employee.createdBy} />
        <InfoRow label="Updated At" value={formatDate(employee.updatedAt)} />
        <InfoRow label="Updated By" value={employee.updatedBy} />
      </Section>

    </div>
  );
}
