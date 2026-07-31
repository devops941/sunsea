import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import {
  FaUser, FaPhone, FaUsers, FaIdCard, FaMapMarkerAlt,
  FaBriefcase, FaCalendarAlt, FaClock, FaMoneyBillWave, FaKey,
  FaClipboardList, FaSave, FaChevronLeft, FaChevronRight, FaCamera,
  FaRandom,
} from "react-icons/fa";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useDepartments } from "../../../hooks/useDepartments";
import { useRoles } from "../../../hooks/useRoles";
import { employeeService } from "../../../services/employeeService";
import apiClient from "../../../api/apiClient";

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
  { id: 10, label: "Audit", icon: FaClipboardList },
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
  salaryType: string;
  basicSalary: string;
  grossSalary: string;
  pfApplicable: boolean;
  pfNumber: string;
  uanNumber: string;
  esiApplicable: boolean;
  esiNumber: string;
  professionalTax: boolean;
  tdsApplicable: boolean;
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
  fatherName: "", motherName: "", spouseName: "", guardianName: "",
  aadhaarNumber: "", panNumber: "", drivingLicense: "", voterId: "",
  permAddress1: "", permAddress2: "", permCity: "", permState: "", permPincode: "",
  sameAsPermanent: false,
  presAddress1: "", presAddress2: "", presCity: "", presState: "", presPincode: "",
  departmentId: "", designation: "", employeeType: "",
  dateOfJoining: "", relievingDate: "", previousExperience: "",
  probationPeriod: "", noticePeriod: "",
  shiftId: "",
  salaryType: "", basicSalary: "", grossSalary: "",
  pfApplicable: false, pfNumber: "", uanNumber: "",
  esiApplicable: false, esiNumber: "",
  professionalTax: false, tdsApplicable: false,
  bankName: "", bankBranch: "", accountNumber: "", ifscCode: "", accountHolderName: "",
  createLoginAccount: false, username: "", password: "", roleId: "",
  mustChangePw: false, loginEnabled: true,
  createdBy: "", createdAt: "", updatedBy: "", updatedAt: "",
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

const EmployeeEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const user = useSelector((state: any) => state.auth.user);
  const { departments, loadDepartments } = useDepartments();
  const { roles, loadRoles } = useRoles();

  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shifts, setShifts] = useState<{ id: string | number; name: string }[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── load dropdowns + shifts + employee data
  useEffect(() => {
    loadDepartments();
    loadRoles();
    apiClient.get("/shifts").then((res) => {
      const data = res.data?.data || res.data || [];
      setShifts(Array.isArray(data) ? data : []);
    }).catch(() => {});

    if (!id) return;
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
        salaryType: emp.salaryType || "",
        basicSalary: emp.basicSalary ? String(emp.basicSalary) : "",
        grossSalary: emp.grossSalary ? String(emp.grossSalary) : "",
        pfApplicable: !!emp.pfApplicable,
        pfNumber: emp.pfNumber || "",
        uanNumber: emp.uanNumber || "",
        esiApplicable: !!emp.esiApplicable,
        esiNumber: emp.esiNumber || "",
        professionalTax: !!emp.professionalTax,
        tdsApplicable: !!emp.tdsApplicable,
        bankName: emp.bankName || "",
        bankBranch: emp.bankBranch || "",
        accountNumber: emp.accountNumber || "",
        ifscCode: emp.ifscCode || "",
        accountHolderName: emp.accountHolderName || "",
        createLoginAccount: !!emp.user,
        username: emp.user?.username || "",
        password: "",
        roleId: emp.user?.roleId ? String(emp.user.roleId) : "",
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
  }, [id, loadDepartments, loadRoles]);

  // ── field change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: any } }
  ) => {
    const { name, value } = e.target;
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
  };

  const handleToggle = (name: keyof FormState) => (v: boolean) => {
    setForm((p) => ({ ...p, [name]: v }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setForm((p) => ({ ...p, photoFile: file, photoPreview: preview }));
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
    if (!form.officialMobile.trim()) e.officialMobile = "Official mobile is required";
    if (!form.officialEmail.trim()) e.officialEmail = "Official email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.officialEmail.trim())) e.officialEmail = "Enter a valid email";
    if (!form.departmentId) e.departmentId = "Department is required";
    if (form.createLoginAccount && !form.roleId) e.roleId = "Role is required";
    if (form.createLoginAccount && !form.username.trim()) e.username = "Username is required";

    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error(Object.values(e)[0]);
      return false;
    }
    return true;
  };

  // ── submit
  const handleSubmit = async () => {
    if (!validate() || isSubmitting || !id) return;
    setIsSubmitting(true);
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

      if (form.personalMobile) fd.append("personalMobile", form.personalMobile);
      fd.append("mobile", form.officialMobile);
      if (form.personalEmail) fd.append("personalEmail", form.personalEmail);
      fd.append("email", form.officialEmail);
      if (form.emergencyContactName) fd.append("emergencyContactName", form.emergencyContactName);
      if (form.emergencyContactNumber) fd.append("emergencyContactNumber", form.emergencyContactNumber);

      if (form.fatherName) fd.append("fatherName", form.fatherName);
      if (form.motherName) fd.append("motherName", form.motherName);
      if (form.spouseName) fd.append("spouseName", form.spouseName);
      if (form.guardianName) fd.append("guardianName", form.guardianName);

      if (form.aadhaarNumber) fd.append("aadhaarNumber", form.aadhaarNumber);
      if (form.panNumber) fd.append("panNumber", form.panNumber);
      if (form.drivingLicense) fd.append("drivingLicense", form.drivingLicense);
      if (form.voterId) fd.append("voterId", form.voterId);

      if (form.permAddress1) fd.append("permanentAddressLine1", form.permAddress1);
      if (form.permAddress2) fd.append("permanentAddressLine2", form.permAddress2);
      if (form.permCity)     fd.append("permanentCity",         form.permCity);
      if (form.permState)    fd.append("permanentState",        form.permState);
      if (form.permPincode)  fd.append("permanentPincode",      form.permPincode);
      if (form.presAddress1) fd.append("presentAddressLine1",   form.presAddress1);
      if (form.presAddress2) fd.append("presentAddressLine2",   form.presAddress2);
      if (form.presCity)     fd.append("presentCity",           form.presCity);
      if (form.presState)    fd.append("presentState",          form.presState);
      if (form.presPincode)  fd.append("presentPincode",        form.presPincode);

      if (form.departmentId) fd.append("departmentId", form.departmentId);
      if (form.designation) fd.append("designation", form.designation);
      if (form.employeeType) fd.append("employeeType", form.employeeType);

      if (form.dateOfJoining) fd.append("dateOfJoining", form.dateOfJoining);
      if (form.relievingDate) fd.append("relievingDate", form.relievingDate);
      if (form.previousExperience) fd.append("previousExperience", form.previousExperience);
      if (form.probationPeriod) fd.append("probationPeriod", form.probationPeriod);
      if (form.noticePeriod) fd.append("noticePeriod", form.noticePeriod);

      if (form.shiftId) fd.append("shiftId", form.shiftId);

      if (form.salaryType) fd.append("salaryType", form.salaryType);
      if (form.basicSalary) fd.append("basicSalary", form.basicSalary);
      if (form.grossSalary) fd.append("grossSalary", form.grossSalary);
      fd.append("pfApplicable", String(form.pfApplicable));
      if (form.pfApplicable && form.pfNumber) fd.append("pfNumber", form.pfNumber);
      if (form.pfApplicable && form.uanNumber) fd.append("uanNumber", form.uanNumber);
      fd.append("esiApplicable", String(form.esiApplicable));
      if (form.esiApplicable && form.esiNumber) fd.append("esiNumber", form.esiNumber);
      fd.append("professionalTax", String(form.professionalTax));
      fd.append("tdsApplicable", String(form.tdsApplicable));
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

      if (user?.userId) fd.append("updatedBy", String(user.userId));

      await employeeService.update(id, fd as any);
      toast.success("Employee updated successfully!");
      navigate("/employees");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── tab content renderers ────────────────────────────────────────────────

  const renderTab0 = () => (
    <div>
      <SectionHeader icon={FaUser} title="Basic Information" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <TextInput label="Employee Code" name="empCode" value={form.empCode} onChange={handleChange} disabled required error={errors.empCode} placeholder="Auto-generated" />
        <TextInput label="Employee Name" name="fullName" value={form.fullName} onChange={handleChange} required error={errors.fullName} placeholder="Full name" />
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

      {/* Photo upload */}
      <div className="mt-6">
        <SectionHeader icon={FaCamera} title="Profile Photo" />
        <div className="flex items-center gap-6">
          <div
            className="w-28 h-28 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:border-primary transition-colors"
            onClick={() => photoInputRef.current?.click()}
          >
            {form.photoPreview ? (
              <img src={form.photoPreview} alt="New preview" className="w-full h-full object-cover" />
            ) : form.existingPhotoUrl ? (
              <img src={form.existingPhotoUrl} alt="Current photo" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400">
                <FaCamera size={24} />
                <span className="text-xs">Upload Photo</span>
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
            >
              {form.existingPhotoUrl || form.photoPreview ? "Replace Photo" : "Choose Photo"}
            </button>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG, GIF up to 5MB</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TextInput label="Personal Mobile Number" name="personalMobile" value={form.personalMobile} onChange={handleChange} placeholder="Personal mobile" />
        <TextInput label="Official Mobile Number" name="officialMobile" value={form.officialMobile} onChange={handleChange} required error={errors.officialMobile} placeholder="Official mobile" />
        <TextInput label="Personal Email Address" name="personalEmail" type="email" value={form.personalEmail} onChange={handleChange} placeholder="Personal email" />
        <TextInput label="Official Email Address" name="officialEmail" type="email" value={form.officialEmail} onChange={handleChange} required error={errors.officialEmail} placeholder="Official email" />
        <TextInput label="Emergency Contact Name" name="emergencyContactName" value={form.emergencyContactName} onChange={handleChange} placeholder="Emergency contact name" />
        <TextInput label="Emergency Contact Number" name="emergencyContactNumber" value={form.emergencyContactNumber} onChange={handleChange} placeholder="Emergency contact number" />
      </div>
    </div>
  );

  const renderTab2 = () => (
    <div>
      <SectionHeader icon={FaUsers} title="Family Details" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TextInput label="Father Name" name="fatherName" value={form.fatherName} onChange={handleChange} placeholder="Father's name" />
        <TextInput label="Mother Name" name="motherName" value={form.motherName} onChange={handleChange} placeholder="Mother's name" />
        <TextInput label="Husband / Wife Name" name="spouseName" value={form.spouseName} onChange={handleChange} placeholder="Spouse's name" />
        <TextInput label="Guardian Name" name="guardianName" value={form.guardianName} onChange={handleChange} placeholder="Guardian's name" />
      </div>
    </div>
  );

  const renderTab3 = () => (
    <div>
      <SectionHeader icon={FaIdCard} title="Identity Documents" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TextInput label="Aadhaar Number" name="aadhaarNumber" value={form.aadhaarNumber} onChange={handleChange} placeholder="12-digit Aadhaar number" />
        <TextInput label="PAN Number" name="panNumber" value={form.panNumber} onChange={handleChange} placeholder="e.g. ABCDE1234F" />
        <TextInput label="Driving License Number" name="drivingLicense" value={form.drivingLicense} onChange={handleChange} placeholder="Driving license number" />
        <TextInput label="Voter ID" name="voterId" value={form.voterId} onChange={handleChange} placeholder="Voter ID number" />
      </div>
    </div>
  );

  const renderTab4 = () => (
    <div>
      <SectionHeader icon={FaMapMarkerAlt} title="Permanent Address" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TextInput label="Address Line 1" name="permAddress1" value={form.permAddress1} onChange={handleChange} placeholder="Street / Building / Plot" />
        <TextInput label="Address Line 2" name="permAddress2" value={form.permAddress2} onChange={handleChange} placeholder="Area / Locality" />
        <TextInput label="Pincode" name="permPincode" value={form.permPincode} onChange={handleChange} placeholder="6-digit pincode" />
        <CityStateSelect
          stateLabel="State"
          cityLabel="City"
          stateValue={form.permState}
          cityValue={form.permCity}
          onStateChange={(s) => setForm((p) => ({ ...p, permState: s.name, permCity: "" }))}
          onCityChange={(c) => setForm((p) => ({ ...p, permCity: c.name }))}
        />
      </div>

      <div className="mt-6 mb-4 flex items-center gap-3">
        <input
          id="sameAsPermanentEdit"
          type="checkbox"
          checked={form.sameAsPermanent}
          name="sameAsPermanent"
          onChange={(e) => handleChange({ target: { name: "sameAsPermanent", value: e.target.checked } })}
          className="w-4 h-4 accent-primary cursor-pointer"
        />
        <label htmlFor="sameAsPermanentEdit" className="text-sm font-semibold text-slate-600 cursor-pointer select-none">
          Same as Permanent Address
        </label>
      </div>

      <SectionHeader icon={FaMapMarkerAlt} title="Present Address" color="text-emerald-500" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TextInput label="Address Line 1" name="presAddress1" value={form.presAddress1} onChange={handleChange} placeholder="Street / Building / Plot" disabled={form.sameAsPermanent} />
        <TextInput label="Address Line 2" name="presAddress2" value={form.presAddress2} onChange={handleChange} placeholder="Area / Locality" disabled={form.sameAsPermanent} />
        <TextInput label="Pincode" name="presPincode" value={form.presPincode} onChange={handleChange} placeholder="6-digit pincode" disabled={form.sameAsPermanent} />
        <CityStateSelect
          stateLabel="State"
          cityLabel="City"
          stateValue={form.presState}
          cityValue={form.presCity}
          onStateChange={(s) => setForm((p) => ({ ...p, presState: s.name, presCity: "" }))}
          onCityChange={(c) => setForm((p) => ({ ...p, presCity: c.name }))}
          disabled={form.sameAsPermanent}
        />
      </div>
    </div>
  );

  const renderTab5 = () => (
    <div>
      <SectionHeader icon={FaBriefcase} title="Official Information" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <SelectInput label="Department" name="departmentId" value={form.departmentId} onChange={handleChange}
          required error={errors.departmentId}
          defaultOptionLabel="Select Department" options={departmentOptions} searchable />
        <TextInput label="Designation" name="designation" value={form.designation} onChange={handleChange} placeholder="e.g. Senior Engineer" />
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
    </div>
  );

  const renderTab6 = () => (
    <div>
      <SectionHeader icon={FaCalendarAlt} title="Joining Details" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <DatePickerCalendar label="Date of Joining" name="dateOfJoining" value={form.dateOfJoining} onChange={handleChange} placeholder="Select joining date" />
        <DatePickerCalendar label="Relieving Date" name="relievingDate" value={form.relievingDate} onChange={handleChange} placeholder="Select relieving date" />
        <TextInput label="Previous Experience" name="previousExperience" value={form.previousExperience} onChange={handleChange} placeholder="e.g. 2 years 3 months" />
        <TextInput label="Current Experience" name="_exp" value={currentExperience} onChange={() => {}} disabled placeholder="Auto-calculated" />
        <TextInput label="Probation Period (months)" name="probationPeriod" type="number" value={form.probationPeriod} onChange={handleChange} placeholder="e.g. 3" />
        <TextInput label="Notice Period (days)" name="noticePeriod" type="number" value={form.noticePeriod} onChange={handleChange} placeholder="e.g. 30" />
      </div>
    </div>
  );

  const renderTab7 = () => (
    <div>
      <SectionHeader icon={FaClock} title="Shift Assignment" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <SelectInput label="Shift" name="shiftId" value={form.shiftId} onChange={handleChange}
          defaultOptionLabel="Select Shift" options={shiftOptions} />
      </div>
    </div>
  );

  const renderTab8 = () => (
    <div>
      <SectionHeader icon={FaMoneyBillWave} title="Salary & Payroll" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <SelectInput label="Salary Type" name="salaryType" value={form.salaryType} onChange={handleChange}
          defaultOptionLabel="Select Type"
          options={[{ value: "monthly", label: "Monthly" }, { value: "daily", label: "Daily" }, { value: "hourly", label: "Hourly" }]} />
        <TextInput label="Basic Salary" name="basicSalary" type="number" value={form.basicSalary} onChange={handleChange} placeholder="0.00" />
        <TextInput label="Gross Salary" name="grossSalary" type="number" value={form.grossSalary} onChange={handleChange} placeholder="0.00" />
      </div>

      <div className="mt-6 space-y-5">
        <div className="flex flex-wrap gap-8">
          <Toggle label="PF Applicable" value={form.pfApplicable} onChange={handleToggle("pfApplicable")} />
          <Toggle label="ESI Applicable" value={form.esiApplicable} onChange={handleToggle("esiApplicable")} />
          <Toggle label="Professional Tax" value={form.professionalTax} onChange={handleToggle("professionalTax")} />
          <Toggle label="TDS Applicable" value={form.tdsApplicable} onChange={handleToggle("tdsApplicable")} />
        </div>
        {form.pfApplicable && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <TextInput label="PF Number" name="pfNumber" value={form.pfNumber} onChange={handleChange} placeholder="PF account number" />
            <TextInput label="UAN Number" name="uanNumber" value={form.uanNumber} onChange={handleChange} placeholder="Universal Account Number" />
          </div>
        )}
        {form.esiApplicable && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-4 bg-green-50 rounded-xl border border-green-100">
            <TextInput label="ESI Number" name="esiNumber" value={form.esiNumber} onChange={handleChange} placeholder="ESI number" />
          </div>
        )}
      </div>

      <div className="mt-6">
        <SectionHeader icon={FaMoneyBillWave} title="Bank Details" color="text-emerald-600" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <TextInput label="Bank Name" name="bankName" value={form.bankName} onChange={handleChange} placeholder="e.g. State Bank of India" />
          <TextInput label="Bank Branch" name="bankBranch" value={form.bankBranch} onChange={handleChange} placeholder="Branch name" />
          <TextInput label="Account Number" name="accountNumber" value={form.accountNumber} onChange={handleChange} placeholder="Account number" />
          <TextInput label="IFSC Code" name="ifscCode" value={form.ifscCode} onChange={handleChange} placeholder="e.g. SBIN0001234" />
          <TextInput label="Account Holder Name" name="accountHolderName" value={form.accountHolderName} onChange={handleChange} placeholder="As per bank records" />
        </div>
      </div>
    </div>
  );

  const renderTab9 = () => (
    <div>
      <div className="flex items-center justify-between mb-5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FaKey className="text-primary text-lg" />
          <h3 className="text-base font-semibold text-slate-700">Login Account</h3>
        </div>
        <Toggle
          label={form.createLoginAccount ? "Manage Login Account" : "Create Login Account"}
          value={form.createLoginAccount}
          onChange={handleToggle("createLoginAccount")}
        />
      </div>

      {form.createLoginAccount && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-5 bg-slate-50 rounded-xl border border-slate-100">
          <TextInput label="Username" name="username" value={form.username} onChange={handleChange} required error={errors.username} placeholder="Login username" />
          <TextInput label="Official Email" name="_officialEmailDisplay" value={form.officialEmail} onChange={() => {}} disabled placeholder="From Contact tab" />
          <SelectInput label="Role" name="roleId" value={form.roleId} onChange={handleChange}
            required error={errors.roleId}
            defaultOptionLabel="Select Role" options={roleOptions} searchable />
          <div className="flex flex-col gap-2">
            <TextInput
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Leave blank to keep current password"
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

  const renderTab10 = () => (
    <div>
      <SectionHeader icon={FaClipboardList} title="Audit Information" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TextInput label="Created By" name="_createdBy" value={form.createdBy} onChange={() => {}} disabled />
        <TextInput label="Created At" name="_createdAt" value={form.createdAt} onChange={() => {}} disabled />
        <TextInput label="Updated By" name="_updatedBy" value={user?.username || ""} onChange={() => {}} disabled />
        <TextInput label="Updated At" name="_updatedAt" value={form.updatedAt || "Will be set on save"} onChange={() => {}} disabled />
      </div>
    </div>
  );

  const tabRenderers = [
    renderTab0, renderTab1, renderTab2, renderTab3, renderTab4,
    renderTab5, renderTab6, renderTab7, renderTab8, renderTab9, renderTab10,
  ];

  // ─── render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-slate-200">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading employee data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto space-y-0">
      {/* Header */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-t-lg">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Edit Employee</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {form.empCode && <span className="font-semibold text-primary">{form.empCode}</span>}
              {form.fullName && <span> — {form.fullName}</span>}
            </p>
          </div>
          <BackButton />
        </div>

        {/* Tab navigation */}
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
      <div className="bg-white border-x border-slate-200 px-6 py-6 min-h-[400px]">
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

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">
            {activeTab + 1} / {TABS.length}
          </span>
          <CustomButton
            text={isSubmitting ? "Saving..." : "Save Changes"}
            icon={FaSave}
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
          />
        </div>

        {activeTab < TABS.length - 1 ? (
          <button
            type="button"
            onClick={() => setActiveTab((p) => Math.min(TABS.length - 1, p + 1))}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all"
          >
            Next <FaChevronRight size={12} />
          </button>
        ) : (
          <div className="w-24" />
        )}
      </div>
    </div>
  );
};

export default EmployeeEdit;
