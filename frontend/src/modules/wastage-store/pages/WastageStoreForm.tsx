import React, { useState, useEffect, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { FaSave, FaEraser, FaCheck } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import BackButton from "../../../components/ui/BackButton/BackButton";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createRawMaterial, updateRawMaterial } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { convertToPrimaryUom } from "../../../utils/uomConversion";
import { categoryService } from "../../../services/categoryService";

const initialFormState = {
    rawMaterialId: "",
    materialName: "",
    categoryId: "" as string | number,
    storeId: "",
    baseUom: "",
    onHandQty: "",
    narration: "",
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
    narration: z
        .string()
        .trim()
        .max(255, "Narration cannot exceed 255 characters")
        .optional(),
});

const WastageStoreForm: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openingStockUom, setOpeningStockUom] = useState("");
    const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string | number }[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const handleSubmitRef = useRef<() => void>(() => {});
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    const handleFormKeyDown = useFormKeyboardNav(formRef);

    useFormShortcuts({ onSave: () => handleSubmitRef.current() });

    const { data: stores } = useAppSelector(state => state.stores);

    const fetchStoresData = useCallback(() => {
        dispatch(fetchStores({ storeCategory: "WASTAGE" }));
    }, [dispatch]);

    useSocketSync("store", undefined, fetchStoresData);

    useEffect(() => {
        categoryService.fetchAll({ type: "WASTAGE", isActive: true }).then((res) => {
            const list = res?.categories ?? res ?? [];
            if (Array.isArray(list) && list.length > 0) {
                setCategoryOptions(list.map((c: any) => ({ label: c.name, value: c.id })));
            } else {
                categoryService.fetchAll({ isActive: true }).then((allRes) => {
                    const allList = allRes?.categories ?? allRes ?? [];
                    setCategoryOptions(Array.isArray(allList) ? allList.map((c: any) => ({ label: c.name, value: c.id })) : []);
                });
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        setOpeningStockUom("");
    }, [formData.baseUom]);

    useEffect(() => {
        fetchStoresData();

        if (isEditMode && locationState.state) {
            setFormData({
                rawMaterialId: locationState.state.rawMaterialId,
                materialName: locationState.state.materialName,
                categoryId: locationState.state.categoryId ?? locationState.state.category?.id ?? "",
                storeId: locationState.state.storeId || locationState.state.store?.storeId || "",
                baseUom: locationState.state.baseUom || "",
                onHandQty: locationState.state.onHandQty !== null && locationState.state.onHandQty !== undefined ? String(locationState.state.onHandQty) : "",
                narration: locationState.state.narration || locationState.state.remarks || "",
                status: locationState.state.isActive ? "Active" : "Inactive",
            });
        } else if (!isEditMode) {
            const getNextId = async () => {
                try {
                    const nextId = await rawMaterialService.fetchNextId();
                    setFormData(prev => ({ ...prev, rawMaterialId: nextId }));
                } catch {
                    // silent — next ID is non-critical
                }
            };
            getNextId();
        }
    }, [isEditMode, locationState.state, fetchStoresData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleClear = () => {
        if (isEditMode && locationState.state) {
            setFormData({
                rawMaterialId: locationState.state.rawMaterialId,
                materialName: locationState.state.materialName,
                categoryId: locationState.state.categoryId ?? locationState.state.category?.id ?? "",
                storeId: locationState.state.storeId || locationState.state.store?.storeId || "",
                baseUom: locationState.state.baseUom || "",
                onHandQty: locationState.state.onHandQty !== null && locationState.state.onHandQty !== undefined ? String(locationState.state.onHandQty) : "",
                narration: locationState.state.narration || locationState.state.remarks || "",
                status: locationState.state.isActive ? "Active" : "Inactive",
            });
        } else {
            setFormData(prev => ({ ...initialFormState, rawMaterialId: prev.rawMaterialId }));
            setOpeningStockUom("");
        }
        setErrors({});
    };

    handleSubmitRef.current = () => handleSubmit({ preventDefault: () => {} } as React.FormEvent);

    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
            e.preventDefault();
            e.stopPropagation();
            if (saveConfirmOpenRef.current) {
                setSaveConfirmOpen(false);
                setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50);
            } else if (isDirtyRef.current) {
                lastFocusedRef.current = document.activeElement as HTMLElement;
                setSaveConfirmOpen(true);
            } else {
                navigate("/wastage-store");
            }
        };
        window.addEventListener("keydown", handleEscape, { capture: true });
        return () => window.removeEventListener("keydown", handleEscape, { capture: true });
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return;

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
            const primaryUom = formData.baseUom.split(",")[0]?.trim() || "";
            const convertedOnHandQty = convertToPrimaryUom(
                formData.onHandQty ? Number(formData.onHandQty) : 0,
                openingStockUom || primaryUom,
                formData.baseUom
            );

            const payload: any = {
                rawMaterialId: formData.rawMaterialId,
                materialName: formData.materialName,
                categoryId: formData.categoryId ? Number(formData.categoryId) : null,
                storeId: formData.storeId || null,
                baseUom: formData.baseUom,
                onHandQty: convertedOnHandQty,
                narration: formData.narration || null,
                status: formData.status,
                isActive: formData.status === "Active",
                itemType: "WASTAGE"
            };

            if (isEditMode) {
                await dispatch(updateRawMaterial({ id: id as string, data: payload })).unwrap();
                toast.success("Wastage product updated successfully!");
            } else {
                await dispatch(createRawMaterial(payload)).unwrap();
                toast.success("Wastage product created successfully!");
            }

            setIsDirty(false);
            navigate("/wastage-store");
        } catch (err: any) {
            toast.error(typeof err === 'string' ? err : err?.message || (isEditMode ? "Failed to update wastage product" : "Failed to create wastage product"));
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-[1024px] xl:mr-auto h-full flex flex-col">
            <div className="bg-card rounded-xl shadow-xs border border-line-soft flex flex-col flex-1 h-full">
                <div className="px-6 py-4 border-b border-line-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-ink">
                        {isEditMode ? "Edit Wastage Product" : "Create Wastage Product"}
                    </h2>
                    <BackButton text="Back to List" to="/wastage-store" />
                </div>

                <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col flex-1" noValidate>
                    <div className="px-6 py-4 flex-1 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Row 1: Wastage ID | Material Name | Category */}
                            <TextInput
                                label="Wastage ID"
                                name="rawMaterialId"
                                value={formData.rawMaterialId}
                                readOnly
                                disabled
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
                                label="Category"
                                name="categoryId"
                                value={formData.categoryId}
                                onChange={handleChange}
                                options={categoryOptions}
                                defaultOptionLabel="Select Category"
                            />

                            {/* Row 2: Store (narrow) | Base UOM (wide) */}
                            <SelectInput
                                label="Store"
                                name="storeId"
                                value={formData.storeId}
                                onChange={handleChange}
                                options={(stores || []).map((s: any) => ({ value: String(s.storeId), label: s.storeName }))}
                                defaultOptionLabel="Select Store"
                                error={errors.storeId}
                                required
                                disabled={isEditMode}
                            />
                            <div className="md:col-span-2">
                                <UOMSelect
                                    name="baseUom"
                                    label="Base UOM"
                                    value={formData.baseUom}
                                    required
                                    isMulti
                                    category={["length", "mass", "each", "volume"]}
                                    allowedCodes={[
                                        "kg", "g", "mt",
                                        "l", "ml",
                                        "m", "cm", "mm",
                                        "dz", "ea"
                                    ]}
                                    onChange={(value) => {
                                        setFormData(prev => ({ ...prev, baseUom: value }));
                                        if (errors.baseUom) {
                                            setErrors(prev => ({ ...prev, baseUom: "" }));
                                        }
                                    }}
                                    error={errors.baseUom}
                                    disabled={isEditMode}
                                />
                            </div>

                            {/* Row 3: Opening Stock | Status | Narration */}
                            <QuantityInput
                                label="Opening Stock"
                                name="onHandQty"
                                value={formData.onHandQty}
                                baseUoms={formData.baseUom}
                                uom={openingStockUom || undefined}
                                onUomChange={setOpeningStockUom}
                                onChange={handleChange}
                                error={errors.onHandQty}
                                required
                                disabled={isEditMode}
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
                            <TextInput
                                label="Narration"
                                name="narration"
                                value={formData.narration}
                                onChange={handleChange}
                                error={errors.narration}
                            />
                        </div>
                    </div>

                    <div className="px-6 py-4 flex justify-end gap-3 border-t border-line-soft bg-card-2">
                        {!isEditMode && (
                            <CustomButton
                                type="button"
                                text="Clear"
                                icon={FaEraser}
                                variant="secondary"
                                onClick={handleClear}
                                disabled={isSubmitting}
                            />
                        )}
                        <CustomButton
                            type="submit"
                            text={isSubmitting ? (isEditMode ? "Updating..." : "Saving...") : (isEditMode ? "Update Product" : "Save Product")}
                            icon={FaSave}
                            disabled={isSubmitting}
                        />
                    </div>
                </form>
            </div>
        <CommonConfirmModal
            show={saveConfirmOpen}
            onHide={() => { setSaveConfirmOpen(false); setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50); }}
            onConfirm={() => {
                setSaveConfirmOpen(false);
                setTimeout(() => {
                    handleSubmitRef.current();
                    setTimeout(() => formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(), 100);
                }, 150);
            }}
            title="Unsaved Changes"
            message="You have unsaved changes. Do you want to save before leaving?"
            confirmText="Save"
            cancelText="Discard"
            confirmVariant="primary"
            confirmIcon={FaCheck}
            onCancel={() => { setSaveConfirmOpen(false); setIsDirty(false); navigate("/wastage-store"); }}
        />
        </div>
    );
};

export default WastageStoreForm;
