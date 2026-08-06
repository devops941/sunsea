import React, { useState, useEffect } from "react";
import { FaSave, FaEraser } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import BackButton from "../../../components/ui/BackButton/BackButton";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createRawMaterial, updateRawMaterial } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";

const initialFormState = {
    rawMaterialId: "",
    materialName: "",
    categoryId: "",
    storeId: "",
    baseUom: "",
    onHandQty: "",
    remarks: "",
    status: "Active",
};

const wastageSchema = z.object({
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
    storeId: z
        .string()
        .trim()
        .min(1, "Store is required"),
    baseUom: z
        .string()
        .trim()
        .min(1, "Base UOM is required"),
    onHandQty: z
        .string()
        .trim()
        .min(1, "Opening Stock is required")
        .refine(
            value => !isNaN(Number(value)) && Number(value) >= 0,
            { message: "Opening Stock must be greater than or equal to 0" }
        ),
    remarks: z
        .string()
        .trim()
        .max(255, "Remarks cannot exceed 255 characters")
        .optional(),
});

const WastageStoreForm: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const { id } = useParams<{ id: string }>();
    const isEdit = Boolean(id);
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: stores } = useAppSelector(state => state.stores);
    const { rawMaterialCategories, loadCategories } = useRawMaterialCategories();

    useEffect(() => {
        dispatch(fetchStores({ storeCategory: "WASTAGE" }));
        loadCategories();

        if (isEdit && locationState.state) {
            setFormData({
                rawMaterialId: locationState.state.rawMaterialId,
                materialName: locationState.state.materialName,
                categoryId: locationState.state.categoryId ? String(locationState.state.categoryId) : "",
                storeId: locationState.state.storeId || "",
                baseUom: locationState.state.baseUom || "",
                onHandQty: locationState.state.onHandQty !== null && locationState.state.onHandQty !== undefined ? String(locationState.state.onHandQty) : "",
                remarks: locationState.state.remarks || "",
                status: locationState.state.isActive ? "Active" : "Inactive",
            });
        } else if (!isEdit) {
            const getNextId = async () => {
                try {
                    // Using the same sequence as raw materials for ID generation
                    const nextId = await rawMaterialService.fetchNextId();
                    setFormData(prev => ({ ...prev, rawMaterialId: nextId }));
                } catch (err) {
                    console.error("Failed to fetch next ID", err);
                }
            };
            getNextId();
        }
    }, [dispatch, loadCategories, isEdit, locationState.state]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleClear = () => {
        if (isEdit && locationState.state) {
            setFormData({
                rawMaterialId: locationState.state.rawMaterialId,
                materialName: locationState.state.materialName,
                categoryId: locationState.state.categoryId ? String(locationState.state.categoryId) : "",
                storeId: locationState.state.storeId || "",
                baseUom: locationState.state.baseUom || "",
                onHandQty: locationState.state.onHandQty !== null && locationState.state.onHandQty !== undefined ? String(locationState.state.onHandQty) : "",
                remarks: locationState.state.remarks || "",
                status: locationState.state.isActive ? "Active" : "Inactive",
            });
        } else {
            setFormData(prev => ({ ...initialFormState, rawMaterialId: prev.rawMaterialId }));
        }
        setErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            wastageSchema.parse(formData);
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
            const payload = {
                ...formData,
                categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
                onHandQty: Number(formData.onHandQty),
                isActive: formData.status === "Active",
                itemType: "WASTAGE"
            } as any;

            if (isEdit) {
                await dispatch(updateRawMaterial({ id: id as string, data: payload })).unwrap();
                toast.success("Wastage product updated successfully!");
            } else {
                await dispatch(createRawMaterial(payload)).unwrap();
                toast.success("Wastage product created successfully!");
            }

            navigate("/wastage-store");
        } catch (err: any) {
            toast.error(err || `Failed to ${isEdit ? "update" : "create"} wastage product`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="inner-containe">
            <div className="p-6 bg-white shadow-sm border border-slate-200">
                <div className="flex items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{isEdit ? "Edit" : "Create"} Wastage Product</h2>
                        <p className="text-sm text-slate-500 mt-1">{isEdit ? "Update details for the selected wastage product" : "Add a new wastage product to the store"}</p>
                    </div>
                    <BackButton />
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <TextInput
                            label="Wastage ID"
                            name="rawMaterialId"
                            value={formData.rawMaterialId}
                            readOnly
                        />
                        <TextInput
                            label="Material Name"
                            name="materialName"
                            value={formData.materialName}
                            onChange={handleChange}
                            error={errors.materialName}
                            required
                        />
                        <SelectInput
                            label="Store"
                            name="storeId"
                            value={formData.storeId}
                            onChange={handleChange}
                            options={(stores || []).map(s => ({ value: s.storeId, label: s.storeName }))}
                            defaultOptionLabel="Select Store"
                            error={errors.storeId}
                            required
                            disabled={isEdit}
                        />
                        <SelectInput
                            label="Raw Material Category"
                            name="categoryId"
                            value={formData.categoryId}
                            onChange={handleChange}
                            options={rawMaterialCategories.map(c => ({ value: String(c.id), label: c.name }))}
                            defaultOptionLabel="Select Category"
                            error={errors.categoryId}
                            required
                            disabled={isEdit}
                        />
                        <UOMSelect
                            name="baseUom"
                            label="Base UOM"
                            value={formData.baseUom}
                            required
                            isMulti
                            category={["length", "mass", "each", "volume"]}
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
                            disabled={isEdit}
                        />
                        <QuantityInput
                            label="Opening Stock"
                            name="onHandQty"
                            value={formData.onHandQty}
                            baseUoms={formData.baseUom}
                            onChange={handleChange}
                            error={errors.onHandQty}
                            required
                            disabled={isEdit}
                        />
                        <SelectInput
                            label="Status"
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            options={[
                                { value: "Active", label: "Active" },
                                { value: "Inactive", label: "Inactive" },
                            ]}
                        />
                        <div className="md:col-span-2">
                            <TextInput
                                label="Remarks"
                                name="remarks"
                                value={formData.remarks}
                                onChange={handleChange}
                                error={errors.remarks}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 mt-8">
                        <CustomButton
                            type="button"
                            text="Clear"
                            icon={FaEraser}
                            onClick={handleClear}
                            variant="secondary"
                            disabled={isSubmitting}
                        />
                        <CustomButton
                            type="submit"
                            text={isSubmitting ? "Saving..." : "Save Product"}
                            icon={FaSave}
                            variant="primary"
                            disabled={isSubmitting}
                        />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WastageStoreForm;
