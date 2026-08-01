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

export default function EmployeeViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();
  const canEdit = can("employees.edit");

  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    employeeService
      .fetchById(id)
      .then((emp: any) => setEmployee(emp))
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
        {employee.photoUrl ? (
          <img
            src={`${import.meta.env.VITE_API_BASE_URL?.replace("/api", "") || "http://localhost:5000"}/${employee.photoUrl}`}
            alt={employee.fullName}
            className="w-24 h-24 rounded-full object-cover border-4 border-primary/20 flex-shrink-0"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold flex-shrink-0">
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
        <InfoRow label="Designation" value={employee.designation} />
        <InfoRow label="Employee Type" value={employee.employeeType ? employee.employeeType.charAt(0).toUpperCase() + employee.employeeType.slice(1) : null} />
        <InfoRow label="Status" value={<StatusBadge status={STATUS_MAP[employee.status] ?? employee.status?.toUpperCase() ?? "INACTIVE"} />} />
      </Section>

      {/* 7. Joining Details */}
      <Section icon={FaCalendarAlt} title="Joining Details">
        <InfoRow label="Date of Joining" value={formatDate(employee.dateOfJoining)} />
        <InfoRow label="Probation Period" value={employee.probationPeriod != null ? `${employee.probationPeriod} days` : null} />
        <InfoRow label="Notice Period" value={employee.noticePeriod != null ? `${employee.noticePeriod} days` : null} />
        <InfoRow label="Relieving Date" value={formatDate(employee.relievingDate)} />
        <InfoRow label="Previous Experience" value={employee.previousExperience} />
      </Section>

      {/* 8. Shift */}
      <Section icon={FaClock} title="Shift Assignment">
        <InfoRow label="Shift" value={employee.shift?.shiftName || employee.shiftId} />
        <InfoRow label="Shift Code" value={employee.shiftId} />
      </Section>

      {/* 9. Payroll */}
      <FullWidthSection icon={FaMoneyBillWave} title="Payroll & Statutory">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5 mb-6">
          <InfoRow label="Salary Type" value={employee.salaryType ? employee.salaryType.charAt(0).toUpperCase() + employee.salaryType.slice(1) : null} />
          <InfoRow label="Basic Salary" value={employee.basicSalary != null ? `₹ ${Number(employee.basicSalary).toLocaleString("en-IN")}` : null} />
          <InfoRow label="Gross Salary" value={employee.grossSalary != null ? `₹ ${Number(employee.grossSalary).toLocaleString("en-IN")}` : null} />
        </div>

        {/* Statutory flags */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "PF Applicable", value: employee.pfApplicable },
            { label: "ESI Applicable", value: employee.esiApplicable },
            { label: "Professional Tax", value: employee.professionalTax },
            { label: "TDS Applicable", value: employee.tdsApplicable },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${value ? "bg-green-500" : "bg-slate-300"}`} />
              <span className="text-xs font-semibold text-slate-600">{label}</span>
              <span className={`ml-auto text-xs font-bold ${value ? "text-green-600" : "text-slate-400"}`}>
                {value ? "Yes" : "No"}
              </span>
            </div>
          ))}
        </div>

        {/* PF / ESI / UAN numbers */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5 mb-6">
          <InfoRow label="PF Number" value={employee.pfNumber} />
          <InfoRow label="UAN Number" value={employee.uanNumber} />
          <InfoRow label="ESI Number" value={employee.esiNumber} />
        </div>

        {/* Bank Details */}
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1 mb-4">
          Bank Details
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
          <InfoRow label="Bank Name" value={employee.bankName} />
          <InfoRow label="Branch" value={employee.bankBranch} />
          <InfoRow label="Account Number" value={employee.accountNumber} />
          <InfoRow label="IFSC Code" value={employee.ifscCode} />
          <InfoRow label="Account Holder" value={employee.accountHolderName} />
        </div>
      </FullWidthSection>

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
