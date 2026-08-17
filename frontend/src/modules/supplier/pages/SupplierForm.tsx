import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { FaSave, FaEraser, FaPlus, FaTrash, FaArrowLeft, FaTimes } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useSuppliers } from "../../../hooks/useSuppliers";
import { supplierService } from "../../../services/supplierService";
import type { SupplierAddress } from "../../../features/supplier/types";

import IndiaPhoneInput, { type PhoneEntry, validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";
import AddressForm from "../../../components/form/AddressFrom/AddressFrom";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { useSocket } from "../../../providers/SocketProvider";

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

const SupplierForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id;
    const location = useLocation();
    const { addSupplier, editSupplier, loading } = useSuppliers();
    const user = useSelector((state: any) => state.auth.user);
    const { socket } = useSocket();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [phones, setPhones] = useState<PhoneEntry[]>([]);
    const [initialSupplier, setInitialSupplier] = useState<any>(null);

    const [formData, setFormData] = useState({
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
        billingAddressState: "",
        billingAddressPincode: "",
        billingAddressCountry: "India",
        stateCode: "TN",
        openingBalance: 0,
        openingBalanceType: "CREDIT",
        status: "Active",
    });

    const [addresses, setAddresses] = useState<SupplierAddress[]>([
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

    const [errors, setErrors] = useState<Record<string, string>>({});

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
            openingBalance: Number(supplier.openingBalance) || 0,
            openingBalanceType: supplier.openingBalanceType || "CREDIT",
            status: supplier.status || "Active",
        });

        if (supplier.addresses && supplier.addresses.length > 0) {
            setAddresses(supplier.addresses);
        } else {
            setAddresses([{
                address: {
                    addressLine1: "",
                    addressLine2: "",
                    city: "",
                    state: "",
                    pincode: "",
                }
            }]);
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
    };

    useEffect(() => {
        const initForm = async () => {
            if (isEdit) {
                if (location.state) {
                    populateForm(location.state);
                } else {
                    try {
                        setIsLoadingData(true);
                        const supplier = await supplierService.fetchById(id!);
                        populateForm(supplier);
                    } catch (err) {
                        toast.error("Failed to load supplier details.");
                        navigate("/suppliers");
                    } finally {
                        setIsLoadingData(false);
                    }
                }
            } else {
                try {
                    const nextCode = await supplierService.fetchNextCode();
                    if (nextCode) {
                        setFormData(prev => ({
                            ...prev,
                            supplierCode: nextCode,
                            createdByOn: user?.username || "",
                        }));
                    }
                } catch (err) {
                    console.error("Failed to fetch next code:", err);
                }
            }
        };

        initForm();
    }, [id, isEdit, location.state, user]);

    useEffect(() => {
        if (!socket) return;

        const handleUpdated = (data: any) => {
            if (isEdit && data.id === Number(id)) {
                populateForm(data);
            }
        };

        socket.on("supplier:updated", handleUpdated);
        return () => {
            socket.off("supplier:updated", handleUpdated);
        };
    }, [socket, isEdit, id]);

    const handleClear = () => {
        if (isEdit) {
            if (initialSupplier) {
                populateForm(initialSupplier);
            }
        } else {
            setFormData({
                companyId: "",
                supplierCode: "",
                createdByOn: user?.username || "",
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
                billingAddressState: "",
                billingAddressPincode: "",
                billingAddressCountry: "India",
                stateCode: "TN",
                openingBalance: 0,
                openingBalanceType: "CREDIT",
                status: "Active",
            });
            setAddresses([{
                address: {
                    addressLine1: "",
                    addressLine2: "",
                    city: "",
                    state: "",
                    pincode: "",
                }
            }]);
            setPhones([]);
            setErrors({});
            supplierService.fetchNextCode().then(nextCode => {
                if (nextCode) {
                    setFormData(prev => ({ ...prev, supplierCode: nextCode }));
                }
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
                        if (errors.pan) {
                            setErrors(ePrev => ({ ...ePrev, pan: "" }));
                        }
                    }
                }
                return updated;
            });
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const addShippingAddress = () => {
        setAddresses(prev => [...prev, {
            address: {
                addressLine1: "",
                addressLine2: "",
                city: "",
                state: "",
                pincode: "",
            }
        }]);
    };

    const handleShippingAddressChange = (index: number, field: string, value: string) => {
        setAddresses(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                address: {
                    ...updated[index].address,
                    [field]: value
                }
            };
            return updated;
        });

        const errorKey = `addresses.${index}.address.${field}`;
        if (errors[errorKey]) {
            setErrors(prev => ({ ...prev, [errorKey]: "" }));
        }
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
    };

    const removeShippingAddress = (index: number) => {
        setAddresses(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        const primaryMobile = phones && phones.length > 0 ? phones[0].number : "";

        const dataToValidate = {
            ...formData,
            mobile: primaryMobile,
            addresses: addresses,
        };

        try {
            supplierFormSchema.parse(dataToValidate);
            setErrors({});
        } catch (error) {
            if (error instanceof z.ZodError) {
                const formattedErrors: Record<string, string> = {};
                error.issues.forEach((issue) => {
                    const pathKey = issue.path.join(".");
                    formattedErrors[pathKey] = issue.message;
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
            addresses: addresses.map((addr) => {
                const copy = { ...addr };
                delete copy.id;
                return copy;
            }),
        };

        if (!isEdit) {
            payload.openingBalance = Number(formData.openingBalance || 0);
            payload.openingBalanceType = formData.openingBalanceType || "CREDIT";
        }

        try {
            if (isEdit) {
                await editSupplier(id, payload);
                toast.success("Supplier updated successfully!");
            } else {
                await addSupplier(payload);
                toast.success("Supplier created successfully!");
            }
            navigate("/suppliers");
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
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-lg font-semibold text-slate-600 animate-pulse">Loading Supplier Details...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-1 min-h-screen bg-white">
            <div className=" space-y-3">
                <div className="bg-white  ">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-slate-800">
                            {isEdit ? "Edit Supplier" : "Add New Supplier"}
                        </h2>
                        <BackButton text="Back" />
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
                        {/* SUPPLIER IDENTIFICATION */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Identification & Status</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                    <TextInput
                                        label="SUPPLIER CODE"
                                        name="supplierCode"
                                        value={formData.supplierCode}
                                        placeholder="SUP-001"
                                        required
                                        error={errors.supplierCode}
                                        onChange={handleChange}
                                        disabled
                                    />
                                </div>
                                <div>
                                    <SelectInput
                                        label="Status"
                                        name="status"
                                        value={formData.status}
                                        options={[
                                            { value: "Active", label: "Active" },
                                            { value: "Backup", label: "Backup" },
                                            { value: "Inactive", label: "Inactive" },
                                            { value: "Blacklisted", label: "Blacklisted" },
                                        ]}
                                        error={errors.status}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* BASIC INFORMATION */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Basic Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                <TextInput
                                    label="LEGAL NAME"
                                    name="legalName"
                                    value={formData.legalName}
                                    placeholder="Sri Vinayaga Chemicals Pvt Ltd"
                                    required
                                    error={errors.legalName}
                                    onChange={handleChange}
                                />
                                <TextInput
                                    label="Display Name"
                                    name="displayName"
                                    value={formData.displayName}
                                    placeholder="SVC"
                                    error={errors.displayName}
                                    onChange={handleChange}
                                />
                                <TextInput
                                    label="Contact Person"
                                    name="contactPerson"
                                    value={formData.contactPerson}
                                    placeholder="Contact person name"
                                    error={errors.contactPerson}
                                    onChange={handleChange}
                                />
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
                                <TextInput
                                    label="Email"
                                    name="email"
                                    value={formData.email}
                                    placeholder="sales@svchemicals.com"
                                    error={errors.email}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* GST & TAX */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">GST & MSME</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                <TextInput
                                    label="GSTIN"
                                    name="gstin"
                                    value={formData.gstin}
                                    placeholder="33ABCDE1234F1Z5"
                                    error={errors.gstin}
                                    onChange={handleChange}
                                />
                                <TextInput
                                    label="PAN"
                                    name="pan"
                                    value={formData.pan}
                                    placeholder="ABCDE1234F"
                                    error={errors.pan}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* BILLING ADDRESS */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Billing Address</h3>
                            <div className="grid grid-cols-1 gap-10">
                                <div className="space-y-2">
                                    <AddressForm
                                        addressValue={formData.billingAddressLine1}
                                        onAddressChange={(v) => handleChange({ target: { name: "billingAddressLine1", value: v } })}
                                        addressError={errors.billingAddressLine1}
                                        countryValue={formData.billingAddressCountry}
                                        onCountryChange={(v) => {
                                            setFormData(prev => ({ ...prev, billingAddressCountry: v, billingAddressState: "", billingAddressCity: "" }));
                                            setErrors(prev => ({ ...prev, billingAddressCountry: "", billingAddressState: "", billingAddressCity: "" }));
                                        }}
                                        countryError={errors.billingAddressCountry}
                                        stateValue={formData.billingAddressState}
                                        onStateChange={(v) => {
                                            setFormData(prev => ({
                                                ...prev, billingAddressState: v, billingAddressCity: ""
                                            }));
                                            setErrors(prev => ({ ...prev, billingAddressState: "", billingAddressCity: "" }));
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
                            </div>
                        </div>

                        {/* ADDITIONAL DELIVERY ADDRESSES */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold text-slate-700"> Delivery / Plant Addresses</h3>
                                <CustomButton
                                    text="Add Address"
                                    icon={FaPlus}
                                    onClick={addShippingAddress}
                                    type="button"
                                />
                            </div>
                            <div className="bg-white border border-slate-200 p-4 rounded-xl mb-4 space-y-4">
                                {addresses.length === 0 && (
                                    <div className="text-center text-sm text-slate-500 py-4">No additional addresses added.</div>
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
                                        const isThisSameAsBilling = addr.address.addressLine1 === formData.billingAddressLine1 &&
                                            addr.address.city === formData.billingAddressCity &&
                                            addr.address.state === formData.billingAddressState &&
                                            addr.address.pincode === formData.billingAddressPincode &&
                                            !!formData.billingAddressLine1;

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
                                                            <DeleteButton onClick={() => removeShippingAddress(index)} />
                                                        )}
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
                        </div>

                        {/* OPENING BALANCE DETAILS - ONLY FOR CREATE */}
                        {!isEdit && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">Opening Balance Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div>
                                        <TextInput
                                            label="Opening Balance ₹"
                                            name="openingBalance"
                                            type="number"
                                            value={String(formData.openingBalance)}
                                            placeholder="0.00"
                                            error={errors.openingBalance}
                                            onChange={handleChange}
                                        />
                                        <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                                            <span>⚠</span> Set once at creation. Cannot be edited later.
                                        </p>
                                    </div>
                                    <SelectInput
                                        label="Opening Balance Type"
                                        name="openingBalanceType"
                                        value={formData.openingBalanceType}
                                        options={[
                                            { value: "CREDIT", label: "Credit (We owe supplier)" },
                                            { value: "DEBIT", label: "Debit (Advance paid to supplier)" },
                                        ]}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        )}

                        {/* FORM ACTIONS */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                            <CustomButton
                                text="Clear Form"
                                icon={FaEraser}
                                onClick={handleClear}
                                type="button"
                            />
                            <CustomButton
                                text={isSubmitting ? "Saving..." : (isEdit ? "Update Supplier" : "Save Supplier")}
                                icon={FaSave}
                                type="submit"
                                disabled={isSubmitting || loading}
                            />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SupplierForm;
