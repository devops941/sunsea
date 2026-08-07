import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createRawMaterial } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import { useSocketSync } from "../../../hooks/useSocketSync";

// const CATEGORY_OPTIONS = [
//     { label: "Yarn", value: "Yarn" },
//     { label: "Fabric", value: "Fabric" },
//     { label: "Colorant", value: "Colorant" },
//     { label: "Chemical", value: "Chemical" },
//     { label: "Packaging", value: "Packaging" },
//     { label: "Accessories", value: "Accessories" },
// ];


const initialFormState = {
    rawMaterialId: "",
    // materialCode: "",
    materialName: "",
    categoryId: "",
    hsnCode: "",
    minimumStock: "",
    leadTimeDays: "",
    storeId: "",

    baseUom: "",
    reorderLevel: "",
    unitPrice: "",
    batchNo: "",
    onHandQty: "",
    reservedQty: "",
    gstTaxRateId:"",
    avgCost: "",
    remarks: "",
    lastMovementAt: "",
    status: "Active",
};

import { z } from "zod";
import BackButton from "../../../components/ui/BackButton/BackButton";

const rawMaterialSchema = z
    .object({
        materialName: z
            .string()
            .trim()
            .min(1, "Material Name is required")
            .max(100, "Material Name cannot exceed 100 characters")
            .regex(
                /^(?=.*[A-Za-z])[A-Za-z0-9\s&().,-]+$/,
                "Material Name must contain at least one letter and only valid characters"
            ),
        categoryId: z
            .string()
            .trim()
            .min(1, "Raw Material Category is required"),

        hsnCode: z
            .string()
            .trim()
            .min(1, "HSN Code is required")
            .regex(
                /^\d{4,8}$/,
                "HSN Code must contain 4 to 8 digits"
            ),

        storeId: z
            .string()
            .trim()
            .min(1, "Store is required"),

        baseUom: z
            .string()
            .trim()
            .min(1, "Base UOM is required"),

        minimumStock: z
            .string()
            .trim()
            .min(1, "Minimum Stock is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Minimum Stock must be greater than or equal to 0",
                }
            ),

        reorderLevel: z
            .string()
            .trim()
            .min(1, "Reorder Level is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Reorder Level must be greater than or equal to 0",
                }
            ),

        leadTimeDays: z
            .string()
            .trim()
            .min(1, "Lead Time Days is required")
            .refine(
                value =>
                    Number.isInteger(Number(value)) &&
                    Number(value) >= 0,
                {
                    message:
                        "Lead Time Days must be a positive whole number",
                }
            ),

        unitPrice: z
            .string()
            .trim()
            .min(1, "Unit Price is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Unit Price must be greater than or equal to 0",
                }
            ),

        batchNo: z
            .string()
            .trim()
            .max(40, "Batch Number cannot exceed 40 characters")
            .optional(),

        onHandQty: z
            .string()
            .trim()
            .min(1, "Opening Stock is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Opening Stock must be greater than or equal to 0",
                }
            ),

        reservedQty: z
            .string()
            .trim()
            .optional()
            .refine(
                value =>
                    !value ||
                    (!isNaN(Number(value)) && Number(value) >= 0),
                {
                    message:
                        "Reserved Quantity must be greater than or equal to 0",
                }
            ),

        avgCost: z
            .string()
            .trim()
            .min(1, "Average Cost is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Average Cost must be greater than or equal to 0",
                }
            ),

        remarks: z
            .string()
            .trim()
            .max(500, "Remarks cannot exceed 500 characters")
            .optional(),

        lastMovementAt: z
            .string()
            .optional()
            .refine(
                val => {
                    if (!val) return true;
                    // Check if date is today or in the future
                    return new Date(val) >= new Date(new Date().setHours(0, 0, 0, 0));
                },
                { message: "Date cannot be in the past" }
            ),

        status: z.enum(["Active", "Inactive"], {
            error: "Status is required",
        }),

        gstTaxRateId: z
            .string()
            .trim()
            .min(1, "GST Tax Type is required"),
    })
    .refine(
        data =>
            Number(data.reorderLevel) >= Number(data.minimumStock),
        {
            path: ["reorderLevel"],
            message:
                "Reorder Level must be greater than or equal to Minimum Stock",
        }
    );

