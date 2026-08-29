import React, { useState, useEffect } from "react";
import { FaSave, FaInfoCircle, FaMapMarkerAlt, FaPhoneAlt } from 'react-icons/fa';
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from 'react-redux';
import TextInput from "../../../components/form/TextInput/TextInput";
import ImageUpload from "../../../components/form/ImageUpload/ImageUpload";
import Button from "../../../components/ui/Button/Button";
// import BackButton from "../../../components/ui/BackButton/BackButton";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";
import type { RootState, AppDispatch } from '../../../app/store';
import { usePermission } from "../../../hooks/usePermission";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import ThemeToggle from "../../../components/common/ThemeToggle";
import { fetchCompany, updateCompany } from '../../../features/company/companySlice';
import type { UpdateCompanyDto } from '../../../features/company/types';
import { validatePhoneEntries } from "../../../components/ui/PhoneInput/PhoneInput";

const CompanySettings: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { can } = usePermission();
  const canEdit = can("company-settings.edit");
  const { data: company, loading } = useSelector((state: RootState) => state.company);

  const [phones, setPhones] = useState<any[]>([]);

  const isEditMode = location.pathname.includes('edit') || location.pathname.includes('settings') || !!(company && company.isOnboarded);

  const [formData, setFormData] = useState<UpdateCompanyDto>({});
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    dispatch(fetchCompany());
  }, [dispatch]);

  useEffect(() => {
    if (company) {
      let parsedPhones = [];
      try {
        parsedPhones = company.mobile ? JSON.parse(company.mobile) : [];
      } catch {
        parsedPhones = [];
      }
      setPhones(Array.isArray(parsedPhones) ? parsedPhones : []);

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
        city: company.city || "",
        state: company.state || "",
        zipcode: company.zipcode || "",
        country: company.country || "India",
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

  const handleCountryChange = (countryData: any) => {
    setFormData((prev) => ({ ...prev, country: countryData.name, state: "", city: "" }));
    setErrors((prev: any) => ({ ...prev, country: undefined, state: undefined, city: undefined }));
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
    if (!formData.email?.trim()) newErrors.email = "Email is required";
    if (!formData.addressLine1?.trim()) newErrors.addressLine1 = "Address Line 1 is required";
    if (!formData.city?.trim()) newErrors.city = "City is required";
    if (!formData.state?.trim()) newErrors.state = "State is required";
    if (!formData.zipcode?.trim()) newErrors.zipcode = "Zipcode is required";
    if (!formData.country?.trim()) newErrors.country = "Country is required";

    const phoneErr = validatePhoneEntries(phones, false);
    if (phoneErr) newErrors.mobile = phoneErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error("You do not have permission to edit company settings.");
      return;
    }
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
        } else if (key === "mobile") {
          submitData.append(key, JSON.stringify(phones));
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
      <div className="fixed inset-0 z-9999 bg-page text-ink flex justify-center items-start overflow-y-auto min-h-screen py-10 px-4">
        <div className="absolute top-4 right-6 z-10">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-ink pb-2">Welcome to Sunsea ERP</h2>
            <p className="text-ink-muted">Please complete your company onboarding to get started.</p>
          </div>
          <div className="bg-card rounded-xl shadow-lg border border-line-soft">
            <form onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col lg:flex-row min-h-[calc(100vh-270px)]">

                {/* Left: All Input Fields — 70% */}
                <div className="lg:w-[70%] px-6 py-6 space-y-8">
                  {/* General Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <FaInfoCircle className="text-primary text-xl" />
                      <h6 className="text-lg font-semibold text-ink m-0">General Info</h6>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextInput label="Legal Company Name" name="legalName" value={formData.legalName || ""} onChange={handleChange} placeholder="Enter Legal Name" required error={errors.legalName} />
                      <TextInput label="GSTIN" name="gstin" value={formData.gstin || ""} onChange={handleChange} placeholder="Enter GSTIN" />
                    </div>
                    <div className="hidden">
                      <TextInput label="Company Code (Auto Generated)" name="companyCode" value={formData.companyCode || ""} onChange={handleChange} placeholder="Auto Generated" disabled error={errors.companyCode} />
                    </div>
                  </div>

                  {/* Address Details */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <FaMapMarkerAlt className="text-primary text-xl" />
                      <h6 className="text-lg font-semibold text-ink m-0">Address Details</h6>
                    </div>
                    <div className="space-y-4">
                      <TextInput label="Address" name="addressLine1" value={formData.addressLine1 || ""} onChange={handleChange} placeholder="Enter full address" required error={errors.addressLine1} />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <CityStateSelect
                              countryLabel="Country"
                              countryValue={formData.country || "India"}
                              onCountryChange={handleCountryChange}
                              countryError={errors.country}
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
                        </div>
                        <TextInput label="Zipcode" name="zipcode" value={formData.zipcode || ""} onChange={handleChange} placeholder="Enter Zipcode" required error={errors.zipcode} />
                      </div>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <FaPhoneAlt className="text-primary text-xl" />
                      <h6 className="text-lg font-semibold text-ink m-0">Contact Details</h6>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextInput label="Email Address" name="email" type="email" value={formData.email || ""} onChange={handleChange} placeholder="Enter Email" required error={errors.email} />
                      <IndiaPhoneInput
                        multi
                        label="Mobile Numbers"
                        name="phones"
                        value={phones}
                        onChange={(e: any) => {
                          setPhones(e.target.value);
                          if (errors.mobile) {
                            setErrors((prev: any) => ({ ...prev, mobile: undefined }));
                          }
                        }}
                        maxNumbers={5}
                        error={errors.mobile}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Image Uploads — 30% */}
                <div className="lg:w-[30%] lg:border-l border-t lg:border-t-0 border-line-soft/50 px-6 py-6 flex lg:flex-col items-center justify-evenly">
                  <ImageUpload label="Company Logo" name="logoFile" currentImageUrl={formData.logoUrl || undefined} onChange={handleChange as any} />
                  <ImageUpload label="Favicon" name="faviconFile" currentImageUrl={formData.faviconUrl || undefined} onChange={handleChange as any} />
                </div>

              </div>

              <div className="flex justify-end px-6 py-5 border-t border-line-soft">
                <Button text="Complete Onboarding" icon={FaSave} type="submit" disabled={loading} className="py-3 px-8 text-lg" />
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Normal Settings/Edit Screen Design
  return (
    <div className="max-w-[1024px] xl:mr-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col lg:flex-row">

            {/* Left: All Input Fields — 70% */}
            <div className="lg:w-[70%] px-6 py-6 space-y-6">
              {/* General Info */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FaInfoCircle className="text-primary text-lg" />
                  <h6 className="text-sm font-bold text-ink m-0">General Info</h6>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput label="Legal Name" name="legalName" value={formData.legalName || ""} onChange={handleChange} placeholder="Enter Legal Name" required error={errors.legalName} />
                  <TextInput label="Email" name="email" type="email" value={formData.email || ""} onChange={handleChange} placeholder="Enter Email" required error={errors.email} />
                  <TextInput label="GSTIN" name="gstin" value={formData.gstin || ""} onChange={handleChange} placeholder="Enter GSTIN" />
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FaPhoneAlt className="text-primary text-lg" />
                  <h6 className="text-sm font-bold text-ink m-0">Contact Details</h6>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput label="Website" name="website" value={formData.website || ""} onChange={handleChange} placeholder="http://www.example.com" />
                  <IndiaPhoneInput
                    multi
                    label="Mobile Numbers"
                    name="phones"
                    value={phones}
                    onChange={(e: any) => {
                      setPhones(e.target.value);
                      if (errors.mobile) {
                        setErrors((prev: any) => ({ ...prev, mobile: undefined }));
                      }
                    }}
                    maxNumbers={5}
                    error={errors.mobile}
                  />
                </div>
              </div>

              {/* Address Details */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FaMapMarkerAlt className="text-primary text-lg" />
                  <h6 className="text-sm font-bold text-ink m-0">Address Details</h6>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput label="Street Address" name="addressLine1" value={formData.addressLine1 || ""} onChange={handleChange} placeholder="Building, street, area" required error={errors.addressLine1} />
                  <CityStateSelect
                    countryLabel=""
                    countryValue={formData.country || "India"}
                    onCountryChange={handleCountryChange}
                    countryError={errors.country}
                    stateLabel=""
                    stateValue={formData.state || ""}
                    onStateChange={handleStateChange}
                    stateError={errors.state}
                    cityLabel="City"
                    cityValue={formData.city || ""}
                    onCityChange={handleCityChange}
                    cityError={errors.city}
                    required
                    renderOnly="city"
                  />
                  <CityStateSelect
                    countryLabel="Country"
                    countryValue={formData.country || "India"}
                    onCountryChange={handleCountryChange}
                    countryError={errors.country}
                    stateLabel="State"
                    stateValue={formData.state || ""}
                    onStateChange={handleStateChange}
                    stateError={errors.state}
                    cityLabel=""
                    cityValue={formData.city || ""}
                    onCityChange={handleCityChange}
                    cityError={errors.city}
                    required
                    renderOnly="state-country"
                  />
                  <TextInput label="Zipcode" name="zipcode" value={formData.zipcode || ""} onChange={handleChange} placeholder="Zipcode" required error={errors.zipcode} />
                </div>
              </div>
            </div>

            {/* Right: Image Uploads — 30% */}
            <div className="lg:w-[30%] lg:border-l border-t lg:border-t-0 border-line/50 px-6 py-6 flex lg:flex-col items-center justify-evenly gap-6">
              <ImageUpload label="Company Logo" name="logoFile" hint="PNG or SVG · min 256×256px" currentImageUrl={formData.logoUrl || undefined} onChange={handleChange as any} />
              <ImageUpload label="Favicon" name="faviconFile" hint="PNG · min 64×64px" currentImageUrl={formData.faviconUrl || undefined} onChange={handleChange as any} />
            </div>

          </div>

          <div className="hidden">
            <TextInput label="Company Code" name="companyCode" value={formData.companyCode || ""} onChange={handleChange} placeholder="Auto Generated" disabled error={errors.companyCode} />
          </div>

          {/* Footer */}
          {canEdit && (
            <div className="flex justify-end px-6 py-4 border-t border-line">
              <Button text={isEditMode ? "Save Changes" : "Create Company"} icon={FaSave} type="submit" disabled={loading} />
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default CompanySettings;