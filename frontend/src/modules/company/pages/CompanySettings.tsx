import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaInfoCircle, FaFileAlt, FaMapMarkerAlt, FaPhoneAlt, FaCogs } from 'react-icons/fa';
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from 'react-redux';
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import ImageUpload from "../../../components/form/ImageUpload/ImageUpload";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import Section from "../../../components/ui/Section/Section";
import type { RootState, AppDispatch } from '../../../app/store';
import { fetchCompany, updateCompany } from '../../../features/company/companySlice';
import type { UpdateCompanyDto } from '../../../features/company/types';

const CompanySettings: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isEditMode = location.pathname.includes('edit');
  const dispatch = useDispatch<AppDispatch>();
  const { data: company, loading } = useSelector((state: RootState) => state.company);

  const [formData, setFormData] = useState<UpdateCompanyDto>({});
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    dispatch(fetchCompany());
  }, [dispatch]);

  useEffect(() => {
    if (company) {
      setFormData({
        companyCode: company.companyCode || "",
        legalName: company.legalName || company.companyName || "",
        shortName: company.shortName || "",
        gstin: company.gstin || "",
        currencyCode: company.currencyCode || "INR",
        phone: company.phone || "",
        mobile: company.mobile || "",
        email: company.email || "",
        website: company.website || "",
        logoUrl: company.logoUrl || "",
        addressLine1: company.addressLine1 || "",
        addressLine2: company.addressLine2 || "",
        city: company.city || "",
        state: company.state || "",
        zipcode: company.zipcode || "",
        country: company.country || "",
        isActive: company.isActive,
      });
    }
  }, [company]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let val: any = value;
    if (type === "checkbox") {
      val = (e.target as HTMLInputElement).checked;
    } else if (type === "file") {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData((prev) => ({ ...prev, [name]: reader.result as string }));
          if (errors[name]) {
            setErrors((prev: any) => ({ ...prev, [name]: undefined }));
          }
        };
        reader.readAsDataURL(file);
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors((prev: any) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: any = {};
    if (!formData.companyCode?.trim()) newErrors.companyCode = "Company code is required";
    if (!formData.legalName?.trim()) newErrors.legalName = "Legal name is required";
    if (!formData.currencyCode?.trim()) newErrors.currencyCode = "Currency code is required";
    if (!formData.email?.trim()) newErrors.email = "Email is required";
    if (!formData.phone?.trim()) newErrors.phone = "Phone number is required";
    if (!formData.addressLine1?.trim()) newErrors.addressLine1 = "Address Line 1 is required";
    if (!formData.city?.trim()) newErrors.city = "City is required";
    if (!formData.state?.trim()) newErrors.state = "State is required";
    if (!formData.zipcode?.trim()) newErrors.zipcode = "Zipcode is required";
    if (!formData.country?.trim()) newErrors.country = "Country is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !company) return;

    try {
      await dispatch(updateCompany({ id: company.id, data: formData })).unwrap();
      toast.success(company.isOnboarded ? "Company updated successfully!" : "Onboarding completed successfully!");
      if (!company.isOnboarded) {
        window.location.href = "/dashboard";
      } else {
        navigate('/company/view');
      }
    } catch (err: any) {
      toast.error(err?.message || err || "Failed to update company");
    }
  };

  if (loading && !company) return <div className="text-center p-5 mt-5">Loading...</div>;

  if (company && !company.isOnboarded) {
    return (
      <div className="onboarding-wrapper d-flex align-items-start justify-content-center bg-light py-5 px-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, overflowY: 'auto', minHeight: '100vh' }}>
        <Container style={{ maxWidth: "1000px" }}>
          <div className="inner-container">
            <div className="text-center mb-5">
              <h2 className="fw-bold onboarding-title-text pb-2">Welcome to Sunsea ERP</h2>
              <p className="text-muted">Please complete your company onboarding to get started.</p>
            </div>
            <form onSubmit={handleSubmit}>
              <Section title="General Info & Logo" icon={<FaInfoCircle />}>
                <Row className="g-3">
                  <Col md={4}>
                    <TextInput label="Legal Company Name" name="legalName" value={formData.legalName || ""} onChange={handleChange} placeholder="Enter Legal Name" required error={errors.legalName} />
                  </Col>
                  <Col md={4}>
                    <TextInput label="Company Code" name="companyCode" value={formData.companyCode || ""} onChange={handleChange} placeholder="Enter Company Code" required error={errors.companyCode} />
                  </Col>
                  <Col md={4}>
                    <SelectInput label="Currency Code" name="currencyCode" value={formData.currencyCode || "INR"} onChange={handleChange as any} required disabled={isEditMode} options={[
                      { value: "INR", label: "INR - Indian Rupee" }, { value: "USD", label: "USD - US Dollar" }, { value: "EUR", label: "EUR - Euro" }
                    ]} />
                  </Col>
                  <Col md={12}>
                    <ImageUpload label="Company Logo" name="logoUrl" onChange={handleChange as any} />
                  </Col>
                </Row>
              </Section>

              <Section title="Registration Details" icon={<FaFileAlt />}>
                <Row className="g-3">
                  <Col md={12}>
                    <TextInput label="GSTIN" name="gstin" value={formData.gstin || ""} onChange={handleChange} placeholder="Enter GSTIN" />
                  </Col>
                </Row>
              </Section>

              <Section title="Address Details" icon={<FaMapMarkerAlt />}>
                <Row className="g-3">
                  <Col lg={6} md={12}>
                    <TextInput label="Address Line 1" name="addressLine1" value={formData.addressLine1 || ""} onChange={handleChange} placeholder="Enter Address Line 1" required error={errors.addressLine1} />
                  </Col>
                  <Col lg={6} md={12}>
                    <TextInput label="Address Line 2" name="addressLine2" value={formData.addressLine2 || ""} onChange={handleChange} placeholder="Enter Address Line 2" error={errors.addressLine2} />
                  </Col>
                  <Col lg={3} md={6}>
                    <TextInput label="City" name="city" value={formData.city || ""} onChange={handleChange} placeholder="Enter City" required error={errors.city} />
                  </Col>
                  <Col lg={3} md={6}>
                    <TextInput label="State" name="state" value={formData.state || ""} onChange={handleChange} placeholder="Enter State" required error={errors.state} />
                  </Col>
                  <Col lg={3} md={6}>
                    <TextInput label="Zipcode" name="zipcode" value={formData.zipcode || ""} onChange={handleChange} placeholder="Enter Zipcode" required error={errors.zipcode} />
                  </Col>
                  <Col lg={3} md={6}>
                    <TextInput label="Country" name="country" value={formData.country || ""} onChange={handleChange} placeholder="Enter Country" required error={errors.country} />
                  </Col>
                </Row>
              </Section>

              <Section title="Contact Details" icon={<FaPhoneAlt />}>
                <Row className="g-3">
                  <Col md={6}>
                    <TextInput label="Email Address" name="email" type="email" value={formData.email || ""} onChange={handleChange} placeholder="Enter Email" required error={errors.email} />
                  </Col>
                  <Col md={6}>
                    <TextInput label="Phone Number" name="phone" value={formData.phone || ""} onChange={handleChange} placeholder="Enter Phone" required error={errors.phone} />
                  </Col>
                </Row>
              </Section>

              <div className="d-flex justify-content-center mt-5">
                <CustomButton text="Complete Onboarding" icon={FaSave} type="submit" disabled={loading} className="py-3 px-5 fs-5" />
              </div>
            </form>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="inner-container">
      <Container fluid>
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">{isEditMode ? 'Edit Company' : 'Create Company'}</h2>
                <div className="page-breadcrumb">Home / Company / {isEditMode ? 'Edit' : 'Create'} Company</div>
              </div>
            </Col>
          </Row>
        </div>

        <form onSubmit={handleSubmit} className="form-inner">
          <Section title="General Information" icon={<FaInfoCircle />}>
            <Row>
              <Col lg={4} md={6}>
                <TextInput label="Legal Name" name="legalName" value={formData.legalName || ""} onChange={handleChange} placeholder="Enter Legal Name" required error={errors.legalName} />
              </Col>
              <Col lg={4} md={6}>
                <TextInput label="Company Code" name="companyCode" value={formData.companyCode || ""} onChange={handleChange} placeholder="Enter Company Code" required error={errors.companyCode} />
              </Col>
              <Col lg={4} md={6}>
                <TextInput label="Short Name" name="shortName" value={formData.shortName || ""} onChange={handleChange} placeholder="Enter Short Name" />
              </Col>
              <Col lg={4} md={6}>
                <SelectInput label="Currency Code" name="currencyCode" value={formData.currencyCode || "INR"} onChange={handleChange as any} required disabled={isEditMode} options={[
                  { value: "INR", label: "INR - Indian Rupee" }, { value: "USD", label: "USD - US Dollar" }, { value: "EUR", label: "EUR - Euro" }
                ]} />
              </Col>
            </Row>
          </Section>

          <Section title="Registration Details" icon={<FaFileAlt />}>
            <Row>
              <Col lg={12} md={12}>
                <TextInput label="GSTIN" name="gstin" value={formData.gstin || ""} onChange={handleChange} placeholder="Enter GSTIN" />
              </Col>
            </Row>
          </Section>

          <Section title="Address Information" icon={<FaMapMarkerAlt />}>
            <Row>
              <Col lg={6} md={12}>
                <TextInput label="Address Line 1" name="addressLine1" value={formData.addressLine1 || ""} onChange={handleChange} placeholder="Enter Address Line 1" required error={errors.addressLine1} />
              </Col>
              <Col lg={6} md={12}>
                <TextInput label="Address Line 2" name="addressLine2" value={formData.addressLine2 || ""} onChange={handleChange} placeholder="Enter Address Line 2" error={errors.addressLine2} />
              </Col>
              <Col lg={3} md={6}>
                <TextInput label="City" name="city" value={formData.city || ""} onChange={handleChange} placeholder="Enter City" required error={errors.city} />
              </Col>
              <Col lg={3} md={6}>
                <TextInput label="State" name="state" value={formData.state || ""} onChange={handleChange} placeholder="Enter State" required error={errors.state} />
              </Col>
              <Col lg={3} md={6}>
                <TextInput label="Zipcode" name="zipcode" value={formData.zipcode || ""} onChange={handleChange} placeholder="Enter Zipcode" required error={errors.zipcode} />
              </Col>
              <Col lg={3} md={6}>
                <TextInput label="Country" name="country" value={formData.country || ""} onChange={handleChange} placeholder="Enter Country" required error={errors.country} />
              </Col>
            </Row>
          </Section>

          <Section title="Contact Information" icon={<FaPhoneAlt />}>
            <Row>
              <Col lg={4} md={6}>
                <TextInput label="Email Address" name="email" type="email" value={formData.email || ""} onChange={handleChange} placeholder="Enter Email" required error={errors.email} />
              </Col>
              <Col lg={4} md={6}>
                <TextInput label="Phone Number" name="phone" value={formData.phone || ""} onChange={handleChange} placeholder="Enter Phone" required error={errors.phone} />
              </Col>
              <Col lg={4} md={6}>
                <TextInput label="Mobile Number" name="mobile" value={formData.mobile || ""} onChange={handleChange} placeholder="Enter Mobile" />
              </Col>
              <Col lg={4} md={6}>
                <TextInput label="Website" name="website" value={formData.website || ""} onChange={handleChange} placeholder="Enter Website (e.g. www.example.com)" />
              </Col>
            </Row>
          </Section>

          <Section title="System Information" icon={<FaCogs />}>
            <Row>
              <Col lg={4} md={6}>
                <ImageUpload label="Company Logo" name="logoUrl" onChange={handleChange as any} />
              </Col>
              <Col lg={4} md={6} className="d-flex align-items-center mt-4">
                <div className="form-check form-switch mt-2">
                  <input className="form-check-input" type="checkbox" role="switch" id="isActiveSwitch" name="isActive" checked={!!formData.isActive} onChange={handleChange as any} />
                  <label className="form-check-label ms-2 fw-bold text-primary" htmlFor="isActiveSwitch">Active Company</label>
                </div>
              </Col>
            </Row>
          </Section>

          <div className="form-actions d-flex justify-content-end gap-3 mt-4" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}>
            <CustomButton text={isEditMode ? "Save Changes" : "Create Company"} icon={FaSave} type="submit" disabled={loading} />
          </div>
        </form>
      </Container>
    </div>
  );
};

export default CompanySettings;
