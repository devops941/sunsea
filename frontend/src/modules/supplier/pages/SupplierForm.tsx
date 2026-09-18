import React, { useState, useEffect, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";
import { useSelector } from "react-redux";
import { FaArrowLeft, FaPlus, FaCheck } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useSuppliers } from "../../../hooks/useSuppliers";
import { supplierService } from "../../../services/supplierService";
import type { SupplierAddress } from "../../../features/supplier/types";

import IndiaPhoneInput, { type PhoneEntry } from "../../../components/ui/PhoneInput/PhoneInput";
import AddressForm from "../../../components/form/AddressFrom/AddressFrom";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import { useSocket } from "../../../providers/SocketProvider";
import { formatAmountOnBlur } from "../../../utils/pricingUtils";
import { formatDate } from "../../../utils/dateUtils";
import RecordAuditInfo, { type AuditData } from "../../../components/ui/RecordAuditInfo/RecordAuditInfo";

const supplierFormSchema = z.object({
    companyId: z.string().optional(),
    supplierCode: z.string().trim().min(1, "Supplier code is required").max(20, "Maximum 20 characters allowed"),
    legalName: z.string().trim().min(1, "Legal name is required").max(160, "Maximum 160 characters allowed"),
    displayName: z.string().trim().max(80, "Maximum 80 characters allowed").optional().nullable(),
    contactPerson: z.string().trim().max(80, "Maximum 80 characters allowed").optional().nullable(),
    mobile: z.string().trim().min(1, "Mobile number is required").max(15, "Maximum 15 characters allowed"),
    email: z.preprocess((val) => (val === "" ? null : val), z.string().trim().email("Invalid email address").max(120).nullable()).optional(),
    gstin: z.preprocess(
        (val) => (typeof val === "string" ? val.trim().toUpperCase() : val),
        z.string()
            .refine(val => !val || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(val), "Invalid GSTIN format (e.g. 33ABCDE1234F1Z5)")
            .nullable()
    ).optional(),
    pan: z.preprocess(
        (val) => (typeof val === "string" ? val.trim().toUpperCase() : val),
        z.string()
            .refine(val => !val || /^[A-Z]{5}\d{4}[A-Z]$/.test(val), "Invalid PAN format (e.g. ABCDE1234F)")
            .nullable()
    ).optional(),
    gstRegType: z.string().trim().max(20, "Maximum 20 characters allowed").optional().nullable(),
    billingAddressLine1: z.string().trim().min(1, "Address Line 1 is required"),
    billingAddressLine2: z.string().trim().optional().nullable(),
    billingAddressCity: z.string().trim().min(1, "City is required"),
    billingAddressState: z.string().trim().min(1, "State is required"),
    billingAddressPincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
    billingAddressCountry: z.string().optional().nullable().default("India"),
    addresses: z.array(
        z.object({
            address: z.object({
                addressLine1: z.string().trim().min(1, "Address Line 1 is required"),
                addressLine2: z.string().trim().optional().nullable(),
                city: z.string().trim().min(1, "City is required"),
                state: z.string().trim().min(1, "State is required"),
                pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
            })
        })
    ).min(1, "At least one delivery/plant address is required"),
    status: z.enum(["Active", "Backup", "Inactive", "Blacklisted"]),
});

const INITIAL_FORM = {
    companyId: "",
    supplierCode: "",
    createdByOn: "",
    legalName: "",
    displayName: "",
    contactPerson: "",
    mobile: "",
    email: "",
    gstin: "",
    pan: "",
    gstRegType: "Registered",
    billingAddressLine1: "",
    billingAddressLine2: "",
    billingAddressCity: "",
    billingAddressState: "Tamil Nadu",
    billingAddressPincode: "",
    billingAddressCountry: "India",
    stateCode: "TN",
    openingBalance: "0.00",
    openingBalanceType: "CREDIT",
    status: "Active",
};

const SupplierForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id;
    const { addSupplier, editSupplier, loading } = useSuppliers();
    const user = useSelector((state: any) => state.auth.user);
    const { socket } = useSocket();

    const formRef = useRef<HTMLFormElement>(null);
    const handleFormKeyDown = useFormKeyboardNav(formRef);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [hasTransactions, setHasTransactions] = useState(false);
    const [phones, setPhones] = useState<PhoneEntry[]>([]);
    const [initialSupplier, setInitialSupplier] = useState<any>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Discard-changes modal
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    const [formData, setFormData] = useState(INITIAL_FORM);
    const [auditInfo, setAuditInfo] = useState<AuditData | null>(null);

    const [addresses, setAddresses] = useState<SupplierAddress[]>([
        { address: { addressLine1: "", addressLine2: "", city: "", state: "Tamil Nadu", pincode: "" } }
    ]);

    const [errors, setErrors] = useState<Record<string, string>>({});

    // ── F2/F9 Save + F8 Clear ─────────────────────────────────────────────────
    useFormShortcuts({
        onSave: () => { handleSubmit(new Event("submit") as any); },
        onDelete: () => { if (!isEdit) handleClear(); },
    });

    // ── F5 Refresh ────────────────────────────────────────────────────────────
    useEffect(() => {
        const handleRefresh = async () => {
            if (isEdit && id) {
                try {
                    setIsLoadingData(true);
                    const supplier = await supplierService.fetchById(id);
                    populateForm(supplier);
                    setIsDirty(false);
                    toast.info("Supplier details refreshed");
                } catch {
                    toast.error("Failed to reload supplier details");
                } finally {
                    setIsLoadingData(false);
                }
            } else if (!isEdit) {
                handleClear();
                toast.info("Form reset");
            }
        };
        window.addEventListener("fkey-refresh", handleRefresh);
        return () => window.removeEventListener("fkey-refresh", handleRefresh);
    }, [id, isEdit]);

    // ── Dirty-check back navigation ──────────────────────────────────
    const isDirtyRef = useRef(isDirty);
    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

    const saveConfirmOpenRef = useRef(saveConfirmOpen);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

    const openDiscardModal = useCallback(() => {
        lastFocusedRef.current = document.activeElement as HTMLElement | null;
        setSaveConfirmOpen(true);
    }, []);

    const handleResume = useCallback(() => {
        setSaveConfirmOpen(false);
        if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); }
        setTimeout(() => {
            if (lastFocusedRef.current && typeof lastFocusedRef.current.focus === "function") {
                lastFocusedRef.current.focus();
            }
        }, 50);
    }, []);

    const handleDiscard = useCallback(() => {
        setSaveConfirmOpen(false);
        if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
        navigate(-1);
    }, [navigate]);

    const handleBack = useCallback(() => {
        if (isDirty) {
            openDiscardModal();
        } else {
            navigate(-1);
        }
    }, [isDirty, openDiscardModal, navigate]);

    // Ref to remember blocker's proceed()/reset() from the current block-attempt
    // so the existing discard modal can drive them from its buttons.
    const proceedRef = useRef<(() => void) | null>(null);
    const resetRef = useRef<(() => void) | null>(null);
    useDirtyNavGuard(isDirty, (proceed, reset) => {
        proceedRef.current = proceed;
        resetRef.current = reset;
        setSaveConfirmOpen(true);
    });

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
            e.preventDefault();
            e.stopPropagation();

            if (saveConfirmOpenRef.current) {
                handleResume();
            } else if (isDirtyRef.current) {
                openDiscardModal();
            } else {
                navigate(-1);
            }
        };
        window.addEventListener("keydown", handleEsc, { capture: true });
        return () => window.removeEventListener("keydown", handleEsc, { capture: true });
    }, [handleResume, openDiscardModal, navigate]);

    const populateForm = (supplier: any) => {
        setInitialSupplier(supplier);
        setFormData({
            companyId: supplier.companyId || "",
            supplierCode: supplier.supplierCode || "",
            createdByOn: supplier.createdByUser?.fullName
                ? `${supplier.createdByUser.fullName}${supplier.createdAt ? " - " + new Date(supplier.createdAt).toLocaleString() : ""}`
                : "",
            legalName: supplier.legalName || "",
            displayName: supplier.displayName || "",
            contactPerson: supplier.contactPerson || "",
            mobile: supplier.mobile || "",
            email: supplier.email || "",
            gstin: supplier.gstin || "",
            pan: supplier.pan || "",
            gstRegType: supplier.gstRegType || "Registered",
            billingAddressLine1: supplier.billingAddressLine1 || "",
            billingAddressLine2: "",
            billingAddressCity: supplier.billingCity || "",
            billingAddressState: supplier.billingState || "",
            billingAddressPincode: supplier.billingPincode || "",
            billingAddressCountry: supplier.billingCountry || "India",
            stateCode: supplier.stateCode || "TN",
            openingBalance: supplier.openingBalance != null ? Number(supplier.openingBalance).toFixed(2) : "0.00",
            openingBalanceType: supplier.openingBalanceType || "CREDIT",
            status: supplier.status || "Active",
        });
        setHasTransactions(Boolean(supplier.hasTransactions));
        setAuditInfo({
            createdAt: supplier.createdAt,
            createdBy: supplier.createdUserName || supplier.createdByUser?.fullName || supplier.createdBy,
            editHistory: supplier.editHistory,
        });

        if (supplier.addresses && supplier.addresses.length > 0) {
            setAddresses(supplier.addresses);
        } else {
            setAddresses([{ address: { addressLine1: "", addressLine2: "", city: "", state: "Tamil Nadu", pincode: "" } }]);
        }

        if (Array.isArray(supplier.mobile) && supplier.mobile.length > 0) {
            setPhones(supplier.mobile);
        } else if (supplier.phones && Array.isArray(supplier.phones) && supplier.phones.length > 0) {
            setPhones(supplier.phones);
        } else if (typeof supplier.mobile === "string" && supplier.mobile) {
            setPhones([{ label: "Mobile", number: supplier.mobile }]);
        } else {
            setPhones([]);
        }

        setIsDirty(false);
    };

    useEffect(() => {
        const initForm = async () => {
            if (isEdit && id) {
                try {
                    setIsLoadingData(true);
                    const supplier = await supplierService.fetchById(id);
                    populateForm(supplier);
                } catch (err) {
                    toast.error("Failed to load supplier details.");
                    navigate("/suppliers");
                } finally {
                    setIsLoadingData(false);
                }
            } else {
                try {
                    const nextCode = await supplierService.fetchNextCode();
                    if (nextCode) {
                        setFormData(prev => ({ ...prev, supplierCode: nextCode, createdByOn: user?.username || "" }));
                    }
                } catch (err) {
                    console.error("Failed to fetch next code:", err);
                }
            }
        };

        initForm();
    }, [id, isEdit, user, navigate]);

    useEffect(() => {
        if (!socket) return;
        const handleUpdated = (data: any) => {
            if (isEdit && data.id === Number(id)) { populateForm(data); }
        };
        socket.on("supplier:updated", handleUpdated);
        return () => { socket.off("supplier:updated", handleUpdated); };
    }, [socket, isEdit, id]);

    const handleClear = () => {
        if (isEdit) {
            if (initialSupplier) { populateForm(initialSupplier); }
        } else {
            setFormData({ ...INITIAL_FORM, createdByOn: user?.username || "" });
            setAddresses([{ address: { addressLine1: "", addressLine2: "", city: "", state: "Tamil Nadu", pincode: "" } }]);
            setPhones([]);
            setErrors({});
            setIsDirty(false);
            supplierService.fetchNextCode().then(nextCode => {
                if (nextCode) { setFormData(prev => ({ ...prev, supplierCode: nextCode })); }
            });
        }
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }
    ) => {
        const { name, value } = e.target;
        const type = (e.target as any).type;

        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (name === "gstin" || name === "pan") {
            const uppercaseVal = value.toUpperCase();
            setFormData(prev => {
                const updated = { ...prev, [name]: uppercaseVal };
                if (name === "gstin" && uppercaseVal.length >= 12) {
                    const extractedPan = uppercaseVal.slice(2, 12);
                    if (/^[A-Z]{5}\d{4}[A-Z]$/.test(extractedPan)) {
                        updated.pan = extractedPan;
                        if (errors.pan) { setErrors(ePrev => ({ ...ePrev, pan: "" })); }
                    }
                }
                return updated;
            });
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        if (errors[name]) { setErrors(prev => ({ ...prev, [name]: "" })); }
        setIsDirty(true);
    };

    const addShippingAddress = () => {
        setAddresses(prev => [...prev, { address: { addressLine1: "", addressLine2: "", city: "", state: "Tamil Nadu", pincode: "" } }]);
        setIsDirty(true);
    };

    const handleShippingAddressChange = (index: number, field: string, value: string) => {
        setAddresses(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], address: { ...updated[index].address, [field]: value } };
            return updated;
        });
        const errorKey = `addresses.${index}.address.${field}`;
        if (errors[errorKey]) { setErrors(prev => ({ ...prev, [errorKey]: "" })); }
        setIsDirty(true);
    };

    const toggleSameAsBilling = (index: number, isSame: boolean) => {
        setAddresses(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                address: {
                    ...updated[index].address,
                    addressLine1: isSame ? formData.billingAddressLine1 : "",
                    city: isSame ? formData.billingAddressCity : "",
                    state: isSame ? formData.billingAddressState : "",
                    pincode: isSame ? formData.billingAddressPincode : "",
                }
            };
            return updated;
        });
        if (isSame) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[`addresses.${index}.address.addressLine1`];
                delete newErrors[`addresses.${index}.address.city`];
                delete newErrors[`addresses.${index}.address.state`];
                delete newErrors[`addresses.${index}.address.pincode`];
                return newErrors;
            });
        }
        setIsDirty(true);
    };

    const removeShippingAddress = (index: number) => {
        setAddresses(prev => prev.filter((_, i) => i !== index));
        setIsDirty(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        const primaryMobile = phones && phones.length > 0 ? phones[0].number : "";
        const dataToValidate = { ...formData, mobile: primaryMobile, addresses };

        try {
            supplierFormSchema.parse(dataToValidate);
            setErrors({});
        } catch (error) {
            if (error instanceof z.ZodError) {
                const formattedErrors: Record<string, string> = {};
                error.issues.forEach((issue) => {
                    formattedErrors[issue.path.join(".")] = issue.message;
                });
                setErrors(formattedErrors);
                toast.error("Please fill all required fields correctly.");
                setIsSubmitting(false);
                return;
            }
        }

        const payload: any = {
            companyId: formData.companyId,
            supplierCode: formData.supplierCode,
            legalName: formData.legalName,
            displayName: formData.displayName || null,
            contactPerson: formData.contactPerson || null,
            mobile: phones,
            email: formData.email || null,
            gstin: formData.gstin || null,
            pan: formData.pan || null,
            gstRegType: formData.gstRegType,
            billingAddressLine1: formData.billingAddressLine1,
            billingCity: formData.billingAddressCity,
            billingState: formData.billingAddressState,
            billingPincode: formData.billingAddressPincode,
            billingCountry: formData.billingAddressCountry || "India",
            stateCode: formData.stateCode,
            status: formData.status,
            addresses: addresses.map((addr) => { const copy = { ...addr }; delete copy.id; return copy; }),
        };

        if (!isEdit || !hasTransactions) {
            payload.openingBalance = Number(formData.openingBalance || 0);
            payload.openingBalanceType = formData.openingBalanceType || "CREDIT";
        }

        try {
            if (isEdit) {
                if (hasTransactions) {
                    const { openingBalance: _ob, openingBalanceType: _obt, ...updatePayload } = payload;
                    await editSupplier(id, updatePayload);
                } else {
                    await editSupplier(id, payload);
                }
                toast.success("Supplier updated successfully!");
                setIsDirty(false);
                navigate(-1);
            } else {
                await addSupplier(payload);
                toast.success("Supplier created successfully!");
                handleClear();
                setTimeout(() => {
                    formRef.current?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled])")?.focus();
                }, 50);
            }
        } catch (err: any) {
            const apiErrors = err?.errors || err?.response?.data?.errors;
            if (Array.isArray(apiErrors) && apiErrors.length > 0) {
                const fieldErrors: Record<string, string> = {};
                apiErrors.forEach((item: any) => {
                    let fieldName = (item.path || "").replace(/^body\./, "");
                    if (fieldName === "billingPincode") fieldName = "billingAddressPincode";
                    if (fieldName === "billingCity") fieldName = "billingAddressCity";
                    if (fieldName === "billingState") fieldName = "billingAddressState";
                    fieldErrors[fieldName] = item.message;
                });
                setErrors(fieldErrors);
                toast.error(apiErrors[0]?.message || "Validation failed.");
            } else {
                toast.error(err?.message || "Operation failed.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingData) {
        return (
            <div className="p-6 text-center text-ink-muted">
                Loading supplier details...
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] xl:mr-auto">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-visible">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-5 py-4 border-b border-line">
                    <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-ink flex items-start">
                            {isEdit ? "Edit Supplier" : "Create Supplier"}
                            {formData.supplierCode && (
                                <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{formData.supplierCode}</span>
                            )}
                        </h3>
                        {isEdit && <RecordAuditInfo auditData={auditInfo} title="Supplier" />}
                    </div>
                    <CustomButton
                        text="Back to List"
                        icon={FaArrowLeft}
                        variant="secondary"
                        onClick={handleBack}
                    />
                </div>

                <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="p-5 space-y-5" noValidate>

                    {/* ── Main Supplier Details ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-8 lg:gap-x-10 gap-y-3 md:gap-y-4">
                        <TextInput
                            label="Firm / Legal Name"
                            name="legalName"
                            value={formData.legalName}
                            placeholder="e.g. Sri Vinayaga Chemicals Pvt Ltd"
                            required
                            error={errors.legalName}
                            onChange={handleChange}
                        />
                        <TextInput
                            label="Display Name"
                            name="displayName"
                            value={formData.displayName}
                            placeholder="e.g. SVC"
                            error={errors.displayName}
                            onChange={handleChange}
                        />
                        <SelectInput
                            label="Status"
                            name="status"
                            searchable={false}
                            value={formData.status}
                            options={[
                                { value: "Active", label: "Active" },
                                { value: "Backup", label: "Backup" },
                                { value: "Inactive", label: "Inactive" },
                                { value: "Blacklisted", label: "Blacklisted" }
                            ]}
                            error={errors.status}
                            onChange={handleChange}
                        />
                        <TextInput
                            label="Contact Person"
                            name="contactPerson"
                            value={formData.contactPerson}
                            placeholder="e.g. Ramesh Kumar"
                            error={errors.contactPerson}
                            onChange={handleChange}
                        />
                        <IndiaPhoneInput
                            multi
                            label="Mobile Numbers"
                            name="phones"
                            value={phones}
                            onChange={(e) => {
                                setPhones(e.target.value);
                                setIsDirty(true);
                                if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: "" }));
                            }}
                            maxNumbers={5}
                            required={true}
                            error={errors.mobile}
                        />
                        <TextInput
                            label="Email"
                            name="email"
                            type="email"
                            value={formData.email}
                            placeholder="e.g. sales@svchemicals.com"
                            error={errors.email}
                            onChange={handleChange}
                        />
                        <TextInput
                            label="GSTIN (15 CHAR)"
                            name="gstin"
                            value={formData.gstin}
                            placeholder="33ABCDE1234F1Z5"
                            error={errors.gstin}
                            onChange={handleChange}
                        />
                        <TextInput
                            label="PAN (10 CHAR)"
                            name="pan"
                            value={formData.pan}
                            placeholder="ABCDE1234F"
                            error={errors.pan}
                            onChange={handleChange}
                        />
                        <SelectInput
                            label="GST Registration Type"
                            name="gstRegType"
                            searchable={false}
                            value={formData.gstRegType}
                            options={[
                                { value: "Registered", label: "Registered" },
                                { value: "Unregistered", label: "Unregistered" },
                                { value: "Composition", label: "Composition" },
                                { value: "SEZ", label: "SEZ Developer / Unit" }
                            ]}
                            error={errors.gstRegType}
                            onChange={handleChange}
                        />
                        <div>
                            <TextInput
                                label="Opening Balance ₹"
                                name="openingBalance"
                                type="number"
                                value={String(formData.openingBalance)}
                                placeholder="0.00"
                                preventNegative
                                required
                                error={errors.openingBalance}
                                onChange={handleChange}
                                onBlur={formatAmountOnBlur((v) => handleChange({ target: { name: "openingBalance", value: v } } as any))}
                                disabled={isEdit && hasTransactions}
                            />
                            {isEdit && hasTransactions && (
                                <p className="mt-1 text-xs text-amber-600">Cannot edit — supplier has existing transactions.</p>
                            )}
                        </div>
                        <SelectInput
                            label="Opening Balance Type"
                            name="openingBalanceType"
                            searchable={false}
                            value={formData.openingBalanceType}
                            options={[
                                { value: "CREDIT", label: "Credit (We owe supplier)" },
                                { value: "DEBIT", label: "Debit (Advance paid to supplier)" }
                            ]}
                            onChange={handleChange}
                            disabled={isEdit && hasTransactions}
                            error={errors.openingBalanceType}
                        />
                        {isEdit && (
                            <div>
                                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Last Purchase Date</label>
                                <div className="px-3 py-2 rounded-lg border border-line bg-card-2 text-sm text-ink">
                                    {initialSupplier?.lastPurchaseDate ? formatDate(initialSupplier.lastPurchaseDate) : "No purchase yet"}
                                </div>
                            </div>
                        )}
                        {isEdit && (
                            <div>
                                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Last Payment Date</label>
                                <div className="px-3 py-2 rounded-lg border border-line bg-card-2 text-sm text-ink">
                                    {initialSupplier?.lastPaymentDate ? formatDate(initialSupplier.lastPaymentDate) : "No payment yet"}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Billing Address ── */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-ink uppercase tracking-wide">
                                Billing Address
                            </h4>
                        </div>
                        <AddressForm
                            addressValue={formData.billingAddressLine1}
                            onAddressChange={(v) => handleChange({ target: { name: "billingAddressLine1", value: v } })}
                            addressError={errors.billingAddressLine1}
                            countryValue={formData.billingAddressCountry}
                            onCountryChange={(v) => {
                                setFormData(prev => ({ ...prev, billingAddressCountry: v, billingAddressState: "", billingAddressCity: "" }));
                                setErrors(prev => ({ ...prev, billingAddressCountry: "", billingAddressState: "", billingAddressCity: "" }));
                                setIsDirty(true);
                            }}
                            countryError={errors.billingAddressCountry}
                            stateValue={formData.billingAddressState}
                            onStateChange={(v) => {
                                setFormData(prev => ({ ...prev, billingAddressState: v, billingAddressCity: "" }));
                                setErrors(prev => ({ ...prev, billingAddressState: "", billingAddressCity: "" }));
                                setIsDirty(true);
                            }}
                            stateError={errors.billingAddressState}
                            cityValue={formData.billingAddressCity}
                            onCityChange={(v) => {
                                setFormData(prev => ({ ...prev, billingAddressCity: v }));
                                setErrors(prev => ({ ...prev, billingAddressCity: "" }));
                                setIsDirty(true);
                            }}
                            cityError={errors.billingAddressCity}
                            pincodeValue={formData.billingAddressPincode}
                            onPincodeChange={(v) => handleChange({ target: { name: "billingAddressPincode", value: v } })}
                            pincodeError={errors.billingAddressPincode}
                            required
                        />
                    </div>

                    {/* ── Delivery / Plant Addresses ── */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-ink uppercase tracking-wide">
                                Delivery / Plant Addresses
                            </h4>
                            <CustomButton
                                type="button"
                                text="Add Address"
                                icon={FaPlus}
                                variant="secondary"
                                onClick={addShippingAddress}
                            />
                        </div>

                        {addresses.length === 0 && (
                            <p className="text-xs text-ink-muted italic">No delivery address added yet. Click "Add Address" to add one.</p>
                        )}

                        {(() => {
                            const isAnyAddressSameAsBilling = addresses.some((addr) =>
                                addr.address.addressLine1 === formData.billingAddressLine1 &&
                                addr.address.city === formData.billingAddressCity &&
                                addr.address.state === formData.billingAddressState &&
                                addr.address.pincode === formData.billingAddressPincode &&
                                !!formData.billingAddressLine1
                            );
                            return addresses.map((addr, index) => {
                                const isThisSameAsBilling =
                                    addr.address.addressLine1 === formData.billingAddressLine1 &&
                                    addr.address.city === formData.billingAddressCity &&
                                    addr.address.state === formData.billingAddressState &&
                                    addr.address.pincode === formData.billingAddressPincode &&
                                    !!formData.billingAddressLine1;
                                const showSameAsBillingCheckbox = isThisSameAsBilling || !isAnyAddressSameAsBilling;

                                return (
                                    <div key={index} className="p-4 border border-line rounded-md relative bg-card-2/40">
                                        <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
                                            <h4 className="text-sm font-semibold text-ink uppercase">Address {index + 1}</h4>
                                            <div className="flex items-center gap-3">
                                                {showSameAsBillingCheckbox && (
                                                    <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer hover:text-ink">
                                                        <input
                                                            type="checkbox"
                                                            className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                                                            checked={isThisSameAsBilling}
                                                            onChange={(e) => toggleSameAsBilling(index, e.target.checked)}
                                                        />
                                                        Same as billing
                                                    </label>
                                                )}
                                                {addresses.length > 1 && <DeleteButton onClick={() => removeShippingAddress(index)} />}
                                            </div>
                                        </div>
                                        <AddressForm
                                            addressValue={addr.address.addressLine1}
                                            onAddressChange={(v) => handleShippingAddressChange(index, "addressLine1", v)}
                                            addressError={errors[`addresses.${index}.address.addressLine1`]}
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
                            });
                        })()}
                    </div>
                </form>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-line">
                    {!isEdit && (
                        <CustomButton
                            text="Clear Form"
                            onClick={handleClear}
                            type="button"
                            variant="secondary"
                        />
                    )}
                    <CustomButton
                        text={isSubmitting ? "Saving..." : (isEdit ? "Update Supplier" : "Save Supplier")}
                        type="submit"
                        disabled={isSubmitting || loading}
                        onClick={handleSubmit}
                    />
                </div>
            </div>

            {/* Discard Changes Modal */}
            <CommonConfirmModal
                isOpen={saveConfirmOpen}
                onClose={handleResume}
                onCancel={handleDiscard}
                onConfirm={() => {
                    setSaveConfirmOpen(false);
                    setTimeout(() => {
                        handleSubmit(new Event("submit") as any);
                        setTimeout(() => formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(), 100);
                    }, 150);
                }}
                title="Discard Changes?"
                message="Are you sure you want to leave? Any unsaved supplier details will be lost."
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

export default SupplierForm;