const RawMaterialCreate: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: stores } = useAppSelector(state => state.stores);
    const { rawMaterialCategories, loadCategories } = useRawMaterialCategories();

    const gstTaxes = useAppSelector(selectActiveGstTaxes);
    const gstLoading = useAppSelector((state) => state.gst.loading);

    const gstOptions = useMemo(() => [
        { value: "", label: gstLoading ? "Loading GST rates..." : "-- Select GST Rate --" },
        ...(gstTaxes || []).map((t: any) => ({
            value: String(t.id),
            label: `${t.taxName} (${t.taxRate}%)`,
        })),
    ], [gstTaxes, gstLoading]);

    const fetchStoresData = useCallback(() => {
        dispatch(fetchStores({ storeCategory: "RAW_MATERIAL" }));
    }, [dispatch]);

    const fetchCategoriesData = useCallback(() => {
        loadCategories();
    }, [loadCategories]);

    const fetchGstData = useCallback(() => {
        dispatch(fetchGstTaxes({ status: "ACTIVE" }));
    }, [dispatch]);

    useSocketSync("store", undefined, fetchStoresData);
    useSocketSync("rawMaterialCategory", undefined, fetchCategoriesData);
    useSocketSync("gstTax", undefined, fetchGstData);

    useEffect(() => {
        fetchStoresData();
        fetchCategoriesData();
        fetchGstData();
        const getNextId = async () => {
            try {
                const nextId = await rawMaterialService.fetchNextId();
                setFormData(prev => ({ ...prev, rawMaterialId: nextId }));
            } catch (err) {
                console.error("Failed to fetch next raw material ID", err);
            }
        };
        getNextId();
    }, [fetchStoresData, fetchCategoriesData, fetchGstData]);

    const handleUomSelectInQuantity = (selectedUom: string) => {
        if (!formData.baseUom) return;
        const list = formData.baseUom.split(",").map(u => u.trim()).filter(Boolean);
        const rest = list.filter(u => u.toLowerCase() !== selectedUom.toLowerCase());
        const reordered = [selectedUom, ...rest].join(",");
        setFormData(prev => ({ ...prev, baseUom: reordered }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target as any;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));


        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
    };

    const handleClear = () => {
        setFormData(prev => ({ ...initialFormState, rawMaterialId: prev.rawMaterialId }));
        setErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            rawMaterialSchema.parse(formData);
            setErrors({});
        } catch (error) {
            if (error instanceof z.ZodError) {
                const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
                const formattedErrors: Record<string, string> = {};
                Object.keys(fieldErrors).forEach((key) => {
                    const message = fieldErrors[key]?.[0];
                    if (message) {
                        formattedErrors[key] = message;
                    }
                });
                setErrors(formattedErrors);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await dispatch(
                createRawMaterial({
                    ...formData,

                    categoryId: formData.categoryId
                        ? Number(formData.categoryId)
                        : null,

                    minimumStock: formData.minimumStock
                        ? Number(formData.minimumStock)
                        : null,

                    reorderLevel: formData.reorderLevel
                        ? Number(formData.reorderLevel)
                        : null,

                    leadTimeDays: formData.leadTimeDays
                        ? Number(formData.leadTimeDays)
                        : null,

                    unitPrice: formData.unitPrice
                        ? Number(formData.unitPrice)
                        : null,

                    onHandQty: formData.onHandQty
                        ? Number(formData.onHandQty)
                        : 0,

                    reservedQty: formData.reservedQty
                        ? Number(formData.reservedQty)
                        : 0,

                    avgCost: formData.avgCost
                        ? Number(formData.avgCost)
                        : 0,

                    batchNo: formData.batchNo || null,
                    remarks: formData.remarks || null,
                    lastMovementAt: formData.lastMovementAt
                        ? new Date(formData.lastMovementAt).toISOString()
                        : null,
                })
            ).unwrap();
            toast.success("Raw material created successfully!");
            navigate("/raw-materials");
        } catch (err: any) {
            toast.error(err || "Failed to create raw material");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full mx-auto">
            <div className="bg-white  shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        Create Raw Material
                    </h2>
                    <BackButton text="Back to List" to="/raw-materials" />
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-8" noValidate>
                    {/* Basic Information */}
                    <div>
                        <h6 className="text-base font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Basic Information</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <TextInput
                                label="Raw Material ID"
                                name="rawMaterialId"
                                value={formData.rawMaterialId}
                                disabled={true}
                                required
                                error={errors.rawMaterialId}
                                onChange={handleChange}
                            />
                            <TextInput
                                label="Material Name"
                                name="materialName"
                                value={formData.materialName}
                                required
                                error={errors.materialName}
                                onChange={handleChange}
                            />
                            <SelectInput
                                label="Store"
                                name="storeId"
                                value={formData.storeId}
                                options={[
                                    { label: "Select Store", value: "" },
                                    ...(stores || []).map((store: any) => ({
                                        label: store.storeName,
                                        value: store.storeId
                                    }))
                                ]}
                                required
                                error={errors.storeId}
                                onChange={handleChange}
                            />
                            <SelectInput
                                label="Raw Material Category"
                                name="categoryId"
                                value={formData.categoryId}
                                options={[
                                    { label: "Select Category", value: "" },
                                    ...(rawMaterialCategories || []).map((cat: any) => ({
                                        label: cat.name,
                                        value: String(cat.id)
                                    }))
                                ]}
                                required
                                error={errors.categoryId}
                                onChange={handleChange}
                            />
                            <UOMSelect
                                name="baseUom"
                                label="Base UOM"
                                value={formData.baseUom}
                                required
                                isMulti
                                category={["length", "mass", "each","volume"]}
                                allowedCodes={[
                                    "kg", "g", "t", "ton",
                                    "l", "ml", "ltr",
                                    "m", "cm", "mtr",
                                    "dz", "ea"
                                ]}
                                onChange={(value) => {
                                    setFormData(prev => ({ ...prev, baseUom: value }));
                                    if (errors.baseUom) {
                                        setErrors(prev => ({ ...prev, baseUom: "" }));
                                    }
                                }}
                                error={errors.baseUom}
                            />
                            <TextInput
                                label="HSN Code"
                                name="hsnCode"
                                value={formData.hsnCode}
                                required
                                error={errors.hsnCode}
                                onChange={handleChange}
                            />
                            <SelectInput
                                label="Status"
                                name="status"
                                value={formData.status}
                                options={[
                                    { label: "Active", value: "Active" },
                                    { label: "Inactive", value: "Inactive" }
                                ]}
                                required
                                error={errors.status}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Stock Information */}
                    <div>
                        <h6 className="text-base font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Stock Information</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <QuantityInput
                                label="Opening Stock"
                                name="onHandQty"
                                value={formData.onHandQty}
                                baseUoms={formData.baseUom}
                                onUomChange={handleUomSelectInQuantity}
                                required
                                error={errors.onHandQty}
                                onChange={handleChange}
                            />
                            <QuantityInput
                                label="Minimum Stock"
                                name="minimumStock"
                                value={formData.minimumStock}
                                baseUoms={formData.baseUom}
                                onUomChange={handleUomSelectInQuantity}
                                required
                                error={errors.minimumStock}
                                onChange={handleChange}
                            />
                            <QuantityInput
                                label="Reorder Level"
                                name="reorderLevel"
                                value={formData.reorderLevel}
                                baseUoms={formData.baseUom}
                                onUomChange={handleUomSelectInQuantity}
                                required
                                error={errors.reorderLevel}
                                onChange={handleChange}
                            />
                            <TextInput
                                type="number"
                                label="Delivery Days"
                                name="leadTimeDays"
                                value={formData.leadTimeDays}
                                required
                                error={errors.leadTimeDays}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Pricing & Value */}
                    <div>
                        <h6 className="text-base font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Pricing & Value</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <TextInput
                                type="number"
                                label="Average Cost"
                                name="avgCost"
                                value={formData.avgCost}
                                required
                                error={errors.avgCost}
                                onChange={handleChange}
                            />
                            <TextInput
                                type="number"
                                label="Unit Price"
                                name="unitPrice"
                                value={formData.unitPrice}
                                required
                                error={errors.unitPrice}
                                onChange={handleChange}
                            />
                            <SelectInput
                                label="GST TYPE (%)"
                                name="gstTaxRateId"
                                value={formData.gstTaxRateId}
                                options={gstOptions}
                                required
                                onChange={handleChange}
                                error={errors.gstTaxRateId}
                                disabled={gstLoading}
                            />
                        </div>
                    </div>

                    {/* Other Details */}
                    <div>
                        <h6 className="text-base font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Other Details</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <TextInput
                                label="Remarks"
                                name="remarks"
                                value={formData.remarks}
                                error={errors.remarks}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                        <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} disabled={isSubmitting} />
                        <CustomButton text={isSubmitting ? "Saving..." : "Save Material"} icon={FaSave} type="submit" disabled={isSubmitting} />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RawMaterialCreate;
