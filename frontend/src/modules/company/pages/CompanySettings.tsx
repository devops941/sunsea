import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FaSave, FaInfoCircle, FaMapMarkerAlt, FaPhoneAlt } from 'react-icons/fa';
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from 'react-redux';
import TextInput from "../../../components/form/TextInput/TextInput";
import ImageUpload from "../../../components/form/ImageUpload/ImageUpload";
import Button from "../../../components/ui/Button/Button";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import IndiaPhoneInput, { validatePhoneEntries } from "../../../components/ui/PhoneInput/PhoneInput";
import type { RootState, AppDispatch } from '../../../app/store';
import { usePermission } from "../../../hooks/usePermission";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import ThemeToggle from "../../../components/common/ThemeToggle";
import { fetchCompany, updateCompany } from '../../../features/company/companySlice';
import type { UpdateCompanyDto } from '../../../features/company/types';
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";

const CompanySettings: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { can } = usePermission();
  const canEdit = can("company-settings.edit");
  const { data: company, loading } = useSelector((state: RootState) => state.company);

  const [phones, setPhones] = useState<any[]>([]);
  const [originalPhones, setOriginalPhones] = useState<any[]>([]);

  const isEditMode = location.pathname.includes('edit') || location.pathname.includes('settings') || !!(company && company.isOnboarded);

  const [formData, setFormData] = useState<UpdateCompanyDto>({});
  const [originalFormData, setOriginalFormData] = useState<UpdateCompanyDto>({});
  const [errors, setErrors] = useState<any>({});
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const handleFormKeyDown = useFormKeyboardNav(formRef);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

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
      const phoneArr = Array.isArray(parsedPhones) ? parsedPhones : [];
      setPhones(phoneArr);
      setOriginalPhones(phoneArr);

      const initialData: UpdateCompanyDto = {
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
      };

      setFormData(initialData);
      setOriginalFormData(initialData);
    }
  }, [company]);

  // Auto-focus first input field when data is loaded
  useEffect(() => {
    if (company && !loading) {
      const timer = setTimeout(() => {
        const firstInput = formRef.current?.querySelector<HTMLElement>(
          'input[name="legalName"], input[data-nav]:not([disabled])'
        );
        firstInput?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [company, loading]);

  const isDirty = useMemo(() => {
    if (!originalFormData.legalName && !originalFormData.email) return false;
    const formKeys: (keyof UpdateCompanyDto)[] = [
      "legalName", "shortName", "gstin", "currencyCode", "phone",
      "email", "website", "addressLine1", "city", "state", "zipcode", "country"
    ];

    const fieldsChanged = formKeys.some(
      (k) => (formData[k] || "") !== (originalFormData[k] || "")
    );
    const phonesChanged = JSON.stringify(phones) !== JSON.stringify(originalPhones);
    const filesChanged = !!(formData as any).logoFile || !!(formData as any).faviconFile;

    return fieldsChanged || phonesChanged || filesChanged;
  }, [formData, originalFormData, phones, originalPhones]);

  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const saveConfirmOpenRef = useRef(saveConfirmOpen);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

  // Ref to remember blocker's proceed()/reset() from the current block-attempt
  // so the existing discard modal can drive them from its buttons.
  const proceedRef = useRef<(() => void) | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

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

  const validate = useCallback((): boolean => {
    const newErrors: any = {};
    if (!formData.companyCode?.trim()) newErrors.companyCode = "Company code is required";
    if (!formData.legalName?.trim()) newErrors.legalName = "Legal name is required";
    // if (!formData.email?.trim()) newErrors.email = "Email is required";
    if (!formData.addressLine1?.trim()) newErrors.addressLine1 = "Address Line 1 is required";
    if (!formData.city?.trim()) newErrors.city = "City is required";
    if (!formData.state?.trim()) newErrors.state = "State is required";
    if (!formData.zipcode?.trim()) newErrors.zipcode = "Zipcode is required";
    if (!formData.country?.trim()) newErrors.country = "Country is required";

    const phoneErr = validatePhoneEntries(phones, false);
    if (phoneErr) newErrors.mobile = phoneErr;

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const fieldOrder = ["legalName", "email", "addressLine1", "city", "state", "zipcode", "country", "mobile"];
      const firstError = fieldOrder.find((f) => newErrors[f]);
      if (firstError) {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${firstError}"]`);
        el?.focus();
      }
      return false;
    }
    return true;
  }, [formData, phones]);

  const submitForm = useCallback(async () => {
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
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.message || err || "Failed to update company");
    }
  }, [canEdit, validate, company, formData, phones, dispatch, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };

  const handleResume = useCallback(() => {
    setSaveConfirmOpen(false);
    if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); }
    setTimeout(() => {
      if (lastFocusedElementRef.current && typeof lastFocusedElementRef.current.focus === "function") {
        lastFocusedElementRef.current.focus();
      } else {
        const firstInput = formRef.current?.querySelector<HTMLElement>(
          'input[name="legalName"], input[data-nav]:not([disabled])'
        );
        firstInput?.focus();
      }
    }, 50);
  }, []);

  const handleDiscard = useCallback(() => {
    setSaveConfirmOpen(false);
    if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
    navigate(-1);
  }, [navigate]);

  const handleSaveFromModal = useCallback(() => {
    setSaveConfirmOpen(false);
    setTimeout(() => {
      if (!validate()) {
        toast.error("please fill all required fields.");
        return;
      }
      submitForm();
    }, 150);
  }, [validate, submitForm]);

  useDirtyNavGuard(isDirty, (proceed, reset) => {
    proceedRef.current = proceed;
    resetRef.current = reset;
    setSaveConfirmOpen(true);
  });

  // Global F2/F9 save shortcut
  useFormShortcuts({
    onSave: () => {
      if (!saveConfirmOpen) {
        submitForm();
      }
    },
  });

  // Ctrl+S shortcut support
  useEffect(() => {
    if (saveConfirmOpen) return;
    const handleCtrlS = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        submitForm();
      }
    };
    window.addEventListener("keydown", handleCtrlS, { capture: true });
    return () => window.removeEventListener("keydown", handleCtrlS, { capture: true });
  }, [saveConfirmOpen, submitForm]);

  // Esc key Discard confirmation
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-select-portal]")) return;

      e.preventDefault();
      e.stopPropagation();

      if (saveConfirmOpenRef.current) {
        handleResume();
      } else if (isDirtyRef.current) {
        lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
        setSaveConfirmOpen(true);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener("keydown", handleEsc, { capture: true });
    return () => window.removeEventListener("keydown", handleEsc, { capture: true });
  }, [handleResume, navigate]);

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
            <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
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
                      <div>
                        <TextInput label="Email Address" name="email" type="text" value={formData.email || ""} onChange={handleChange} placeholder="Enter Email"  />
                        {formData.email && formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) && (
                          <span className="text-[11px] text-amber-500 mt-1 block">
                            ⚠ Doesn't look like an email — save allowed, but check the value.
                          </span>
                        )}
                      </div>
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

        <CommonConfirmModal
          isOpen={saveConfirmOpen}
          onClose={handleResume}
          onCancel={handleDiscard}
          onConfirm={handleSaveFromModal}
          title="Discard Changes?"
          message="Are you sure you want to leave? Any unsaved company settings will be lost."
          warningText="Save to keep your changes, or Discard to leave."
          cancelText="Discard"
          cancelVariant="danger"
          confirmText="Save"
          confirmVariant="primary"
          confirmIcon={FaSave}
          isDangerous={false}
          defaultFocusCancel={false}
        />
      </div>
    );
  }

  // Normal Settings/Edit Screen Design
  return (
    <div className="max-w-[1024px] xl:mr-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
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
                  <div>
                    <TextInput label="Email" name="email" type="text" value={formData.email || ""} onChange={handleChange} placeholder="Enter Email" />
                    {formData.email && formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) && (
                      <span className="text-[11px] text-amber-500 mt-1 block">
                        ⚠ Doesn't look like an email — save allowed, but check the value.
                      </span>
                    )}
                  </div>
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

      <CommonConfirmModal
        isOpen={saveConfirmOpen}
        onClose={handleResume}
        onCancel={handleDiscard}
        onConfirm={handleSaveFromModal}
        title="Discard Changes?"
        message="Are you sure you want to leave? Any unsaved company settings will be lost."
        warningText="Save to keep your changes, or Discard to leave."
        cancelText="Discard"
        cancelVariant="danger"
        confirmText="Save"
        confirmVariant="primary"
        confirmIcon={FaSave}
        isDangerous={false}
        defaultFocusCancel={false}
      />
    </div>
  );
};

export default CompanySettings;