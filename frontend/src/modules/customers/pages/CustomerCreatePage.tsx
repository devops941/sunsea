import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaArrowLeft, FaUser, FaInfoCircle, FaMapMarkerAlt, FaFileInvoiceDollar, FaBuilding } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
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
import IndiaPhoneInput, { type PhoneEntry } from "../../../components/ui/PhoneInput/PhoneInput";

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
  const [phones, setPhones] = useState<PhoneEntry[]>([]);

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
    supplyStateName: "",
    stateCode: "",

    billingAddressLine1: "",
    billingAddressCountry: "",
    billingAddressCity: "",
    billingAddressState: "",
    billingAddressPincode: "",

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

  const [addresses, setAddresses] = useState<any[]>([
    {
      address: {
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        pincode: "",
      }
    }
  ]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;

    // Checkboxes (native events only)
    if ('type' in e.target && e.target.type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const addShippingAddress = () => {
    setAddresses(prev => [
      ...prev,
      {
        address: {
          addressLine1: "",
          addressLine2: "",
          city: "",
          state: "",
          pincode: "",
        }
      }
    ]);
  };

  const removeShippingAddress = (index: number) => {
    setAddresses(prev => prev.filter((_, i) => i !== index));
  };

  const handleShippingAddressChange = (index: number, field: string, value: string) => {
    setAddresses(prev => {
      const newAddresses = [...prev];
      newAddresses[index] = {
        ...newAddresses[index],
        address: {
          ...newAddresses[index].address,
          [field]: value
        }
      };
      return newAddresses;
    });

    const errorKey = `addresses.${index}.address.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: "" }));
    }
  };

  const toggleSameAsBilling = (index: number, checked: boolean) => {
    if (checked) {
      setAddresses(prev => {
        const newAddresses = [...prev];
        newAddresses[index] = {
          ...newAddresses[index],
          address: {
            ...newAddresses[index].address,
            addressLine1: formData.billingAddressLine1,
            city: formData.billingAddressCity,
            state: formData.billingAddressState,
            pincode: formData.billingAddressPincode,
          }
        };
        return newAddresses;
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
    }));
    setErrors((prev) => ({ ...prev, billingAddressState: "", billingAddressCity: "", stateCode: "" }));
  };

  const handleCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({
      ...prev,
      billingAddressCity: cityData.name,
    }));
    setErrors((prev) => ({ ...prev, billingAddressCity: "" }));
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


  const handleClear = () => {
    setFormData(initialFormData);
    setErrors({});
    setShippingResetKey((k) => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationData = {
      ...formData,
      mobile: phones,
      billingState: formData.billingAddressState,
      billingCity: formData.billingAddressCity,
      billingPincode: formData.billingAddressPincode,
      addresses,
    };

    const validationErrors = validateCustomer(validationData);

    if (Object.keys(validationErrors).length > 0) {
      const mappedErrors: Record<string, string> = {};
      Object.keys(validationErrors).forEach((key) => {
        if (key === "billingState") mappedErrors.billingAddressState = validationErrors.billingState;
        else if (key === "billingCity") mappedErrors.billingAddressCity = validationErrors.billingCity;
        else if (key === "billingPincode") mappedErrors.billingAddressPincode = validationErrors.billingPincode;
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
        mobile: phones,
        email: formData.email,
        gstin: formData.gstin,
        stateCode: formData.stateCode,
        billingAddressLine1: formData.billingAddressLine1,
        billingCountry: formData.billingAddressCountry || "India",
        billingCity: formData.billingAddressCity,
        billingState: formData.billingAddressState,
        billingPincode: formData.billingAddressPincode,
        addresses: addresses.map(addr => addr.address),
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
    <div className="p-4 md:p-6 min-h-screen bg-white">
      <div className=" space-y-3">

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
                  <TextInput label="Customer code" name="customerId" value={formData.customerId} onChange={handleChange} disabled error={errors.customerId} />
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
                </div>
                <div>
                  <TextInput label="Created by-on" name="createdByOn" value={formData.createdByOn} placeholder="" onChange={handleChange} disabled error={errors.createdByOn} />
                </div>
              </div>
            </div>



            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

                <TextInput label="Firm / Legal Name" name="firmName" value={formData.firmName} placeholder="e.g. Murugan Plastics" required onChange={handleChange} error={errors.firmName} />

                <div>
                  {/* BUG-CUST-007 fix: error prop was incorrectly pointing to errors.customerType */}
                  <TextInput label="Display Name" name="displayName" value={formData.displayName} placeholder="Murugan" onChange={handleChange} error={errors.displayName} />
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
                </div>
                <div>
                  <TextInput label="Contact Person" name="contactPerson" value={formData.contactPerson} placeholder="Mr. S. Murugan" onChange={handleChange} error={errors.contactPerson} />
                </div>
                <div>
                  <TextInput label="Designation" name="designation" value={formData.designation} placeholder="Proprietor" onChange={handleChange} error={errors.designation} />
                </div>
                <div>
                  <IndiaPhoneInput
                    multi
                    label="Mobile Numbers"
                    name="phones"
                    value={phones}
                    onChange={(e) => {
                      setPhones(e.target.value);
                      if (errors.mobile) {
                        setErrors((prev) => ({ ...prev, mobile: "" }));
                      }
                    }}
                    maxNumbers={5}
                    error={errors.mobile}
                  />
                </div>
                <div>
                  <TextInput label="Email" name="email" type="email" value={formData.email} placeholder="x@y.com" onChange={handleChange} error={errors.email} />
                </div>
              </div>
            </div>



            {/* GST & Statutory */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">GST & Statutory</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <TextInput label="GSTIN (15 CHAR)" name="gstin" value={formData.gstin} placeholder="33AABC1234D1Z5" onChange={handleChange} error={errors.gstin} />
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

                    countryValue={formData.billingAddressCountry}
                    onCountryChange={(v) => {
                      setFormData(prev => ({
                        ...prev,
                        billingAddressCountry: v,
                        billingAddressState: "",
                        billingAddressCity: "",
                      }));
                      setErrors(prev => ({ ...prev, billingAddressCountry: "", billingAddressState: "", billingAddressCity: "" }));
                    }}
                    countryError={errors.billingAddressCountry}

                    stateValue={formData.billingAddressState}
                    onStateChange={(v) => {
                      const gstCode = getGstStateCode(v);
                      setFormData(prev => ({
                        ...prev, billingAddressState: v, billingAddressCity: "", stateCode: gstCode || prev.stateCode,
                      }));
                      setErrors(prev => ({ ...prev, billingAddressState: "", billingAddressCity: "", stateCode: "" }));
                    }}
                    stateError={errors.billingAddressState}

                    cityValue={formData.billingAddressCity}
                    onCityChange={(v) => {
                      setFormData(prev => ({ ...prev, billingAddressCity: v }));
                      setErrors(prev => ({ ...prev, billingAddressCity: "" }));
                    }}
                    cityError={errors.billingAddressCity}

                    pincodeValue={formData.billingAddressPincode}
                    onPincodeChange={(v) => handleChange({ target: { name: "billingAddressPincode", value: v } })}
                    pincodeError={errors.billingAddressPincode}
                    required
                  />
                </div>

                {/* Additional Addresses */}
                <div className="space-y-4 col-span-full mt-6">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-700">Additional Addresses</h5>
                    <button
                      type="button"
                      onClick={addShippingAddress}
                      className="text-sm px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 font-medium border border-blue-200 transition-colors"
                    >
                      + Add Address
                    </button>
                  </div>

                  {addresses.map((addr, index) => {
                    const isThisSameAsBilling = addr.address.addressLine1 === formData.billingAddressLine1 &&
                      addr.address.city === formData.billingAddressCity &&
                      addr.address.state === formData.billingAddressState &&
                      addr.address.pincode === formData.billingAddressPincode &&
                      !!formData.billingAddressLine1;

                    const isAnyAddressSameAsBilling = addresses.some(a =>
                      a.address.addressLine1 === formData.billingAddressLine1 &&
                      a.address.city === formData.billingAddressCity &&
                      a.address.state === formData.billingAddressState &&
                      a.address.pincode === formData.billingAddressPincode &&
                      !!formData.billingAddressLine1
                    );

                    const showSameAsBillingCheckbox = isThisSameAsBilling || !isAnyAddressSameAsBilling;

                    return (
                      <div key={index} className="p-4 border border-slate-200 rounded-md bg-slate-50 relative">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                          <h4 className="text-sm font-semibold text-slate-700 uppercase">Address {index + 1}</h4>

                          <div className="flex items-center gap-4">
                            {showSameAsBillingCheckbox && (
                              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  checked={isThisSameAsBilling}
                                  onChange={(e) => toggleSameAsBilling(index, e.target.checked)}
                                />
                                <span>Same as billing</span>
                              </label>
                            )}

                            {addresses.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeShippingAddress(index)}
                                className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 rounded"
                                title="Remove Address"
                              >
                                <span className="font-bold">Remove</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <AddressForm
                          addressValue={addr.address.addressLine1}
                          onAddressChange={(v) => handleShippingAddressChange(index, "addressLine1", v)}
                          addressError={errors[`addresses.${index}.address.addressLine1`]}

                          countryValue="India"

                          stateValue={addr.address.state}
                          onStateChange={(v) => {
                            handleShippingAddressChange(index, "state", v);
                            handleShippingAddressChange(index, "city", "");
                          }}
                          stateError={errors[`addresses.${index}.address.state`]}

                          cityValue={addr.address.city}
                          onCityChange={(v) => handleShippingAddressChange(index, "city", v)}
                          cityError={errors[`addresses.${index}.address.city`]}

                          pincodeValue={addr.address.pincode}
                          onPincodeChange={(v) => handleShippingAddressChange(index, "pincode", v)}
                          pincodeError={errors[`addresses.${index}.address.pincode`]}
                          required
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>



            {/* Commercial Settings */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Commercial Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <TextInput label="Credit Limit ₹" name="creditLimit" type="number" value={formData.creditLimit} placeholder="30000" onChange={handleChange} preventNegative min={25000} error={errors.creditLimit} />
                </div>
                <div>
                  <TextInput label="Credit Days (Net)" name="creditDays" value={formData.creditDays} onChange={handleChange} type="number" placeholder="30 days" preventNegative error={errors.creditDays} />
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
                  <div key={index} className="p-4 border border-slate-200 rounded-xl bg-white relative">
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