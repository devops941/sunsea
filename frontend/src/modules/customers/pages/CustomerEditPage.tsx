import React, { useState, useEffect } from "react";
import { FaSave, FaIdCard, FaArrowLeft, FaUser, FaMapMarkerAlt, FaFileInvoiceDollar, FaBuilding } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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

const getGstStateCode = (stateName: string): string => {
  const normalized = stateName.toLowerCase().replace(/[^a-z]/g, "");
  const mapping: Record<string, string> = {
    jammuandkashmir: "01", himachalpradesh: "02", punjab: "03", chandigarh: "04",
    uttarakhand: "05", haryana: "06", delhi: "07", rajasthan: "08",
    uttarpradesh: "09", bihar: "10", sikkim: "11", arunachalpradesh: "12",
    nagaland: "13", manipur: "14", mizoram: "15", tripura: "16", meghalaya: "17",
    assam: "18", westbengal: "19", jharkhand: "20", odisha: "21", chhattisgarh: "22",
    madhyapradesh: "23", gujarat: "24", damananddiu: "26", dadraandnagarhaveli: "26",
    maharashtra: "27", andhrapradesh: "37", karnataka: "29", goa: "30",
    lakshadweep: "31", kerala: "32", tamilnadu: "33", puducherry: "34",
    andamanandnicobarislands: "35", telangana: "36", ladakh: "38",
  };
  return mapping[normalized] || "";
};

const initialFormData = {
  customerId: "",
  isActive: "true",
  createdByOn: "",

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
  pan: "",
  gstRegType: "Regular",
  stateCode: "",

  tdsSection: "",
  tcsRate: "0",

  billingAddressLine1: "",
  billingCity: "",
  billingState: "",
  billingPincode: "",

  sameAsBilling: false,

  shippingAddressLine1: "",
  shippingCity: "",
  shippingState: "",
  shippingPincode: "",

  creditLimit: "0",
  creditDays: "0",
  priceList: "Standard",

  routeId: "",
  collectionAgentId: "",

  bankAccounts: [
    { bankHolderName: "", bankName: "", accountNumber: "", ifscCode: "", branchName: "", upiMobileNumber: "" },
  ],
};

