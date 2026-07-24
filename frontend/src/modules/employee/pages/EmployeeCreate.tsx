import React, { useState, useEffect, useMemo } from "react";
import { FaSave, FaEraser, FaUser, FaKey, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { useEmployees } from "../../../hooks/useEmployees";
import { useDepartments } from "../../../hooks/useDepartments";
import { useRoles } from "../../../hooks/useRoles";
import { employeeService } from "../../../services/employeeService";
import { useSelector } from "react-redux";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";
import { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";

const EmployeeCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { addEmployee, employees, loadEmployees } = useEmployees();
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
    createdByOn: user?.username,
  });

  useEffect(() => {
    const fetchCode = async () => {
      try {
        const nextCode = await employeeService.fetchNextCode();
        if (nextCode) {
          setFormData(prev => ({ ...prev, empCode: nextCode }));
        }
      } catch (err) {
        console.error("Error fetching next employee code:", err);
      }
    };
    fetchCode();
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadDepartments();
      await loadRoles();
      await loadEmployees({ limit: 1000 });
    };

    init();
  }, [loadDepartments, loadRoles, loadEmployees]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox"
      ? (e.target as HTMLInputElement).checked
      : value;

    // BUG-EMP-007 fix: removed stale designationId reference that does not exist in formData
    setFormData(prev => ({
      ...prev,
      [name]: val,
    }));

    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleClear = () => {
    setFormData({
      empCode: formData.empCode,
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
      createdByOn: user?.username,
    });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const payload: any = {
        empCode: formData.empCode,
        fullName: formData.fullName,
        mobile: formData.mobile || undefined,
        email: formData.email || undefined,
        departmentId: formData.departmentId ? Number(formData.departmentId) : undefined,
        status: formData.status as any,
        createLoginAccount: formData.createLoginAccount,
        createdBy: user ? user?.userId : undefined,
      };

      // If a role is selected but they didn't toggle createLoginAccount, auto-create one
      // because in the database, role belongs to the User (Login Account).
      if (formData.createLoginAccount || formData.roleId) {
        payload.createLoginAccount = true;
        payload.loginAccount = {
          username: formData.createLoginAccount ? formData.username : formData.empCode,
          password: formData.createLoginAccount ? formData.password : "Sunsea@123",
          roleId: Number(formData.roleId),
          status: formData.userStatus || "active",
        };
      }

      await addEmployee(payload);
      toast.success("Employee created successfully!");
      navigate("/employees");
    } catch (err: any) {
      toast.error(err || "Failed to create employee");
    }
  };

  const departmentOptions = useMemo(() => {
    return departments.map((d) => ({
      value: String(d.id),
      label: d.name,
    }));
  }, [departments]);

  const roleOptions = useMemo(() => {
    const excludedRoles = ["ROLE_ADMIN", "Super Admin", "System Administrator"];
    return roles
      .filter((r) => !excludedRoles.includes(r.name))
      .map(r => ({ value: String(r.id), label: r.name }));
  }, [roles]);

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

    // BUG-EMP-003 fix: department is required on Create (consistent enforcement)
    if (!formData.departmentId) {
      newErrors.departmentId = "Department is required";
    }

    // BUG-EMP-002 fix: email is optional — only validate format/duplicate if a value is entered
    if (formData.email) {
      const emailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
      if (!emailFormatValid) {
        newErrors.email = "Enter a valid email address";
      } else {
        const emailExists = employees.some(
          (emp) => emp.email?.toLowerCase().trim() === formData.email.toLowerCase().trim()
        );
        if (emailExists) {
          newErrors.email = "Email already exists";
        }
      }
    }

    if (!formData.roleId) {
      newErrors.roleId = "Role is required";
    }

    if (formData.createLoginAccount) {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required";
      }
      if (!formData.password.trim()) {
        newErrors.password = "Password is required";
      } else if (formData.password.length < 6) {
        newErrors.password = "Password must be at least 6 characters";
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast.error(`Validation failed: ${Object.values(newErrors)[0]}`);
      return false;
    }

    return true;
  };

  return (
    <div className="w-full  space-y-6">
      {/* Page Header */}
      <div className="">
        <div className="px-3 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">
              Create Employee
            </h2>
          </div>
          <BackButton />
        </div>
      </div>

      <div className="bg-white  border border-gray-200">
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
                onChange={handleChange}
                error={errors.empCode}
                disabled
              />

              <TextInput
                label="Employee Name"
                name="fullName"
                value={formData.fullName}
                placeholder="Enter Employee Name"
                required
                onChange={handleChange}
                error={errors.fullName}
              />

              <IndiaPhoneInput
                label="Phone Number"
                name="mobile"
                value={formData.mobile}
                placeholder="Enter Mobile Number"
                required={false}
                onChange={(e) => handleChange(e as any)}
                error={errors.mobile}
              />

              <TextInput
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                placeholder="Enter Email Address"
                onChange={handleChange}
                error={errors.email}
              />

              <SelectInput
                label="Department"
                name="departmentId"
                value={formData.departmentId}
                options={departmentOptions}
                defaultOptionLabel="Select Department"
                required
                onChange={handleChange}
                error={errors.departmentId}
              />

                <SelectInput
                  label="Role"
                  name="roleId"
                  value={formData.roleId}
                  options={roleOptions}
                  defaultOptionLabel="Select Role"
                  required
                  onChange={handleChange}
                  error={errors.roleId}
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
                onChange={handleChange}
              />

              <TextInput
                label="Created By"
                name="createdByOn"
                value={formData.createdByOn}
                required
                onChange={handleChange}
                disabled
              />
            </div>
          </div>

          {/* User Login Account Section */}
          <div>
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FaKey className="text-primary text-xl" />
                <h3 className="text-lg font-semibold text-gray-700">Login Account Details</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm font-semibold text-primary">Create Login Account</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    name="createLoginAccount"
                    checked={formData.createLoginAccount}
                    onChange={handleChange}
                  />
                  <div className={`block w-14 h-8 rounded-full transition-colors duration-300 ${formData.createLoginAccount ? 'bg-primary' : 'bg-gray-300'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${formData.createLoginAccount ? 'transform translate-x-6' : ''}`}></div>
                </div>
              </label>
            </div>

            {formData.createLoginAccount && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-white p-6 rounded-xl border border-slate-100 animate-[fadeIn_0.3s_ease]">
                <TextInput
                  label="Username"
                  name="username"
                  value={formData.username}
                  placeholder="Enter username"
                  required
                  onChange={handleChange}
                  error={errors.username}
                />

                <TextInput
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  placeholder="Enter password"
                  required
                  onChange={handleChange}
                  error={errors.password}
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
                  onChange={handleChange}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
            <CustomButton
              text="Clear"
              icon={FaEraser}
              onClick={handleClear}

            />
            <CustomButton
              text="Save Employee"
              icon={FaSave}
              type="submit"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeCreatePage;