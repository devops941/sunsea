import React, { useState, useEffect } from "react";
import { FaSave, FaInfoCircle, FaFileAlt, FaMapMarkerAlt, FaPhoneAlt, FaCogs } from 'react-icons/fa';
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from 'react-redux';
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import ImageUpload from "../../../components/form/ImageUpload/ImageUpload";
import Button from "../../../components/ui/Button/Button";
// import BackButton from "../../../components/ui/BackButton/BackButton";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";
import type { RootState, AppDispatch } from '../../../app/store';
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { fetchCompany, updateCompany } from '../../../features/company/companySlice';
import type { UpdateCompanyDto } from '../../../features/company/types';

const CompanySettings: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { data: company, loading } = useSelector((state: RootState) => state.company);
  
  const isEditMode = location.pathname.includes('edit') || location.pathname.includes('settings') || !!(company && company.isOnboarded);

  const [formData, setFormData] = useState<UpdateCompanyDto>({});
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    dispatch(fetchCompany());
  }, [dispatch]);

  useEffect(() => {
    if (company) {
      setFormData({
        companyCode: company.companyCode || `CMP-${Math.floor(10000 + Math.random() * 90000)}`,
        legalName: company.legalName || company.companyName || "",
        shortName: company.shortName || "",
        gstin: company.gstin || "",
        currencyCode: company.currencyCode || "INR",
        phone: company.phone || "",
        mobile: company.mobile || "",
        email: company.email || "",
        website: company.website || "",
        logoUrl: company.logoUrl || "",
        faviconUrl: company.faviconUrl || "",
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
        setFormData((prev) => ({ ...prev, [name]: file }));
        if (errors[name]) {
          setErrors((prev: any) => ({ ...prev, [name]: undefined }));
        }
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors((prev: any) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleStateChange = (stateData: any) => {
    setFormData((prev) => ({ ...prev, state: stateData.name, city: "" }));
    setErrors((prev: any) => ({ ...prev, state: undefined, city: undefined }));
  };

  const handleCityChange = (cityData: any) => {
    setFormData((prev) => ({ ...prev, city: cityData.name }));
    setErrors((prev: any) => ({ ...prev, city: undefined }));
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
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "logoFile") {
          if (value) {
            submitData.append("logo", value);
          }
        } else if (key === "faviconFile") {
          if (value) {
            submitData.append("favicon", value);
          }
        } else if (key === "businessPlaces") {
          submitData.append(key, JSON.stringify(value));
        } else if (value !== undefined && value !== null) {
          submitData.append(key, String(value));
        }
      });

      await dispatch(updateCompany({ id: company.id, data: submitData as any })).unwrap();
      toast.success(company.isOnboarded ? "Company updated successfully!" : "Onboarding completed successfully!");
      if (!company.isOnboarded) {
        navigate('/dashboard');
      } else {
        navigate('/company/view');
      }
    } catch (err: any) {
      toast.error(err?.message || err || "Failed to update company");
    }
  };

  if (loading && !company) return <CommonLoader text="Loading Company Settings..." fullScreen={false} />;

  // Onboarding Screen Design
  if (company && !company.isOnboarded) {
    return (
      <div className="fixed inset-0 z-9999 bg-gray-100 flex justify-center items-start overflow-y-auto min-h-screen py-10 px-4">
        <div className="w-full max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 pb-2">Welcome to Sunsea ERP</h2>
            <p className="text-gray-500">Please complete your company onboarding to get started.</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-8" noValidate>
              {/* General Info */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FaInfoCircle className="text-primary text-xl" />
                  <h6 className="text-lg font-semibold text-gray-800 m-0">General Info & Logo</h6>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <TextInput label="Legal Company Name" name="legalName" value={formData.legalName || ""} onChange={handleChange} placeholder="Enter Legal Name" required error={errors.legalName} />
                  </div>
                  <div>
                    <TextInput label="Company Code (Auto Generated)" name="companyCode" value={formData.companyCode || ""} onChange={handleChange} placeholder="Auto Generated" disabled error={errors.companyCode} />
                  </div>
                  <div>
                    <SelectInput label="Currency Code" name="currencyCode" value={formData.currencyCode || "INR"} onChange={handleChange as any} required disabled={isEditMode} options={[
                      { value: "INR", label: "INR - Indian Rupee" }
                    ]} />
                  </div>
                  <div className="md:col-span-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ImageUpload label="Company Logo" name="logoFile" currentImageUrl={formData.logoUrl || undefined} onChange={handleChange as any} />
                  <ImageUpload label="Favicon" name="faviconFile" currentImageUrl={formData.faviconUrl || undefined} onChange={handleChange as any} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Details */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FaFileAlt className="text-primary text-xl" />
                  <h6 className="text-lg font-semibold text-gray-800 m-0">Registration Details</h6>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <TextInput label="GSTIN" name="gstin" value={formData.gstin || ""} onChange={handleChange} placeholder="Enter GSTIN" />
                  </div>
                </div>
              </div>

              {/* Address Details */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FaMapMarkerAlt className="text-primary text-xl" />
                  <h6 className="text-lg font-semibold text-gray-800 m-0">Address Details</h6>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <TextInput label="Address Line 1" name="addressLine1" value={formData.addressLine1 || ""} onChange={handleChange} placeholder="Enter Address Line 1" required error={errors.addressLine1} />
                  </div>
                  <div>
                    <TextInput label="Address Line 2" name="addressLine2" value={formData.addressLine2 || ""} onChange={handleChange} placeholder="Enter Address Line 2" error={errors.addressLine2} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <div className="lg:col-span-2">
                    <CityStateSelect
                      stateLabel="State"
                      stateValue={formData.state || ""}
                      onStateChange={handleStateChange}
                      stateError={errors.state}
                      cityLabel="City"
                      cityValue={formData.city || ""}
                      onCityChange={handleCityChange}
                      cityError={errors.city}
                      required
                    />
                  </div>
                  <div>
                    <TextInput label="Zipcode" name="zipcode" value={formData.zipcode || ""} onChange={handleChange} placeholder="Enter Zipcode" required error={errors.zipcode} />
                  </div>
                  <div>
                    <TextInput label="Country" name="country" value={formData.country || ""} onChange={handleChange} placeholder="Enter Country" required error={errors.country} />
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FaPhoneAlt className="text-primary text-xl" />
                  <h6 className="text-lg font-semibold text-gray-800 m-0">Contact Details</h6>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <TextInput label="Email Address" name="email" type="email" value={formData.email || ""} onChange={handleChange} placeholder="Enter Email" required error={errors.email} />
                  </div>
                  <div>
                    <div className="mb-3 flex flex-col w-full group">
                      <label className={`flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-[0.5px] transition-colors duration-250 ${errors.phone ? 'text-red-500' : 'text-slate-500'} group-focus-within:text-primary`}>Phone Number <span className="text-[#e53935] ml-0.5">*</span></label>
                      <IndiaPhoneInput
                        name="phone"
                        value={formData.phone || ""}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, phone: e.target.value }));
                          if (errors.phone) setErrors((prev: any) => ({ ...prev, phone: undefined }));
                        }}
                        required={true}
                      />
                      {errors.phone && <div className="text-[#dc3545] text-sm font-medium mt-1">{errors.phone}</div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center mt-8 pt-4 border-t border-gray-200">
                <Button text="Complete Onboarding" icon={FaSave} type="submit" disabled={loading} className="py-3 px-8 text-lg" />
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Normal Settings/Edit Screen Design (Matches CreateOrder.tsx)
  return (
    <div className="w-full mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Page Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {isEditMode ? 'Edit Company Settings' : 'Create Company'}
              </h2>
            </div>

          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6" noValidate>
          {/* General Information */}
          <div>
            <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaInfoCircle className="text-gray-500 text-sm" /> General Information
            </h6>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <TextInput label="Legal Name" name="legalName" value={formData.legalName || ""} onChange={handleChange} placeholder="Enter Legal Name" required error={errors.legalName} />
              </div>
              <div>
                <TextInput label="Company Code" name="companyCode" value={formData.companyCode || ""} onChange={handleChange} placeholder="Auto Generated" disabled error={errors.companyCode} />
              </div>
              {/* <div>
                <TextInput label="Short Name" name="shortName" value={formData.shortName || ""} onChange={handleChange} placeholder="Enter Short Name" />
              </div> */}
              <div>
                <SelectInput label="Currency Code" name="currencyCode" value={formData.currencyCode || "INR"} onChange={handleChange as any} required disabled={isEditMode} options={[
                  { value: "INR", label: "INR - Indian Rupee" }
                ]} />
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div>
            <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaFileAlt className="text-gray-500 text-sm" /> Registration Details
            </h6>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <TextInput label="GSTIN" name="gstin" value={formData.gstin || ""} onChange={handleChange} placeholder="Enter GSTIN" />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaMapMarkerAlt className="text-gray-500 text-sm" /> Address Information
            </h6>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <TextInput label="Address Line 1" name="addressLine1" value={formData.addressLine1 || ""} onChange={handleChange} placeholder="Enter Address Line 1" required error={errors.addressLine1} />
              </div>
              <div>
                <TextInput label="Address Line 2" name="addressLine2" value={formData.addressLine2 || ""} onChange={handleChange} placeholder="Enter Address Line 2" error={errors.addressLine2} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <div className="lg:col-span-2">
                <CityStateSelect
                  stateLabel="State"
                  stateValue={formData.state || ""}
                  onStateChange={handleStateChange}
                  stateError={errors.state}
                  cityLabel="City"
                  cityValue={formData.city || ""}
                  onCityChange={handleCityChange}
                  cityError={errors.city}
                  disabled={isEditMode}
                  required  
                />
              </div>
              <div>
                <TextInput label="Zipcode" name="zipcode" value={formData.zipcode || ""} onChange={handleChange} placeholder="Enter Zipcode" required error={errors.zipcode} />
              </div>
              <div>
                <TextInput label="Country" name="country" value={formData.country || ""} onChange={handleChange} placeholder="Enter Country" required disabled={isEditMode} error={errors.country} />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaPhoneAlt className="text-gray-500 text-sm" /> Contact Information
            </h6>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <TextInput label="Email Address" name="email" type="email" value={formData.email || ""} onChange={handleChange} placeholder="Enter Email" required error={errors.email} />
              </div>
              <div>
                <IndiaPhoneInput
                  label="Phone Number"
                  name="phone"
                  value={formData.phone || ""}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, phone: e.target.value }));
                    if (errors.phone) setErrors((prev: any) => ({ ...prev, phone: undefined }));
                  }}
                  required={true}
                  error={errors.phone}
                />
              </div>
              {/* <div>
                <TextInput label="Mobile Number" name="mobile" value={formData.mobile || ""} onChange={handleChange} placeholder="Enter Mobile" />
              </div> */}
              <div className="md:col-span-3 lg:col-span-1">
                <TextInput label="Website" name="website" value={formData.website || ""} onChange={handleChange} placeholder="Enter Website (e.g. www.example.com)" />
              </div>
            </div>
          </div>

          {/* System Information */}
          <div>
            <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaCogs className="text-gray-500 text-sm" /> System Information
            </h6>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div className="md:col-span-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ImageUpload label="Company Logo" name="logoFile" currentImageUrl={formData.logoUrl || undefined} onChange={handleChange as any} />
                  <ImageUpload label="Favicon" name="faviconFile" currentImageUrl={formData.faviconUrl || undefined} onChange={handleChange as any} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer group/toggle">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      name="isActive"
                      checked={!!formData.isActive}
                      onChange={handleChange as any}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                    <span className="ml-3 text-sm font-bold text-gray-700">Active Company</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
            <Button text={isEditMode ? "Save Changes" : "Create Company"} icon={FaSave} type="submit" disabled={loading} />
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanySettings;
