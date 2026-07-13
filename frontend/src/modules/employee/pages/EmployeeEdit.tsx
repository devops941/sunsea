import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Row, Col, Form } from "react-bootstrap";
import { FaUser, FaPhoneAlt, FaEnvelope, FaIdCard, FaLock, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { useEmployees } from "../../../hooks/useEmployees";
import { useDepartments } from "../../../hooks/useDepartments";

import { useRoles } from "../../../hooks/useRoles";
import { useSelector } from "react-redux";

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

    if (formData.mobile.trim() && !/^\d{10}$/.test(formData.mobile.trim())) {
      newErrors.mobile = "Enter a valid 10-digit mobile number";
    }

    if (formData.email) {
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
  }, [employeeData]);

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
    <div className="inner-container">
      <Container fluid>
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Edit Employee</h2>
                
              </div>
            </Col>
          </Row>
        </div>

        <form onSubmit={handleSubmit} className="form-inner">
          <Row className="mb-4">
            <h2 className="form-title">Basic & Professional Information</h2>

            <Col lg={4} md={6}>
              <TextInput
                label="Employee Code"
                name="empCode"
                value={formData.empCode}
                placeholder="e.g. EMP001"
                icon={<FaIdCard />}
                required
                onChange={handleChange}
                error={errors.empCode}
                disabled
              />
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Employee Name"
                name="fullName"
                value={formData.fullName}
                placeholder="Enter Employee Name"
                icon={<FaUser />}
                required
                onChange={handleChange}
                error={errors.fullName}
              />
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Phone Number"
                name="mobile"
                value={formData.mobile}
                placeholder="Enter Mobile Number"
                icon={<FaPhoneAlt />}
                onChange={handleChange}
                error={errors.mobile}
              />
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                placeholder="Enter Email Address"
                icon={<FaEnvelope />}
                onChange={handleChange}
                error={errors.email}
              />
            </Col>

            <Col lg={4} md={6}>
              <SelectInput
                label="Department"
                name="departmentId"
                value={formData.departmentId}
                options={departmentOptions}
                onChange={handleChange}
              />
            </Col>



            <Col lg={4} md={6}>
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
            </Col>
            <Col lg={4} md={6}>
              <TextInput
                label="Updated BY"
                name="updatedByOn"
                value={user?.username}
                icon={<FaIdCard />}
                required
                onChange={handleChange}
                disabled
              />
            </Col>
          </Row>

          {/* User Login Account Section */}
          <div className="section-divider my-4"></div>
          <Row className="mb-4">
            <Col lg={12}>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  id="createLoginAccount-switch"
                  label={employeeData?.user ? "Manage Login Account" : "Create Login Account"}
                  name="createLoginAccount"
                  checked={formData.createLoginAccount}
                  onChange={handleChange}
                  className="custom-switch fs-5 fw-semibold text-primary"
                />
              </Form.Group>
            </Col>

            {formData.createLoginAccount && (
              <>
                <h2 className="form-title mt-2">Login Account Details</h2>
                <Col lg={3} md={6}>
                  <TextInput
                    label="Username"
                    name="username"
                    value={formData.username}
                    placeholder="Enter username"
                    icon={<FaUser />}
                    required
                    onChange={handleChange}
                    error={errors.username}
                  />
                </Col>

                <Col lg={3} md={6}>
                  <TextInput
                    label="Password"
                    name="password"
                    type="password"
                    value={formData.password}
                    placeholder={employeeData?.user ? "Leave empty to keep current password" : "Enter password"}
                    icon={<FaLock />}
                    required={!employeeData?.user}
                    onChange={handleChange}
                    error={errors.password}
                  />
                </Col>

                <Col lg={3} md={6}>
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
                </Col>

                <Col lg={3} md={6}>
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
                </Col>

              </>
            )}
          </Row>

          <Row className="mt-4">
            <Col lg={12}>
              <div className="form-actions d-flex justify-content-end gap-3">
                <CustomButton
                  text="Save Changes"
                  icon={FaSave}
                  type="submit"
                />
              </div>
            </Col>
          </Row>
        </form>
      </Container>
    </div>
  );
};

export default EmployeeEdit;