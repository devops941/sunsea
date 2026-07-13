import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaArrowLeft, FaUser, FaInfoCircle, FaMapMarkerAlt, FaFileInvoiceDollar, FaBuilding } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../components/ui/CityStateSelect/CityStateSelect";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import AddressForm from "../../../components/form/AddressFrom/AddressFrom";
import { useCustomers } from "../../../hooks/useCustomers";
import { customerService } from "../../../services/customerService";
import { useSelector } from "react-redux";
import { validateCustomer } from "../validations/customerValidation";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";

const getGstStateCode = (stateNameOrCode: string): string => {
  const normalized = stateNameOrCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  const mapping: Record<string, string> = {
    jk: "01", hp: "02", pb: "03", ch: "04", ut: "05", hr: "06", dl: "07",
    rj: "08", up: "09", br: "10", sk: "11", ar: "12", nl: "13", mn: "14",
    mz: "15", tr: "16", ml: "17", as: "18", wb: "19", jh: "20", or: "21",
    od: "21", ct: "22", cg: "22", mp: "23", gj: "24", dd: "26", dn: "26",
    mh: "27", ap: "37", ka: "29", ga: "30", ld: "31", kl: "32", tn: "33",
    py: "34", an: "35", tg: "36", ts: "36", la: "38", jammuandkashmir: "01",
    himachalpradesh: "02", punjab: "03", chandigarh: "04", uttarakhand: "05",
    haryana: "06", delhi: "07", rajasthan: "08", uttarpradesh: "09", bihar: "10",
    sikkim: "11", arunachalpradesh: "12", nagaland: "13", manipur: "14", mizoram: "15",
    tripura: "16", meghalaya: "17", assam: "18", westbengal: "19", jharkhand: "20",
    odisha: "21", chhattisgarh: "22", madhyapradesh: "23", gujarat: "24", damananddiu: "26",
    dadraandnagarhaveli: "26", maharashtra: "27", andhrapradesh: "37", karnataka: "29",
    goa: "30", lakshadweep: "31", kerala: "32", tamilnadu: "33", puducherry: "34",
    andamanandnicobarislands: "35", telangana: "36", ladakh: "38",
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
    stateCode: "",

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
  }, [formData.gstin]);

  const handleBankChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updatedBanks = [...prev.bankAccounts];
      updatedBanks[index] = { ...updatedBanks[index], [name]: value };
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
        { bankHolderName: "", bankName: "", accountNumber: "", ifscCode: "", branchName: "", upiMobileNumber: "" },
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
    setFormData((prev) => ({ ...prev, [name]: values }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) => {
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
      setErrors((prev) => ({ ...prev, shippingAddressLine1: "", shippingAddressCity: "", shippingAddressState: "", shippingAddressPincode: "", sameAsBilling: "" }));
      return;
    }

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (prev.sameAsBilling) {
        if (name === "billingAddressLine1") updated.shippingAddressLine1 = value;
        else if (name === "billingAddressPincode") updated.shippingAddressPincode = value;
      }
      return updated;
    });

    if (errors[name]) {
      setErrors((prev) => {
        const updatedErrors = { ...prev, [name]: "" };
        if (prev.sameAsBilling) {
          if (name === "billingAddressLine1") updatedErrors.shippingAddressLine1 = "";
          else if (name === "billingAddressPincode") updatedErrors.shippingAddressPincode = "";
        }
        return updatedErrors;
      });
    }
  };

  const handleStateChange = (stateData: StateCityOption) => {
    const gstCode = getGstStateCode(stateData.state_code || stateData.name);
    setFormData((prev) => ({
      ...prev,
      billingAddressState: stateData.name,
      billingAddressCity: "",
      stateCode: gstCode || prev.stateCode,
      ...(prev.sameAsBilling && { shippingAddressState: stateData.name, shippingAddressCity: "" }),
    }));
    setErrors((prev) => ({ ...prev, billingAddressState: "", billingAddressCity: "", stateCode: "" }));
  };

  const handleCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({
      ...prev,
      billingAddressCity: cityData.name,
      ...(prev.sameAsBilling && { shippingAddressCity: cityData.name }),
    }));
    setErrors((prev) => ({ ...prev, billingAddressCity: "" }));
  };

  const handleShippingStateChange = (stateData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, shippingAddressState: stateData.name, shippingAddressCity: "" }));
    setErrors((prev) => ({ ...prev, shippingAddressState: "", shippingAddressCity: "" }));
  };

  const handleShippingCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, shippingAddressCity: cityData.name }));
    setErrors((prev) => ({ ...prev, shippingAddressCity: "" }));
  };

  useEffect(() => {
    const fetchCode = async () => {
      try {
        const nextCode = await customerService.fetchNextCode();
        if (nextCode) setFormData(prev => ({ ...prev, customerId: nextCode }));
      } catch (err) {
        console.error("Error fetching next customer code:", err);
      }
    };
    fetchCode();
  }, []);

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
  }, [formData.billingAddressLine1, formData.billingAddressCity, formData.billingAddressState, formData.billingAddressPincode, formData.sameAsBilling]);

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
        (bank) => bank.bankHolderName?.trim() || bank.bankName?.trim() || bank.accountNumber?.trim() || bank.ifscCode?.trim() || bank.branchName?.trim() || bank.upiMobileNumber?.trim()
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
        stateCode: formData.stateCode,
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
    <div className="p-4 md:p-6 min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-3">

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">

          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Create Customer</h2>
            <CustomButton
              text="Back"
              icon={FaArrowLeft}
              onClick={() => navigate("/customers")}

            />
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Identification & Status */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Identification & Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <TextInput label="Customer code" name="customerId" value={formData.customerId} onChange={handleChange} disabled />
                  {errors.customerId && <div className="text-red-500 mt-1 text-sm">{errors.customerId}</div>}
                </div>
                <div>
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
                  {errors.isActive && <div className="text-red-500 mt-1 text-sm">{errors.isActive}</div>}
                </div>
                <div>
                  <TextInput label="Created by-on" name="createdByOn" value={formData.createdByOn} placeholder="" onChange={handleChange} disabled />
                  {errors.createdByOn && <div className="text-red-500 mt-1 text-sm">{errors.createdByOn}</div>}
                </div>
              </div>
            </div>



            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

                <TextInput label="Firm / Legal Name" name="firmName" value={formData.firmName} placeholder="e.g. Murugan Plastics" required onChange={handleChange} />
                {errors.firmName && <div className="text-red-500 mt-1 text-sm">{errors.firmName}</div>}

                <div>
                  <TextInput label="Display Name" name="displayName" value={formData.displayName} placeholder="Murugan" onChange={handleChange} />
                </div>
                <div>
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
                  {errors.customerType && <div className="text-red-500 mt-1 text-sm">{errors.customerType}</div>}
                </div>
                <div>
                  <TextInput label="Contact Person" name="contactPerson" value={formData.contactPerson} placeholder="Mr. S. Murugan" onChange={handleChange} />
                  {errors.contactPerson && <div className="text-red-500 mt-1 text-sm">{errors.contactPerson}</div>}
                </div>
                <div>
                  <TextInput label="Designation" name="designation" value={formData.designation} placeholder="Proprietor" onChange={handleChange} />
                  {errors.designation && <div className="text-red-500 mt-1 text-sm">{errors.designation}</div>}
                </div>
                <div>
                  <IndiaPhoneInput label="Mobile" name="mobile" value={formData.mobile} placeholder="98400 XXXXX" required onChange={handleChange} error={errors.mobile} />
                </div>
                <div>
                  <IndiaPhoneInput label="Alt-Phone" name="altPhone" value={formData.altPhone} placeholder="98400 XXXXX" required onChange={handleChange} error={errors.altPhone} />
                </div>
                <div>
                  <IndiaPhoneInput label="WhatsApp #" name="whatsapp" value={formData.whatsapp} placeholder="98400 XXXXX" onChange={handleChange} error={errors.whatsapp} />
                </div>
                <div>
                  <TextInput label="Email" name="email" type="email" value={formData.email} placeholder="x@y.com" onChange={handleChange} />
                  {errors.email && <div className="text-red-500 mt-1 text-sm">{errors.email}</div>}
                </div>
              </div>
            </div>



            {/* GST & Statutory */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">GST & Statutory</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <TextInput label="GSTIN (15 CHAR)" name="gstin" value={formData.gstin} placeholder="33AABC1234D1Z5" onChange={handleChange} />
                  {errors.gstin && <div className="text-red-500 mt-1 text-sm">{errors.gstin}</div>}
                </div>
                <div>
                  <TextInput label="Place Of Supply (State Code)" name="stateCode" value={formData.stateCode} placeholder="33" onChange={handleChange} />
                  {errors.stateCode && <div className="text-red-500 mt-1 text-sm">{errors.stateCode}</div>}
                </div>
              </div>
            </div>



            {/* Billing & Shipping Address */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-4">Billing & Shipping Address</h3>
              <div className="grid grid-cols-1 gap-10">
                {/* Billing */}
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-700">Billing Address</h5>
                  <AddressForm
                    addressValue={formData.billingAddressLine1}
                    onAddressChange={(v) => handleChange({ target: { name: "billingAddressLine1", value: v } })}
                    addressError={errors.billingAddressLine1}

                    stateValue={formData.billingAddressState}
                    onStateChange={(v) => {
                      const gstCode = getGstStateCode(v);
                      setFormData(prev => ({
                        ...prev, billingAddressState: v, billingAddressCity: "", stateCode: gstCode || prev.stateCode,
                        ...(prev.sameAsBilling && { shippingAddressState: v, shippingAddressCity: "" })
                      }));
                      setErrors(prev => ({ ...prev, billingAddressState: "", billingAddressCity: "", stateCode: "" }));
                    }}
                    stateError={errors.billingAddressState}

                    cityValue={formData.billingAddressCity}
                    onCityChange={(v) => {
                      setFormData(prev => ({ ...prev, billingAddressCity: v, ...(prev.sameAsBilling && { shippingAddressCity: v }) }));
                      setErrors(prev => ({ ...prev, billingAddressCity: "" }));
                    }}
                    cityError={errors.billingAddressCity}

                    pincodeValue={formData.billingAddressPincode}
                    onPincodeChange={(v) => handleChange({ target: { name: "billingAddressPincode", value: v } })}
                    pincodeError={errors.billingAddressPincode}
                    required
                  />
                </div>

                {/* Shipping */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-700">Shipping Address</h5>
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        name="sameAsBilling"
                        checked={formData.sameAsBilling}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      Same as billing
                    </label>
                  </div>
                  {errors.sameAsBilling && <div className="text-red-500 mt-1 text-sm">{errors.sameAsBilling}</div>}

                  <AddressForm
                    addressValue={formData.shippingAddressLine1}
                    onAddressChange={(v) => handleChange({ target: { name: "shippingAddressLine1", value: v } })}
                    addressError={errors.shippingAddressLine1}

                    stateValue={formData.shippingAddressState}
                    onStateChange={(v) => {
                      setFormData(prev => ({ ...prev, shippingAddressState: v, shippingAddressCity: "" }));
                      setErrors(prev => ({ ...prev, shippingAddressState: "", shippingAddressCity: "" }));
                    }}
                    stateError={errors.shippingAddressState}

                    cityValue={formData.shippingAddressCity}
                    onCityChange={(v) => {
                      setFormData(prev => ({ ...prev, shippingAddressCity: v }));
                      setErrors(prev => ({ ...prev, shippingAddressCity: "" }));
                    }}
                    cityError={errors.shippingAddressCity}

                    pincodeValue={formData.shippingAddressPincode}
                    onPincodeChange={(v) => handleChange({ target: { name: "shippingAddressPincode", value: v } })}
                    pincodeError={errors.shippingAddressPincode}
                    disabled={formData.sameAsBilling}
                    resetKey={shippingResetKey}
                  />
                </div>
              </div>
            </div>



            {/* Commercial Settings */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Commercial Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <TextInput label="Credit Limit ₹" name="creditLimit" type="number" value={formData.creditLimit} placeholder="300000" onChange={handleChange} preventNegative min={250000} />
                  {errors.creditLimit && <div className="text-red-500 mt-1 text-sm">{errors.creditLimit}</div>}
                </div>
                <div>
                  <TextInput label="Credit Days (Net)" name="creditDays" value={formData.creditDays} onChange={handleChange} type="number" placeholder="30 days" preventNegative />
                  {errors.creditDays && <div className="text-red-500 mt-1 text-sm">{errors.creditDays}</div>}
                </div>
              </div>
            </div>



            {/* BANK DETAILS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-slate-700">Bank Account Details</h3>
                <CustomButton text="Add Bank Account" onClick={addBankAccount} type="button" />
              </div>

              <div className="space-y-6">
                {formData.bankAccounts.map((bank, index) => (
                  <div key={index} className="p-4 border border-slate-200 rounded-xl bg-slate-50 relative">
                    {formData.bankAccounts.length > 1 && (
                      <div className="absolute top-4 right-4">
                        <button
                          type="button"
                          onClick={() => removeBankAccount(index)}
                          className="text-red-500 hover:text-red-700 text-sm font-semibold transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <h6 className="font-bold text-slate-600 mb-2">Bank #{index + 1}</h6>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <TextInput label="Account Holder Name" name="bankHolderName" value={bank.bankHolderName} onChange={(e) => handleBankChange(index, e)} error={errors[`bankAccounts.${index}.bankHolderName`]} />
                      </div>
                      <div>
                        <TextInput label="Bank Name" name="bankName" value={bank.bankName} onChange={(e) => handleBankChange(index, e)} error={errors[`bankAccounts.${index}.bankName`]} />
                      </div>
                      <div>
                        <TextInput label="Account Number" name="accountNumber" value={bank.accountNumber} onChange={(e) => handleBankChange(index, e)} error={errors[`bankAccounts.${index}.accountNumber`]} />
                      </div>
                      <div>
                        <TextInput label="IFSC Code" name="ifscCode" value={bank.ifscCode} onChange={(e) => handleBankChange(index, e)} error={errors[`bankAccounts.${index}.ifscCode`]} />
                      </div>
                      <div>
                        <TextInput label="Branch Name" name="branchName" value={bank.branchName} onChange={(e) => handleBankChange(index, e)} error={errors[`bankAccounts.${index}.branchName`]} />
                      </div>
                      <div>
                        <IndiaPhoneInput label="GPay / PhonePe Number" name="upiMobileNumber" value={bank.upiMobileNumber} placeholder="9876543210" onChange={(e) => handleBankChange(index, e as React.ChangeEvent<HTMLInputElement>)} error={errors[`bankAccounts.${index}.upiMobileNumber`]} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
              <CustomButton
                text="Clear Form"
                icon={FaEraser}
                onClick={handleClear}
                type="button"

              />
              <CustomButton text="Save Customer" icon={FaSave} type="submit" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerCreatePage;