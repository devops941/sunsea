import React, { useState, useEffect, useMemo } from "react";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { updateRawMaterial } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import { z } from "zod";
import { rawMaterialService } from "../../../services/rawMaterialService";
import BackButton from "../../../components/ui/BackButton/BackButton";

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
    gstTaxRateId: "",
    avgCost: "",
    remarks: "",
    lastMovementAt: "",

    status: "Active",
};


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
            .min(1, "Lead Time is required")
            .refine(
                value =>
                    Number.isInteger(Number(value)) &&
                    Number(value) >= 0,
                {
                    message: "Lead Time must be a whole number greater than or equal to 0",
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
            .max(40, "Maximum 40 characters allowed")
            .optional(),

        onHandQty: z
            .string()
            .trim()
            .optional()
            .refine(
                value =>
                    !value ||
                    (!isNaN(Number(value)) && Number(value) >= 0),
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
                    message: "Reserved Quantity must be greater than or equal to 0",
                }
            ),

        avgCost: z
            .string()
            .trim()
            .optional()
            .refine(
                value =>
                    !value ||
                    (!isNaN(Number(value)) && Number(value) >= 0),
                {
                    message: "Average Cost must be greater than or equal to 0",
                }
            ),

        remarks: z
            .string()
            .trim()
            .max(500, "Maximum 500 characters allowed")
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

        status: z
            .enum(["Active", "Inactive"], {
                error: "Status is required",
            }),
    })
    .refine(
        data =>
            Number(data.reorderLevel) <= Number(data.minimumStock),
        {
            path: ["reorderLevel"],
            message:
                "Reorder Level cannot be greater than Minimum Stock",
        }
    );

const RawMaterialEdit: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const { id } = useParams<{ id: string }>();
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

    useEffect(() => {
        dispatch(fetchStores(undefined));
        loadCategories();
        dispatch(fetchGstTaxes({ status: "ACTIVE" }));
        if (locationState.state) {
            setFormData({
                rawMaterialId: locationState.state.rawMaterialId,
                materialName: locationState.state.materialName,
                categoryId: locationState.state.categoryId ? String(locationState.state.categoryId) : "",
                hsnCode: locationState.state.hsnCode || "",
                minimumStock: locationState.state.minimumStock !== null && locationState.state.minimumStock !== undefined ? String(locationState.state.minimumStock) : "",
                leadTimeDays: locationState.state.leadTimeDays !== null && locationState.state.leadTimeDays !== undefined ? String(locationState.state.leadTimeDays) : "",
                storeId: locationState.state.storeId || "",

                baseUom: locationState.state.baseUom || "",
                reorderLevel:
                    locationState.state.reorderLevel != null
                        ? String(locationState.state.reorderLevel)
                        : "",

                unitPrice:
                    locationState.state.unitPrice != null
                        ? String(locationState.state.unitPrice)
                        : "",

                batchNo:
                    locationState.state.batchNo ?? "",

                onHandQty:
                    locationState.state.onHandQty != null
                        ? String(locationState.state.onHandQty)
                        : "",

                reservedQty:
                    locationState.state.reservedQty != null
                        ? String(locationState.state.reservedQty)
                        : "",

                gstTaxRateId:
                    locationState.state.gstTaxRateId != null
                        ? String(locationState.state.gstTaxRateId)
                        : "",

                avgCost:
                    locationState.state.avgCost != null
                        ? String(locationState.state.avgCost)
                        : "",

                remarks: locationState.state.remarks || "",

                lastMovementAt: locationState.state.lastMovementAt
                    ? locationState.state.lastMovementAt.substring(0, 16)
                    : "",

                status: locationState.state.status || "Active",

            });
        } else if (id) {
            // Fetch by ID if state is not provided
            rawMaterialService.fetchById(id).then((data) => {
                setFormData({
                    rawMaterialId: data.rawMaterialId,
                    materialName: data.materialName,
                    categoryId: data.categoryId ? String(data.categoryId) : "",
                    hsnCode: data.hsnCode || "",
                    minimumStock: data.minimumStock !== null && data.minimumStock !== undefined ? String(data.minimumStock) : "",
                    leadTimeDays: data.leadTimeDays !== null && data.leadTimeDays !== undefined ? String(data.leadTimeDays) : "",
                    storeId: data.storeId || "",
                    baseUom: data.baseUom || "",
                    reorderLevel: data.reorderLevel != null ? String(data.reorderLevel) : "",
                    unitPrice: data.unitPrice != null ? String(data.unitPrice) : "",
                    batchNo: data.batchNo ?? "",
                    onHandQty: data.onHandQty != null ? String(data.onHandQty) : "",
                    reservedQty: data.reservedQty != null ? String(data.reservedQty) : "",
                    gstTaxRateId: data.gstTaxRateId != null ? String(data.gstTaxRateId) : "",
                    avgCost: data.avgCost != null ? String(data.avgCost) : "",
                    remarks: data.remarks || "",
                    lastMovementAt: data.lastMovementAt ? data.lastMovementAt.substring(0, 16) : "",
                    status: data.status || "Active",
                });
            }).catch(() => {
                toast.error("Failed to load raw material data.");
                navigate("/raw-materials");
            });
        } else {
            toast.error("No raw material data provided.");
            navigate("/raw-materials");
        }
    }, [locationState.state, id, navigate, dispatch, loadCategories]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;
        const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
        setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
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
            await dispatch(updateRawMaterial({
                id: formData.rawMaterialId,
                data: {
                    materialName: formData.materialName,
                    categoryId: formData.categoryId ? Number(formData.categoryId) : null,
                    hsnCode: formData.hsnCode || null,
                    minimumStock: formData.minimumStock ? Number(formData.minimumStock) : null,
                    leadTimeDays: formData.leadTimeDays ? Number(formData.leadTimeDays) : null,
                    storeId: formData.storeId || null,

                    baseUom: formData.baseUom,
                    reorderLevel: formData.reorderLevel ? Number(formData.reorderLevel) : null,
                    unitPrice: formData.unitPrice ? Number(formData.unitPrice) : null,
                }
            })).unwrap();
            toast.success("Raw material updated successfully!");
            navigate("/raw-materials");
        } catch (err: any) {
            toast.error(err || "Failed to update raw material");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        Edit Raw Material
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
                                required
                                error={errors.onHandQty}
                                onChange={handleChange}
                            />
                            <QuantityInput
                                label="Minimum Stock"
                                name="minimumStock"
                                value={formData.minimumStock}
                                baseUoms={formData.baseUom}
                                required
                                error={errors.minimumStock}
                                onChange={handleChange}
                            />
                            <QuantityInput
                                label="Reorder Level"
                                name="reorderLevel"
                                value={formData.reorderLevel}
                                baseUoms={formData.baseUom}
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
                                required
                                error={errors.remarks}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                        
                        <CustomButton text={isSubmitting ? "Saving..." : "Save Material"} icon={FaSave} type="submit" disabled={isSubmitting} />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RawMaterialEdit;
