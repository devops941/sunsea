import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import {
  FaUser, FaPhone, FaIdCard, FaMapMarkerAlt,
  FaBriefcase, FaCalendarAlt, FaMoneyBillWave, FaKey,
  FaClipboardList, FaSave, FaChevronLeft, FaChevronRight, FaCamera,
  FaRandom, FaEye, FaEyeSlash, FaCheck, FaTimes, FaSpinner,
} from "react-icons/fa";

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

// ─── Tab definitions (8 tabs — combined from 11) ─────────────────────────────

const TABS = [
  { id: 0, label: "Personal",         icon: FaUser        }, // Basic Info + Profile Photo
  { id: 1, label: "Contact & Family", icon: FaPhone       }, // Contact + Family
  { id: 2, label: "ID & Address",     icon: FaIdCard      }, // Identity + Address
  { id: 3, label: "Official & Shift", icon: FaBriefcase   }, // Official Info + Shift
  { id: 4, label: "Joining",          icon: FaCalendarAlt },
  { id: 5, label: "Payroll",          icon: FaMoneyBillWave},
  { id: 6, label: "Login Account",    icon: FaKey         },
  // { id: 7, label: "Audit",            icon: FaClipboardList},
];

// ─── form state ──────────────────────────────────────────────────────────────

interface FormState {
  // Personal
  empCode: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  maritalStatus: string;
  employeeStatus: string;
  photoFile: File | null;
  photoPreview: string;
  // Contact
  personalMobile: string;
  officialMobile: string;
  personalEmail: string;
  officialEmail: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  // Family
  fatherName: string;
  motherName: string;
  spouseName: string;
  guardianName: string;
  // Identity
  aadhaarNumber: string;
  panNumber: string;
  drivingLicense: string;
  voterId: string;
  // Address
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
  // Official
  departmentId: string;
  designation: string;
  employeeType: string;
  shiftId: string;
  // Joining
  dateOfJoining: string;
  relievingDate: string;
  previousExperience: string;
  probationPeriod: string;
  noticePeriod: string;
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
  // Login Account
  createLoginAccount: boolean;
  username: string;
  password: string;
  roleId: string;
  mustChangePw: boolean;
  loginEnabled: boolean;
}

const INITIAL: FormState = {
  empCode: "", fullName: "", gender: "", dateOfBirth: "", bloodGroup: "",
  maritalStatus: "", employeeStatus: "active", photoFile: null, photoPreview: "",
  personalMobile: "", officialMobile: "", personalEmail: "", officialEmail: "",
  emergencyContactName: "", emergencyContactNumber: "",
  fatherName: "", motherName: "", spouseName: "", guardianName: "",
  aadhaarNumber: "", panNumber: "", drivingLicense: "", voterId: "",
  permAddress1: "", permAddress2: "", permCity: "", permState: "", permPincode: "",
  sameAsPermanent: false,
  presAddress1: "", presAddress2: "", presCity: "", presState: "", presPincode: "",
  departmentId: "", designation: "", employeeType: "", shiftId: "",
  dateOfJoining: "", relievingDate: "", previousExperience: "",
  probationPeriod: "", noticePeriod: "",
  salaryType: "MONTHLY",
  monthlySalary: "", basicSalary: "", da: "", hra: "",
  conveyanceAllowance: "", medicalAllowance: "", specialAllowance: "",
  otherAllowance: "",
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
};

