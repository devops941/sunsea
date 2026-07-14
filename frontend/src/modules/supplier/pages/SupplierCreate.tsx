
import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaPlus, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import Button from "../../../components/ui/Button/Button";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import Checkbox from "../../../components/form/CheckboxInput/CheckboxInput";
import { useSuppliers } from "../../../hooks/useSuppliers";
import type { SupplierAddress } from "../../../features/supplier/types";
import { useSelector } from "react-redux";
import { supplierService } from "../../../services/supplierService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { rawMaterialCategoryService } from "../../../services/rawMaterialCategoryService";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import IndiaPhoneInput from "../../../components/ui/PhoneInput/PhoneInput";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../components/ui/CityStateSelect/CityStateSelect";
import { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";

const supplierFormSchema = z.object({
    companyId: z.string().uuid("Company ID must be a valid UUID"),
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
        companyId: "d67768ba-bcde-4321-a123-bcdef9876543",
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
            companyId: "d67768ba-bcde-4321-a123-bcdef9876543",
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

    const handleStateChange = (stateData: StateCityOption) => {
        setFormData(prev => ({
            ...prev,
            billingAddressState: stateData.name,
            billingAddressCity: "",
            stateCode: stateData.state_code || prev.stateCode,
        }));
        setErrors(prev => ({
            ...prev,
            billingAddressState: "",
            billingAddressCity: "",
        }));
    };

    const handleCityChange = (cityData: StateCityOption) => {
        setFormData(prev => ({ ...prev, billingAddressCity: cityData.name }));
        setErrors(prev => ({ ...prev, billingAddressCity: "" }));
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

    const handleTempAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked;
            setTempAddress(prev => ({ ...prev, [name]: checked }));
        } else {
            setTempAddress(prev => ({ ...prev, [name]: value }));
        }
    };

    const addShippingAddress = () => {
        if (!tempAddress.label || !tempAddress.addressLine1 || !tempAddress.city || !tempAddress.state || !tempAddress.pincode) {
            toast.warning("Please fill all required shipping address fields");
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
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <div className="page-breadcrumb">Settings / Supplier Master / Add</div>
                                <h2 className="page-title">Add New Supplier</h2>
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner" noValidate>
                    {/* SUPPLIER HEADER */}
                    <Row className="mb-4">
                        <h2 className="form-title">Supplier Header</h2>
                        <Col lg={4} md={6}>
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
                        </Col>
                        <Col lg={4} md={6}>
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
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Created by-on"
                                name="createdByOn"
                                value={formData.createdByOn}
                                placeholder=""
                                onChange={handleChange}
                                disabled
                                error={errors.createdByOn}
                            />

                        </Col>
                    </Row>

                    {/* BASIC INFORMATION */}
                    <Row className="mb-4">
                        <h2 className="form-title">Basic Information</h2>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="LEGAL NAME"
                                name="legalName"
                                value={formData.legalName}
                                placeholder="Sri Vinayaga Chemicals Pvt Ltd"
                                required
                                error={errors.legalName}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Display Name"
                                name="displayName"
                                value={formData.displayName}
                                placeholder="SVC"
                                error={errors.displayName}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6}>
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
                        </Col>
                        <Col lg={4} md={6} className="mt-3">
                            <MultiSelect
                                label="Raw Material Category"
                                name="parentCategories"
                                options={categoryOptions}
                                value={selectedParentCategories}
                                onChange={handleParentCategoryChange}
                                required
                            />
                        </Col>
                        <Col lg={4} md={6} className="mt-3">
                            <MultiSelect
                                label="Raw Materials"
                                name="category"
                                options={rawMaterialOptions}
                                value={formData.category}
                                onChange={handleCategoryChange}
                                error={errors.category}
                                required
                            />
                        </Col>

                        {materialPrices.length > 0 && (
                            <Row className="mb-4">
                                <h2 className="form-title">Raw Material Pricing</h2>
                                <Col lg={12}>
                                    <table className="table table-bordered table-sm align-middle">
                                        <thead>
                                            <tr>
                                                <th>Raw Material</th>
                                                <th>Price (₹)</th>
                                                <th>Valid From</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {materialPrices.map((mp, index) => (
                                                <tr key={mp.rawMaterialId}>
                                                    <td>{mp.materialName}</td>
                                                    <td>
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
                                                    <td>
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
                                </Col>
                            </Row>
                        )}
                        <Col lg={4} md={6} className="mt-3">
                            <TextInput
                                label="Contact Person"
                                name="contactPerson"
                                value={formData.contactPerson}
                                placeholder="Contact person name"
                                error={errors.contactPerson}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6} className="mt-3">
                            <TextInput
                                label="Designation"
                                name="designation"
                                value={formData.designation}
                                placeholder="Enter designation"
                                error={errors.designation}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6} className="mt-3">
                            <IndiaPhoneInput
                                label="Mobile Number"
                                name="mobile"
                                value={formData.mobile}
                                placeholder="Enter mobile number"
                                required
                                error={errors.mobile}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6} className="mt-3">
                            <IndiaPhoneInput
                                label="Alt Phone"
                                name="altPhone"
                                value={formData.altPhone}
                                placeholder="Enter secondary number"
                                error={errors.altPhone}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6} className="mt-3">
                            <IndiaPhoneInput
                                label="WhatsApp Number"
                                name="whatsapp"
                                value={formData.whatsapp}
                                placeholder="e.g. 9840012345"
                                error={errors.whatsapp}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6} className="mt-3">
                            <TextInput
                                label="Email"
                                name="email"
                                value={formData.email}
                                placeholder="sales@svchemicals.com"
                                error={errors.email}
                                onChange={handleChange}
                            />
                        </Col>

                    </Row>

                    {/* BILLING ADDRESS */}
                    <Row className="mb-4">
                        <h2 className="form-title">Billing Address</h2>
                        <Col lg={6}>
                            <TextInput
                                label="Address Line 1"
                                name="billingAddressLine1"
                                value={formData.billingAddressLine1}
                                placeholder="No.12, Anna Salai"
                                required
                                error={errors.billingAddressLine1}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={6}>
                            <TextInput
                                label="Address Line 2"
                                name="billingAddressLine2"
                                value={formData.billingAddressLine2}
                                placeholder="Kappalur"
                                error={errors.billingAddressLine2}
                                onChange={handleChange}
                            />
                        </Col>
                        <CityStateSelect
                            stateLabel="State"
                            cityLabel="City"
                            stateValue={formData.billingAddressState}
                            cityValue={formData.billingAddressCity}
                            onStateChange={handleStateChange}
                            onCityChange={handleCityChange}
                            stateError={errors.billingAddressState}
                            cityError={errors.billingAddressCity}
                            required
                        />
                        <Col lg={3} md={6} className="mt-3">
                            <TextInput
                                label="Pincode"
                                name="billingAddressPincode"
                                value={formData.billingAddressPincode}
                                placeholder="625008"
                                required
                                error={errors.billingAddressPincode}
                                onChange={handleChange}
                            />
                        </Col>

                        {/* <Col lg={3} md={6} className="mt-3">
                            <TextInput
                                label="State Code"
                                name="stateCode"
                                value={formData.stateCode}
                                placeholder="TN"
                                required
                                error={errors.stateCode}
                                onChange={handleChange}
                            />
                        </Col> */}
                    </Row>

                    {/* GST & TAX */}
                    <Row className="mb-4">
                        <h2 className="form-title">GST & MSME</h2>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="GSTIN"
                                name="gstin"
                                value={formData.gstin}
                                placeholder="33ABCDE1234F1Z5"
                                error={errors.gstin}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="PAN"
                                name="pan"
                                value={formData.pan}
                                placeholder="ABCDE1234F"
                                error={errors.pan}
                                onChange={handleChange}
                            />
                        </Col>

                    </Row>

                    {/* BANK DETAILS */}
                    <Row className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2 className="form-title mb-0">Bank Account Details</h2>
                            <CustomButton
                                text="Add another bank"
                                onClick={addBankAccount}
                                type="button"
                            />
                        </div>

                        {formData.bankAccounts.map((bank, index) => (
                            <div key={index} className="bank-account-block mb-4 p-3 border rounded">
                                {formData.bankAccounts.length > 1 && (
                                    <div className="d-flex justify-content-between mb-2">
                                        <h6 className="mb-0">Bank #{index + 1}</h6>
                                        <CustomButton
                                            text="Remove"
                                            onClick={() => removeBankAccount(index)}
                                            type="button"
                                        />
                                    </div>
                                )}

                                <Row>
                                    <Col lg={4} md={6}>
                                        <TextInput
                                            label="Account Holder Name"
                                            name="bankHolderName"
                                            value={bank.bankHolderName}
                                            onChange={(e) => handleBankChange(index, e)}
                                            error={errors[`bankAccounts.${index}.bankHolderName`]}
                                        />
                                    </Col>

                                    <Col lg={4} md={6}>
                                        <TextInput
                                            label="Bank Name"
                                            name="bankName"
                                            value={bank.bankName}
                                            onChange={(e) => handleBankChange(index, e)}
                                            error={errors[`bankAccounts.${index}.bankName`]}
                                        />
                                    </Col>

                                    <Col lg={4} md={6}>
                                        <TextInput
                                            label="Account Number"
                                            name="accountNumber"
                                            value={bank.accountNumber}
                                            onChange={(e) => handleBankChange(index, e)}
                                            error={errors[`bankAccounts.${index}.accountNumber`]}
                                        />
                                    </Col>

                                    <Col lg={4} md={6}>
                                        <TextInput
                                            label="IFSC Code"
                                            name="ifscCode"
                                            value={bank.ifscCode}
                                            onChange={(e) => handleBankChange(index, e)}
                                            error={errors[`bankAccounts.${index}.ifscCode`]}
                                        />
                                    </Col>

                                    <Col lg={4} md={6}>
                                        <TextInput
                                            label="Branch Name"
                                            name="branchName"
                                            value={bank.branchName}
                                            onChange={(e) => handleBankChange(index, e)}
                                            error={errors[`bankAccounts.${index}.branchName`]}
                                        />
                                    </Col>

                                    <Col lg={4} md={6}>
                                        <IndiaPhoneInput
                                            label="GPay / PhonePe Number"
                                            name="upiMobileNumber"
                                            value={bank.upiMobileNumber}
                                            placeholder="98765XXXXX"
                                            onChange={(e) => handleBankChange(index, e as React.ChangeEvent<HTMLInputElement>)}
                                            error={errors[`bankAccounts.${index}.upiMobileNumber`]}
                                        />
                                    </Col>
                                </Row>
                            </div>
                        ))}
                    </Row>

                    {/* COMMERCIAL TERMS */}
                    <Row className="mb-4">
                        <h2 className="form-title">Commercial Terms</h2>
                        <Col lg={4} md={6}>
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
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Lead Time (Days)"
                                name="leadTimeDays"
                                value={String(formData.leadTimeDays)}
                                placeholder="7"
                                required
                                error={errors.leadTimeDays}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <SelectInput
                                label="Currency"
                                name="currency"
                                value={formData.currency}
                                options={[
                                    { value: "INR", label: "INR" },
                                    // { value: "USD", label: "USD" },
                                ]}
                                error={errors.currency}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6} className="mt-3">
                            <TextInput
                                label="Min Order Qty (MOQ)"
                                name="minOrderQty"
                                value={String(formData.minOrderQty)}
                                placeholder="1000"
                                error={errors.minOrderQty}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>

                    {/* ADDITIONAL DELIVERY ADDRESSES */}
                    <Row className="mb-4">
                        <h2 className="form-title">Additional Delivery / Plant Addresses</h2>
                        <Col lg={12} className="mb-3">
                            <div className="p-3 border rounded bg-light">
                                <Row className="g-3">
                                    <Col md={3}>
                                        <TextInput
                                            label="Address Label (e.g. Chennai Plant)"
                                            name="label"
                                            value={tempAddress.label}
                                            onChange={handleTempAddressChange}
                                        />
                                    </Col>
                                    <Col md={3}>
                                        <TextInput
                                            label="Address Line 1"
                                            name="addressLine1"
                                            value={tempAddress.addressLine1}
                                            onChange={handleTempAddressChange}
                                        />
                                    </Col>
                                    <Col md={3}>
                                        <TextInput
                                            label="Address Line 2"
                                            name="addressLine2"
                                            value={tempAddress.addressLine2}
                                            onChange={handleTempAddressChange}
                                        />
                                    </Col>
                                    <Col md={3}>
                                        <TextInput
                                            label="City"
                                            name="city"
                                            value={tempAddress.city}
                                            onChange={handleTempAddressChange}
                                        />
                                    </Col>
                                    <Col md={3}>
                                        <TextInput
                                            label="State"
                                            name="state"
                                            value={tempAddress.state}
                                            onChange={handleTempAddressChange}
                                        />
                                    </Col>
                                    <Col md={3}>
                                        <TextInput
                                            label="Pincode"
                                            name="pincode"
                                            value={tempAddress.pincode}
                                            onChange={handleTempAddressChange}
                                        />
                                    </Col>
                                    <Col md={2}>
                                        <TextInput
                                            label="State Code"
                                            name="stateCode"
                                            value={tempAddress.stateCode}
                                            onChange={handleTempAddressChange}
                                        />
                                    </Col>
                                    <Col md={2} className="d-flex align-items-center mt-4">
                                        <Checkbox
                                            label="Default"
                                            name="isDefault"
                                            checked={tempAddress.isDefault}
                                            onChange={handleTempAddressChange}
                                        />
                                    </Col>
                                    <Col md={12} className="d-flex justify-content-end">
                                        <CustomButton
                                            text="Add Address"
                                            icon={FaPlus}
                                            onClick={addShippingAddress}
                                        />
                                    </Col>
                                </Row>
                            </div>
                        </Col>

                        {/* Plant Addresses List Table */}
                        {addresses.length > 0 && (
                            <Col lg={12}>
                                <table className="table table-bordered table-striped align-middle">
                                    <thead>
                                        <tr>
                                            <th>Label</th>
                                            <th>Address</th>
                                            <th>State Code</th>
                                            <th>Default</th>
                                            <th style={{ width: "80px" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {addresses.map((addr, idx) => (
                                            <tr key={idx}>
                                                <td>{addr.label}</td>
                                                <td>{`${addr.address.addressLine1}, ${addr.address.addressLine2 || ""}, ${addr.address.city}, ${addr.address.state} - ${addr.address.pincode}`}</td>
                                                <td>{addr.stateCode}</td>
                                                <td>{addr.isDefault ? "Yes" : "No"}</td>
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => removeShippingAddress(idx)}
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Col>
                        )}
                    </Row>

                    {/* FORM ACTIONS */}
                    <Row className="mt-4">
                        <Col lg={12}>
                            <div className="form-actions d-flex justify-content-end">
                                <CustomButton
                                    text="Cancel"
                                    icon={FaEraser}
                                    onClick={handleClear}
                                    className="me-3"
                                />
                                <Button
                                    text="Save Supplier"
                                    icon={FaSave}
                                    type="submit"
                                    disabled={loading}
                                />
                            </div>
                        </Col>
                    </Row>
                </form>
            </Container>
        </div>
    );
};

export default SupplierCreate;