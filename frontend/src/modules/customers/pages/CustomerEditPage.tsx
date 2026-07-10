import React, { useState, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaIdCard, FaSave } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { useCustomers } from "../../../hooks/useCustomers";
import { customerService } from "../../../services/customerService";
import { useSelector } from "react-redux";
import { validateCustomer } from "../validations/customerValidation";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../components/ui/CityStateSelect/CityStateSelect";
const getGstStateCode = (stateName: string): string => {
  const normalized = stateName.toLowerCase().replace(/[^a-z]/g, "");
  const mapping: Record<string, string> = {
    jammuandkashmir: "01",
    himachalpradesh: "02",
    punjab: "03",
    chandigarh: "04",
    uttarakhand: "05",
    haryana: "06",
    delhi: "07",
    rajasthan: "08",
    uttarpradesh: "09",
    bihar: "10",
    sikkim: "11",
    arunachalpradesh: "12",
    nagaland: "13",
    manipur: "14",
    mizoram: "15",
    tripura: "16",
    meghalaya: "17",
    assam: "18",
    westbengal: "19",
    jharkhand: "20",
    odisha: "21",
    chhattisgarh: "22",
    madhyapradesh: "23",
    gujarat: "24",
    damananddiu: "26",
    dadraandnagarhaveli: "26",
    maharashtra: "27",
    andhrapradesh: "37",
    karnataka: "29",
    goa: "30",
    lakshadweep: "31",
    kerala: "32",
    tamilnadu: "33",
    puducherry: "34",
    andamanandnicobarislands: "35",
    telangana: "36",
    ladakh: "38",
  };
  return mapping[normalized] || "";
};

const initialFormData = {
  // Customer Info
  customerId: "", // display-only, holds customerCode
  isActive: "true",
  createdByOn: "",

  // Basic Information
  firmName: "",
  displayName: "",
  customerType: [] as string[],

  contactPerson: "",
  designation: "",

  mobile: "",
  altPhone: "",
  whatsapp: "",

  email: "",

  // GST & Statutory
  gstin: "",
  pan: "",
  gstRegType: "Regular",

  stateCode: "",

  tdsSection: "",
  tcsRate: "0",

  // Billing Address
  billingAddressLine1: "",
  billingCity: "",
  billingState: "",
  billingPincode: "",

  // Shipping Address
  sameAsBilling: false,

  shippingAddressLine1: "",
  shippingCity: "",
  shippingState: "",
  shippingPincode: "",

  // Commercial Settings
  creditLimit: "0",
  creditDays: "0",

  priceList: "Standard",

  routeId: "",
  collectionAgentId: "",

  // Bank Accounts
  bankAccounts: [
    {
      bankHolderName: "",
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      branchName: "",
      upiMobileNumber: "",
    },
  ],
};

type CustomerFormData = typeof initialFormData;

