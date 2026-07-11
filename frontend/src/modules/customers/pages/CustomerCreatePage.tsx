import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../components/ui/CityStateSelect/CityStateSelect";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { useCustomers } from "../../../hooks/useCustomers";
import { customerService } from "../../../services/customerService";
import { useSelector } from "react-redux";
import { validateCustomer } from "../validations/customerValidation";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";

const getGstStateCode = (stateNameOrCode: string): string => {
  const normalized = stateNameOrCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  const mapping: Record<string, string> = {
    // ISO codes
    jk: "01",
    hp: "02",
    pb: "03",
    ch: "04",
    ut: "05",
    hr: "06",
    dl: "07",
    rj: "08",
    up: "09",
    br: "10",
    sk: "11",
    ar: "12",
    nl: "13",
    mn: "14",
    mz: "15",
    tr: "16",
    ml: "17",
    as: "18",
    wb: "19",
    jh: "20",
    or: "21",
    od: "21",
    ct: "22",
    cg: "22",
    mp: "23",
    gj: "24",
    dd: "26",
    dn: "26",
    mh: "27",
    ap: "37",
    ka: "29",
    ga: "30",
    ld: "31",
    kl: "32",
    tn: "33",
    py: "34",
    an: "35",
    tg: "36",
    ts: "36",
    la: "38",

    // State Names
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

const CustomerCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { addCustomer } = useCustomers();
  const user = useSelector((state: any) => state.auth.user);

  const initialFormData = {
    customerId: "",
    isActive: "true",
    createdByOn: user?.username,

    firmName: "",
    displayName: "",
    customerType: [] as string[],

    contactPerson: "",
    designation: "",

    mobile: "",
    altPhone: "",
    whatsapp: "",

    email: "",

    gstin: "",
    // pan: "",
    // gstRegType: "Regular",

    stateCode: "",

    // tdsSection: "",
    // tcsRate: "0",

    billingAddressLine1: "",
    billingAddressCity: "",
    billingAddressState: "",
    billingAddressPincode: "",

    sameAsBilling: false,

    shippingAddressLine1: "",
    shippingAddressCity: "",
    shippingAddressState: "",
    shippingAddressPincode: "",

    creditLimit: "",
    creditDays: "0",

    priceList: "Standard",

    routeId: "",
    collectionAgentId: "",

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

  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Bump this key to force CityStateSelect (shipping) to reset/remount
  const [shippingResetKey, setShippingResetKey] = useState(0);

  useEffect(() => {
    if (formData.gstin && formData.gstin.length >= 2) {
      const extractedStateCode = formData.gstin.substring(0, 2);
      if (/^[0-9]{2}$/.test(extractedStateCode)) {
        setFormData(prev => ({ ...prev, stateCode: extractedStateCode }));
        setErrors(prev => ({ ...prev, stateCode: "" }));
      }
    }
    if (formData.gstin && formData.gstin.length >= 12) {
      const extractedPan = formData.gstin.substring(2, 12).toUpperCase();
      setFormData(prev => ({ ...prev, pan: extractedPan }));
    } else if (!formData.gstin) {
      setFormData(prev => ({ ...prev, pan: "" }));
    }
  }, [formData.gstin]);

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

  const handleMultiSelectChange = (name: string, values: string[]) => {
    setFormData((prev) => ({
      ...prev,
      [name]: values,
    }));
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
            shippingAddressCity: prev.billingAddressCity,
            shippingAddressState: prev.billingAddressState,
            shippingAddressPincode: prev.billingAddressPincode,
          }
          : {
            shippingAddressLine1: "",
            shippingAddressCity: "",
            shippingAddressState: "",
            shippingAddressPincode: "",
          }),
      }));

      setShippingResetKey((k) => k + 1);

      setErrors((prev) => ({
        ...prev,
        shippingAddressLine1: "",
        shippingAddressCity: "",
        shippingAddressState: "",
        shippingAddressPincode: "",
        sameAsBilling: "",
      }));

      return;
    }

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: value,
      };
      if (prev.sameAsBilling) {
        if (name === "billingAddressLine1") {
          updated.shippingAddressLine1 = value;
        } else if (name === "billingAddressPincode") {
          updated.shippingAddressPincode = value;
        }
      }
      return updated;
    });

    if (errors[name]) {
      setErrors((prev) => {
        const updatedErrors = { ...prev, [name]: "" };
        if (prev.sameAsBilling) {
          if (name === "billingAddressLine1") {
            updatedErrors.shippingAddressLine1 = "";
          } else if (name === "billingAddressPincode") {
            updatedErrors.shippingAddressPincode = "";
          }
        }
        return updatedErrors;
      });
    }
  };

  // Billing State/City handlers (passed to CityStateSelect)
  const handleStateChange = (stateData: StateCityOption) => {
    const gstCode = getGstStateCode(stateData.state_code || stateData.name);
    setFormData((prev) => ({
      ...prev,
      billingAddressState: stateData.name,
      billingAddressCity: "",
      stateCode: gstCode || prev.stateCode,
      ...(prev.sameAsBilling && {
        shippingAddressState: stateData.name,
        shippingAddressCity: "",
      }),
    }));
    setErrors((prev) => ({
      ...prev,
      billingAddressState: "",
      billingAddressCity: "",
      stateCode: "",
    }));
  };

  const handleCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({
      ...prev,
      billingAddressCity: cityData.name,
      ...(prev.sameAsBilling && {
        shippingAddressCity: cityData.name,
      }),
    }));
    setErrors((prev) => ({ ...prev, billingAddressCity: "" }));
  };

  // Shipping State/City handlers (passed to CityStateSelect)
  const handleShippingStateChange = (stateData: StateCityOption) => {
    setFormData((prev) => ({
      ...prev,
      shippingAddressState: stateData.name,
      shippingAddressCity: "",
    }));
    setErrors((prev) => ({
      ...prev,
      shippingAddressState: "",
      shippingAddressCity: "",
    }));
  };

  const handleShippingCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, shippingAddressCity: cityData.name }));
    setErrors((prev) => ({ ...prev, shippingAddressCity: "" }));
  };

  useEffect(() => {
    const fetchCode = async () => {
      try {
        const nextCode = await customerService.fetchNextCode();

        if (nextCode) {
          setFormData(prev => ({ ...prev, customerId: nextCode }));
        }
      } catch (err) {
        console.error("Error fetching next customer code:", err);
      }
    };
    fetchCode();
  }, []);

  // Keep shipping fields synced live while "Same as billing" is checked
  useEffect(() => {
    if (formData.sameAsBilling) {
      setFormData((prev) => ({
        ...prev,
        shippingAddressLine1: prev.billingAddressLine1,
        shippingAddressCity: prev.billingAddressCity,
        shippingAddressState: prev.billingAddressState,
        shippingAddressPincode: prev.billingAddressPincode,
      }));
    }
  }, [
    formData.billingAddressLine1,
    formData.billingAddressCity,
    formData.billingAddressState,
    formData.billingAddressPincode,
    formData.sameAsBilling,
  ]);

  const handleClear = () => {
    setFormData(initialFormData);
    setErrors({});
    setShippingResetKey((k) => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationData = {
      ...formData,
      billingState: formData.billingAddressState,
      billingCity: formData.billingAddressCity,
      billingPincode: formData.billingAddressPincode,
      shippingState: formData.shippingAddressState,
      shippingCity: formData.shippingAddressCity,
      shippingPincode: formData.shippingAddressPincode,
    };

    const validationErrors = validateCustomer(validationData);

    if (Object.keys(validationErrors).length > 0) {
      const mappedErrors: Record<string, string> = {};
      Object.keys(validationErrors).forEach((key) => {
        if (key === "billingState") mappedErrors.billingAddressState = validationErrors.billingState;
        else if (key === "billingCity") mappedErrors.billingAddressCity = validationErrors.billingCity;
        else if (key === "billingPincode") mappedErrors.billingAddressPincode = validationErrors.billingPincode;
        else if (key === "shippingState") mappedErrors.shippingAddressState = validationErrors.shippingState;
        else if (key === "shippingCity") mappedErrors.shippingAddressCity = validationErrors.shippingCity;
        else if (key === "shippingPincode") mappedErrors.shippingAddressPincode = validationErrors.shippingPincode;
        else mappedErrors[key] = validationErrors[key];
      });
      setErrors(mappedErrors);
      toast.error("Please fix the highlighted errors");
      return;
    }

    try {
      const activeBankAccounts = formData.bankAccounts.filter(
        (bank) =>
          bank.bankHolderName?.trim() ||
          bank.bankName?.trim() ||
          bank.accountNumber?.trim() ||
          bank.ifscCode?.trim() ||
          bank.branchName?.trim() ||
          bank.upiMobileNumber?.trim()
      );

      await addCustomer({
        customerCode: formData.customerId,
        firmName: formData.firmName,
        displayName: formData.displayName,
        customerType: formData.customerType,
        contactPerson: formData.contactPerson,
        designation: formData.designation,
        mobile: formData.mobile,
        altPhone: formData.altPhone,
        whatsapp: formData.whatsapp,
        email: formData.email,
        gstin: formData.gstin,
        //pan: formData.pan,
        //gstRegType: formData.gstRegType,
        stateCode: formData.stateCode,
        //tdsSection: formData.tdsSection,
        //tcsRate: Number(formData.tcsRate),
        billingAddressLine1: formData.billingAddressLine1,
        billingCity: formData.billingAddressCity,
        billingState: formData.billingAddressState,
        billingPincode: formData.billingAddressPincode,
        shippingAddressLine1: formData.shippingAddressLine1,
        shippingCity: formData.shippingAddressCity,
        shippingState: formData.shippingAddressState,
        shippingPincode: formData.shippingAddressPincode,
        creditLimit: Number(formData.creditLimit),
        creditDays: Number(formData.creditDays),
        bankAccount: activeBankAccounts.length > 0 ? activeBankAccounts : undefined,
        status: formData.isActive === "true" ? "Active" : "Inactive",
      });

      toast.success("Customer created successfully");
      navigate('/customers');
      setErrors({});
    } catch (error: any) {
      toast.error(error?.message || "Failed to create customer");
    }
  };

  return (
    <div className="inner-container">
      <Container fluid>
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Create Customer</h2>
                <div className="page-breadcrumb">Home / Customers / Create Customer</div>
              </div>
            </Col>
          </Row>
        </div>

        <form onSubmit={handleSubmit} className="form-inner">
          {/* Customer Info */}
          <Row className="mb-4">
            <Col lg={4} md={6}>
              <TextInput
                label="Customer code"
                name="customerId"
                value={formData.customerId}
                onChange={handleChange}
                disabled
              />
              {errors.customerId && <div className="text-danger mt-1">{errors.customerId}</div>}
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
              {errors.isActive && <div className="text-danger mt-1">{errors.isActive}</div>}
            </Col>
            <Col lg={4} md={6}>
              <TextInput
                label="Created by-on"
                name="createdByOn"
                value={formData.createdByOn}
                placeholder=""
                onChange={handleChange}
                disabled
              />
              {errors.createdByOn && <div className="text-danger mt-1">{errors.createdByOn}</div>}
            </Col>
          </Row>

          {/* Basic Info */}
          <Row className="mb-4">
            <h2 className="form-title"> Basic Information</h2>

            <Col lg={8} md={12}>
              <TextInput
                label="Firm / Legal Name"
                name="firmName"
                value={formData.firmName}
                placeholder="e.g. Murugan Plastics"
                required
                onChange={handleChange}
              />
              {errors.firmName && <div className="text-danger mt-1">{errors.firmName}</div>}
            </Col>

            <Col lg={4} md={12}>
              <TextInput
                label="Display Name"
                name="displayName"
                value={formData.displayName}
                placeholder="Murugan"
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
              />
              {errors.customerType && <div className="text-danger mt-1">{errors.customerType}</div>}
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Contact Person"
                name="contactPerson"
                value={formData.contactPerson}
                placeholder="Mr. S. Murugan"
                onChange={handleChange}
              />
              {errors.contactPerson && <div className="text-danger mt-1">{errors.contactPerson}</div>}
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Designation"
                name="designation"
                value={formData.designation}
                placeholder="Proprietor"
                onChange={handleChange}
              />
              {errors.designation && <div className="text-danger mt-1">{errors.designation}</div>}
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
                label="Alt-Phone"
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
                onChange={handleChange}
              //error={errors.email}
              />
              {errors.email && <div className="text-danger mt-1">{errors.email}</div>}
            </Col>
          </Row>

          <Row className="mb-4">
            <h2 className="form-title"> GST & Statutory</h2>

            <Col lg={4} md={6}>
              <TextInput
                label="GSTIN (15 CHAR)"
                name="gstin"
                value={formData.gstin}
                placeholder="33AABC1234D1Z5"
                onChange={handleChange}
              />
              {errors.gstin && <div className="text-danger mt-1">{errors.gstin}</div>}
            </Col>

            {/* <Col lg={4} md={6}>
              <TextInput
                label="PAN (AUTO FROM GSTIN)"
                name="pan"
                value={formData.pan}
                placeholder="AABCM1234F"
                onChange={handleChange}
              />
              {errors.pan && <div className="text-danger mt-1">{errors.pan}</div>}
            </Col> */}

            {/* <Col lg={4} md={6}>
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
              />
              {errors.gstRegType && <div className="text-danger mt-1">{errors.gstRegType}</div>}
            </Col> */}

            <Col lg={4} md={6}>
              <TextInput
                label="Place Of Supply (State Code)"
                name="stateCode"
                value={formData.stateCode}
                placeholder="33"
                onChange={handleChange}
              />
              {errors.stateCode && <div className="text-danger mt-1">{errors.stateCode}</div>}
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
              />
              {errors.tdsSection && <div className="text-danger mt-1">{errors.tdsSection}</div>}
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="TCS Rate %"
                name="tcsRate"
                type="number"
                value={formData.tcsRate}
                placeholder="0.10"
                onChange={handleChange}
              />
              {errors.tcsRate && <div className="text-danger mt-1">{errors.tcsRate}</div>}
            </Col> */}
          </Row>

          <Row className="mb-4">
            <h2 className="form-title"> Billing & Shipping Address</h2>

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
              />
              {errors.billingAddressLine1 && <div className="text-danger mt-1">{errors.billingAddressLine1}</div>}

              <Row>
                <CityStateSelect
                  stateValue={formData.billingAddressState}
                  cityValue={formData.billingAddressCity}
                  onStateChange={handleStateChange}
                  onCityChange={handleCityChange}
                  stateError={errors.billingAddressState}
                  cityError={errors.billingAddressCity}
                  required
                />

                <Col md={4}>
                  <TextInput
                    label="Pincode"
                    name="billingAddressPincode"
                    value={formData.billingAddressPincode}
                    onChange={handleChange}
                  />
                  {errors.billingAddressPincode && <div className="text-danger mt-1">{errors.billingAddressPincode}</div>}
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
                  />{" "}
                  Same as billing
                </div>
                {errors.sameAsBilling && <div className="text-danger mt-1">{errors.sameAsBilling}</div>}
              </div>

              <TextInput
                label="Address Line"
                name="shippingAddressLine1"
                value={formData.shippingAddressLine1}
                onChange={handleChange}
                disabled={formData.sameAsBilling}
              />
              {errors.shippingAddressLine1 && <div className="text-danger mt-1">{errors.shippingAddressLine1}</div>}

              <Row>
                <CityStateSelect
                  stateValue={formData.shippingAddressState}
                  cityValue={formData.shippingAddressCity}
                  onStateChange={handleShippingStateChange}
                  onCityChange={handleShippingCityChange}
                  stateError={errors.shippingAddressState}
                  cityError={errors.shippingAddressCity}
                  disabled={formData.sameAsBilling}
                  resetKey={shippingResetKey}
                />

                <Col md={4}>
                  <TextInput
                    label="Pincode"
                    name="shippingAddressPincode"
                    value={formData.shippingAddressPincode}
                    onChange={handleChange}
                    disabled={formData.sameAsBilling}
                  />
                  {errors.shippingAddressPincode && <div className="text-danger mt-1">{errors.shippingAddressPincode}</div>}
                </Col>
              </Row>
            </Col>
          </Row>

          <Row className="mb-4">
            <h2 className="form-title"> Commercial Settings</h2>

            <Col lg={4} md={6}>
              <TextInput
                label="Credit Limit ₹"
                name="creditLimit"
                type="number"
                value={formData.creditLimit}
                placeholder="300000"
                onChange={handleChange}
                preventNegative
                min={250000}
              />
              {errors.creditLimit && <div className="text-danger mt-1">{errors.creditLimit}</div>}
            </Col>

            <Col lg={4} md={6}>
              <TextInput
                label="Credit Days (Net)"
                name="creditDays"
                value={formData.creditDays}
                onChange={handleChange}
                type="number"
                placeholder="30 days"
                preventNegative
              />
              {errors.creditDays && <div className="text-danger mt-1">{errors.creditDays}</div>}
            </Col>
          </Row>

          {/* BANK DETAILS */}
          <Row className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="form-title mb-0">Bank Account Details</h2>
              <CustomButton text="Add another bank" onClick={addBankAccount} type="button" />
            </div>

            {formData.bankAccounts.map((bank, index) => (
              <div key={index} className="bank-account-block mb-4 p-3 border rounded">
                {formData.bankAccounts.length > 1 && (
                  <div className="d-flex justify-content-between mb-2">
                    <h6 className="mb-0">Bank #{index + 1}</h6>
                    <CustomButton text="Remove" onClick={() => removeBankAccount(index)} type="button" />
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
                      placeholder="9876543210"
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
              <div className="form-actions d-flex justify-content-end gap-3">
                <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} />
                <CustomButton text="Save Customer" icon={FaSave} type="submit" />
              </div>
            </Col>
          </Row>
        </form>
      </Container>
    </div>
  );
};

export default CustomerCreatePage;