// ─── sub-components ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; color?: string }> = ({
  icon: Icon, title, color = "text-primary",
}) => (
  <div className="flex items-center gap-2 mb-5 pb-2 border-b border-slate-100">
    <Icon className={`${color} text-lg`} />
    <h3 className="text-base font-semibold text-slate-700">{title}</h3>
  </div>
);

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label, value, onChange,
}) => (
  <div className="flex items-center gap-3">
    <label className="text-xs font-bold uppercase tracking-[0.5px] text-slate-500">{label}</label>
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" className="sr-only" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <div className={`block w-14 h-8 rounded-full transition-colors duration-300 ${value ? "bg-primary" : "bg-gray-300"}`} />
      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${value ? "transform translate-x-6" : ""}`} />
    </label>
    <span className="text-sm font-medium text-slate-600">{value ? "YES" : "NO"}</span>
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────

const EmployeeCreatePage: React.FC = () => {
  const navigate   = useNavigate();
  const user       = useSelector((state: any) => state.auth.user);
  const { departments, loadDepartments } = useDepartments();
  const { roles,       loadRoles       } = useRoles();

  const [activeTab,    setActiveTab]    = useState(0);
  const [form,         setForm]         = useState<FormState>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shifts,       setShifts]       = useState<{ id: string | number; name: string }[]>([]);
  const [errors,       setErrors]       = useState<Partial<Record<keyof FormState, string>>>({}); 
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── init
  useEffect(() => {
    fetchDeps();
    fetchRls();
    fetchShifts();
  }, [fetchDeps, fetchRls, fetchShifts]);

  // ── debounced username availability check
  useEffect(() => {
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
  }, [form.username, form.createLoginAccount]);

  // ── field change handler
  // ── field change handler
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
          next.presCity     = p.permCity;
          next.presState    = p.permState;
          next.presPincode  = p.permPincode;
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
  };

  const handleToggle = (name: keyof FormState) => (v: boolean) => {
    setForm((p) => ({ ...p, [name]: v }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }
    setForm((p) => ({ ...p, photoFile: file, photoPreview: URL.createObjectURL(file) }));
  };

  // ── derived
  const age               = calcAge(form.dateOfBirth);
  const currentExperience = calcExperience(form.dateOfJoining);

  const departmentOptions = useMemo(() =>
    departments.map((d) => ({ value: String(d.id), label: d.name })), [departments]);

  const roleOptions = useMemo(() => {
    const excluded = ["ROLE_ADMIN", "Super Admin", "System Administrator"];
    return roles
      .filter((r) => !excluded.includes(r.name))
      .map((r) => ({ value: String(r.id), label: r.name }));
  }, [roles]);

  const shiftOptions = useMemo(() =>
    shifts.map((s: any) => ({ value: String(s.shiftCode), label: s.shiftName })), [shifts]);

  // ── validation — all mandatory fields across all tabs
  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};

    // Personal
    if (!form.empCode.trim())   e.empCode  = "Employee code is required";
    if (!form.fullName.trim())  e.fullName = "Employee name is required";

    // Contact — Mobile & Email are optional; validate format if entered
    if (form.officialMobile.trim()) {
      if (form.officialMobile.replace(/\D/g, "").replace(/^91/, "").length !== 10)
        e.officialMobile = "Enter a valid 10-digit mobile number";
    }

    // Official email is required when Create Login Account is enabled
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

    // Official
    if (!form.departmentId)   e.departmentId  = "Department is required";

    // Joining
    if (!form.dateOfJoining)  e.dateOfJoining = "Date of joining is required";

    // Payroll — validate primary salary field for each type
    if (!form.salaryType) {
      e.salaryType = "Salary type is required";
    } else {
      const st = form.salaryType.toUpperCase();
      if (st === "MONTHLY" && !form.monthlySalary)
        e.monthlySalary = "Monthly gross salary is required";
      if (st === "WEEKLY" && !form.weeklySalary)
        e.weeklySalary = "Weekly gross salary is required";
      if (st === "DAILY" && !form.dailySalary)
        e.dailySalary = "Daily wage is required";
      if (st === "HOURLY" && !form.hourlySalary)
        e.hourlySalary = "Hourly rate is required";
    }

    // PF validation
    if (form.pfApplicable) {
      if (!form.uanNumber.trim()) e.uanNumber = "UAN Number is required when PF is applicable";
    }

    // ESI validation
    if (form.esiApplicable) {
      if (!form.esiNumber.trim()) e.esiNumber = "ESIC Number is required when ESI is applicable";
    }

    // Bank validation
    if (form.paymentMode === "BANK") {
      if (!form.bankName.trim())           e.bankName = "Bank Name is required for Bank Transfers";
      if (!form.bankBranch.trim())         e.bankBranch = "Bank Branch is required for Bank Transfers";
      if (!form.accountNumber.trim())      e.accountNumber = "Account Number is required for Bank Transfers";
      if (!form.ifscCode.trim())            e.ifscCode = "IFSC Code is required for Bank Transfers";
      if (!form.accountHolderName.trim())  e.accountHolderName = "Account Holder Name is required for Bank Transfers";
    }

    // Login account
    if (form.createLoginAccount) {
      if (!form.roleId.trim())    e.roleId   = "Role is required";
      if (!form.username.trim())  e.username = "Username is required";
      else if (form.username.trim().length < 3) e.username = "Username must be at least 3 characters";
      else if (usernameStatus === "taken") e.username = "Username is already taken";
      if (!form.password.trim())  e.password = "Password is required";
      else if (form.password.length < 8) e.password = "Password must be at least 8 characters";
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error(Object.values(e)[0]);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || isSubmitting) return;
    setIsSubmitting(true);

    // Check duplicate employee code
    try {
      const res = await employeeService.fetchAll();
      const list = Array.isArray(res) ? res : res.data || [];
      const duplicate = list.find((e: any) => e.empCode?.toLowerCase() === form.empCode.trim().toLowerCase());
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

      // Personal
      fd.append("empCode",  form.empCode);
      fd.append("fullName", form.fullName);
      if (form.gender)          fd.append("gender",          form.gender);
      if (form.dateOfBirth)     fd.append("dateOfBirth",     form.dateOfBirth);
      if (form.bloodGroup)      fd.append("bloodGroup",      form.bloodGroup);
      if (form.maritalStatus)   fd.append("maritalStatus",   form.maritalStatus);
      fd.append("status", form.employeeStatus || "active");
      if (form.photoFile)       fd.append("photo", form.photoFile);

      // Contact
      if (form.personalMobile)        fd.append("personalMobile",        form.personalMobile);
      if (form.officialMobile)        fd.append("mobile",                form.officialMobile);
      if (form.personalEmail)         fd.append("personalEmail",         form.personalEmail);
      if (form.officialEmail)         fd.append("email",                 form.officialEmail);
      if (form.emergencyContactName)  fd.append("emergencyContactName",  form.emergencyContactName);
      if (form.emergencyContactNumber) fd.append("emergencyContactNumber", form.emergencyContactNumber);

      // Family
      if (form.fatherName)   fd.append("fatherName",   form.fatherName);
      if (form.motherName)   fd.append("motherName",   form.motherName);
      if (form.spouseName)   fd.append("spouseName",   form.spouseName);
      if (form.guardianName) fd.append("guardianName", form.guardianName);

      // Identity
      if (form.aadhaarNumber) fd.append("aadhaarNumber", form.aadhaarNumber);
      if (form.panNumber)     fd.append("panNumber",     form.panNumber);
      if (form.drivingLicense)fd.append("drivingLicense",form.drivingLicense);
      if (form.voterId)       fd.append("voterId",       form.voterId);

      // Address
      if (form.permAddress1)  fd.append("permanentAddressLine1", form.permAddress1);
      if (form.permAddress2)  fd.append("permanentAddressLine2", form.permAddress2);
      if (form.permCity)      fd.append("permanentCity",         form.permCity);
      if (form.permState)     fd.append("permanentState",        form.permState);
      if (form.permPincode)   fd.append("permanentPincode",      form.permPincode);
      if (form.presAddress1)  fd.append("presentAddressLine1",   form.presAddress1);
      if (form.presAddress2)  fd.append("presentAddressLine2",   form.presAddress2);
      if (form.presCity)      fd.append("presentCity",           form.presCity);
      if (form.presState)     fd.append("presentState",          form.presState);
      if (form.presPincode)   fd.append("presentPincode",        form.presPincode);

      // Official
      if (form.departmentId)  fd.append("departmentId",  form.departmentId);
      if (form.designation)   fd.append("designation",   form.designation);
      if (form.employeeType)  fd.append("employeeType",  form.employeeType);
      if (form.shiftId)       fd.append("shiftId",       form.shiftId);

      // Joining
      if (form.dateOfJoining)      fd.append("dateOfJoining",      form.dateOfJoining);
      if (form.relievingDate)       fd.append("relievingDate",       form.relievingDate);
      if (form.previousExperience)  fd.append("previousExperience",  form.previousExperience);
      if (form.probationPeriod)     fd.append("probationPeriod",     form.probationPeriod);
      if (form.noticePeriod)        fd.append("noticePeriod",        form.noticePeriod);

      // Payroll — map salary type to backend fields
      if (form.salaryType) fd.append("salaryType", form.salaryType.toLowerCase());
      const st = (form.salaryType || "MONTHLY").toUpperCase();
      // grossSalary stores the primary salary amount regardless of type
      if (st === "MONTHLY") {
        if (form.monthlySalary) fd.append("grossSalary", form.monthlySalary);
        if (form.basicSalary)   fd.append("basicSalary", form.basicSalary);
      } else if (st === "WEEKLY") {
        if (form.weeklySalary)  fd.append("grossSalary", form.weeklySalary);
        if (form.basicSalary)   fd.append("basicSalary", form.basicSalary);
      } else if (st === "DAILY") {
        if (form.dailySalary)   fd.append("grossSalary", form.dailySalary);
        if (form.dailySalary)   fd.append("basicSalary", form.dailySalary);
      } else if (st === "HOURLY") {
        if (form.hourlySalary)  fd.append("grossSalary", form.hourlySalary);
      }
      fd.append("pfApplicable",   String(form.pfApplicable));
      if (form.pfApplicable && form.pfNumber)  fd.append("pfNumber",  form.pfNumber);
      if (form.pfApplicable && form.uanNumber) fd.append("uanNumber", form.uanNumber);
      fd.append("esiApplicable",  String(form.esiApplicable));
      if (form.esiApplicable && form.esiNumber) fd.append("esiNumber", form.esiNumber);
      fd.append("professionalTax", String(form.professionalTax));
      fd.append("tdsApplicable",   String(form.tdsApplicable));

      // Bank
      fd.append("paymentMode",      form.paymentMode || "CASH");
      if (form.bankName)            fd.append("bankName",           form.bankName);
      if (form.bankBranch)          fd.append("bankBranch",         form.bankBranch);
      if (form.accountNumber)       fd.append("accountNumber",      form.accountNumber);
      if (form.ifscCode)            fd.append("ifscCode",           form.ifscCode);
      if (form.accountHolderName)   fd.append("accountHolderName",  form.accountHolderName);

      // Login
      fd.append("createLoginAccount", String(form.createLoginAccount));
      if (form.createLoginAccount) {
        fd.append("loginAccount", JSON.stringify({
          username:    form.username,
          password:    form.password,
          roleId:      Number(form.roleId),
          status:      form.loginEnabled ? "active" : "suspended",
          mustChangePw: form.mustChangePw,
        }));
      }

      if (user?.userId) fd.append("createdBy", String(user.userId));

      await employeeService.create(fd as any);
      toast.success("Employee created successfully!");
      navigate("/employees");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Tab content ──────────────────────────────────────────────────────────

  // Tab 0 — Personal (Basic Info + Profile Photo)
  const renderTab0 = () => (
    <div>
      <SectionHeader icon={FaUser} title="Basic Information" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <TextInput label="Employee Code" name="empCode" value={form.empCode} onChange={handleChange}
          required error={errors.empCode} placeholder="e.g. EMP001" />
        <TextInput label="Employee Name" name="fullName" value={form.fullName} onChange={handleChange}
          required error={errors.fullName} placeholder="Full name" />
        <SelectInput label="Gender" name="gender" value={form.gender} onChange={handleChange}
          defaultOptionLabel="Select Gender"
          options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]} />
        <DatePickerCalendar label="Date of Birth" name="dateOfBirth" value={form.dateOfBirth}
          onChange={handleChange} placeholder="Select DOB" maxDate={new Date()} />
        <TextInput label="Age (years)" name="_age" value={age} onChange={() => {}} disabled placeholder="Auto-calculated" />
        <SelectInput label="Blood Group" name="bloodGroup" value={form.bloodGroup} onChange={handleChange}
          defaultOptionLabel="Select Blood Group"
          options={["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((g) => ({ value: g, label: g }))} />
        <SelectInput label="Marital Status" name="maritalStatus" value={form.maritalStatus} onChange={handleChange}
          defaultOptionLabel="Select Status"
          options={["Single","Married","Divorced","Widowed"].map((s) => ({ value: s.toLowerCase(), label: s }))} />
        <SelectInput label="Employee Status" name="employeeStatus" value={form.employeeStatus} onChange={handleChange}
          options={[
            { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
            { value: "resigned", label: "Resigned" }, { value: "retired", label: "Retired" },
            { value: "terminated", label: "Terminated" },
          ]} />
      </div>

      {/* Profile Photo */}
      <div className="mt-6">
        <SectionHeader icon={FaCamera} title="Profile Photo" />
        <div className="flex items-center gap-6">
          <div
            className="w-28 h-28 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:border-primary transition-colors"
            onClick={() => photoInputRef.current?.click()}
          >
            {form.photoPreview ? (
              <img src={form.photoPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400">
                <FaCamera size={24} />
                <span className="text-xs">Upload Photo</span>
              </div>
            )}
          </div>
          <div>
            <button type="button" onClick={() => photoInputRef.current?.click()}
              className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors">
              {form.photoPreview ? "Change Photo" : "Choose Photo"}
            </button>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP up to 5 MB</p>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
          </div>
        </div>
      </div>
    </div>
  );

  // Tab 1 — Contact & Family
  const renderTab1 = () => (
    <div>
      <SectionHeader icon={FaPhone} title="Contact Information" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <IndiaPhoneInput
          label="Official Mobile Number"
          name="officialMobile"
          value={form.officialMobile}
          onChange={handleChange}
          required={false}
          error={errors.officialMobile}
          placeholder="98765 43210"
        />
        <IndiaPhoneInput
          label="Personal Mobile Number"
          name="personalMobile"
          value={form.personalMobile}
          onChange={handleChange}
          required={false}
          placeholder="98765 43210"
        />
        <TextInput label="Official Email Address" name="officialEmail" type="email"
          value={form.officialEmail} onChange={handleChange} required={form.createLoginAccount} error={errors.officialEmail} placeholder="official@company.com" />
        <TextInput label="Personal Email Address" name="personalEmail" type="email"
          value={form.personalEmail} onChange={handleChange} placeholder="personal@email.com" />
        <TextInput label="Emergency Contact Name" name="emergencyContactName"
          value={form.emergencyContactName} onChange={handleChange} placeholder="Emergency contact name" />
        <IndiaPhoneInput
          label="Emergency Contact Number"
          name="emergencyContactNumber"
          value={form.emergencyContactNumber}
          onChange={handleChange}
          required={false}
          placeholder="98765 43210"
        />
      </div>

      <div className="mt-6">
        <SectionHeader icon={FaUser} title="Family Details" color="text-violet-500" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <TextInput label="Father Name"       name="fatherName"  value={form.fatherName}  onChange={handleChange} placeholder="Father's name" />
          <TextInput label="Mother Name"       name="motherName"  value={form.motherName}  onChange={handleChange} placeholder="Mother's name" />
          <TextInput label="Husband / Wife Name" name="spouseName" value={form.spouseName} onChange={handleChange} placeholder="Spouse's name" />
          <TextInput label="Guardian Name"     name="guardianName" value={form.guardianName} onChange={handleChange} placeholder="Guardian's name" />
        </div>
      </div>
    </div>
  );

  // Tab 2 — ID & Address
  const renderTab2 = () => (
    <div>
      <SectionHeader icon={FaIdCard} title="Identity Documents" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TextInput label="Aadhaar Number"       name="aadhaarNumber"  value={form.aadhaarNumber}  onChange={handleChange} error={errors.aadhaarNumber} placeholder="12-digit Aadhaar" maxLength={12} />
        <TextInput label="PAN Number"           name="panNumber"      value={form.panNumber}      onChange={handleChange} error={errors.panNumber} placeholder="e.g. ABCDE1234F" maxLength={10} />
        <TextInput label="Driving License"      name="drivingLicense" value={form.drivingLicense} onChange={handleChange} error={errors.drivingLicense} placeholder="Driving license number" maxLength={16} />
        <TextInput label="Voter ID"             name="voterId"        value={form.voterId}        onChange={handleChange} error={errors.voterId} placeholder="e.g. ABC1234567" maxLength={10} />
      </div>

      <div className="mt-6">
        <SectionHeader icon={FaMapMarkerAlt} title="Permanent Address" color="text-blue-500" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <TextInput label="Address Line 1" name="permAddress1" value={form.permAddress1} onChange={handleChange} placeholder="Street / Building / Plot" />
          <TextInput label="Address Line 2" name="permAddress2" value={form.permAddress2} onChange={handleChange} placeholder="Area / Locality" />
          <TextInput label="Pincode"        name="permPincode"  value={form.permPincode}  onChange={handleChange} placeholder="6-digit pincode" />
          <CityStateSelect
            stateLabel="State" cityLabel="City"
            stateValue={form.permState} cityValue={form.permCity}
            onStateChange={(s) => setForm((p) => ({ ...p, permState: s.name, permCity: "" }))}
            onCityChange={(c)  => setForm((p) => ({ ...p, permCity: c.name }))}
          />
        </div>
      </div>

      <div className="mt-4 mb-4 flex items-center gap-3">
        <input id="sameAsPermanent" type="checkbox" checked={form.sameAsPermanent} name="sameAsPermanent"
          onChange={(e) => handleChange({ target: { name: "sameAsPermanent", value: e.target.checked } })}
          className="w-4 h-4 accent-primary cursor-pointer" />
        <label htmlFor="sameAsPermanent" className="text-sm font-semibold text-slate-600 cursor-pointer select-none">
          Present address same as permanent address
        </label>
      </div>

      <SectionHeader icon={FaMapMarkerAlt} title="Present Address" color="text-emerald-500" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TextInput label="Address Line 1" name="presAddress1" value={form.presAddress1} onChange={handleChange} placeholder="Street / Building / Plot" disabled={form.sameAsPermanent} />
        <TextInput label="Address Line 2" name="presAddress2" value={form.presAddress2} onChange={handleChange} placeholder="Area / Locality"           disabled={form.sameAsPermanent} />
        <TextInput label="Pincode"        name="presPincode"  value={form.presPincode}  onChange={handleChange} placeholder="6-digit pincode"            disabled={form.sameAsPermanent} />
        <CityStateSelect
          stateLabel="State" cityLabel="City"
          stateValue={form.presState} cityValue={form.presCity}
          onStateChange={(s) => setForm((p) => ({ ...p, presState: s.name, presCity: "" }))}
          onCityChange={(c)  => setForm((p) => ({ ...p, presCity: c.name }))}
          disabled={form.sameAsPermanent}
        />
      </div>
    </div>
  );

  // Tab 3 — Official Info & Shift
  const renderTab3 = () => (
    <div>
      <SectionHeader icon={FaBriefcase} title="Official Information" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <SelectInput label="Department" name="departmentId" value={form.departmentId} onChange={handleChange}
          required error={errors.departmentId} defaultOptionLabel="Select Department" options={departmentOptions} searchable />
        <SelectInput label="Role" name="roleId" value={form.roleId} onChange={handleChange}
          required={form.createLoginAccount} error={errors.roleId} defaultOptionLabel="Select Role" options={roleOptions} searchable />
        <SelectInput label="Employee Type" name="employeeType" value={form.employeeType} onChange={handleChange}
          defaultOptionLabel="Select Type"
          options={["Permanent","Contract","Intern","Consultant","Operator","Supervisor"].map((t) => ({ value: t.toLowerCase(), label: t }))} />
        <SelectInput label="Employment Status" name="employeeStatus" value={form.employeeStatus} onChange={handleChange}
          options={[
            { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
            { value: "resigned", label: "Resigned" }, { value: "retired", label: "Retired" },
            { value: "terminated", label: "Terminated" },
          ]} />
      </div>

      <div className="mt-6">
        <SectionHeader icon={FaCalendarAlt} title="Shift Assignment" color="text-amber-500" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <SelectInput label="Shift" name="shiftId" value={form.shiftId} onChange={handleChange}
            defaultOptionLabel="Select Shift" options={shiftOptions} searchable />
        </div>
      </div>
    </div>
  );

  // Tab 4 — Joining
  const renderTab4 = () => (
    <div>
      <SectionHeader icon={FaCalendarAlt} title="Joining Details" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <DatePickerCalendar label="Date of Joining" name="dateOfJoining" value={form.dateOfJoining}
          onChange={handleChange} placeholder="Select joining date" />
        <DatePickerCalendar label="Relieving Date" name="relievingDate" value={form.relievingDate}
          onChange={handleChange} placeholder="Select relieving date" />
        <TextInput label="Previous Experience" name="previousExperience" value={form.previousExperience}
          onChange={handleChange} placeholder="e.g. 2 years 3 months" />
        {/* <TextInput label="Current Experience" name="_exp" value={currentExperience} onChange={() => {}} disabled placeholder="Auto-calculated" /> */}
        {/* <TextInput label="Probation Period (months)" name="probationPeriod" type="number"
          value={form.probationPeriod} onChange={handleChange} placeholder="e.g. 3" /> */}
        {/* <TextInput label="Notice Period (days)" name="noticePeriod" type="number"
          value={form.noticePeriod} onChange={handleChange} placeholder="e.g. 30" /> */}
      </div>
    </div>
  );

  // Tab 5 — Payroll (dynamic salary structure with live preview)
  const renderTab5 = () => (
    <SalaryStructureSection
      form={form}
      onChange={handleChange}
      onToggle={(name) => handleToggle(name as any)}
      errors={errors}
    />
  );

  // Tab 6 — Login Account
  const renderTab6 = () => (
    <div>
      <div className="flex items-center justify-between mb-5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FaKey className="text-primary text-lg" />
          <h3 className="text-base font-semibold text-slate-700">Login Account</h3>
        </div>
        <Toggle label="Create Login Account" value={form.createLoginAccount} onChange={handleToggle("createLoginAccount")} />
      </div>

      {form.createLoginAccount && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 p-5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex flex-col gap-1">
            <TextInput label="Username" name="username" value={form.username} onChange={handleChange}
              required error={errors.username} placeholder="Enter unique username" />
            {form.username.trim().length >= 3 && usernameStatus !== "idle" && (
              <div className={`flex items-center gap-1.5 text-xs font-medium ${
                usernameStatus === "checking" ? "text-slate-400" :
                usernameStatus === "available" ? "text-emerald-600" : "text-red-500"
              }`}>
                {usernameStatus === "checking" && <><FaSpinner className="animate-spin" size={11} /> Checking availability...</>}
                {usernameStatus === "available" && <><FaCheck size={11} /> Username is available</>}
                {usernameStatus === "taken" && <><FaTimes size={11} /> Username is already taken</>}
              </div>
            )}
          </div>
          <TextInput
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
              required
              error={errors.password}
              placeholder="Minimum 8 characters"
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              }
            />
            <button type="button"
              onClick={() => setForm((p) => ({ ...p, password: generatePassword() }))}
              className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline self-start">
              <FaRandom size={11} /> Generate Random Password
            </button>
          </div>
          <div className="flex flex-col gap-4">
            <Toggle label="Password Reset Required" value={form.mustChangePw}   onChange={handleToggle("mustChangePw")} />
            <Toggle label="Login Enabled"           value={form.loginEnabled}   onChange={handleToggle("loginEnabled")} />
          </div>
        </div>
      )}
    </div>
  );

  /*
  // Tab 7 — Audit
  const renderTab7 = () => (
    <div>
      <SectionHeader icon={FaClipboardList} title="Audit Information" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TextInput label="Created By"  name="_createdBy"  value={user?.username || ""} onChange={() => {}} disabled />
        <TextInput label="Created At"  name="_createdAt"  value="Will be set on save"  onChange={() => {}} disabled />
        <TextInput label="Updated By"  name="_updatedBy"  value=""                     onChange={() => {}} disabled />
        <TextInput label="Updated At"  name="_updatedAt"  value=""                     onChange={() => {}} disabled />
      </div>
    </div>
  );
  */

  const tabRenderers = [
    renderTab0, renderTab1, renderTab2, renderTab3,
    renderTab4, renderTab5, renderTab6,
  ];

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full mx-auto space-y-0">
      {/* Header */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-t-lg">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Create Employee</h2>
            <p className="text-sm text-slate-400 mt-0.5">Fill in the details across all sections</p>
          </div>
          <div className="flex items-center gap-3">
            <BackButton />
            <CustomButton
              text={isSubmitting ? "Saving..." : "Save Employee"}
              icon={FaSave}
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
            />
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-6 overflow-x-auto">
          <div className="flex gap-0 border-b border-slate-200 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wide
                    border-b-2 transition-all duration-200 whitespace-nowrap
                    ${isActive
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }
                  `}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-white border-x border-slate-200 px-6 py-6 min-h-[420px]">
        {tabRenderers[activeTab]()}
      </div>

      {/* Footer navigation */}
      <div className="bg-white border border-slate-200 rounded-b-lg px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          disabled={activeTab === 0}
          onClick={() => setActiveTab((p) => Math.max(0, p - 1))}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
            ${activeTab === 0
              ? "text-slate-300 cursor-not-allowed"
              : "text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
        >
          <FaChevronLeft size={12} /> Previous
        </button>

        <span className="text-xs text-slate-400 font-medium">
          {activeTab + 1} / {TABS.length}
        </span>

        {activeTab < TABS.length - 1 ? (
          <button
            type="button"
            onClick={() => setActiveTab((p) => Math.min(TABS.length - 1, p + 1))}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all"
          >
            Next <FaChevronRight size={12} />
          </button>
        ) : (
          <CustomButton
            text={isSubmitting ? "Saving..." : "Save Employee"}
            icon={FaSave}
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
          />
        )}
      </div>
    </div>
  );
};

export default EmployeeCreatePage;
