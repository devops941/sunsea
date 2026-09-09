import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaArrowLeft, FaPlus, FaCheck } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import AddressForm from "../../../components/form/AddressFrom/AddressFrom";
import { useCustomers } from "../../../hooks/useCustomers";
import { customerService } from "../../../services/customerService";
import IndiaPhoneInput, { validatePhoneNumber, SinglePhoneField } from "../../../components/ui/PhoneInput/PhoneInput";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import { useCustomerTypes } from "../../../hooks/useCustomerTypes";
import { useCustomerGrades } from "../../../hooks/useCustomerGrades";
import CreatableSelectInput from "../../../components/form/CreatableSelectInput/CreatableSelectInput";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";

const addressSchema = z.object({
  addressLine1: z.string(),
  addressLine2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
});

const customerFormSchema = z.object({
  customerId: z.string().min(1, "Customer Code is required"),
  isActive: z.string().min(1, "Status is required"),
  firmName: z.string().min(3, "Firm Name must be at least 3 characters"),
  displayName: z.string().min(3, "Display Name must be at least 3 characters"),
  customerTypeId: z.number({ message: "Customer Type is required" }).nullable(),
  customerGradeId: z.number({ message: "Customer Grade is required" }).nullable(),
  phones: z.any().optional().nullable(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/, "Invalid GSTIN format").optional().or(z.literal("")),
  openingBalance: z.string().min(1, "Opening Balance is required"),
  openingBalanceType: z.string().min(1, "Opening Balance Type is required"),
  creditLimit: z.string().optional().default("0"),
  creditDays: z.string().optional(),

  transports: z.array(z.object({
    name: z.string().min(1, "Transport name is required"),
    address: z.string().optional(),
    phone: z.string().optional(),
  })),

  addresses: z.array(z.object({ address: addressSchema })),
});

// Use the schema's input type because zod defaults/transformations can make
// the resolver output stricter than the values accepted by react-hook-form.
type CustomerFormValues = z.input<typeof customerFormSchema>;

const initialFormData: CustomerFormValues = {
  customerId: "",
  isActive: "true",
  firmName: "",
  displayName: "",
  customerTypeId: null,
  customerGradeId: null,
  phones: [],
  email: "",
  gstin: "",
  creditLimit: "",
  creditDays: "",
  openingBalance: "",
  openingBalanceType: "DEBIT",
  transports: [],
  addresses: [{ address: { addressLine1: "", addressLine2: "", city: "", state: "Tamil Nadu", pincode: "" } }]
};

const mapCustomerToFormData = (customer: any): CustomerFormValues => {
  let initialPhones = [];
  if (Array.isArray(customer.mobile) && customer.mobile.length > 0) {
    initialPhones = customer.mobile;
  } else if (customer.phones && Array.isArray(customer.phones) && customer.phones.length > 0) {
    initialPhones = customer.phones;
  } else if (typeof customer.mobile === "string" && customer.mobile) {
    initialPhones = [{ label: "Primary Mobile Number", number: customer.mobile }];
  }

  let addrs = customer.addresses && customer.addresses.length > 0 ? customer.addresses.map((a: any) => ({ address: a.address || a })) : [];

  return {
    customerId: customer.customerCode || "",
    isActive: customer.status === "Active" ? "true" : "false",
    firmName: customer.firmName || "",
    displayName: customer.displayName || "",
    customerTypeId: customer.customerTypeId || null,
    customerGradeId: customer.customerGradeId || null,
    phones: initialPhones,
    email: customer.email || "",
    gstin: customer.gstin || "",
    creditLimit: customer.creditLimit != null ? String(customer.creditLimit) : "",
    creditDays: customer.creditDays != null ? String(customer.creditDays) : "",
    openingBalance: customer.openingBalance != null ? String(customer.openingBalance) : "0",
    openingBalanceType: customer.openingBalanceType || "DEBIT",
    transports: Array.isArray(customer.transports) ? customer.transports : [],
    addresses: addrs.length > 0 ? addrs : initialFormData.addresses,
  };
};

const CtrlText = ({ field, label, placeholder, required, type, disabled, error, preventNegative }: any) => (
  <TextInput
    label={label}
    name={field.name}
    value={field.value ?? ""}
    onChange={field.onChange}
    onBlur={field.onBlur}
    placeholder={placeholder}
    required={required}
    type={type}
    disabled={disabled}
    error={error}
    preventNegative={preventNegative}
  />
);


const CustomerFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isEditMode = !!id;

  const { addCustomer, editCustomer } = useCustomers();

  const [loading, setLoading] = useState(isEditMode);
  const [hasTransactions, setHasTransactions] = useState(false);

  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; idToDelete: number | null }>({ isOpen: false, idToDelete: null });
  const [deleteGradeModalState, setDeleteGradeModalState] = useState<{ isOpen: boolean; idToDelete: number | null }>({ isOpen: false, idToDelete: null });
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const { customerTypes, createCustomerType, updateCustomerType, deleteCustomerType, isLoading: isTypesLoading } = useCustomerTypes();
  const { customerGrades, isLoading: isGradesLoading, createCustomerGrade, updateCustomerGrade, deleteCustomerGrade } = useCustomerGrades();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema) as any,
    defaultValues: initialFormData,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "addresses"
  });

  const { fields: transportFields, append: appendTransport, remove: removeTransport } = useFieldArray({
    control,
    name: "transports"
  });

  const formRef = useRef<HTMLFormElement>(null);
  const handleFormKeyDown = useFormKeyboardNav(formRef);

  // Focus a field by name using direct DOM query (works even when field.ref is
  // not forwarded through CtrlText, which is the case for all Controller fields here).
  const focusFieldByName = useCallback((name: string) => {
    const el = formRef.current?.querySelector<HTMLElement>(
      `input[name="${name}"][data-nav], [data-nav][name="${name}"]`
    );
    if (el) {
      el.focus();
      return true;
    }
    return false;
  }, []);

  // Focus the very first navigable field in the form.
  const focusFirstField = useCallback(() => {
    const first = formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])");
    first?.focus();
  }, []);

  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const openDiscardModal = useCallback(() => {
    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
    setSaveConfirmOpen(true);
  }, []);

  const handleResume = useCallback(() => {
    setSaveConfirmOpen(false);
    setTimeout(() => {
      if (lastFocusedElementRef.current && typeof lastFocusedElementRef.current.focus === "function") {
        lastFocusedElementRef.current.focus();
      } else {
        const firstInput = formRef.current?.querySelector<HTMLElement>(
          "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])"
        );
        firstInput?.focus();
      }
    }, 50);
  }, []);

  const handleDiscard = useCallback(() => {
    setSaveConfirmOpen(false);
    navigate("/customers");
  }, [navigate]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      openDiscardModal();
    } else {
      navigate("/customers");
    }
  }, [isDirty, openDiscardModal, navigate]);

  // Keep refs in sync so the Esc handler always reads the latest values
  // without needing to tear-down and re-register the listener on every render.
  // This prevents the stale-closure bug where a second Esc press after a failed
  // modal-save exits the page because the handler captured an outdated isDirty.
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const saveConfirmOpenRef = useRef(saveConfirmOpen);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

  // Esc anywhere on the page — registered once, reads refs for fresh state.
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // If a dropdown is currently open (SelectInput portal), let it close first
      if (document.querySelector("[data-select-portal]")) return;

      e.preventDefault();
      e.stopPropagation();

      if (saveConfirmOpenRef.current) {
        handleResume();
      } else if (isDirtyRef.current) {
        openDiscardModal();
      } else {
        navigate("/customers");
      }
    };
    window.addEventListener("keydown", handleEsc, { capture: true });
    return () => window.removeEventListener("keydown", handleEsc, { capture: true });
  // Only stable callbacks + navigate here — volatile state is read via refs above.
  }, [handleResume, openDiscardModal, navigate]);

  const handleRemoveAddress = (index: number) => {
    remove(index);
  };

  // Auto-focus the first field whenever the form becomes visible.
  // Edit mode: form is hidden behind a loading gate, so useFormKeyboardNav's
  //   mount effect fires before the <form> is in the DOM → focus silently fails.
  //   This effect re-fires when loading→false and focuses the first field.
  // Create mode: loading is always false, so this fires on mount as a reliable
  //   complement to the hook's 200 ms timer (handles cases where state updates
  //   steal focus after the timer fires, e.g. setValue inside fetchCode).
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => focusFirstField(), 250);
    return () => clearTimeout(timer);
  }, [loading, focusFirstField]);

  useEffect(() => {
    if (isEditMode) {
      const fetchCustomer = async () => {
        try {
          const customer = await customerService.fetchById(id);
          reset(mapCustomerToFormData(customer));
          setHasTransactions(Boolean(customer.hasTransactions));
        } catch (err) {
          toast.error("Failed to load customer details");
        } finally {
          setLoading(false);
        }
      };
      fetchCustomer();
    } else {
      const fetchCode = async () => {
        try {
          const nextCode = await customerService.fetchNextCode();
          if (nextCode) {
            setValue("customerId", nextCode, { shouldValidate: true });
          }
        } catch {
          // next-code fetch is non-critical; form remains editable
        }
      };
      fetchCode();
    }
  }, [id, isEditMode, location.state, reset, setValue]);





  const handleClear = async () => {
    if (!isEditMode) {
      reset(initialFormData);
      try {
        const nextCode = await customerService.fetchNextCode();
        if (nextCode) {
          setValue("customerId", nextCode, { shouldValidate: true });
        }
      } catch {
        // next-code fetch is non-critical; form remains editable
      }
      // Return focus to the first field after clearing
      setTimeout(() => focusFirstField(), 100);
    }
  };

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      const payload = {
        customerCode: data.customerId,
        firmName: data.firmName,
        displayName: data.displayName,
        customerTypeId: data.customerTypeId,
        customerGradeId: data.customerGradeId,
        mobile: data.phones,
        email: data.email,
        gstin: data.gstin,
        addresses: (data.addresses || []).map((addr, index) => ({
          ...addr.address,
          _label: index === 0 ? "Billing Address" : `Address ${index + 1}`,
        })),
        creditLimit: Number(data.creditLimit) || 0,
        creditDays: data.creditDays ? Number(data.creditDays) : null,
        openingBalance: Number(data.openingBalance || 0),
        openingBalanceType: data.openingBalanceType || "DEBIT",
        transports: data.transports.length > 0 ? data.transports : null,
        status: data.isActive === "true" ? "Active" : "Inactive",
      };

      if (isEditMode && id) {
        if (hasTransactions) {
          // Exclude openingBalance and openingBalanceType when customer has transactions
          const { openingBalance: _ob, openingBalanceType: _obt, ...updatePayload } = payload;
          await editCustomer(id, updatePayload as any);
        } else {
          // No transactions — include opening balance in update
          await editCustomer(id, payload as any);
        }
        toast.success("Customer updated successfully");
      } else {
        await addCustomer(payload as any);
        toast.success("Customer created successfully");
      }

      navigate('/customers');
    } catch (error: any) {
      const msg = typeof error === "string" ? error : error?.message || error?.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} customer`;
      toast.error(msg);
    }
  };

  // Field order matches the visual layout — used to find which error field comes first.
  const FIELD_ORDER: (keyof CustomerFormValues)[] = [
    "firmName", "displayName", "customerGradeId", "customerTypeId",
    "isActive", "phones", "email", "gstin",
    "openingBalance", "openingBalanceType", "creditLimit", "creditDays",
  ];

  // Save from the discard modal: close modal first, then validate + submit.
  // If validation fails → errors show on the form, first error field gets focus
  //   so keyboard navigation works immediately.
  // If validation passes → onSubmit saves and navigates away.
  const handleSaveFromModal = useCallback(() => {
    setSaveConfirmOpen(false);
    setTimeout(() => {
      handleSubmit(
        onSubmit,
        (fieldErrors) => {
          toast.error("Required fields fill pannuga — please fill all required fields.");

          // Walk the visual field order and focus the first one that has an error.
          // focusFieldByName uses a direct DOM query (name attr + data-nav) so it
          // works even though CtrlText does not forward field.ref to the input.
          const firstErrorField = FIELD_ORDER.find((f) => fieldErrors[f]);
          if (firstErrorField && focusFieldByName(firstErrorField)) {
            formRef.current
              ?.querySelector<HTMLElement>(`input[name="${firstErrorField}"]`)
              ?.scrollIntoView({ block: "center", behavior: "smooth" });
          } else {
            // Address / transport errors — focus the first visible red-border input
            const firstRedInput = formRef.current?.querySelector<HTMLElement>(
              "input.border-red-500[data-nav]"
            );
            firstRedInput?.focus();
            firstRedInput?.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }
      )();
    }, 150);
  }, [handleSubmit, onSubmit, focusFieldByName]);

  // ── Global F-Keys / Shortcuts Integration (F2 / F9 / F8 / F5) ──
  useFormShortcuts({
    onSave: () => {
      handleSubmit(onSubmit)();
    },
    onDelete: () => {
      if (!isEditMode) {
        handleClear();
      }
    },
  });

  // F5 Data Refresh
  useEffect(() => {
    const handleRefresh = async () => {
      if (isEditMode && id) {
        try {
          setLoading(true);
          const customer = await customerService.fetchById(id);
          reset(mapCustomerToFormData(customer));
          setHasTransactions(Boolean(customer.hasTransactions));
          toast.info("Customer details refreshed");
        } catch {
          toast.error("Failed to reload customer details");
        } finally {
          setLoading(false);
        }
      } else if (!isEditMode) {
        handleClear();
        toast.info("Form reset");
      }
    };

    window.addEventListener("fkey-refresh", handleRefresh);
    return () => window.removeEventListener("fkey-refresh", handleRefresh);
  }, [id, isEditMode, reset]);



  if (loading) {
    return <div className="p-6 text-center text-ink-muted">Loading customer details...</div>;
  }

  return (
    <div className="max-w-[1400px] xl:mr-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-visible">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h3 className="text-lg font-bold text-ink flex items-start">
            {isEditMode ? 'Edit Customer' : 'Create Customer'}
            <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{watch("customerId")}</span>
          </h3>
          <CustomButton
            text="Back to List"
            icon={FaArrowLeft}
            variant="secondary"
            onClick={handleBack}
          />
        </div>

        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} onKeyDown={handleFormKeyDown} className="p-5 space-y-5" noValidate>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-8 lg:gap-x-10 gap-y-3 md:gap-y-4">
            <Controller name="firmName" control={control} render={({ field }) => (
              <CtrlText field={field} label="Firm / Legal Name" placeholder="e.g. Murugan Plastics" required error={errors.firmName?.message} />
            )} />
            <Controller name="displayName" control={control} render={({ field }) => (
              <CtrlText field={field} label="Display Name" placeholder="Murugan" required error={errors.displayName?.message}  />
            )} />
            <Controller name="customerGradeId" control={control} render={({ field }) => (
              <CreatableSelectInput
                label="Customer Grade"
                name="customerGradeId"
                value={field.value as number | null}
                options={customerGrades.map((g) => ({ label: g.name, value: g.id }))}
                isLoading={isGradesLoading}
                onChange={field.onChange}
                onCreateOption={async (val) => {
                  try {
                    await createCustomerGrade({ name: val });
                  } catch (e) { /* Error handled in hook */ }
                }}
                onEditOption={async (id, newLabel) => {
                  try {
                    await updateCustomerGrade({ id: id as number, data: { name: newLabel } });
                  } catch (e) { /* Error handled in hook */ }
                }}
                onDeleteOption={(id) => {
                  setDeleteGradeModalState({ isOpen: true, idToDelete: id as number });
                }}
                error={errors.customerGradeId?.message}
              />
            )} />
            <Controller name="customerTypeId" control={control} render={({ field }) => (
              <CreatableSelectInput
                label="Customer Type"
                name="customerTypeId"
                value={field.value as number | null}
                options={customerTypes.map((t) => ({ label: t.name, value: t.id }))}
                isLoading={isTypesLoading}
                onChange={field.onChange}
                onCreateOption={async (val) => {
                  try {
                    await createCustomerType({ name: val });
                  } catch (e) { /* Error handled in hook */ }
                }}
                onEditOption={async (id, newLabel) => {
                  try {
                    await updateCustomerType({ id: id as number, data: { name: newLabel } });
                  } catch (e) { /* Error handled in hook */ }
                }}
                onDeleteOption={(id) => {
                  setDeleteModalState({ isOpen: true, idToDelete: id as number });
                }}
                error={errors.customerTypeId?.message}
              />
            )} />
            <Controller name="isActive" control={control} render={({ field }) => (
              <SelectInput
                label="Status"
                searchable={false}
                name={field.name}
                value={field.value}
                options={[
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ]}
                onChange={(e: any) => field.onChange(e.target.value)}
                error={errors.isActive?.message}
              />
            )} />
            <Controller name="phones" control={control} render={({ field }) => (
              <IndiaPhoneInput
                multi
                label="Mobile Numbers"
                name="phones"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                maxNumbers={5}
                required={false}
                error={errors.phones?.message as string}
              />
            )} />
            <Controller name="email" control={control} render={({ field }) => (
              <CtrlText field={field} label="Email" type="email" placeholder="x@y.com" error={errors.email?.message} />
            )} />
            <Controller name="gstin" control={control} render={({ field }) => (
              <CtrlText field={field} label="GSTIN (15 CHAR)" placeholder="33AABC1234D1Z5" error={errors.gstin?.message} />
            )} />
            <Controller name="openingBalance" control={control} render={({ field }) => (
              <CtrlText field={field} label="Opening Balance ₹" type="number" placeholder="0.00" preventNegative  required error={errors.openingBalance?.message} disabled={isEditMode && hasTransactions} />
            )} />
            <Controller name="openingBalanceType" control={control} render={({ field }) => (
              <SelectInput
                searchable={false}
                label="Opening Balance Type"
                name={field.name}
                value={field.value}
                options={[
                  { value: "DEBIT", label: "Debit (Customer owes us)" },
                  { value: "CREDIT", label: "Credit (Advance received from customer)" },
                ]}
                onChange={(e: any) => field.onChange(e.target.value)}
                disabled={isEditMode && hasTransactions}
                error={errors.openingBalanceType?.message}
              />
            )} />
            <Controller name="creditLimit" control={control} render={({ field }) => (
              <CtrlText field={field} label="Credit Limit ₹" type="number" placeholder="30000" preventNegative required error={errors.creditLimit?.message} />
            )} />
            <Controller name="creditDays" control={control} render={({ field }) => (
              <SelectInput
                label="Credit Days"
                searchable={false}
                name={field.name}
                value={field.value ?? ""}
                options={[
                  { value: "7", label: "7 Days" },
                  { value: "14", label: "14 Days" },
                  { value: "21", label: "21 Days" },
                  { value: "30", label: "30 Days" },
                ]}
                defaultOptionLabel="Select Credit Days"
                onChange={(e: any) => field.onChange(e.target.value)}
                error={errors.creditDays?.message}
              />
            )} />
          </div>

          {/* Transport Details */}
         

          {/* Billing Address */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink uppercase tracking-wide">
                Billing Address
          
              </h4>
              <CustomButton
                type="button"
                text="Add Address"
                icon={FaPlus}
                variant="secondary"
                onClick={() => append({ address: { addressLine1: "", addressLine2: "", city: "", state: "Tamil Nadu", pincode: "" } })}
              />
            </div>

            {/* Billing Address Form (always index 0) */}
            {fields.length > 0 && (() => {
              const fieldErrors = errors.addresses?.[0]?.address;
              return (
                <AddressForm
                  addressValue={watch(`addresses.0.address.addressLine1`)}
                  onAddressChange={(v) => setValue(`addresses.0.address.addressLine1`, v, { shouldValidate: true, shouldDirty: true })}
                  addressError={fieldErrors?.addressLine1?.message}
                  countryValue="India"
                  stateValue={watch(`addresses.0.address.state`)}
                  onStateChange={(v) => {
                    setValue(`addresses.0.address.state`, v, { shouldValidate: true, shouldDirty: true });
                    setValue(`addresses.0.address.city`, "", { shouldValidate: true, shouldDirty: true });
                  }}
                  stateError={fieldErrors?.state?.message}
                  cityValue={watch(`addresses.0.address.city`)}
                  onCityChange={(v) => setValue(`addresses.0.address.city`, v, { shouldValidate: true, shouldDirty: true })}
                  cityError={fieldErrors?.city?.message}
                  pincodeValue={watch(`addresses.0.address.pincode`)}
                  onPincodeChange={(v) => setValue(`addresses.0.address.pincode`, v, { shouldValidate: true, shouldDirty: true })}
                  pincodeError={fieldErrors?.pincode?.message}
                />
              );
            })()}

            {/* Additional Addresses */}
            {fields.map((field, index) => {
              if (index === 0) return null;
              const fieldErrors = errors.addresses?.[index]?.address;
              return (
                <div key={field.id} className="p-4 border border-line rounded-md relative">
                  <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
                    <h4 className="text-sm font-semibold text-ink uppercase">Address {index + 1}</h4>
                    <DeleteButton onClick={() => handleRemoveAddress(index)} />
                  </div>
                  <AddressForm
                    addressValue={watch(`addresses.${index}.address.addressLine1`)}
                    onAddressChange={(v) => setValue(`addresses.${index}.address.addressLine1`, v, { shouldValidate: true, shouldDirty: true })}
                    addressError={fieldErrors?.addressLine1?.message}
                    countryValue="India"
                    stateValue={watch(`addresses.${index}.address.state`)}
                    onStateChange={(v) => {
                      setValue(`addresses.${index}.address.state`, v, { shouldValidate: true, shouldDirty: true });
                      setValue(`addresses.${index}.address.city`, "", { shouldValidate: true, shouldDirty: true });
                    }}
                    stateError={fieldErrors?.state?.message}
                    cityValue={watch(`addresses.${index}.address.city`)}
                    onCityChange={(v) => setValue(`addresses.${index}.address.city`, v, { shouldValidate: true, shouldDirty: true })}
                    cityError={fieldErrors?.city?.message}
                    pincodeValue={watch(`addresses.${index}.address.pincode`)}
                    onPincodeChange={(v) => setValue(`addresses.${index}.address.pincode`, v, { shouldValidate: true, shouldDirty: true })}
                    pincodeError={fieldErrors?.pincode?.message}
                  />
                </div>
              );
            })}
          </div>

          {/* Transport Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink uppercase tracking-wide">Transport Details</h4>
              <CustomButton
                type="button"
                text="Add Transport"
                icon={FaPlus}
                variant="secondary"
                onClick={() => appendTransport({ name: "", address: "", phone: "" })}
              />
            </div>

            {transportFields.length === 0 && (
              <p className="text-xs text-ink-muted italic">No transport added yet. Click "Add Transport" to add one.</p>
            )}

            {transportFields.map((tf, index) => {
              const fieldErrors = errors.transports?.[index];
              return (
                <div key={tf.id} className="p-4 border border-line rounded-md relative">
                  <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
                    <h4 className="text-sm font-semibold text-ink uppercase">Transport {index + 1}</h4>
                    <DeleteButton onClick={() => removeTransport(index)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-8 lg:gap-x-10 gap-y-3 md:gap-y-4">
                    <Controller name={`transports.${index}.name`} control={control} render={({ field }) => (
                      <CtrlText field={field} label="Transport Name" placeholder="e.g. Sri Balaji Transport" required error={fieldErrors?.name?.message} />
                    )} />
                    <Controller name={`transports.${index}.address`} control={control} render={({ field }) => (
                      <CtrlText field={field} label="Transport Address" placeholder="e.g. 12, Main Road, Coimbatore" error={fieldErrors?.address?.message} />
                    )} />
                    <Controller name={`transports.${index}.phone`} control={control} render={({ field }) => (
                      <div>
                        <label className="block text-xs font-semibold text-ink-muted mb-1.5">Transport Phone</label>
                        <SinglePhoneField
                          name={field.name}
                          value={field.value ?? ""}
                          placeholder="98765 43210"
                          onChange={(val) => field.onChange(val)}
                          onBlur={field.onBlur}
                          error={fieldErrors?.phone?.message}
                        />
                      </div>
                    )} />
                  </div>
                </div>
              );
            })}
          </div>

        </form>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-line">
          {!isEditMode && (
            <CustomButton
              text="Clear Form"
              onClick={handleClear}
              type="button"
            />
          )}
          <CustomButton
            text={isSubmitting ? "Saving..." : "Save Customer"}
            type="submit"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          />
        </div>
      </div>

      <CommonConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, idToDelete: null })}
        onConfirm={async () => {
          if (deleteModalState.idToDelete !== null) {
            try {
              await deleteCustomerType(deleteModalState.idToDelete);
              if (watch("customerTypeId") === deleteModalState.idToDelete) {
                setValue("customerTypeId", null as any, { shouldValidate: true, shouldDirty: true });
              }
            } catch (e) { /* Error handled in hook */ }
          }
          setDeleteModalState({ isOpen: false, idToDelete: null });
        }}
        title="Delete Customer Type"
        message="Are you sure you want to delete this customer type?"
        confirmText="Delete"
        isDangerous={true}
      />
      <CommonConfirmModal
        isOpen={deleteGradeModalState.isOpen}
        onClose={() => setDeleteGradeModalState({ isOpen: false, idToDelete: null })}
        onConfirm={async () => {
          if (deleteGradeModalState.idToDelete !== null) {
            try {
              await deleteCustomerGrade(deleteGradeModalState.idToDelete);
              if (watch("customerGradeId") === deleteGradeModalState.idToDelete) {
                setValue("customerGradeId", null as any, { shouldValidate: true, shouldDirty: true });
              }
            } catch (e) { /* Error handled in hook */ }
          }
          setDeleteGradeModalState({ isOpen: false, idToDelete: null });
        }}
        title="Delete Customer Grade"
        message="Are you sure you want to delete this customer grade?"
        confirmText="Delete"
        isDangerous={true}
      />

      {/* Back button / Esc key → Save or Discard */}
      <CommonConfirmModal
        isOpen={saveConfirmOpen}
        onClose={handleResume}
        onCancel={handleDiscard}
        onConfirm={handleSaveFromModal}
        title="Discard Changes?"
        message="Are you sure you want to leave? Any unsaved customer details will be lost."
        warningText="Save to keep your changes, or Discard to leave."
        cancelText="Discard"
        cancelVariant="danger"
        confirmText="Save"
        confirmVariant="primary"
        confirmIcon={FaCheck}
        isDangerous={false}
        defaultFocusCancel={false}
      />
    </div>
  );
};

export default CustomerFormPage;