// Maps the API's customer record (nested billingAddress/shippingAddress JSON)
// into the flat shape this form's state uses.
const mapCustomerToFormData = (customer: any): CustomerFormData => {
  const billingMatchesShipping =
    !!customer.shippingAddressLine1 &&
    customer.billingAddressLine1 === customer.shippingAddressLine1 &&
    customer.billingCity === customer.shippingCity &&
    customer.billingState === customer.shippingState &&
    customer.billingPincode === customer.shippingPincode;

  return {
    customerId: customer.customerCode || "",
    isActive: customer.status === "Active" ? "true" : "false",
    createdByOn: customer.createdUser
      ? `${customer.createdUser.fullName} - ${new Date(customer.createdAt).toLocaleString()}`
      : "",

    firmName: customer.firmName || "",
    displayName: customer.displayName || "",
    customerType: typeof customer.customerType === "string"
      ? customer.customerType.split(",").filter(Boolean)
      : (Array.isArray(customer.customerType) ? customer.customerType : []),

    contactPerson: customer.contactPerson || "",
    designation: customer.designation || "",

    mobile: customer.mobile || "",
    altPhone: customer.altPhone || "",
    whatsapp: customer.whatsapp || "",

    email: customer.email || "",

    gstin: customer.gstin || "",
    pan: customer.pan || "",
    gstRegType: customer.gstRegType || "Regular",

    stateCode: customer.stateCode || "",

    tdsSection: customer.tdsSection || "",
    tcsRate: customer.tcsRate != null ? String(customer.tcsRate) : "0",

    billingAddressLine1: customer.billingAddressLine1 || "",
    billingCity: customer.billingCity || "",
    billingState: customer.billingState || "",
    billingPincode: customer.billingPincode || "",

    sameAsBilling: billingMatchesShipping,

    shippingAddressLine1: customer.shippingAddressLine1 || "",
    shippingCity: customer.shippingCity || "",
    shippingState: customer.shippingState || "",
    shippingPincode: customer.shippingPincode || "",

    creditLimit: customer.creditLimit != null ? String(customer.creditLimit) : "0",
    creditDays: customer.creditDays != null ? String(customer.creditDays) : "0",

    priceList: customer.priceList || "Standard",

    routeId: customer.routeId || "",
    collectionAgentId: customer.collectionAgentId != null ? String(customer.collectionAgentId) : "",

    bankAccounts: Array.isArray(customer.bankAccount)
      ? customer.bankAccount.map((bank: any) => ({
        bankHolderName: bank.bankHolderName || "",
        bankName: bank.bankName || "",
        accountNumber: bank.accountNumber || "",
        ifscCode: bank.ifscCode || "",
        branchName: bank.branchName || "",
        upiMobileNumber: bank.upiMobileNumber || "",
      }))
      : customer.bankAccount && typeof customer.bankAccount === "object"
        ? [
          {
            bankHolderName: customer.bankAccount.bankHolderName || "",
            bankName: customer.bankAccount.bankName || "",
            accountNumber: customer.bankAccount.accountNumber || "",
            ifscCode: customer.bankAccount.ifscCode || "",
            branchName: customer.bankAccount.branchName || "",
            upiMobileNumber: customer.bankAccount.upiMobileNumber || "",
          },
        ]
        : [
          {
            bankHolderName: "",
            bankName: "",
            accountNumber: "",
            ifscCode: "",
            branchName: "",
            upiMobileNumber: "",
          },
        ],
  };
};

const CustomerEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { editCustomer } = useCustomers();

  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const user = useSelector((state: any) => state.auth.user);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shippingResetKey, setShippingResetKey] = useState(0);

  useEffect(() => {
    // Fast-render with whatever was passed via navigation state (e.g. from a table row click)
    if (location.state) {
      setFormData(mapCustomerToFormData(location.state));
    }

    // Always fetch the authoritative record from the API — handles direct URL access,
    // page refresh, and stale navigation state.
    const fetchCustomer = async () => {
      if (!id) return;
      try {
        const customer = await customerService.fetchById(id);
        setFormData(mapCustomerToFormData(customer));
      } catch (err) {
        toast.error("Failed to load customer details");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleMultiSelectChange = (name: string, values: string[]) => {
    setFormData((prev) => ({
      ...prev,
      [name]: values,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }
  ) => {
    const { name, value } = e.target;

    if (name === "sameAsBilling") {
      const checked = (e.target as HTMLInputElement).checked;

      setFormData((prev) => ({
        ...prev,
        sameAsBilling: checked,

        ...(checked
          ? {
            shippingAddressLine1: prev.billingAddressLine1,
            shippingCity: prev.billingCity,
            shippingState: prev.billingState,
            shippingPincode: prev.billingPincode,
          }
          : {
            shippingAddressLine1: "",
            shippingCity: "",
            shippingState: "",
            shippingPincode: "",
          }),
      }));

      setShippingResetKey((k) => k + 1);

      // Clear shipping errors
      setErrors((prev) => ({
        ...prev,
        shippingAddressLine1: "",
        shippingCity: "",
        shippingState: "",
        shippingPincode: "",
        sameAsBilling: "",
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Billing State/City handlers (passed to CityStateSelect)
  const handleBillingStateChange = (stateData: StateCityOption) => {
    const gstCode = getGstStateCode(stateData.state_code || stateData.name);
    setFormData((prev) => ({
      ...prev,
      billingState: stateData.name,
      billingCity: "",
      stateCode: gstCode || prev.stateCode,
    }));
    setErrors((prev) => ({
      ...prev,
      billingState: "",
      billingCity: "",
      stateCode: "",
    }));
  };

  const handleBillingCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, billingCity: cityData.name }));
    setErrors((prev) => ({ ...prev, billingCity: "" }));
  };

  // Shipping State/City handlers (passed to CityStateSelect)
  const handleShippingStateChange = (stateData: StateCityOption) => {
    setFormData((prev) => ({
      ...prev,
      shippingState: stateData.name,
      shippingCity: "",
    }));
    setErrors((prev) => ({
      ...prev,
      shippingState: "",
      shippingCity: "",
    }));
  };

  const handleShippingCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, shippingCity: cityData.name }));
    setErrors((prev) => ({ ...prev, shippingCity: "" }));
  };

  const handleBankChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updatedBanks = [...prev.bankAccounts];
      updatedBanks[index] = {
        ...updatedBanks[index],
        [name]: value,
      };
      return { ...prev, bankAccounts: updatedBanks };
    });

    const errorKey = `bankAccounts.${index}.${name}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: "" }));
    }
  };

  const addBankAccount = () => {
    setFormData((prev) => ({
      ...prev,
      bankAccounts: [
        ...prev.bankAccounts,
        {
          bankHolderName: "",
          bankName: "",
          accountNumber: "",
          ifscCode: "",
          branchName: "",
          upiMobileNumber: "",
        },
      ],
    }));
  };

  const removeBankAccount = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter((_, i) => i !== index),
    }));
  };

  // Keep shipping address in sync with billing address when "Same as billing" is checked
  useEffect(() => {
    if (formData.sameAsBilling) {
      setFormData((prev) => ({
        ...prev,
        shippingAddressLine1: prev.billingAddressLine1,
        shippingCity: prev.billingCity,
        shippingState: prev.billingState,
        shippingPincode: prev.billingPincode,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.sameAsBilling,
    formData.billingAddressLine1,
    formData.billingCity,
    formData.billingState,
    formData.billingPincode,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const validationErrors = validateCustomer(formData);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the highlighted errors");
      return;
    }


    try {
      // Note: customerCode, companyId, and createdBy are NOT sent — they're either
      // immutable (customerCode/companyId) or server-derived (createdBy) and should
      // never be edited from the client.
      await editCustomer(id, {
        firmName: formData.firmName,
        displayName: formData.displayName || undefined,

        customerType: formData.customerType,

        contactPerson: formData.contactPerson || undefined,
        designation: formData.designation || undefined,

        mobile: formData.mobile,
        altPhone: formData.altPhone || undefined,
        whatsapp: formData.whatsapp || undefined,

        email: formData.email || undefined,

        gstin: formData.gstin || undefined,
        // pan: formData.pan || undefined,
        // gstRegType: formData.gstRegType || undefined,

        // stateCode: formData.stateCode,

        // tdsSection: formData.tdsSection || undefined,
        // tcsRate: Number(formData.tcsRate || 0),

        billingAddressLine1: formData.billingAddressLine1,
        billingCity: formData.billingCity,
        billingState: formData.billingState,
        billingPincode: formData.billingPincode,
        shippingAddressLine1: formData.sameAsBilling ? formData.billingAddressLine1 : formData.shippingAddressLine1 || undefined,
        shippingCity: formData.sameAsBilling ? formData.billingCity : formData.shippingCity || undefined,
        shippingState: formData.sameAsBilling ? formData.billingState : formData.shippingState || undefined,
        shippingPincode: formData.sameAsBilling ? formData.billingPincode : formData.shippingPincode || undefined,

        creditLimit: Number(formData.creditLimit || 0),
        creditDays: Number(formData.creditDays || 0),

        priceList: formData.priceList || "Standard",

        routeId: formData.routeId || null,
        collectionAgentId: formData.collectionAgentId || null,

        bankAccount: formData.bankAccounts,
        status: formData.isActive === "true" ? "Active" : "Inactive",
      });
      toast.success("Customer updated successfully!");
      navigate("/customers");
    } catch (err: any) {
      toast.error(err.message || "Failed to update customer");
    }
  };

  if (loading) {
    return (
      <div className="inner-container d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
        <Spinner animation="border" />
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
                <h2 className="page-title">Edit Customer</h2>
                <div className="page-breadcrumb">Home / Customers / Edit Customer</div>
              </div>
            </Col>
          </Row>
        </div>

        <form onSubmit={handleSubmit} className="form-inner">
          {/* Customer Info */}
          <Row className="mb-4">
            <Col lg={4} md={6}>
              <TextInput
                label="Customer ID / Code"
                name="customerId"
                value={formData.customerId}
                icon={<FaIdCard />}
                onChange={handleChange}
                disabled
              />
            </Col>
            <Col lg={4} md={6}>
              <SelectInput
                label="Status"
                name="isActive"
                value={formData.isActive}
                options={[
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ]}
                onChange={handleChange}
              />
            </Col>
            <Col lg={4} md={6}>
              <TextInput
                label="Created by-on"
                name="createdByOn"
                value={user?.username}
                icon={<FaIdCard />}
                onChange={handleChange}
                disabled
              />
            </Col>
          </Row>

          {/* Basic Info */}
          <Row className="mb-4">
            <h2 className="form-title">Basic Information</h2>

            <Col lg={8} md={12}>
              <TextInput
                label="Firm / Legal Name"
                name="firmName"
                value={formData.firmName}
                placeholder="e.g. Murugan Plastics"
                required
                error={errors.firmName}
                onChange={handleChange}
              />
            </Col>

            <Col lg={4} md={12}>
              <TextInput
                label="Display Name"
                name="displayName"
                value={formData.displayName}
                placeholder="Murugan"
                error={errors.displayName}
                onChange={handleChange}
              />
            </Col>

            <Col lg={4} md={6}>
              <MultiSelect
                label="Customer Type"
                name="customerType"
                value={formData.customerType}
                required
                options={[
                  { value: "B2B", label: "B2B (GST Registered)" },
                  { value: "B2C", label: "B2C (Consumer)" },
                  { value: "Export", label: "Export" },
                ]}
                onChange={handleMultiSelectChange}
                error={errors.customerType}
              />
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Contact Person"
                name="contactPerson"
                value={formData.contactPerson}
                placeholder="Mr. S. Murugan"
                error={errors.contactPerson}
                onChange={handleChange}
              />
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Designation"
                name="designation"
                value={formData.designation}
                placeholder="Proprietor"
                error={errors.designation}
                onChange={handleChange}
              />
            </Col>

            <Col lg={4} md={6}>
              <IndiaPhoneInput
                label="Mobile"
                name="mobile"
                value={formData.mobile}
                placeholder="98400 XXXXX"
                required
                onChange={handleChange}
                error={errors.mobile}
              />
            </Col>

            <Col lg={4} md={6}>
              <IndiaPhoneInput
                label="Alt. Phone"
                name="altPhone"
                value={formData.altPhone}
                placeholder="98400 XXXXX"
                required
                onChange={handleChange}
                error={errors.altPhone}
              />
            </Col>

            <Col lg={4} md={6}>
              <IndiaPhoneInput
                label="WhatsApp #"
                name="whatsapp"
                value={formData.whatsapp}
                placeholder="98400 XXXXX"
                onChange={handleChange}
                error={errors.whatsapp}
              />
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                placeholder="x@y.com"
                error={errors.email}
                onChange={handleChange}
              />
            </Col>
          </Row>

          <Row className="mb-4">
            <h2 className="form-title">GST & Statutory</h2>

            <Col lg={4} md={6}>
              <TextInput
                label="GSTIN (15 CHAR)"
                name="gstin"
                value={formData.gstin}
                placeholder="33AABC1234D1Z5"
                onChange={handleChange}
                error={errors.gstin}
              />
            </Col>

            {/* <Col lg={4} md={6}>
              <TextInput
                label="PAN (AUTO FROM GSTIN)"
                name="pan"
                value={formData.pan}
                placeholder="AABCM1234F"
                onChange={handleChange}
                error={errors.pan}
                disabled
              />
            </Col>

            <Col lg={4} md={6}>
              <SelectInput
                label="GST Registration Type"
                name="gstRegType"
                value={formData.gstRegType}
                options={[
                  { value: "Regular", label: "Regular" },
                  { value: "Composition", label: "Composition" },
                  { value: "Unregistered", label: "Un-registered" },
                  { value: "SEZ", label: "SEZ" },
                  { value: "Consumer", label: "Consumer" },
                ]}
                onChange={handleChange}
                error={errors.gstRegType}
              />
            </Col> */}

            <Col lg={4} md={6}>
              <TextInput
                label="Place Of Supply (State Code)"
                name="stateCode"
                value={formData.stateCode}
                placeholder="33"
                onChange={handleChange}
                error={errors.stateCode}
              />
            </Col>

            {/* <Col lg={4} md={6}>
              <SelectInput
                label="TDS Section (If Applicable)"
                name="tdsSection"
                value={formData.tdsSection}
                options={[
                  { value: "", label: "None" },
                  { value: "194Q", label: "194Q" },
                  { value: "194C", label: "194C" },
                  { value: "194J", label: "194J" },
                ]}
                onChange={handleChange}
                error={errors.tdsSection}
              />
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="TCS Rate %"
                name="tcsRate"
                type="number"
                value={formData.tcsRate}
                placeholder="0.10"
                onChange={handleChange}
                error={errors.tcsRate}
              />
            </Col> */}
          </Row>

          <Row className="mb-4">
            <h2 className="form-title">Billing & Shipping Address</h2>

            <p className="text-muted mb-3">
              Two addresses. "Same as billing" checkbox copies Billing to Shipping.
            </p>

            {/* Billing */}
            <Col lg={6}>
              <h5 className="mb-3">Billing</h5>

              <TextInput
                label="Address Line"
                name="billingAddressLine1"
                value={formData.billingAddressLine1}
                onChange={handleChange}
                error={errors.billingAddressLine1}
              />

              <Row>
                <CityStateSelect
                  stateValue={formData.billingState}
                  cityValue={formData.billingCity}
                  onStateChange={handleBillingStateChange}
                  onCityChange={handleBillingCityChange}
                  stateError={errors.billingState}
                  cityError={errors.billingCity}
                  required
                />

                <Col md={4}>
                  <TextInput
                    label="Pincode"
                    name="billingPincode"
                    value={formData.billingPincode}
                    onChange={handleChange}
                    error={errors.billingPincode}
                  />
                </Col>
              </Row>
            </Col>

            {/* Shipping */}
            <Col lg={6}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0">Shipping</h5>

                <div>
                  <input
                    type="checkbox"
                    name="sameAsBilling"
                    checked={formData.sameAsBilling}
                    onChange={handleChange}
                  />
                  Same as billing
                </div>
              </div>

              <TextInput
                label="Address Line"
                name="shippingAddressLine1"
                value={formData.shippingAddressLine1}
                error={errors.shippingAddressLine1}
                onChange={handleChange}
                disabled={formData.sameAsBilling}
              />

              <Row>
                <CityStateSelect
                  stateValue={formData.shippingState}
                  cityValue={formData.shippingCity}
                  onStateChange={handleShippingStateChange}
                  onCityChange={handleShippingCityChange}
                  stateError={errors.shippingState}
                  cityError={errors.shippingCity}
                  disabled={formData.sameAsBilling}
                  resetKey={shippingResetKey}
                />

                <Col md={4}>
                  <TextInput
                    label="Pincode"
                    name="shippingPincode"
                    value={formData.shippingPincode}
                    error={errors.shippingPincode}
                    onChange={handleChange}
                    disabled={formData.sameAsBilling}
                  />
                </Col>
              </Row>
            </Col>
          </Row>

          <Row className="mb-4">
            <h2 className="form-title">Commercial Settings</h2>

            <Col lg={4} md={6}>
              <TextInput
                label="Credit Limit ₹"
                name="creditLimit"
                type="number"
                value={formData.creditLimit}
                placeholder="300000"
                required
                onChange={handleChange}
                error={errors.creditLimit}
              />
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Credit Days (Net)"
                name="creditDays"
                type="number"
                value={formData.creditDays}
                onChange={handleChange}
                error={errors.creditDays}
                preventNegative
              />
            </Col>

            {/* <Col lg={4} md={6}>
              <SelectInput
                label="Default Price List"
                name="priceList"
                value={formData.priceList}
                options={[
                  { value: "Standard", label: "Standard" },
                  { value: "Wholesale", label: "Wholesale" },
                  { value: "Retail", label: "Retail" },
                  { value: "Distributor", label: "Distributor" },
                ]}
                onChange={handleChange}
                error={errors.priceList}
              />
            </Col> */}
          </Row>

          {/* Route and Collection Agent selects — wire up real options when those
                hooks/endpoints (e.g. useRoutes, useEmployees) are available */}
          {/*
            <Col lg={4} md={6}>
              <SelectInput
                label="Route"
                name="routeId"
                value={formData.routeId}
                options={routeOptions}
                onChange={handleChange}
              />
            </Col>

            <Col lg={4} md={6}>
              <SelectInput
                label="Collection Agent"
                name="collectionAgentId"
                value={formData.collectionAgentId}
                options={employeeOptions}
                onChange={handleChange}
              />
            </Col>
            */}

          {/* BANK DETAILS */}
          <Row className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="form-title mb-0">Bank Account Details</h2>
              <CustomButton
                text="Add another bank"
                onClick={addBankAccount}
                type="button"
              />
            </div>

            {formData.bankAccounts.map((bank, index) => (
              <div key={index} className="bank-account-block mb-4 p-3 border rounded">
                {formData.bankAccounts.length > 1 && (
                  <div className="d-flex justify-content-between mb-2">
                    <h6 className="mb-0">Bank #{index + 1}</h6>
                    <CustomButton
                      text="Remove"
                      onClick={() => removeBankAccount(index)}
                      type="button"
                    />
                  </div>
                )}

                <Row>
                  <Col lg={4} md={6}>
                    <TextInput
                      label="Account Holder Name"
                      name="bankHolderName"
                      value={bank.bankHolderName}
                      onChange={(e) => handleBankChange(index, e)}
                      error={errors[`bankAccounts.${index}.bankHolderName`]}
                    />
                  </Col>

                  <Col lg={4} md={6}>
                    <TextInput
                      label="Bank Name"
                      name="bankName"
                      value={bank.bankName}
                      onChange={(e) => handleBankChange(index, e)}
                      error={errors[`bankAccounts.${index}.bankName`]}
                    />
                  </Col>

                  <Col lg={4} md={6}>
                    <TextInput
                      label="Account Number"
                      name="accountNumber"
                      value={bank.accountNumber}
                      onChange={(e) => handleBankChange(index, e)}
                      error={errors[`bankAccounts.${index}.accountNumber`]}
                    />
                  </Col>

                  <Col lg={4} md={6}>
                    <TextInput
                      label="IFSC Code"
                      name="ifscCode"
                      value={bank.ifscCode}
                      onChange={(e) => handleBankChange(index, e)}
                      error={errors[`bankAccounts.${index}.ifscCode`]}
                    />
                  </Col>

                  <Col lg={4} md={6}>
                    <TextInput
                      label="Branch Name"
                      name="branchName"
                      value={bank.branchName}
                      onChange={(e) => handleBankChange(index, e)}
                      error={errors[`bankAccounts.${index}.branchName`]}
                    />
                  </Col>

                  <Col lg={4} md={6}>
                    <IndiaPhoneInput
                      label="GPay / PhonePe Number"
                      name="upiMobileNumber"
                      value={bank.upiMobileNumber}
                      onChange={(e) => handleBankChange(index, e as React.ChangeEvent<HTMLInputElement>)}
                      error={errors[`bankAccounts.${index}.upiMobileNumber`]}
                    />
                  </Col>
                </Row>
              </div>
            ))}
          </Row>

          <Row className="mt-4">
            <Col lg={12}>
              <div className="form-actions d-flex justify-content-end">
                <CustomButton text="Save Changes" icon={FaSave} type="submit" />
              </div>
            </Col>
          </Row>
        </form>
      </Container>
    </div>
  );
};

export default CustomerEditPage;