type CustomerFormData = typeof initialFormData;

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
    createdByOn: customer.createdUser ? `${customer.createdUser.fullName} - ${new Date(customer.createdAt).toLocaleString()}` : "",

    firmName: customer.firmName || "",
    displayName: customer.displayName || "",
    customerType: typeof customer.customerType === "string" ? customer.customerType.split(",").filter(Boolean) : (Array.isArray(customer.customerType) ? customer.customerType : []),

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
        ? [{ bankHolderName: customer.bankAccount.bankHolderName || "", bankName: customer.bankAccount.bankName || "", accountNumber: customer.bankAccount.accountNumber || "", ifscCode: customer.bankAccount.ifscCode || "", branchName: customer.bankAccount.branchName || "", upiMobileNumber: customer.bankAccount.upiMobileNumber || "" }]
        : [{ bankHolderName: "", bankName: "", accountNumber: "", ifscCode: "", branchName: "", upiMobileNumber: "" }],
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
    if (location.state) setFormData(mapCustomerToFormData(location.state));

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
  }, [id]);

  const handleMultiSelectChange = (name: string, values: string[]) => {
    setFormData((prev) => ({ ...prev, [name]: values }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;

    if (name === "sameAsBilling") {
      const checked = (e.target as HTMLInputElement).checked;

      setFormData((prev) => ({
        ...prev,
        sameAsBilling: checked,
        ...(checked
          ? { shippingAddressLine1: prev.billingAddressLine1, shippingCity: prev.billingCity, shippingState: prev.billingState, shippingPincode: prev.billingPincode }
          : { shippingAddressLine1: "", shippingCity: "", shippingState: "", shippingPincode: "" }),
      }));
      setShippingResetKey((k) => k + 1);
      setErrors((prev) => ({ ...prev, shippingAddressLine1: "", shippingCity: "", shippingState: "", shippingPincode: "", sameAsBilling: "" }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleBillingStateChange = (stateData: StateCityOption) => {
    const gstCode = getGstStateCode(stateData.state_code || stateData.name);
    setFormData((prev) => ({ ...prev, billingState: stateData.name, billingCity: "", stateCode: gstCode || prev.stateCode }));
    setErrors((prev) => ({ ...prev, billingState: "", billingCity: "", stateCode: "" }));
  };

  const handleBillingCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, billingCity: cityData.name }));
    setErrors((prev) => ({ ...prev, billingCity: "" }));
  };

  const handleShippingStateChange = (stateData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, shippingState: stateData.name, shippingCity: "" }));
    setErrors((prev) => ({ ...prev, shippingState: "", shippingCity: "" }));
  };

  const handleShippingCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, shippingCity: cityData.name }));
    setErrors((prev) => ({ ...prev, shippingCity: "" }));
  };

  const handleBankChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updatedBanks = [...prev.bankAccounts];
      updatedBanks[index] = { ...updatedBanks[index], [name]: value };
      return { ...prev, bankAccounts: updatedBanks };
    });
    const errorKey = `bankAccounts.${index}.${name}`;
    if (errors[errorKey]) setErrors((prev) => ({ ...prev, [errorKey]: "" }));
  };

  const addBankAccount = () => {
    setFormData((prev) => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts, { bankHolderName: "", bankName: "", accountNumber: "", ifscCode: "", branchName: "", upiMobileNumber: "" }],
    }));
  };

  const removeBankAccount = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter((_, i) => i !== index),
    }));
  };

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
  }, [formData.sameAsBilling, formData.billingAddressLine1, formData.billingCity, formData.billingState, formData.billingPincode]);

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
      <div className="min-h-screen bg-white flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 min-h-screen bg-white">
      <div className=" space-y-3">

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">

          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Edit Customer</h2>
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
                  <TextInput label="Customer ID / Code" name="customerId" value={formData.customerId} onChange={handleChange} disabled />
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
                  <TextInput label="Created by-on" name="createdByOn" value={formData.createdByOn} onChange={handleChange} disabled />
                </div>
              </div>
            </div>



            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <TextInput label="Firm / Legal Name" name="firmName" value={formData.firmName} placeholder="e.g. Murugan Plastics" required error={errors.firmName} onChange={handleChange} />
                <div>
                  <TextInput label="Display Name" name="displayName" value={formData.displayName} placeholder="Murugan" error={errors.displayName} onChange={handleChange} />
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
                    error={errors.customerType}
                  />
                </div>
                <div>
                  <TextInput label="Contact Person" name="contactPerson" value={formData.contactPerson} placeholder="Mr. S. Murugan" error={errors.contactPerson} onChange={handleChange} />
                </div>
                <div>
                  <TextInput label="Designation" name="designation" value={formData.designation} placeholder="Proprietor" error={errors.designation} onChange={handleChange} />
                </div>
                <div>
                  <IndiaPhoneInput label="Mobile" name="mobile" value={formData.mobile} placeholder="98400 XXXXX" required onChange={handleChange} error={errors.mobile} />
                </div>
                <div>
                  {/* BUG-CUST-003 fix: altPhone is optional on the backend — removed required prop */}
                  <IndiaPhoneInput label="Alt. Phone" name="altPhone" value={formData.altPhone} placeholder="98400 XXXXX" onChange={handleChange} error={errors.altPhone} />
                </div>
                <div>
                  <IndiaPhoneInput label="WhatsApp #" name="whatsapp" value={formData.whatsapp} placeholder="98400 XXXXX" onChange={handleChange} error={errors.whatsapp} />
                </div>
                <div>
                  <TextInput label="Email" name="email" type="email" value={formData.email} placeholder="x@y.com" error={errors.email} onChange={handleChange} />
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
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Billing & Shipping Address</h3>
              <div className="grid grid-cols-1 gap-10">
                {/* Billing */}
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-700">Billing Address</h5>
                  <AddressForm
                    addressValue={formData.billingAddressLine1}
                    onAddressChange={(v) => handleChange({ target: { name: "billingAddressLine1", value: v } })}
                    addressError={errors.billingAddressLine1}

                    stateValue={formData.billingState}
                    onStateChange={(v) => {
                      const gstCode = getGstStateCode(v);
                      setFormData(prev => ({
                        ...prev, billingState: v, billingCity: "", stateCode: gstCode || prev.stateCode,
                        ...(prev.sameAsBilling && { shippingState: v, shippingCity: "" })
                      }));
                      setErrors(prev => ({ ...prev, billingState: "", billingCity: "", stateCode: "" }));
                    }}
                    stateError={errors.billingState}

                    cityValue={formData.billingCity}
                    onCityChange={(v) => {
                      setFormData(prev => ({ ...prev, billingCity: v, ...(prev.sameAsBilling && { shippingCity: v }) }));
                      setErrors(prev => ({ ...prev, billingCity: "" }));
                    }}
                    cityError={errors.billingCity}

                    pincodeValue={formData.billingPincode}
                    onPincodeChange={(v) => handleChange({ target: { name: "billingPincode", value: v } })}
                    pincodeError={errors.billingPincode}
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

                    stateValue={formData.shippingState}
                    onStateChange={(v) => {
                      setFormData(prev => ({ ...prev, shippingState: v, shippingCity: "" }));
                      setErrors(prev => ({ ...prev, shippingState: "", shippingCity: "" }));
                    }}
                    stateError={errors.shippingState}

                    cityValue={formData.shippingCity}
                    onCityChange={(v) => {
                      setFormData(prev => ({ ...prev, shippingCity: v }));
                      setErrors(prev => ({ ...prev, shippingCity: "" }));
                    }}
                    cityError={errors.shippingCity}

                    pincodeValue={formData.shippingPincode}
                    onPincodeChange={(v) => handleChange({ target: { name: "shippingPincode", value: v } })}
                    pincodeError={errors.shippingPincode}
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
                  <TextInput label="Credit Limit ₹" name="creditLimit" type="number" value={formData.creditLimit} placeholder="300000" onChange={handleChange} preventNegative min={250000} error={errors.creditLimit} />
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
                text="Cancel"
                icon={FaArrowLeft}
                onClick={() => navigate("/customers")}
                type="button"
                
              />
              <CustomButton text="Update Customer" icon={FaSave} type="submit" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerEditPage;
