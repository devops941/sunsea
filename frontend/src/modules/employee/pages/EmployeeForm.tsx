import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import {
  FaUser, FaPhone, FaUsers, FaIdCard, FaMapMarkerAlt,
  FaBriefcase, FaCalendarAlt, FaClock, FaMoneyBillWave, FaKey,
  FaClipboardList, FaSave, FaChevronLeft, FaChevronRight, FaCamera,
  FaRandom, FaEye, FaEyeSlash, FaCheck, FaTimes, FaSpinner,
} from "react-icons/fa";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";
import { useDepartments } from "../../../hooks/useDepartments";
import { useRoles } from "../../../hooks/useRoles";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { employeeService } from "../../../services/employeeService";
import apiClient from "../../../api/apiClient";
import SalaryStructureSection from "../../../components/employee/SalaryStructureSection";

// ─── helpers ────────────────────────────────────────────────────────────────

function calcAge(dob: string): string {
  if (!dob) return "";
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

function calcExperience(dateOfJoining: string): string {
  if (!dateOfJoining) return "";
  const start = new Date(dateOfJoining);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years < 0) return "";
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  return parts.length ? parts.join(" ") : "Less than a month";
}

function generatePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = rand(upper) + rand(lower) + rand(digits) + rand(symbols);
  for (let i = 4; i < 12; i++) pw += rand(all);
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "";
  return val.split("T")[0]; // strip time if ISO string
}

// ─── tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: 0, label: "Basic Info", icon: FaUser },
  { id: 1, label: "Contact", icon: FaPhone },
  { id: 2, label: "Family", icon: FaUsers },
  { id: 3, label: "Identity", icon: FaIdCard },
  { id: 4, label: "Address", icon: FaMapMarkerAlt },
  { id: 5, label: "Official Info", icon: FaBriefcase },
  { id: 6, label: "Joining", icon: FaCalendarAlt },
  { id: 7, label: "Shift", icon: FaClock },
  { id: 8, label: "Payroll", icon: FaMoneyBillWave },
  { id: 9, label: "Login Account", icon: FaKey },
];

// ─── form state ───────────────────────────────────────────────────────────────

