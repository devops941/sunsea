import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaUser, FaPhoneAlt, FaEnvelope, FaIdCard, FaLock, FaSave, FaKey, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { useEmployees } from "../../../hooks/useEmployees";
import { useDepartments } from "../../../hooks/useDepartments";

import { useRoles } from "../../../hooks/useRoles";
import { useSelector } from "react-redux";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";
import { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";

const EmployeeEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const employeeData = location.state;

  const { editEmployee, employees, loadEmployees } = useEmployees();
  const { departments, loadDepartments } = useDepartments();
  const { roles, loadRoles } = useRoles();
  const user = useSelector((state: any) => state.auth.user);

  const [formData, setFormData] = useState({
    empCode: "",
    fullName: "",
    mobile: "",
    email: "",
    departmentId: "",
    status: "active",
    createLoginAccount: false,
    username: "",
    password: "",
    roleId: "",
    userStatus: "active",
    updatedByOn: user?.username,
  });

  interface FormErrors {
    empCode?: string;
    fullName?: string;
    mobile?: string;
    email?: string;
    username?: string;
    password?: string;
    roleId?: string;
    departmentId?: string;
  }

  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.empCode.trim()) {
      newErrors.empCode = "Employee code is required";
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Employee name is required";
    }

    // BUG-EMP-001 fix: mobile is optional — only validate format if a value is entered
    if (formData.mobile) {
      const mobileError = validatePhoneNumber(formData.mobile, true);
      if (mobileError) {
        newErrors.mobile = mobileError;
      }
    }

    // BUG-EMP-002 fix: email is optional — only validate format/duplicate if a value is entered
    if (formData.email && formData.email.trim()) {
      const emailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
      if (!emailFormatValid) {
        newErrors.email = "Enter a valid email address";
      } else {
        const emailExists = employees.some(
          (emp) =>
            emp.id !== id &&
            emp.email?.toLowerCase().trim() === formData.email.toLowerCase().trim()
        );
        if (emailExists) {
          newErrors.email = "Email already exists";
        }
      }
    }

    // BUG-EMP-003 fix: department required on Edit — consistent with Create
    if (!formData.departmentId) {
      newErrors.departmentId = "Department is required";
    }

    if (formData.createLoginAccount) {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required";
      }
      if (!formData.password.trim() && !employeeData?.user) {
        newErrors.password = "Password is required";
      } else if (formData.password && formData.password.length < 6) {
        newErrors.password = "Password must be at least 6 characters";
      }
      if (!formData.roleId) {
        newErrors.roleId = "Role is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Initial data load
  useEffect(() => {
    loadDepartments();
    loadRoles();
    loadEmployees({ limit: 1000 });
  }, [loadDepartments, loadRoles, loadEmployees]);



  // Populate form when employee data arrives
  useEffect(() => {
    if (employeeData) {
      const deptId = employeeData.departmentId;

      setFormData({
        empCode: employeeData.empCode || "",
        fullName: employeeData.fullName || "",
        mobile: employeeData.mobile || "",
        email: employeeData.email || "",
        departmentId: deptId ? String(deptId) : "",
        status: employeeData.status || "active",
        createLoginAccount: !!employeeData.user,
        username: employeeData.user?.username || "",
        password: "",
        roleId: employeeData.user?.roleId ? String(employeeData.user.roleId) : "",
        userStatus: employeeData.user?.status || "active",
        updatedByOn: user?.username,
      });


    }
  }, [employeeData, user?.username]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({
      ...prev,
      [name]: val,
    }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!id) return;

    try {
      const payload: any = {
        empCode: formData.empCode,
        fullName: formData.fullName,
        mobile: formData.mobile || undefined,
        email: formData.email || undefined,
        departmentId: formData.departmentId ? Number(formData.departmentId) : undefined,
        status: formData.status as any,
        createLoginAccount: formData.createLoginAccount,
        updatedBy: user ? user?.userId : undefined,
      };

      if (formData.createLoginAccount) {
        payload.loginAccount = {
          username: formData.username,
          roleId: Number(formData.roleId),
          status: formData.userStatus,
        };
        if (formData.password) {
          payload.loginAccount.password = formData.password;
        }
      }

      await editEmployee(id, payload);
      toast.success("Employee updated successfully!");
      navigate("/employees");
    } catch (err: any) {
      toast.error(err?.message || err || "Failed to update employee");
    }
  };

  const departmentOptions = useMemo(() => {
    return departments.map(d => ({ value: String(d.id), label: d.name }));
  }, [departments]);



  const roleOptions = useMemo(() => {
    return roles.map(r => ({ value: String(r.id), label: r.name }));
  }, [roles]);

  return (
    <div className="w-full  space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">
              Edit Employee
            </h2>
          </div>
          <BackButton />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-8" noValidate>
          {/* General Info */}
          <div>
            <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
              <FaUser className="text-primary text-xl" />
              <h3 className="text-lg font-semibold text-gray-700">Basic & Professional Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <TextInput
                label="Employee Code"
                name="empCode"
                value={formData.empCode}
                placeholder="e.g. EMP001"
                required
                onChange={handleChange as any}
                error={errors.empCode}
                disabled
              />

              <TextInput
                label="Employee Name"
                name="fullName"
                value={formData.fullName}
                placeholder="Enter Employee Name"
                required
                onChange={handleChange as any}
                error={errors.fullName}
              />

              <IndiaPhoneInput
                label="Phone Number"
                name="mobile"
                value={formData.mobile}
                placeholder="Enter Mobile Number"
                required={false}
                onChange={handleChange as any}
                error={errors.mobile}
              />

              <TextInput
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                placeholder="Enter Email Address"
                onChange={handleChange as any}
                error={errors.email}
              />

              <SelectInput
                label="Department"
                name="departmentId"
                value={formData.departmentId}
                options={departmentOptions}
                onChange={handleChange as any}
                defaultOptionLabel="Select Department"
                required
                error={errors.departmentId}
              />

              <SelectInput
                label="Status"
                name="status"
                value={formData.status}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "resigned", label: "Resigned" },
                  { value: "terminated", label: "Terminated" },
                ]}
                onChange={handleChange as any}
              />

              <TextInput
                label="Updated By"
                name="updatedByOn"
                value={user?.username}
                required
                onChange={handleChange as any}
                disabled
              />
            </div>
          </div>

          {/* User Login Account Section */}
          <div>
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FaKey className="text-primary text-xl" />
                <h3 className="text-lg font-semibold text-gray-700">Login Account Settings</h3>
              </div>
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="createLoginAccount"
                    className="sr-only peer"
                    checked={formData.createLoginAccount}
                    onChange={handleChange as any}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    {employeeData?.user ? "Manage Login Account" : "Create Login Account"}
                  </span>
                </label>
              </div>
            </div>

            {formData.createLoginAccount && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
                <TextInput
                  label="Username"
                  name="username"
                  value={formData.username}
                  placeholder="Enter username"
                  required
                  onChange={handleChange as any}
                  error={errors.username}
                />

                <TextInput
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  placeholder={employeeData?.user ? "Leave empty to keep current" : "Enter password"}
                  required={!employeeData?.user}
                  onChange={handleChange as any}
                  error={errors.password}
                />

                <SelectInput
                  label="Role"
                  name="roleId"
                  value={formData.roleId}
                  options={roleOptions}
                  defaultOptionLabel="Select Role"
                  required
                  onChange={handleChange as any}
                  error={errors.roleId}
                />

                <SelectInput
                  label="User Status"
                  name="userStatus"
                  value={formData.userStatus}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "suspended", label: "Suspended" },
                    { value: "locked", label: "Locked" },
                  ]}
                  onChange={handleChange as any}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <CustomButton
              text="Cancel"
              icon={FaTimes}
              variant="secondary"
              onClick={() => navigate("/employees")}
              type="button"
            />
            <CustomButton
              text="Save Changes"
              icon={FaSave}
              type="submit"
              variant="primary"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeEdit;