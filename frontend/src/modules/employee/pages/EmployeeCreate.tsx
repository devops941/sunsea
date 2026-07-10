import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Form } from "react-bootstrap";
import { FaSave, FaEraser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { useEmployees } from "../../../hooks/useEmployees";
import { useDepartments } from "../../../hooks/useDepartments";
import { useDesignations } from "../../../hooks/useDesignations";
import { useRoles } from "../../../hooks/useRoles";
import { employeeService } from "../../../services/employeeService";
import { useSelector } from "react-redux";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";
import { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";

const EmployeeCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { addEmployee, employees, loadEmployees } = useEmployees();
  const { departments, loadDepartments } = useDepartments();
  const { designations, loadDesignations } = useDesignations();
  const { roles, loadRoles } = useRoles();
  const user = useSelector((state: any) => state.auth.user);



  const [formData, setFormData] = useState({
    empCode: "",
    fullName: "",
    mobile: "",
    email: "",
    departmentId: "",
    designationId: "",
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
  }, []);

  // useEffect(() => {
  //   if (departments.length > 0 && !formData.departmentId) {
  //     const firstDeptId = String(departments[0].id);

  //     setFormData(prev => ({
  //       ...prev,
  //       departmentId: firstDeptId,
  //     }));

  //     loadDesignations(Number(firstDeptId));
  //   }
  // }, [departments]);
  useEffect(() => {
    if (!formData.departmentId) return;

    loadDesignations(Number(formData.departmentId));
  }, [formData.departmentId, loadDesignations]);
  useEffect(() => {
    if (formData.departmentId) {
      loadDesignations(Number(formData.departmentId));
    }
  }, [formData.departmentId, loadDesignations]);


  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox"
      ? (e.target as HTMLInputElement).checked
      : value;

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: val,
      };

      // RESET DESIGNATION WHEN DEPARTMENT CHANGES
      if (name === "departmentId") {
        updated.designationId = "";
      }

      return updated;
    });

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
      designationId: "",
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
        designationId: formData.designationId ? Number(formData.designationId) : undefined,
        status: formData.status as any,
        createLoginAccount: formData.createLoginAccount,
        createdBy: user ? user?.userId : undefined,
      };

      if (formData.createLoginAccount) {
        payload.loginAccount = {
          username: formData.username,
          password: formData.password,
          roleId: Number(formData.roleId),
          status: formData.userStatus,
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

  const designationOptions = useMemo(() => {
    return designations.map((d) => ({
      value: String(d.id),
      label: d.name,
    }));
  }, [designations]);

  const roleOptions = useMemo(() => {
    return roles.map(r => ({ value: String(r.id), label: r.name }));
  }, [roles]);

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

    // if (! /^\d{10}$/.test(formData.mobile.trim())) {
    //   newErrors.mobile = "Enter a valid 10-digit mobile number";
    // }
    const mobileError = validatePhoneNumber(formData.mobile, true);
    if (mobileError) {
      newErrors.mobile = mobileError;
    }

    if (!formData.email) {
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

    if (formData.createLoginAccount) {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required";
      }
      if (!formData.password.trim()) {
        newErrors.password = "Password is required";
      } else if (formData.password.length < 6) {
        newErrors.password = "Password must be at least 6 characters";
      }
      if (!formData.roleId) {
        newErrors.roleId = "Role is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <div className="inner-container">
      <Container fluid>
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Create Employee</h2>
                <div className="page-breadcrumb">Home / Employees / Create Employee</div>
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
                required
                onChange={handleChange}
                error={errors.fullName}
              />
            </Col>

            <Col lg={4} md={6}>
              <IndiaPhoneInput
                label="Phone Number"
                name="mobile"
                value={formData.mobile}
                placeholder="Enter Mobile Number"
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
                defaultOptionLabel="Select Department"
                required
                onChange={handleChange}
              />
            </Col>

            <Col lg={4} md={6}>
              <SelectInput
                label="Designation"
                name="designationId"
                value={formData.designationId}
                options={designationOptions}
                defaultOptionLabel="Select Designation"
                required
                disabled={!formData.departmentId}
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
                label="CREATED BY"
                name="createdByOn"
                value={formData.createdByOn}
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
                  label="Create Login Account"
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
                    placeholder="Enter password"
                    required
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
                    required
                    onChange={handleChange}
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
            </Col>
          </Row>
        </form>
      </Container>
    </div>
  );
};

export default EmployeeCreatePage;