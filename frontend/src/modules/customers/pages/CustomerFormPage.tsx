import React, { useState, useEffect } from "react";
import { FaArrowLeft, FaPlus } from "react-icons/fa";
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
import IndiaPhoneInput, { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import { useCustomerTypes } from "../../../hooks/useCustomerTypes";
import { useCustomerGrades } from "../../../hooks/useCustomerGrades";
import CreatableSelectInput from "../../../components/form/CreatableSelectInput/CreatableSelectInput";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";

const addressSchema = z.object({
  addressLine1: z.string().min(1, "Address Line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Pincode is required").regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
});

const customerFormSchema = z.object({
  customerId: z.string().min(1, "Customer Code is required"),
  isActive: z.string().min(1, "Status is required"),
  firmName: z.string().min(3, "Firm Name must be at least 3 characters"),
  displayName: z.string().min(3, "Display Name must be at least 3 characters"),
  customerTypeId: z.number({ message: "Customer Type is required" }).nullable(),
  customerGradeId: z.number({ message: "Customer Grade is required" }).nullable(),
  phones: z.any().superRefine((val, ctx) => {
    const primaryMobileNumber = Array.isArray(val) && val.length > 0 ? val[0].number : (typeof val === "string" ? val : "");
    const error = validatePhoneNumber(primaryMobileNumber, true);
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      });
    }
  }),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/, "Invalid GSTIN format").optional().or(z.literal("")),
  openingBalance: z.string().min(1, "Opening Balance is required"),
  openingBalanceType: z.string().min(1, "Opening Balance Type is required"),
  creditLimit: z.string().min(1, "Credit Limit is required").refine(val => !isNaN(Number(val)) && Number(val) >= 25000, { message: "Credit Limit must be at least ₹25000" }),


  addresses: z.array(z.object({ address: addressSchema })).min(1, "At least one address is required"),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

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
  openingBalance: "",
  openingBalanceType: "DEBIT",
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
    openingBalance: customer.openingBalance != null ? String(customer.openingBalance) : "0",
    openingBalanceType: customer.openingBalanceType || "DEBIT",
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

  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; idToDelete: number | null }>({ isOpen: false, idToDelete: null });
  const [deleteGradeModalState, setDeleteGradeModalState] = useState<{ isOpen: boolean; idToDelete: number | null }>({ isOpen: false, idToDelete: null });

  const { customerTypes, createCustomerType, updateCustomerType, deleteCustomerType, isLoading: isTypesLoading } = useCustomerTypes();
  const { customerGrades, isLoading: isGradesLoading, createCustomerGrade, updateCustomerGrade, deleteCustomerGrade } = useCustomerGrades();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: initialFormData,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "addresses"
  });

  const handleRemoveAddress = (index: number) => {
    remove(index);
  };

  useEffect(() => {
    if (isEditMode) {
      if (location.state) {
        reset(mapCustomerToFormData(location.state));
        setLoading(false);
      } else {
        const fetchCustomer = async () => {
          try {
            const customer = await customerService.fetchById(id);
            reset(mapCustomerToFormData(customer));
          } catch (err) {
            toast.error("Failed to load customer details");
          } finally {
            setLoading(false);
          }
        };
        fetchCustomer();
      }
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
        openingBalance: Number(data.openingBalance || 0),
        openingBalanceType: data.openingBalanceType || "DEBIT",
        status: data.isActive === "true" ? "Active" : "Inactive",
      };

      if (isEditMode && id) {
        // Exclude openingBalance and openingBalanceType — both are immutable after creation
        const { openingBalance: _ob, openingBalanceType: _obt, ...updatePayload } = payload;
        await editCustomer(id, updatePayload as any);
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



  if (loading) {
    return <div className="p-6 text-center text-ink-muted">Loading customer details...</div>;
  }

  return (
    <div className="w-full mx-auto h-full flex flex-col min-h-[calc(100vh-120px)]">
      <div className="bg-card rounded-xl border border-line-soft shadow-xs overflow-visible flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-line-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-ink flex items-start">
              {isEditMode ? 'Edit Customer' : 'Create Customer'}
              <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{watch("customerId")}</span>
            </h3>
            <CustomButton
              text="Back to List"
              icon={FaArrowLeft}
              variant="secondary"
              onClick={() => navigate("/customers")}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-3 space-y-4 flex-1 flex flex-col" noValidate>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Controller name="firmName" control={control} render={({ field }) => (
              <CtrlText field={field} label="Firm / Legal Name" placeholder="e.g. Murugan Plastics" required error={errors.firmName?.message} />
            )} />
            <Controller name="displayName" control={control} render={({ field }) => (
              <CtrlText field={field} label="Display Name" placeholder="Murugan" error={errors.displayName?.message} />
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
              <CtrlText field={field} label="Opening Balance ₹" type="number" placeholder="0.00" preventNegative error={errors.openingBalance?.message} disabled={isEditMode} />
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
                disabled={isEditMode}
                error={errors.openingBalanceType?.message}
              />
            )} />
            <Controller name="creditLimit" control={control} render={({ field }) => (
              <CtrlText field={field} label="Credit Limit ₹" type="number" placeholder="30000" preventNegative error={errors.creditLimit?.message} />
            )} />
          </div>

          {/* Billing Address */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink uppercase tracking-wide">
                Billing Address
                {fields.length === 1 && (
                  <span className="text-ink-muted font-normal normal-case ml-1 text-xs">(Same address used for Shipping)</span>
                )}
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
                  onAddressChange={(v) => setValue(`addresses.0.address.addressLine1`, v, { shouldValidate: true })}
                  addressError={fieldErrors?.addressLine1?.message}
                  countryValue="India"
                  stateValue={watch(`addresses.0.address.state`)}
                  onStateChange={(v) => {
                    setValue(`addresses.0.address.state`, v, { shouldValidate: true });
                    setValue(`addresses.0.address.city`, "", { shouldValidate: true });
                  }}
                  stateError={fieldErrors?.state?.message}
                  cityValue={watch(`addresses.0.address.city`)}
                  onCityChange={(v) => setValue(`addresses.0.address.city`, v, { shouldValidate: true })}
                  cityError={fieldErrors?.city?.message}
                  pincodeValue={watch(`addresses.0.address.pincode`)}
                  onPincodeChange={(v) => setValue(`addresses.0.address.pincode`, v, { shouldValidate: true })}
                  pincodeError={fieldErrors?.pincode?.message}
                  required
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
                    onAddressChange={(v) => setValue(`addresses.${index}.address.addressLine1`, v, { shouldValidate: true })}
                    addressError={fieldErrors?.addressLine1?.message}
                    countryValue="India"
                    stateValue={watch(`addresses.${index}.address.state`)}
                    onStateChange={(v) => {
                      setValue(`addresses.${index}.address.state`, v, { shouldValidate: true });
                      setValue(`addresses.${index}.address.city`, "", { shouldValidate: true });
                    }}
                    stateError={fieldErrors?.state?.message}
                    cityValue={watch(`addresses.${index}.address.city`)}
                    onCityChange={(v) => setValue(`addresses.${index}.address.city`, v, { shouldValidate: true })}
                    cityError={fieldErrors?.city?.message}
                    pincodeValue={watch(`addresses.${index}.address.pincode`)}
                    onPincodeChange={(v) => setValue(`addresses.${index}.address.pincode`, v, { shouldValidate: true })}
                    pincodeError={fieldErrors?.pincode?.message}
                    required
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-auto flex justify-end gap-3 pt-4">
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
            />
          </div>
        </form>
      </div>

      <CommonConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, idToDelete: null })}
        onConfirm={async () => {
          if (deleteModalState.idToDelete !== null) {
            try {
              await deleteCustomerType(deleteModalState.idToDelete);
              if (watch("customerTypeId") === deleteModalState.idToDelete) {
                setValue("customerTypeId", null as any, { shouldValidate: true });
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
                setValue("customerGradeId", null as any, { shouldValidate: true });
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
    </div>
  );
};

export default CustomerFormPage;