import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaPlus, FaTrash, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import Checkbox from "../../../components/form/CheckboxInput/CheckboxInput";
import { useSuppliers } from "../../../hooks/useSuppliers";
import type { SupplierAddress } from "../../../features/supplier/types";
import { useSelector } from "react-redux";
import { supplierService } from "../../../services/supplierService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { rawMaterialCategoryService } from "../../../services/rawMaterialCategoryService";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../components/ui/CityStateSelect/CityStateSelect";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";
import AddressForm from "../../../components/form/AddressFrom/AddressFrom";

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
import { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";


const supplierFormSchema = z.object({
    // BUG-SUP-001 fix: companyId is resolved server-side — make it optional in frontend validation
    companyId: z.string().optional(),
    supplierCode: z.string().trim().min(1, "Supplier code is required").max(20, "Maximum 20 characters allowed"),
    legalName: z.string().trim().min(1, "Legal name is required").max(160, "Maximum 160 characters allowed"),
    displayName: z.string().trim().max(80, "Maximum 80 characters allowed").optional().nullable(),
    vendorType: z.enum(["Manufacturer", "Trader", "Service", "Logistics"]),
    category: z.array(z.string()).min(1, "At least one category is required"),
    rawMaterialCategories: z.string().optional().nullable(),
    contactPerson: z.string().trim().max(80, "Maximum 80 characters allowed").optional().nullable(),
    designation: z.string().trim().max(60, "Maximum 60 characters allowed").optional().nullable(),
    mobile: z
        .string()
        .trim()
        .max(15, "Maximum 15 characters allowed")
        .superRefine((val, ctx) => {
            const error = validatePhoneNumber(val, true);
            if (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: error,
                });
            }
        }),
    altPhone: z.string()
        .trim()
        .max(15, "Maximum 15 characters allowed")
        .superRefine((val, ctx) => {
            const error = validatePhoneNumber(val, true);
            if (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: error,
                });
            }
        }),
    whatsapp: z.string()
        .trim()
        .max(15, "Maximum 15 characters allowed")
        .superRefine((val, ctx) => {
            const error = validatePhoneNumber(val, true);
            if (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: error,
                });
            }
        }),
    email: z.preprocess((val) => (val === "" ? null : val), z.string().trim().email("Invalid email address").max(120).nullable()).optional(),
    website: z.string().trim().max(200, "Maximum 200 characters allowed").optional().nullable(),
    gstin: z.preprocess((val) => (val === "" ? null : val), z.string().trim().max(15, "Maximum 15 characters allowed").nullable()).optional(),
    pan: z.preprocess((val) => (val === "" ? null : val), z.string().trim().max(10, "Maximum 10 characters allowed").nullable()).optional(),
    gstRegType: z.string().trim().max(20, "Maximum 20 characters allowed").optional().nullable(),
    msmeStatus: z.enum(["Micro", "Small", "Medium", "None"]).optional().nullable(),
    udyamNo: z.string().trim().max(20, "Maximum 20 characters allowed").optional().nullable(),
    tdsSection: z.string().trim().max(10, "Maximum 10 characters allowed").optional().nullable(),
    billingAddressLine1: z.string().trim().min(1, "Address Line 1 is required"),
    billingAddressLine2: z.string().trim().optional().nullable(),
    billingAddressCity: z.string().trim().min(1, "City is required"),
    billingAddressState: z.string().trim().min(1, "State is required"),
    billingAddressPincode: z.string().trim().min(1, "Pincode is required"),
    // stateCode: z.string().trim().length(2, "State code must be exactly 2 characters"),
    paymentTerms: z.enum(["Advance", "Net15", "Net30", "Net45", "Net60"]),
    leadTimeDays: z.number().int().min(0, "Lead time cannot be negative"),
    minOrderQty: z.number().min(0, "Minimum order quantity cannot be negative"),
    currency: z.string().trim().length(3, "Currency code must be 3 characters"),
    bankAccounts: z
        .array(
            z.object({
                bankHolderName: z.string().trim().min(1, "Account Holder Name is required"),
                bankName: z.string().trim().min(1, "Bank Name is required"),
                accountNumber: z.string().trim().min(9, "Account Number must be 9-18 digits").max(18, "Account Number must be 9-18 digits"),
                ifscCode: z.string().trim().min(11, "IFSC Code must be exactly 11 characters").max(11, "IFSC Code must be exactly 11 characters"),
                branchName: z.string().trim().min(1, "Branch Name is required"),
                // upiMobileNumber: z.string().trim().max(10, "GPay/PhonePe number must be 10 digits").optional().nullable().or(z.literal("")),
            })
        )
        .optional(),
    status: z.enum(["Active", "Backup", "Inactive", "Blacklisted"]),
});