interface FormState {
  empCode: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  maritalStatus: string;
  employeeStatus: string;
  photoFile: File | null;
  photoPreview: string;
  existingPhotoUrl: string;
  personalMobile: string;
  officialMobile: string;
  personalEmail: string;
  officialEmail: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  fatherName: string;
  motherName: string;
  spouseName: string;
  guardianName: string;
  guardianRelationship: string;
  aadhaarNumber: string;
  panNumber: string;
  drivingLicense: string;
  voterId: string;
  permAddress1: string;
  permAddress2: string;
  permCity: string;
  permState: string;
  permPincode: string;
  sameAsPermanent: boolean;
  presAddress1: string;
  presAddress2: string;
  presCity: string;
  presState: string;
  presPincode: string;
  departmentId: string;
  designation: string;
  employeeType: string;
  dateOfJoining: string;
  relievingDate: string;
  previousExperience: string;
  probationPeriod: string;
  noticePeriod: string;
  shiftId: string;
  // Payroll — salary structure
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
  cashInHand: string;
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
  createLoginAccount: boolean;
  username: string;
  password: string;
  roleId: string;
  mustChangePw: boolean;
  loginEnabled: boolean;
  // audit
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

const INITIAL_STATE: FormState = {
  empCode: "", fullName: "", gender: "", dateOfBirth: "", bloodGroup: "",
  maritalStatus: "", employeeStatus: "active", photoFile: null, photoPreview: "", existingPhotoUrl: "",
  personalMobile: "", officialMobile: "", personalEmail: "", officialEmail: "",
  emergencyContactName: "", emergencyContactNumber: "",
  fatherName: "", motherName: "", spouseName: "", guardianName: "", guardianRelationship: "",
  aadhaarNumber: "", panNumber: "", drivingLicense: "", voterId: "",
  permAddress1: "", permAddress2: "", permCity: "", permState: "", permPincode: "",
  sameAsPermanent: false,
  presAddress1: "", presAddress2: "", presCity: "", presState: "", presPincode: "",
  departmentId: "", designation: "", employeeType: "",
  dateOfJoining: "", relievingDate: "", previousExperience: "",
  probationPeriod: "", noticePeriod: "",
  shiftId: "",
  salaryType: "MONTHLY",
  monthlySalary: "", basicSalary: "", da: "", hra: "",
  conveyanceAllowance: "", medicalAllowance: "", specialAllowance: "",
  otherAllowance: "",
  cashInHand: "",
  weeklySalary: "",
  dailySalary: "", overtimeEligible: false,
  hourlySalary: "", minWorkingHours: "", maxWorkingHours: "",
  pfApplicable: false, pfNumber: "", uanNumber: "",
  esiApplicable: false, esiNumber: "",
  professionalTax: false, tdsApplicable: false,
  paymentMode: "BANK",
  bankName: "", bankBranch: "", accountNumber: "", ifscCode: "", accountHolderName: "",
  createLoginAccount: false, username: "", password: "", roleId: "",
  mustChangePw: false, loginEnabled: true,
  createdBy: "", createdAt: "", updatedBy: "", updatedAt: "",
};

// ─── sub-components ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; color?: string }> = ({
  icon: Icon, title, color = "text-primary",
}) => (
  <div className="flex items-center gap-2 mb-5 pb-2 border-b border-line-soft">
    <Icon className={`${color} text-lg`} />
    <h3 className="text-base font-extrabold text-ink tracking-wide">{title}</h3>
  </div>
);

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label, value, onChange,
}) => (
  <div className="flex items-center gap-3">
    <label className="text-xs font-bold uppercase tracking-[0.5px] text-ink-muted">{label}</label>
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" className="sr-only" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <div className={`block w-14 h-8 rounded-full transition-colors duration-300 ${value ? "bg-primary" : "bg-gray-300"}`} />
      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${value ? "transform translate-x-6" : ""}`} />
    </label>
    <span className="text-sm font-medium text-ink-muted">{value ? "YES" : "NO"}</span>
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────

const EmployeeForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const user = useSelector((state: any) => state.auth.user);
  const { departments, loadDepartments } = useDepartments();
  const { roles, loadRoles } = useRoles();

  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [shifts, setShifts] = useState<any[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const handleSubmitRef = useRef<() => void>(() => {});
  const handleFormKeyDown = useFormKeyboardNav(tabContentRef);

  const [isDirty, setIsDirty] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const isDirtyRef = useRef(isDirty);
  const saveConfirmOpenRef = useRef(saveConfirmOpen);

  useFormShortcuts({ onSave: () => handleSubmitRef.current() });

  const fetchShifts = useCallback(() => {
    apiClient.get("/shifts").then((res) => {
      const data = res.data?.data || res.data || [];
      setShifts(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const fetchDeps = useCallback(() => {
    loadDepartments();
  }, [loadDepartments]);

  const fetchRls = useCallback(() => {
    loadRoles();
  }, [loadRoles]);

  // Real-time socket sync for dropdowns (Departments, Roles, Shifts)
  useSocketSync("department", undefined, fetchDeps);
  useSocketSync("role", undefined, fetchRls);
  useSocketSync("shift", undefined, fetchShifts);

  // ── load dropdowns + shifts + employee data (edit) or next emp code (create)
  useEffect(() => {
    fetchDeps();
    fetchRls();
    fetchShifts();

    if (isEdit && id) {
      setIsLoading(true);
      employeeService.fetchById(id).then((emp: any) => {
        setForm({
          empCode: emp.empCode || "",
          fullName: emp.fullName || "",
          gender: emp.gender || "",
          dateOfBirth: fmtDate(emp.dateOfBirth),
          bloodGroup: emp.bloodGroup || "",
          maritalStatus: emp.maritalStatus || "",
          employeeStatus: emp.status || "active",
          photoFile: null,
          photoPreview: "",
          existingPhotoUrl: emp.photoUrl || "",
          personalMobile: emp.personalMobile || "",
          officialMobile: emp.mobile || "",
          personalEmail: emp.personalEmail || "",
          officialEmail: emp.email || "",
          emergencyContactName: emp.emergencyContactName || "",
          emergencyContactNumber: emp.emergencyContactNumber || "",
          fatherName: emp.fatherName || "",
          motherName: emp.motherName || "",
          spouseName: emp.spouseName || "",
          guardianName: emp.guardianName || "",
          guardianRelationship: emp.guardianRelationship || "",
          aadhaarNumber: emp.aadhaarNumber || "",
          panNumber: emp.panNumber || "",
          drivingLicense: emp.drivingLicense || "",
          voterId: emp.voterId || "",
          permAddress1: emp.permanentAddressLine1 || "",
          permAddress2: emp.permanentAddressLine2 || "",
          permCity: emp.permanentCity || "",
          permState: emp.permanentState || "",
          permPincode: emp.permanentPincode || "",
          sameAsPermanent: false,
          presAddress1: emp.presentAddressLine1 || "",
          presAddress2: emp.presentAddressLine2 || "",
          presCity: emp.presentCity || "",
          presState: emp.presentState || "",
          presPincode: emp.presentPincode || "",
          departmentId: emp.departmentId ? String(emp.departmentId) : "",
          designation: emp.designation || "",
          employeeType: emp.employeeType || "",
          dateOfJoining: fmtDate(emp.dateOfJoining),
          relievingDate: fmtDate(emp.relievingDate),
          previousExperience: emp.previousExperience || "",
          probationPeriod: emp.probationPeriod ? String(emp.probationPeriod) : "",
          noticePeriod: emp.noticePeriod ? String(emp.noticePeriod) : "",
          shiftId: emp.shiftId ? String(emp.shiftId) : "",
          salaryType: (emp.salaryType || "monthly").toUpperCase(),
          monthlySalary:      emp.salaryType?.toLowerCase() === "monthly" ? String(emp.grossSalary || "") : "",
          weeklySalary:       emp.salaryType?.toLowerCase() === "weekly"  ? String(emp.grossSalary || "") : "",
          dailySalary:        emp.salaryType?.toLowerCase() === "daily"   ? String(emp.grossSalary || "") : "",
          hourlySalary:       emp.salaryType?.toLowerCase() === "hourly"  ? String(emp.grossSalary || "") : "",
          basicSalary:        (() => {
            const raw = emp.basicSalary !== undefined && emp.basicSalary !== null ? String(emp.basicSalary) : (emp.payrollConfig?.basicSalary ? String(emp.payrollConfig.basicSalary) : "");
            if (raw && parseFloat(raw) > 0) return raw;
            const gross = Number(emp.grossSalary || 0);
            return gross > 0 ? String(Math.round(gross * 0.50)) : "";
          })(),
          da:                 (() => {
            const raw = emp.da !== undefined && emp.da !== null ? String(emp.da) : (emp.payrollConfig?.da ? String(emp.payrollConfig.da) : "");
            if (raw && parseFloat(raw) > 0) return raw;
            const gross = Number(emp.grossSalary || 0);
            return gross > 0 ? String(Math.round(gross * 0.10)) : "";
          })(),
          hra:                (() => {
            const raw = emp.hra !== undefined && emp.hra !== null ? String(emp.hra) : (emp.payrollConfig?.hra ? String(emp.payrollConfig.hra) : "");
            if (raw && parseFloat(raw) > 0) return raw;
            const gross = Number(emp.grossSalary || 0);
            return gross > 0 ? String(Math.round(gross * 0.10)) : "";
          })(),
          conveyanceAllowance: "",
          medicalAllowance:   "",
          specialAllowance:   "",
          otherAllowance:     (() => {
            const raw = emp.otherAllowance !== undefined && emp.otherAllowance !== null ? String(emp.otherAllowance) : (emp.payrollConfig?.otherAllowance ? String(emp.payrollConfig.otherAllowance) : "");
            if (raw && parseFloat(raw) > 0) return raw;
            const gross = Number(emp.grossSalary || 0);
            if (gross <= 0) return "";
            const b = Math.round(gross * 0.50);
            const d = Math.round(gross * 0.10);
            const h = Math.round(gross * 0.10);
            return String(Math.max(0, gross - b - d - h));
          })(),
          cashInHand:         emp.payrollConfig?.cashInHand ? String(emp.payrollConfig.cashInHand) : "",
          overtimeEligible:   false,
          minWorkingHours:    "",
          maxWorkingHours:    "",
          pfApplicable: !!emp.pfApplicable,
          pfNumber: emp.pfNumber || "",
          uanNumber: emp.uanNumber || "",
          esiApplicable: !!emp.esiApplicable,
          esiNumber: emp.esiNumber || "",
          professionalTax: !!emp.professionalTax,
          tdsApplicable: !!emp.tdsApplicable,
          paymentMode: emp.paymentMode || "BANK",
          bankName: emp.bankName || "",
          bankBranch: emp.bankBranch || "",
          accountNumber: emp.accountNumber || "",
          ifscCode: emp.ifscCode || "",
          accountHolderName: emp.accountHolderName || "",
          createLoginAccount: !!emp.user,
          username: emp.user?.username || "",
          password: "",
          roleId: emp.roleId ? String(emp.roleId) : (emp.user?.roleId ? String(emp.user.roleId) : ""),
          mustChangePw: !!emp.user?.mustChangePw,
          loginEnabled: emp.user ? emp.user.status === "active" : true,
          createdBy: emp.createdByUser?.username || emp.createdBy || "",
          createdAt: emp.createdAt ? new Date(emp.createdAt).toLocaleString() : "",
          updatedBy: emp.updatedByUser?.username || emp.updatedBy || "",
          updatedAt: emp.updatedAt ? new Date(emp.updatedAt).toLocaleString() : "",
        });
      }).catch(() => {
        toast.error("Failed to load employee data");
      }).finally(() => setIsLoading(false));
    } else {
      // Create mode — fetch next employee code
      employeeService.fetchNextCode().then((code: string) => {
        if (code) setForm((p) => ({ ...p, empCode: code }));
      }).catch(() => {});
    }
  }, [id, isEdit, loadDepartments, loadRoles]);

  // ── debounced username availability check (create mode only)
  useEffect(() => {
    if (isEdit) return; // skip availability check in edit mode
    if (!form.createLoginAccount || !form.username.trim()) {
      setUsernameStatus("idle");
      return;
    }
    if (form.username.trim().length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    usernameCheckTimer.current = setTimeout(() => {
      apiClient.get(`/users/check-username/${encodeURIComponent(form.username.trim())}`)
        .then((res) => {
          const data = res.data?.data || res.data;
          setUsernameStatus(data?.available ? "available" : "taken");
          if (!data?.available) {
            setErrors((p) => ({ ...p, username: "Username is already taken" }));
          } else {
            setErrors((p) => ({ ...p, username: undefined }));
          }
        })
        .catch(() => {
          setUsernameStatus("idle");
        });
    }, 500);
    return () => {
      if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    };
  }, [form.username, form.createLoginAccount, isEdit]);

  // ── field change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: any } }
  ) => {
    let { name, value } = e.target;

    // Field-level entry restrictions
    if (name === "aadhaarNumber") {
      value = String(value).replace(/\D/g, "").slice(0, 12);
    } else if (name === "panNumber") {
      value = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    } else if (name === "drivingLicense") {
      value = String(value).toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 16);
    } else if (name === "voterId") {
      value = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    }

    setForm((p) => {
      const next = { ...p, [name]: value };

      if (name === "sameAsPermanent") {
        const checked = (e as React.ChangeEvent<HTMLInputElement>).target.checked ?? value;
        next.sameAsPermanent = checked;
        if (checked) {
          next.presAddress1 = p.permAddress1;
          next.presAddress2 = p.permAddress2;
          next.presCity = p.permCity;
          next.presState = p.permState;
          next.presPincode = p.permPincode;
        }
      }

      if (p.sameAsPermanent && ["permAddress1","permAddress2","permCity","permState","permPincode"].includes(name)) {
        const map: Record<string, keyof FormState> = {
          permAddress1: "presAddress1", permAddress2: "presAddress2",
          permCity: "presCity", permState: "presState", permPincode: "presPincode",
        };
        (next as any)[map[name]] = value;
      }

      return next;
    });
    if (errors[name as keyof FormState]) {
      setErrors((p) => ({ ...p, [name]: undefined }));
    }
    setIsDirty(true);
  };

  const handleToggle = (name: keyof FormState) => (v: boolean) => {
    setForm((p) => ({ ...p, [name]: v }));
    setIsDirty(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }
    const preview = URL.createObjectURL(file);
    setForm((p) => ({ ...p, photoFile: file, photoPreview: preview }));
    setIsDirty(true);
  };

  // ── derived
  const age = calcAge(form.dateOfBirth);
  const currentExperience = calcExperience(form.dateOfJoining);

  // ── dropdown options
  const departmentOptions = useMemo(() =>
    departments.map((d) => ({ value: String(d.id), label: d.name })),
    [departments]
  );

  const roleOptions = useMemo(() => {
    const excluded = ["ROLE_ADMIN", "Super Admin", "System Administrator"];
    return roles
      .filter((r) => !excluded.includes(r.name))
      .map((r) => ({ value: String(r.id), label: r.name }));
  }, [roles]);

  const shiftOptions = useMemo(() =>
    shifts.map((s: any) => ({ value: String(s.shiftCode), label: s.shiftName })),
    [shifts]
  );

  // ── validate
  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.empCode.trim()) e.empCode = "Employee code is required";
    if (!form.fullName.trim()) e.fullName = "Employee name is required";

    // Contact — Mobile & Email are optional; validate format if entered
    if (form.officialMobile.trim()) {
      if (form.officialMobile.replace(/\D/g, "").replace(/^91/, "").length !== 10)
        e.officialMobile = "Enter a valid 10-digit mobile number";
    }

    if (form.createLoginAccount && !form.officialEmail.trim()) {
      e.officialEmail = "Official email is required when login account is enabled";
    } else if (form.officialEmail.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.officialEmail.trim()))
        e.officialEmail = "Enter a valid email address";
    }

    // Identity validation
    if (form.aadhaarNumber.trim()) {
      if (form.aadhaarNumber.trim().length !== 12)
        e.aadhaarNumber = "Aadhaar number must be exactly 12 digits";
    }

    if (form.panNumber.trim()) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber.trim()))
        e.panNumber = "Invalid PAN number format (e.g. ABCDE1234F)";
    }

    if (form.drivingLicense.trim()) {
      const clean = form.drivingLicense.trim().replace(/[\s-]/g, "");
      if (clean.length < 10 || clean.length > 16)
        e.drivingLicense = "Invalid Driving License format (10-16 alphanumeric characters)";
    }

    if (form.voterId.trim()) {
      if (!/^[A-Z]{3}[0-9]{7}$/.test(form.voterId.trim()))
        e.voterId = "Invalid Voter ID format (e.g. ABC1234567)";
    }

    if (!form.departmentId) e.departmentId = "Department is required";

    // Login account validation
    if (form.createLoginAccount) {
      if (!form.roleId.trim()) e.roleId = "Role is required when login account is enabled";
      if (!form.username.trim()) e.username = "Username is required";
      else if (form.username.trim().length < 3) e.username = "Username must be at least 3 characters";
      else if (!isEdit && usernameStatus === "taken") e.username = "Username is already taken";

      // Password: required in create mode, optional in edit mode
      if (!isEdit) {
        if (!form.password.trim()) e.password = "Password is required";
        else if (form.password.length < 8) e.password = "Password must be at least 8 characters";
      } else {
        if (form.password && form.password.length < 8) e.password = "Password must be at least 8 characters";
      }
    }

    // Payroll — validate primary salary field per type
    const st = (form.salaryType || "").toUpperCase();
    if (st === "MONTHLY" && !form.monthlySalary)
      e.monthlySalary = "Monthly gross salary is required";
    if (st === "WEEKLY" && !form.weeklySalary)
      e.weeklySalary = "Weekly gross salary is required";
    if (st === "DAILY" && !form.dailySalary)
      e.dailySalary = "Daily wage is required";
    if (st === "HOURLY" && !form.hourlySalary)
      e.hourlySalary = "Hourly rate is required";

    // PF validation
    if (form.paymentMode === "BANK" && form.pfApplicable) {
      if (!form.uanNumber.trim()) e.uanNumber = "UAN Number is required when PF is applicable";
    }

    // ESI validation
    if (form.paymentMode === "BANK" && form.esiApplicable) {
      if (!form.esiNumber.trim()) e.esiNumber = "ESIC Number is required when ESI is applicable";
    }

    // Bank validation
    if (form.paymentMode === "BANK") {
      if (!form.bankName.trim())           e.bankName = "Bank Name is required for Bank Transfers";
      if (!form.bankBranch.trim())         e.bankBranch = "Bank Branch is required for Bank Transfers";
      if (!form.accountNumber.trim())      e.accountNumber = "Account Number is required for Bank Transfers";
      if (!form.ifscCode.trim())            e.ifscCode = "IFSC Code is required for Bank Transfers";
      if (!form.accountHolderName.trim())  e.accountHolderName = "Account Holder Name is required for Bank Transfers";

      // Validate component breakdown sum matches gross salary
      const gross = parseFloat(form.monthlySalary || form.weeklySalary || form.dailySalary || form.hourlySalary || "0") || 0;
      if (gross > 0) {
        const basic = parseFloat(form.basicSalary || "0") || 0;
        const da = parseFloat(form.da || "0") || 0;
        const hra = parseFloat(form.hra || "0") || 0;
        const other = parseFloat(form.otherAllowance || "0") || 0;
        const sum = basic + da + hra + other;

        if (Math.abs(sum - gross) > 0.01) {
          e.otherAllowance = `Salary components sum (₹${sum.toLocaleString('en-IN')}) must equal Gross Salary (₹${gross.toLocaleString('en-IN')})`;
        }
      }
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error(Object.values(e)[0]);
      return false;
    }
    return true;
  };

  // ── submit
  const handleSubmit = async () => {
    if (!validate() || isSubmitting) return;
    if (isEdit && !id) return;
    setIsSubmitting(true);

    // Check duplicate employee code
    try {
      const res = await employeeService.fetchAll();
      const list = Array.isArray(res) ? res : res.data || [];
      const duplicate = list.find((e: any) => {
        const codeMatch = e.empCode?.trim().toLowerCase() === form.empCode.trim().toLowerCase();
        if (!codeMatch) return false;
        // In edit mode, exclude self from duplicate check
        if (isEdit) return String(e.id) !== String(id);
        return true;
      });
      if (duplicate) {
        setErrors(p => ({ ...p, empCode: "Employee code already exists" }));
        toast.error("Employee code already exists");
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      // Continue if search check fails
    }

    try {
      const fd = new FormData();
      fd.append("empCode", form.empCode);
      fd.append("fullName", form.fullName);
      if (form.gender) fd.append("gender", form.gender);
      if (form.dateOfBirth) fd.append("dateOfBirth", form.dateOfBirth);
      if (form.bloodGroup) fd.append("bloodGroup", form.bloodGroup);
      if (form.maritalStatus) fd.append("maritalStatus", form.maritalStatus);
      fd.append("status", form.employeeStatus || "active");

      if (form.photoFile) fd.append("photo", form.photoFile);

      fd.append("personalMobile",        form.personalMobile || "");
      fd.append("mobile",                form.officialMobile || "");
      fd.append("personalEmail",         form.personalEmail || "");
      fd.append("email",                 form.officialEmail || "");
      fd.append("emergencyContactName",  form.emergencyContactName || "");
      fd.append("emergencyContactNumber", form.emergencyContactNumber || "");

      // Family
      fd.append("fatherName",           form.fatherName || "");
      fd.append("motherName",           form.motherName || "");
      fd.append("spouseName",           form.spouseName || "");
      fd.append("guardianName",         form.guardianName || "");
      fd.append("guardianRelationship", form.guardianRelationship || "");

      // Identity
      fd.append("aadhaarNumber", form.aadhaarNumber || "");
      fd.append("panNumber",     form.panNumber || "");
      fd.append("drivingLicense",form.drivingLicense || "");
      fd.append("voterId",       form.voterId || "");

      // Address
      fd.append("permanentAddressLine1", form.permAddress1 || "");
      fd.append("permanentAddressLine2", form.permAddress2 || "");
      fd.append("permanentCity",         form.permCity || "");
      fd.append("permanentState",        form.permState || "");
      fd.append("permanentPincode",      form.permPincode || "");
      fd.append("presentAddressLine1",   form.presAddress1 || "");
      fd.append("presentAddressLine2",   form.presAddress2 || "");
      fd.append("presentCity",           form.presCity || "");
      fd.append("presentState",          form.presState || "");
      fd.append("presentPincode",        form.presPincode || "");

      if (form.departmentId) fd.append("departmentId", form.departmentId);
      if (form.roleId)       fd.append("roleId",       form.roleId);
      if (form.designation)  fd.append("designation",  form.designation);
      if (form.employeeType) fd.append("employeeType", form.employeeType);

      if (form.dateOfJoining) fd.append("dateOfJoining", form.dateOfJoining);
      if (form.relievingDate) fd.append("relievingDate", form.relievingDate);
      if (form.previousExperience) fd.append("previousExperience", form.previousExperience);
      if (form.probationPeriod) fd.append("probationPeriod", form.probationPeriod);
      if (form.noticePeriod) fd.append("noticePeriod", form.noticePeriod);

      if (form.shiftId) fd.append("shiftId", form.shiftId);

      if (form.salaryType) fd.append("salaryType", form.salaryType.toLowerCase());
      const st = (form.salaryType || "MONTHLY").toUpperCase();
      if (st === "MONTHLY") {
        if (form.monthlySalary) fd.append("grossSalary", form.monthlySalary);
      } else if (st === "WEEKLY") {
        if (form.weeklySalary)  fd.append("grossSalary", form.weeklySalary);
      } else if (st === "DAILY") {
        if (form.dailySalary)   fd.append("grossSalary", form.dailySalary);
      } else if (st === "HOURLY") {
        if (form.hourlySalary)  fd.append("grossSalary", form.hourlySalary);
      }

      // Bank Transfer salary components
      if (form.paymentMode === "BANK") {
        if (form.basicSalary)    fd.append("basicSalary", form.basicSalary);
        if (form.da)             fd.append("da", form.da);
        if (form.hra)            fd.append("hra", form.hra);
        if (form.otherAllowance) fd.append("otherAllowance", form.otherAllowance);
      }
      if (form.cashInHand) fd.append("cashInHand", form.cashInHand);
      // Statutory
      fd.append("pfApplicable",    String(form.pfApplicable));
      if (form.pfNumber)  fd.append("pfNumber",  form.pfNumber);
      if (form.uanNumber) fd.append("uanNumber", form.uanNumber);
      fd.append("esiApplicable",   String(form.esiApplicable));
      if (form.esiNumber) fd.append("esiNumber", form.esiNumber);
      fd.append("professionalTax", String(form.professionalTax));
      fd.append("paymentMode", form.paymentMode || "CASH");
      if (form.bankName) fd.append("bankName", form.bankName);
      if (form.bankBranch) fd.append("bankBranch", form.bankBranch);
      if (form.accountNumber) fd.append("accountNumber", form.accountNumber);
      if (form.ifscCode) fd.append("ifscCode", form.ifscCode);
      if (form.accountHolderName) fd.append("accountHolderName", form.accountHolderName);

      fd.append("createLoginAccount", String(form.createLoginAccount));
      if (form.createLoginAccount) {
        const loginAccount: any = {
          username: form.username,
          roleId: Number(form.roleId),
          status: form.loginEnabled ? "active" : "suspended",
          mustChangePw: form.mustChangePw,
        };
        if (form.password) loginAccount.password = form.password;
        fd.append("loginAccount", JSON.stringify(loginAccount));
      }

      if (isEdit) {
        if (user?.userId) fd.append("updatedBy", String(user.userId));
        await employeeService.update(id!, fd as any);
        toast.success("Employee updated successfully!");
      } else {
        if (user?.userId) fd.append("createdBy", String(user.userId));
        await employeeService.create(fd as any);
        toast.success("Employee created successfully!");
      }
      setIsDirty(false);
      navigate("/employees");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || `Failed to ${isEdit ? "update" : "create"} employee`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keep submitRef current on every render so useFormShortcuts (F2/F9) always calls the latest handleSubmit
  handleSubmitRef.current = handleSubmit;

  // Keep dirty/modal refs current to avoid stale closures in Escape handler
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

  // ── Escape: dirty-check back navigation ──────────────────────────────────
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
      e.preventDefault();
      e.stopPropagation();

      if (saveConfirmOpenRef.current) {
        setSaveConfirmOpen(false);
        setTimeout(() => { lastFocusedRef.current?.focus() ?? tabContentRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50);
      } else if (isDirtyRef.current) {
        lastFocusedRef.current = document.activeElement as HTMLElement | null;
        setSaveConfirmOpen(true);
      } else {
        navigate("/employees");
      }
    };
    window.addEventListener("keydown", handleEsc, { capture: true });
    return () => window.removeEventListener("keydown", handleEsc, { capture: true });
  }, [navigate]);

  // ── Tab Navigation Shortcuts (Alt+Right / Alt+N / Ctrl+PageDown, Alt+Left / Alt+P / Ctrl+PageUp, Ctrl+S) ──
  useEffect(() => {
    const handleTabShortcuts = (e: KeyboardEvent) => {
      if (document.querySelector("[role='dialog']:not([aria-hidden='true']), [data-radix-popper-content-wrapper]")) return;

      // Next tab: Alt + ArrowRight OR Alt + N OR Ctrl + PageDown
      if (
        (e.altKey && (e.key === "ArrowRight" || e.key === "n" || e.key === "N")) ||
        (e.ctrlKey && e.key === "PageDown")
      ) {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab((p) => Math.min(TABS.length - 1, p + 1));
        return;
      }

      // Previous tab: Alt + ArrowLeft OR Alt + P OR Ctrl + PageUp
      if (
        (e.altKey && (e.key === "ArrowLeft" || e.key === "p" || e.key === "P")) ||
        (e.ctrlKey && e.key === "PageUp")
      ) {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab((p) => Math.max(0, p - 1));
        return;
      }

      // Ctrl + S save shortcut
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        handleSubmitRef.current();
        return;
      }
    };

    window.addEventListener("keydown", handleTabShortcuts, { capture: true });
    return () => window.removeEventListener("keydown", handleTabShortcuts, { capture: true });
  }, []);

  // Auto-focus first field when switching tabs
  useEffect(() => {
    const timer = setTimeout(() => {
      const first = tabContentRef.current?.querySelector<HTMLElement>(
        "[data-nav]:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled])"
      );
      first?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // ── F5 Refresh ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleRefresh = async () => {
      if (isEdit && id) {
        try {
          setIsLoading(true);
          const emp = await employeeService.fetchById(id);
          // Re-trigger the existing load effect by resetting loading state
          setForm(INITIAL_STATE); // brief reset
          employeeService.fetchById(id).then((fresh: any) => {
            setForm((prev) => ({
              ...prev,
              fullName: fresh.fullName || "",
              employeeStatus: fresh.status || "active",
            }));
            setIsDirty(false);
            toast.info("Employee details refreshed");
          });
        } catch {
          toast.error("Failed to reload employee details");
        } finally {
          setIsLoading(false);
        }
      }
    };
    window.addEventListener("fkey-refresh", handleRefresh);
    return () => window.removeEventListener("fkey-refresh", handleRefresh);
  }, [id, isEdit]);

  // ─── tab content renderers ────────────────────────────────────────────────

  const renderTab0 = () => (
    <div>
      <SectionHeader icon={FaUser} title="Basic Information" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4">
        <TextInput horizontal label="Employee Code" name="empCode" value={form.empCode} onChange={handleChange} required error={errors.empCode} placeholder="e.g. EMP001" disabled={isEdit} />
        <TextInput horizontal label="Employee Name" name="fullName" value={form.fullName} onChange={handleChange} required error={errors.fullName} placeholder="Full name" />
        <SelectInput horizontal label="Gender" name="gender" value={form.gender} onChange={handleChange}
          defaultOptionLabel="Select Gender"
          options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]} />
        <DatePickerCalendar horizontal label="Date of Birth" name="dateOfBirth" value={form.dateOfBirth}
          onChange={handleChange} placeholder="Select DOB" maxDate={new Date()} />
        <TextInput horizontal label="Age (years)" name="_age" value={age} onChange={() => {}} disabled placeholder="Auto-calculated" />
        <SelectInput horizontal label="Blood Group" name="bloodGroup" value={form.bloodGroup} onChange={handleChange}
          defaultOptionLabel="Select Blood Group"
          options={["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((g) => ({ value: g, label: g }))} />
        <SelectInput horizontal label="Marital Status" name="maritalStatus" value={form.maritalStatus} onChange={handleChange}
          defaultOptionLabel="Select Status"
          options={["Single","Married","Divorced","Widowed"].map((s) => ({ value: s.toLowerCase(), label: s }))} />
        <SelectInput horizontal label="Employee Status" name="employeeStatus" value={form.employeeStatus} onChange={handleChange}
          options={[
            { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
            { value: "resigned", label: "Resigned" }, { value: "retired", label: "Retired" },
            { value: "terminated", label: "Terminated" },
          ]} />
      </div>

      {/* Photo upload */}
      <div className="mt-6">
        <SectionHeader icon={FaCamera} title="Profile Photo" />
        <div className="flex items-center gap-6">
          <div
            className="w-28 h-28 rounded-full border-2 border-dashed border-line-soft flex items-center justify-center bg-card-2 overflow-hidden cursor-pointer hover:border-primary transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            onClick={() => photoInputRef.current?.click()}
            tabIndex={0}
            data-nav
            role="button"
            aria-label="Upload profile photo"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); photoInputRef.current?.click(); } }}
          >
            {form.photoPreview ? (
              <img src={form.photoPreview} alt="New preview" className="w-full h-full object-cover" />
            ) : form.existingPhotoUrl ? (
              <img
                src={
                  form.existingPhotoUrl.startsWith("http://") || form.existingPhotoUrl.startsWith("https://") || form.existingPhotoUrl.startsWith("data:")
                    ? form.existingPhotoUrl
                    : `${import.meta.env.VITE_API_BASE_URL?.replace("/api", "") || "http://localhost:5000"}/${form.existingPhotoUrl.replace(/^\//, "")}`
                }
                alt="Current photo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-ink-subtle">
                <FaCamera size={24} className="text-primary" />
                <span className="text-xs font-semibold">Upload Photo</span>
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="px-4 py-2 text-sm font-bold text-primary bg-primary/15 border border-primary/30 rounded-lg hover:bg-primary/25 transition-colors"
            >
              {form.existingPhotoUrl || form.photoPreview ? "Replace Photo" : "Choose Photo"}
            </button>
            <p className="text-xs text-ink-subtle mt-1.5 font-medium">JPG, PNG, GIF up to 5MB</p>
            {form.photoFile && (
              <p className="text-xs text-emerald-600 mt-1">New photo selected: {form.photoFile.name}</p>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderTab1 = () => (
    <div>
      <SectionHeader icon={FaPhone} title="Contact Information" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4">
        <IndiaPhoneInput horizontal
          label="Personal Mobile Number"
          name="personalMobile"
          value={form.personalMobile}
          onChange={handleChange}
          required={false}
          placeholder="98765 43210"
        />
        <IndiaPhoneInput horizontal
          label="Official Mobile Number"
          name="officialMobile"
          value={form.officialMobile}
          onChange={handleChange}
          required={false}
          error={errors.officialMobile}
          placeholder="98765 43210"
        />
        <TextInput horizontal label="Personal Email Address" name="personalEmail" type="email" value={form.personalEmail} onChange={handleChange} placeholder="Personal email" />
        <TextInput horizontal label="Official Email Address" name="officialEmail" type="email" value={form.officialEmail} onChange={handleChange} error={errors.officialEmail} placeholder="Official email" />
        <TextInput horizontal label="Emergency Contact Name" name="emergencyContactName" value={form.emergencyContactName} onChange={handleChange} placeholder="Emergency contact name" />
        <IndiaPhoneInput horizontal
          label="Emergency Contact Number"
          name="emergencyContactNumber"
          value={form.emergencyContactNumber}
          onChange={handleChange}
          required={false}
          placeholder="98765 43210"
        />
      </div>
    </div>
  );

  const renderTab2 = () => (
    <div>
      <SectionHeader icon={FaUsers} title="Family Details" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4">
        <TextInput horizontal label="Father Name"           name="fatherName"           value={form.fatherName}           onChange={handleChange} placeholder="Father's name" />
        <TextInput horizontal label="Mother Name"           name="motherName"           value={form.motherName}           onChange={handleChange} placeholder="Mother's name" />
        <TextInput horizontal label="Husband / Wife Name"   name="spouseName"           value={form.spouseName}           onChange={handleChange} placeholder="Spouse's name" />
        <TextInput horizontal label="Guardian Name"         name="guardianName"         value={form.guardianName}         onChange={handleChange} placeholder="Guardian's name" />
        <TextInput horizontal label="Guardian Relationship" name="guardianRelationship" value={form.guardianRelationship} onChange={handleChange} placeholder="e.g. Uncle, Brother, etc." />
      </div>
    </div>
  );

  const renderTab3 = () => (
    <div>
      <SectionHeader icon={FaIdCard} title="Identity Documents" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4">
        <TextInput horizontal label="Aadhaar Number" name="aadhaarNumber" value={form.aadhaarNumber} onChange={handleChange} error={errors.aadhaarNumber} placeholder="12-digit Aadhaar number" maxLength={12} />
        <TextInput horizontal label="PAN Number" name="panNumber" value={form.panNumber} onChange={handleChange} error={errors.panNumber} placeholder="e.g. ABCDE1234F" maxLength={10} />
        <TextInput horizontal label="Driving License Number" name="drivingLicense" value={form.drivingLicense} onChange={handleChange} error={errors.drivingLicense} placeholder="Driving license number" maxLength={16} />
        <TextInput horizontal label="Voter ID" name="voterId" value={form.voterId} onChange={handleChange} error={errors.voterId} placeholder="Voter ID number" maxLength={10} />
      </div>
    </div>
  );

  const renderTab4 = () => (
    <div>
      <SectionHeader icon={FaMapMarkerAlt} title="Permanent Address" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4">
        <TextInput horizontal label="Address Line 1" name="permAddress1" value={form.permAddress1} onChange={handleChange} placeholder="Street / Building / Plot" />
        <TextInput horizontal label="Address Line 2" name="permAddress2" value={form.permAddress2} onChange={handleChange} placeholder="Area / Locality" />
        <TextInput horizontal label="Pincode" name="permPincode" value={form.permPincode} onChange={handleChange} placeholder="6-digit pincode" />
        <CityStateSelect
          stateLabel="State"
          cityLabel="City"
          stateValue={form.permState}
          cityValue={form.permCity}
          onStateChange={(s) => setForm((p) => ({ ...p, permState: s.name, permCity: "" }))}
          onCityChange={(c) => setForm((p) => ({ ...p, permCity: c.name }))}
          horizontal
        />
      </div>

      <div className="mt-6 mb-4 flex items-center gap-3">
        <input
          id="sameAsPermanentForm"
          type="checkbox"
          checked={form.sameAsPermanent}
          name="sameAsPermanent"
          onChange={(e) => handleChange({ target: { name: "sameAsPermanent", value: e.target.checked } })}
          className="w-4 h-4 accent-primary cursor-pointer"
        />
        <label htmlFor="sameAsPermanentForm" className="text-sm font-semibold text-ink-muted cursor-pointer select-none">
          Same as Permanent Address
        </label>
      </div>

      <SectionHeader icon={FaMapMarkerAlt} title="Present Address" color="text-emerald-500" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4">
        <TextInput horizontal label="Address Line 1" name="presAddress1" value={form.presAddress1} onChange={handleChange} placeholder="Street / Building / Plot" disabled={form.sameAsPermanent} />
        <TextInput horizontal label="Address Line 2" name="presAddress2" value={form.presAddress2} onChange={handleChange} placeholder="Area / Locality" disabled={form.sameAsPermanent} />
        <TextInput horizontal label="Pincode" name="presPincode" value={form.presPincode} onChange={handleChange} placeholder="6-digit pincode" disabled={form.sameAsPermanent} />
        <CityStateSelect
          stateLabel="State"
          cityLabel="City"
          stateValue={form.presState}
          cityValue={form.presCity}
          onStateChange={(s) => setForm((p) => ({ ...p, presState: s.name, presCity: "" }))}
          onCityChange={(c) => setForm((p) => ({ ...p, presCity: c.name }))}
          disabled={form.sameAsPermanent}
          horizontal
        />
      </div>
    </div>
  );

  const renderTab5 = () => (
    <div>
      <SectionHeader icon={FaBriefcase} title="Official Information" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4">
        <SelectInput horizontal label="Department" name="departmentId" value={form.departmentId} onChange={handleChange}
          required error={errors.departmentId}
          defaultOptionLabel="Select Department" options={departmentOptions} searchable />
        <SelectInput horizontal label="Role" name="roleId" value={form.roleId} onChange={handleChange}
          required={form.createLoginAccount} error={errors.roleId}
          defaultOptionLabel="Select Role" options={roleOptions} searchable />
        <SelectInput horizontal label="Employee Type" name="employeeType" value={form.employeeType} onChange={handleChange}
          defaultOptionLabel="Select Type"
          options={["Permanent","Contract","Intern","Consultant","Operator","Supervisor"].map((t) => ({ value: t.toLowerCase(), label: t }))} />
        <SelectInput horizontal label="Employment Status" name="employeeStatus" value={form.employeeStatus} onChange={handleChange}
          options={[
            { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
            { value: "resigned", label: "Resigned" }, { value: "retired", label: "Retired" },
            { value: "terminated", label: "Terminated" },
          ]} />
      </div>
    </div>
  );

  const renderTab6 = () => (
    <div>
      <SectionHeader icon={FaCalendarAlt} title="Joining Details" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4">
        <DatePickerCalendar horizontal label="Date of Joining" name="dateOfJoining" value={form.dateOfJoining} onChange={handleChange} placeholder="Select joining date" />
        <DatePickerCalendar horizontal label="Relieving Date" name="relievingDate" value={form.relievingDate} onChange={handleChange} placeholder="Select relieving date" />
        <TextInput horizontal label="Previous Experience" name="previousExperience" value={form.previousExperience} onChange={handleChange} placeholder="e.g. 2 years 3 months" />
      </div>
    </div>
  );

  const renderTab7 = () => (
    <div>
      <SectionHeader icon={FaClock} title="Shift Assignment" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4">
        <SelectInput horizontal label="Shift" name="shiftId" value={form.shiftId} onChange={handleChange}
          defaultOptionLabel="Select Shift" options={shiftOptions} searchable />
      </div>
    </div>
  );

  const selectedShift = useMemo(() => {
    if (!form.shiftId) return null;
    return shifts.find((s: any) =>
      String(s.shiftCode || s.id) === String(form.shiftId) ||
      String(s.id) === String(form.shiftId)
    ) || null;
  }, [form.shiftId, shifts]);

  const renderTab8 = () => (
    <div className="space-y-6">
      <SalaryStructureSection
        form={form}
        onChange={handleChange}
        onToggle={(name) => handleToggle(name as any)}
        errors={errors}
        selectedShift={selectedShift}
      />
    </div>
  );

  const renderTab9 = () => (
    <div>
      <div className="flex items-center justify-between mb-5 pb-2 border-b border-line-soft">
        <div className="flex items-center gap-2">
          <FaKey className="text-primary text-lg" />
          <h3 className="text-base font-semibold text-ink">Login Account</h3>
        </div>
        <Toggle
          label={isEdit ? (form.createLoginAccount ? "Manage Login Account" : "Create Login Account") : "Create Login Account"}
          value={form.createLoginAccount}
          onChange={handleToggle("createLoginAccount")}
        />
      </div>

      {form.createLoginAccount && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 gap-y-3 md:gap-y-4 p-5 bg-card-2 rounded-xl border border-line-soft">
          <div className="flex flex-col gap-1">
            <TextInput horizontal label="Username" name="username" value={form.username} onChange={handleChange} required error={errors.username} placeholder="Login username" />
            {!isEdit && form.username.trim().length >= 3 && usernameStatus !== "idle" && (
              <div className={`flex items-center gap-1.5 text-xs font-medium ${
                usernameStatus === "checking" ? "text-ink-muted" :
                usernameStatus === "available" ? "text-emerald-600" : "text-red-500"
              }`}>
                {usernameStatus === "checking" && <><FaSpinner className="animate-spin" size={11} /> Checking availability...</>}
                {usernameStatus === "available" && <><FaCheck size={11} /> Username is available</>}
                {usernameStatus === "taken" && <><FaTimes size={11} /> Username is already taken</>}
              </div>
            )}
          </div>
          <TextInput
            horizontal
            label="Official Email Address"
            name="officialEmail"
            type="email"
            value={form.officialEmail}
            onChange={handleChange}
            required={form.createLoginAccount}
            error={errors.officialEmail}
            placeholder="official@company.com"
          />
          <div className="flex flex-col gap-2">
            <TextInput
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              required={!isEdit}
              error={errors.password}
              placeholder={isEdit ? "Leave blank to keep current password" : "Minimum 8 characters"}
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-ink-muted hover:text-ink focus:outline-none cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              }
            />
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, password: generatePassword() }))}
              className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline self-start"
            >
              <FaRandom size={11} /> Generate Random Password
            </button>
          </div>
          <div className="flex flex-col gap-4">
            <Toggle label="Password Reset Required" value={form.mustChangePw} onChange={handleToggle("mustChangePw")} />
            <Toggle label="Login Enabled" value={form.loginEnabled} onChange={handleToggle("loginEnabled")} />
          </div>
        </div>
      )}
    </div>
  );

  const tabRenderers = [
    renderTab0, renderTab1, renderTab2, renderTab3, renderTab4,
    renderTab5, renderTab6, renderTab7, renderTab8, renderTab9,
  ];

  // ─── render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-card rounded-xl border border-line-soft shadow-xs">
        <div className="flex flex-col items-center gap-3 text-ink-muted">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading employee data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] xl:mr-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-lg font-bold text-ink">{isEdit ? "Edit Employee" : "Create Employee"}</h2>
            {isEdit && (form.empCode || form.fullName) && (
              <p className="text-xs text-ink-muted mt-0.5">
                {form.empCode && <span className="font-semibold text-primary">{form.empCode}</span>}
                {form.fullName && <span> — {form.fullName}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <BackButton />
            <CustomButton
              text={isSubmitting ? "Saving..." : (isEdit ? "Save Changes" : "Save Employee")}
              icon={FaSave}
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
            />
          </div>
        </div>

        {/* Tab navigation */}
        <div className="px-5 overflow-x-auto border-b border-line">
          <div
            className="flex gap-0 min-w-max"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); setActiveTab((p) => Math.min(TABS.length - 1, p + 1)); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); setActiveTab((p) => Math.max(0, p - 1)); }
            }}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide
                    border-b-2 transition-all duration-200 whitespace-nowrap
                    ${isActive
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-ink-muted hover:text-ink hover:bg-card-2"
                    }
                  `}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div ref={tabContentRef} onKeyDown={handleFormKeyDown} className="px-5 py-5 min-h-[350px]">
          {tabRenderers[activeTab]()}
        </div>

        {/* Footer navigation */}
        <div className="border-t border-line px-5 py-3 flex items-center justify-between">
          <button
            type="button"
            disabled={activeTab === 0}
            onClick={() => setActiveTab((p) => Math.max(0, p - 1))}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${activeTab === 0
                ? "text-ink-subtle cursor-not-allowed"
                : "text-ink-muted hover:bg-card-2 border border-line-soft"
              }`}
          >
            <FaChevronLeft size={12} /> Previous
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted font-medium">
              {activeTab + 1} / {TABS.length}
            </span>
            <CustomButton
              text={isSubmitting ? "Saving..." : (isEdit ? "Save Changes" : "Save Employee")}
              icon={FaSave}
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
            />
          </div>

          {activeTab < TABS.length - 1 ? (
            <button
              type="button"
              data-nav
              onClick={() => setActiveTab((p) => Math.min(TABS.length - 1, p + 1))}
              title="Next Tab (Alt + Right Arrow or Alt + N)"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <span>Next</span>
              <span className="text-[9.5px] font-mono font-bold text-white/90 ml-1 px-1.5 py-0.5 rounded bg-white/20 border border-white/25">Alt+Right</span>
              <FaChevronRight size={11} />
            </button>
          ) : (
            <div className="w-24" />
          )}
        </div>
      </div>

      {/* Discard Changes Modal */}
      <CommonConfirmModal
        isOpen={saveConfirmOpen}
        onClose={() => { setSaveConfirmOpen(false); setTimeout(() => { lastFocusedRef.current?.focus() ?? tabContentRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50); }}
        onCancel={() => { setSaveConfirmOpen(false); navigate("/employees"); }}
        onConfirm={() => {
          setSaveConfirmOpen(false);
          setTimeout(() => {
            handleSubmitRef.current();
            setTimeout(() => tabContentRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(), 100);
          }, 150);
        }}
        title="Discard Changes?"
        message="Are you sure you want to leave? Any unsaved employee details will be lost."
        warningText="Save to keep your changes, or Discard to leave."
        cancelText="Discard"
        cancelVariant="danger"
        confirmText="Save"
        confirmVariant="primary"
        confirmIcon={FaCheck}
        isDangerous={false}
        defaultFocusCancel={false}
      />
    </div>
  );
};

export default EmployeeForm;