const SupplierCreate: React.FC = () => {
    const navigate = useNavigate();
    const { addSupplier, loading } = useSuppliers();
    const user = useSelector((state: any) => state.auth.user);

    const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
    const [allRawMaterials, setAllRawMaterials] = useState<any[]>([]);
    const [rawMaterialOptions, setRawMaterialOptions] = useState<{ value: string; label: string }[]>([]);
    const [selectedParentCategories, setSelectedParentCategories] = useState<string[]>([]);

    const [formData, setFormData] = useState({
      // BUG-SUP-001 fix: companyId is now resolved server-side — no longer hardcoded here
      companyId: "",
      supplierCode: "",
      createdByOn: user?.username || "",
        legalName: "",
        displayName: "",
        vendorType: "Manufacturer",
        category: [] as string[],
        rawMaterialCategories: "",
        contactPerson: "",
        designation: "",
        mobile: "",
        altPhone: "",
        whatsapp: "",
        email: "",
        website: "",
        gstin: "",
        pan: "",
        gstRegType: "Registered",
        msmeStatus: "None",
        udyamNo: "",
        tdsSection: "",
        billingAddressLine1: "",
        billingAddressLine2: "",
        billingAddressCity: "",
        billingAddressState: "",
        billingAddressPincode: "",
        stateCode: "TN",
        paymentTerms: "Net30",
        leadTimeDays: 7,
        minOrderQty: 0,
        currency: "INR",
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
        status: "Active",
    });

    const [addresses, setAddresses] = useState<SupplierAddress[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Shipping Address Temp Form State
    const [tempAddress, setTempAddress] = useState({
        label: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        pincode: "",
        stateCode: "TN",
        isDefault: false,
    });
    const [materialPrices, setMaterialPrices] = useState<{
        rawMaterialId: string;
        materialName: string;
        price: number;
        validFrom: string;
        validTo: string;
    }[]>([]);

    useEffect(() => {
        setMaterialPrices((prev) => {
            // keep existing rows for materials still selected
            const kept = prev.filter((p) => formData.category.includes(p.materialName));

            // add new rows for newly selected materials
            const existingNames = kept.map((p) => p.materialName);
            const newRows = formData.category
                .filter((name) => !existingNames.includes(name))
                .map((name) => {
                    const rm = allRawMaterials.find((m) => m.materialName === name);
                    return {
                        rawMaterialId: rm?.rawMaterialId || "",
                        materialName: name,
                        price: 0,
                        validFrom: new Date().toISOString().split("T")[0],
                        validTo: "",
                    };
                });

            return [...kept, ...newRows];
        });
    }, [formData.category, allRawMaterials]);

    const handlePriceChange = (index: number, field: string, value: any) => {
        setMaterialPrices((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleClear = () => {
        setFormData({
            // BUG-SUP-001 fix: companyId resolved server-side
            companyId: "",
            supplierCode: "",
            createdByOn: user?.username || "",
            legalName: "",
            displayName: "",
            vendorType: "Manufacturer",
            category: [],
            rawMaterialCategories: "",
            contactPerson: "",
            designation: "",
            mobile: "",
            altPhone: "",
            whatsapp: "",
            email: "",
            website: "",
            gstin: "",
            pan: "",
            gstRegType: "Registered",
            msmeStatus: "None",
            udyamNo: "",
            tdsSection: "",
            billingAddressLine1: "",
            billingAddressLine2: "",
            billingAddressCity: "",
            billingAddressState: "",
            billingAddressPincode: "",
            stateCode: "TN",
            paymentTerms: "Net30",
            leadTimeDays: 7,
            minOrderQty: 0,
            currency: "INR",
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
            status: "Active",
        });
        setSelectedParentCategories([]);
        setRawMaterialOptions([]);
        setAddresses([]);
        setErrors({});
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }
    ) => {
        const { name, value } = e.target;
        const type = (e.target as any).type;

        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            const parsedValue = (name === "leadTimeDays" || name === "minOrderQty")
                ? Number(value) || 0
                : value;
            setFormData(prev => ({ ...prev, [name]: parsedValue }));
        }
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };


    const handleCategoryChange = (_name: string, values: string[]) => {
        setFormData(prev => ({ ...prev, category: values }));
        if (errors.category) {
            setErrors(prev => ({ ...prev, category: "" }));
        }
    };

    const handleParentCategoryChange = (_name: string, selectedCategoryIds: string[]) => {
        setSelectedParentCategories(selectedCategoryIds);

        // Filter raw materials based on selected categories
        const filteredMaterials = allRawMaterials.filter((m: any) =>
            selectedCategoryIds.includes(String(m.categoryId))
        );

        const options = filteredMaterials.map((m: any) => ({
            value: m.materialName,
            label: m.materialName,
        }));
        setRawMaterialOptions(options);

        // Filter formData.category to only keep materials that belong to the selected categories
        const validMaterialNames = filteredMaterials.map((m: any) => m.materialName);
        const updatedSelectedMaterials = formData.category.filter((name: string) =>
            validMaterialNames.includes(name)
        );

        setFormData(prev => ({ ...prev, category: updatedSelectedMaterials }));

        if (errors.category) {
            setErrors(prev => ({ ...prev, category: "" }));
        }
    };

    const handleBankChange = (
        index: number,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { name, value } = e.target;

        setFormData((prev) => {
            const updatedBanks = [...prev.bankAccounts];
            updatedBanks[index] = {
                ...updatedBanks[index],
                [name]: value,
            };
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
                {
                    bankHolderName: "",
                    bankName: "",
                    accountNumber: "",
                    ifscCode: "",
                    branchName: "",
                    upiMobileNumber: "",
                },
            ],
        }));
    };

    const removeBankAccount = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            bankAccounts: prev.bankAccounts.filter((_, i) => i !== index),
        }));
    };

    useEffect(() => {
        const fetchCode = async () => {
            try {
                const nextCode = await supplierService.fetchNextCode();

                if (nextCode) {
                    setFormData(prev => ({ ...prev, supplierCode: nextCode }));
                }
            } catch (err) {
                console.error("Error fetching next supplier code:", err);
            }
        };
        const loadData = async () => {
            try {
                // Fetch categories
                const categoriesRes = await rawMaterialCategoryService.fetchAll();
                const categoriesList = Array.isArray(categoriesRes)
                    ? categoriesRes
                    : categoriesRes?.rawMaterialCategories || [];

                const catOpts = categoriesList.map((c: any) => ({
                    value: String(c.id),
                    label: c.name,
                }));
                setCategoryOptions(catOpts);

                // Fetch raw materials
                const materials = await rawMaterialService.fetchAll();
                setAllRawMaterials(materials);
            } catch (err) {
                console.error("Error loading categories and raw materials:", err);
            }
        };
        fetchCode();
        loadData();
    }, []);

    const addShippingAddress = () => {
        if (!tempAddress.label || !tempAddress.addressLine1 || !tempAddress.city || !tempAddress.state || !tempAddress.pincode) {
            toast.warning("Please fill all required plant address fields");
            return;
        }

        const newAddr: SupplierAddress = {
            label: tempAddress.label,
            isDefault: tempAddress.isDefault,
            stateCode: tempAddress.stateCode,
            address: {
                addressLine1: tempAddress.addressLine1,
                addressLine2: tempAddress.addressLine2 || null,
                city: tempAddress.city,
                state: tempAddress.state,
                pincode: tempAddress.pincode,
            }
        };

        // If this address is set as default, remove default from existing ones
        if (newAddr.isDefault) {
            setAddresses(prev => prev.map(a => ({ ...a, isDefault: false })).concat(newAddr));
        } else {
            setAddresses(prev => [...prev, newAddr]);
        }

        // Reset temp address
        setTempAddress({
            label: "",
            addressLine1: "",
            addressLine2: "",
            city: "",
            state: "",
            pincode: "",
            stateCode: "TN",
            isDefault: false,
        });
    };

    const removeShippingAddress = (index: number) => {
        setAddresses(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            supplierFormSchema.parse(formData);
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
                return;
            }
        }

        const payload = {
            companyId: formData.companyId,
            supplierCode: formData.supplierCode,
            legalName: formData.legalName,
            displayName: formData.displayName || null,
            vendorType: formData.vendorType,
            category: formData.category.join(","),
            rawMaterialCategories: categoryOptions
                .filter(opt => selectedParentCategories.includes(opt.value))
                .map(opt => opt.label)
                .join(","),
            contactPerson: formData.contactPerson || null,
            designation: formData.designation || null,
            mobile: formData.mobile,
            altPhone: formData.altPhone || null,
            whatsapp: formData.whatsapp || null,
            email: formData.email || null,
            website: formData.website || null,
            gstin: formData.gstin || null,
            pan: formData.pan || null,
            gstRegType: formData.gstRegType,
            msmeStatus: formData.msmeStatus || null,
            udyamNo: formData.udyamNo || null,
            tdsSection: formData.tdsSection || null,
            billingAddressLine1: formData.billingAddressLine1,
            billingCity: formData.billingAddressCity,
            billingState: formData.billingAddressState,
            billingPincode: formData.billingAddressPincode,
            stateCode: formData.stateCode,
            paymentTerms: formData.paymentTerms,
            leadTimeDays: formData.leadTimeDays,
            minOrderQty: formData.minOrderQty,
            currency: formData.currency,
            bankAccount: formData.bankAccounts,
            status: formData.status,
            addresses,
            materialPrices: materialPrices.map((mp) => ({
                rawMaterialId: mp.rawMaterialId,
                price: mp.price,
                validFrom: mp.validFrom,
                validTo: mp.validTo || null,
            })),
        };

        try {
            await addSupplier(payload as any);
            toast.success("Supplier created successfully!");
            navigate("/suppliers");
        } catch (err: any) {
            toast.error(err || "Failed to create supplier");
        }
    };

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className=" space-y-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-slate-800">Add New Supplier</h2>
                        <CustomButton
                            text="Back"
                            icon={FaArrowLeft}
                            onClick={() => navigate("/suppliers")}
                        />
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
                        {/* SUPPLIER HEADER */}
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
                                <div>
                                    <TextInput
                                        label="Created by-on"
                                        name="createdByOn"
                                        value={formData.createdByOn}
                                        placeholder=""
                                        onChange={handleChange}
                                        disabled
                                        error={errors.createdByOn}
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
                                <SelectInput
                                    label="VENDOR TYPE"
                                    name="vendorType"
                                    value={formData.vendorType}
                                    options={[
                                        { value: "Manufacturer", label: "Manufacturer" },
                                        { value: "Trader", label: "Trader" },
                                        { value: "Service", label: "Service" },
                                        { value: "Logistics", label: "Logistics" },
                                    ]}
                                    error={errors.vendorType}
                                    onChange={handleChange}
                                />
                                <MultiSelect
                                    label="Raw Material Category"
                                    name="parentCategories"
                                    options={categoryOptions}
                                    value={selectedParentCategories}
                                    onChange={handleParentCategoryChange}
                                    required
                                />
                                <MultiSelect
                                    label="Raw Materials"
                                    name="category"
                                    options={rawMaterialOptions}
                                    value={formData.category}
                                    onChange={handleCategoryChange}
                                    error={errors.category}
                                    required
                                />

                                {materialPrices.length > 0 && (
                                    <div className="lg:col-span-3 mt-3">
                                        <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase">Raw Material Pricing</h3>
                                        <div className="border border-slate-200 rounded-md overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-2">Raw Material</th>
                                                        <th className="px-4 py-2">Price (₹)</th>
                                                        <th className="px-4 py-2">Valid From</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {materialPrices.map((mp, index) => (
                                                        <tr key={mp.rawMaterialId} className="bg-white">
                                                            <td className="px-4 py-2 font-medium text-slate-700">{mp.materialName}</td>
                                                            <td className="px-4 py-2">
                                                                <TextInput
                                                                    label=""
                                                                    name={`price-${index}`}
                                                                    type="number"
                                                                    value={String(mp.price)}
                                                                    onChange={(e) => handlePriceChange(index, "price", Number(e.target.value))}
                                                                    min={0}
                                                                    step={0.01}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <TextInput
                                                                    label=""
                                                                    name={`validFrom-${index}`}
                                                                    type="date"
                                                                    value={mp.validFrom}
                                                                    onChange={(e) => handlePriceChange(index, "validFrom", e.target.value)}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <TextInput
                                    label="Contact Person"
                                    name="contactPerson"
                                    value={formData.contactPerson}
                                    placeholder="Contact person name"
                                    error={errors.contactPerson}
                                    onChange={handleChange}
                                />
                                <TextInput
                                    label="Designation"
                                    name="designation"
                                    value={formData.designation}
                                    placeholder="Enter designation"
                                    error={errors.designation}
                                    onChange={handleChange}
                                />
                                <IndiaPhoneInput
                                    label="Mobile Number"
                                    name="mobile"
                                    value={formData.mobile}
                                    placeholder="Enter mobile number"
                                    required
                                    error={errors.mobile}
                                    onChange={handleChange}
                                />
                                <IndiaPhoneInput
                                    label="Alt Phone"
                                    name="altPhone"
                                    value={formData.altPhone}
                                    placeholder="Enter secondary number"
                                    error={errors.altPhone}
                                    onChange={handleChange}
                                />
                                <IndiaPhoneInput
                                    label="WhatsApp Number"
                                    name="whatsapp"
                                    value={formData.whatsapp}
                                    placeholder="e.g. 9840012345"
                                    error={errors.whatsapp}
                                    onChange={handleChange}
                                />
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

                                        stateValue={formData.billingAddressState}
                                        onStateChange={(v) => {
                                            const gstCode = getGstStateCode(v);
                                            setFormData(prev => ({
                                                ...prev, billingAddressState: v, billingAddressCity: "", stateCode: gstCode || prev.stateCode
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
                            </div>
                        </div>

                        {/* COMMERCIAL TERMS */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Commercial Terms</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                <SelectInput
                                    label="Payment Terms"
                                    name="paymentTerms"
                                    value={formData.paymentTerms}
                                    options={[
                                        { value: "Advance", label: "Advance" },
                                        { value: "Net15", label: "Net15 (15 Days)" },
                                        { value: "Net30", label: "Net30 (30 Days)" },
                                        { value: "Net45", label: "Net45 (45 Days)" },
                                        { value: "Net60", label: "Net60 (60 Days)" },
                                    ]}
                                    error={errors.paymentTerms}
                                    onChange={handleChange}
                                />
                                <TextInput
                                    label="Lead Time (Days)"
                                    name="leadTimeDays"
                                    value={String(formData.leadTimeDays)}
                                    placeholder="7"
                                    required
                                    error={errors.leadTimeDays}
                                    onChange={handleChange}
                                />
                                <SelectInput
                                    label="Currency"
                                    name="currency"
                                    value={formData.currency}
                                    options={[
                                        { value: "INR", label: "INR" },
                                        { value: "USD", label: "USD" },
                                    ]}
                                    error={errors.currency}
                                    onChange={handleChange}
                                />
                                <TextInput
                                    label="Min Order Qty (MOQ)"
                                    name="minOrderQty"
                                    value={String(formData.minOrderQty)}
                                    placeholder="1000"
                                    error={errors.minOrderQty}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* ADDITIONAL DELIVERY ADDRESSES */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Additional Delivery / Plant Addresses</h3>
                            <div className="bg-white border border-slate-200 p-4 rounded-xl mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    <TextInput
                                        label="Label (e.g. Chennai Plant)"
                                        name="label"
                                        value={tempAddress.label}
                                        onChange={(e) => setTempAddress(prev => ({ ...prev, label: e.target.value }))}
                                    />
                                    <div className="md:col-span-2 lg:col-span-3">
                                        <AddressForm
                                            addressValue={tempAddress.addressLine1}
                                            onAddressChange={(v) => setTempAddress(prev => ({ ...prev, addressLine1: v }))}

                                            stateValue={tempAddress.state}
                                            onStateChange={(v) => {
                                                const gstCode = getGstStateCode(v);
                                                setTempAddress(prev => ({ ...prev, state: v, city: "", stateCode: gstCode || prev.stateCode }));
                                            }}

                                            cityValue={tempAddress.city}
                                            onCityChange={(v) => setTempAddress(prev => ({ ...prev, city: v }))}

                                            pincodeValue={tempAddress.pincode}
                                            onPincodeChange={(v) => setTempAddress(prev => ({ ...prev, pincode: v }))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between col-span-full mt-2">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                name="isDefault"
                                                checked={tempAddress.isDefault}
                                                onChange={(e) => setTempAddress(prev => ({ ...prev, isDefault: e.target.checked }))}
                                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                            />
                                            Set as Default
                                        </label>
                                        <CustomButton
                                            text="Add Address"
                                            icon={FaPlus}
                                            onClick={addShippingAddress}
                                            type="button"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Plant Addresses List Table */}
                            {addresses.length > 0 && (
                                <div className="border border-slate-200 rounded-md overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-2">Label</th>
                                                <th className="px-4 py-2">Address</th>
                                                <th className="px-4 py-2">State Code</th>
                                                <th className="px-4 py-2">Default</th>
                                                <th className="px-4 py-2 text-center" style={{ width: "80px" }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {addresses.map((addr, idx) => (
                                                <tr key={idx} className="bg-white">
                                                    <td className="px-4 py-2 font-medium">{addr.label}</td>
                                                    <td className="px-4 py-2">{`${addr.address.addressLine1}, ${addr.address.addressLine2 || ""}, ${addr.address.city}, ${addr.address.state} - ${addr.address.pincode}`}</td>
                                                    <td className="px-4 py-2">{addr.stateCode}</td>
                                                    <td className="px-4 py-2">
                                                        {addr.isDefault ? <span className="text-green-600 font-semibold">Yes</span> : "No"}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            type="button"
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                            onClick={() => removeShippingAddress(idx)}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
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

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            <TextInput
                                                label="Account Holder Name"
                                                name="bankHolderName"
                                                value={bank.bankHolderName}
                                                onChange={(e) => handleBankChange(index, e)}
                                                error={errors[`bankAccounts.${index}.bankHolderName`]}
                                            />
                                            <TextInput
                                                label="Bank Name"
                                                name="bankName"
                                                value={bank.bankName}
                                                onChange={(e) => handleBankChange(index, e)}
                                                error={errors[`bankAccounts.${index}.bankName`]}
                                            />
                                            <TextInput
                                                label="Account Number"
                                                name="accountNumber"
                                                value={bank.accountNumber}
                                                onChange={(e) => handleBankChange(index, e)}
                                                error={errors[`bankAccounts.${index}.accountNumber`]}
                                            />
                                            <TextInput
                                                label="IFSC Code"
                                                name="ifscCode"
                                                value={bank.ifscCode}
                                                onChange={(e) => handleBankChange(index, e)}
                                                error={errors[`bankAccounts.${index}.ifscCode`]}
                                            />
                                            <TextInput
                                                label="Branch Name"
                                                name="branchName"
                                                value={bank.branchName}
                                                onChange={(e) => handleBankChange(index, e)}
                                                error={errors[`bankAccounts.${index}.branchName`]}
                                            />
                                            <IndiaPhoneInput
                                                label="GPay / PhonePe Number"
                                                name="upiMobileNumber"
                                                value={bank.upiMobileNumber}
                                                placeholder="9876543210"
                                                onChange={(e) => handleBankChange(index, e as React.ChangeEvent<HTMLInputElement>)}
                                                error={errors[`bankAccounts.${index}.upiMobileNumber`]}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* FORM ACTIONS */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                            <CustomButton
                                text="Clear Form"
                                icon={FaEraser}
                                onClick={handleClear}
                                type="button"
                            />
                            <CustomButton
                                text="Save Supplier"
                                icon={FaSave}
                                type="submit"
                                disabled={loading}
                            />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SupplierCreate;