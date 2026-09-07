import React, { useState, useEffect, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { FaSave, FaEraser, FaCheck } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createRawMaterial, updateRawMaterial } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { rawMaterialService } from "../../../services/rawMaterialService";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { z } from "zod";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { categoryService } from "../../../services/categoryService";
import { convertToPrimaryUom } from "../../../utils/uomConversion";

const initialFormState = {
    rawMaterialId: "",
    materialName: "",
    categoryId: "" as string | number,
    minimumStock: "",
    storeId: "",
    baseUom: "",
    reorderLevel: "",
    rate: "",
    batchNo: "",
    onHandQty: "",
    reservedQty: "",
    narration: "",
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

        rate: z
            .string()
            .trim()
            .min(1, "Rate is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Rate must be greater than or equal to 0",
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

        narration: z
            .string()
            .trim()
            .max(500, "Narration cannot exceed 500 characters")
            .optional(),

        status: z.enum(["Active", "Inactive"], {
            error: "Status is required",
        }),
    })
    .refine(
        data => Number(data.reorderLevel) >= Number(data.minimumStock),
        {
            path: ["reorderLevel"],
            message: "Reorder Level must be greater than or equal to Minimum Stock",
        }
    );

const RawMaterialForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const [openingStockUom, setOpeningStockUom] = useState("");
    const [minimumStockUom, setMinimumStockUom] = useState("");
    const [reorderLevelUom, setReorderLevelUom] = useState("");
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
        dispatch(fetchStores({ storeCategory: "RAW_MATERIAL" }));
    }, [dispatch]);

    useSocketSync("store", undefined, fetchStoresData);

    const fetchCategoriesData = useCallback(() => {
        categoryService.fetchAll({ type: "RAW_MATERIAL", isActive: true }).then((res) => {
            const list = res?.categories ?? res ?? [];
            setCategoryOptions(
                Array.isArray(list) ? list.map((c: any) => ({ label: c.name, value: c.id })) : []
            );
        }).catch(() => {});
    }, []);

    useEffect(() => {
        fetchCategoriesData();
    }, [fetchCategoriesData]);

    // Keep category dropdown fresh when categories change in another tab
    useSocketSync("category", undefined, fetchCategoriesData);

    useEffect(() => {
        setOpeningStockUom("");
        setMinimumStockUom("");
        setReorderLevelUom("");
    }, [formData.baseUom]);

    const populateFormData = useCallback((data: any) => {
        setFormData({
            rawMaterialId: data.rawMaterialId || "",
            materialName: data.materialName || "",
            categoryId: data.categoryId ?? "",
            minimumStock: data.minimumStock !== null && data.minimumStock !== undefined ? String(data.minimumStock) : "",
            storeId: data.storeId || data.store?.storeId || "",
            baseUom: data.baseUom || "",
            reorderLevel: data.reorderLevel !== null && data.reorderLevel !== undefined ? String(data.reorderLevel) : "",
            rate: data.rate !== null && data.rate !== undefined ? String(data.rate) : (data.unitPrice !== null && data.unitPrice !== undefined ? String(data.unitPrice) : ""),
            batchNo: data.batchNo || "",
            onHandQty: data.onHandQty !== null && data.onHandQty !== undefined ? String(data.onHandQty) : "",
            reservedQty: data.reservedQty !== null && data.reservedQty !== undefined ? String(data.reservedQty) : "",
            narration: data.narration || data.remarks || "",
            lastMovementAt: data.lastMovementAt || "",
            status: data.status || (data.isActive ? "Active" : "Inactive"),
        });
    }, []);

    useEffect(() => {
        fetchStoresData();

        if (isEditMode && id) {
            const stateData = (location.state as any);
            if (stateData && stateData.rawMaterialId === id) {
                populateFormData(stateData);
            } else {
                setIsLoadingData(true);
                rawMaterialService.fetchById(id)
                    .then(data => {
                        populateFormData(data);
                    })
                    .catch(err => {
                        toast.error(err?.message || "Failed to load raw material data");
                        navigate("/raw-materials");
                    })
                    .finally(() => {
                        setIsLoadingData(false);
                    });
            }
        } else {
            rawMaterialService.fetchNextId()
                .then(nextId => {
                    setFormData(prev => ({ ...prev, rawMaterialId: nextId }));
                })
                .catch(() => {});
        }
    }, [isEditMode, id, location.state, fetchStoresData, populateFormData, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setIsDirty(true);
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
        setOpeningStockUom("");
        setMinimumStockUom("");
        setReorderLevelUom("");
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
                navigate("/raw-materials");
            }
        };
        window.addEventListener("keydown", handleEscape, { capture: true });
        return () => window.removeEventListener("keydown", handleEscape, { capture: true });
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

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
            const primaryUom = formData.baseUom.split(",")[0]?.trim() || "";
            const convertedOnHandQty = convertToPrimaryUom(
                formData.onHandQty ? Number(formData.onHandQty) : 0,
                openingStockUom || primaryUom,
                formData.baseUom
            );
            const convertedMinStock = convertToPrimaryUom(
                formData.minimumStock ? Number(formData.minimumStock) : 0,
                minimumStockUom || primaryUom,
                formData.baseUom
            );
            const convertedReorderLevel = convertToPrimaryUom(
                formData.reorderLevel ? Number(formData.reorderLevel) : 0,
                reorderLevelUom || primaryUom,
                formData.baseUom
            );

            const payload: any = {
                rawMaterialId: formData.rawMaterialId,
                materialName: formData.materialName,
                categoryId: formData.categoryId ? Number(formData.categoryId) : null,
                storeId: formData.storeId || null,
                baseUom: formData.baseUom,
                minimumStock: convertedMinStock,
                reorderLevel: convertedReorderLevel,
                rate: formData.rate ? Number(formData.rate) : null,
                onHandQty: convertedOnHandQty,
                reservedQty: formData.reservedQty ? Number(formData.reservedQty) : 0,
                batchNo: formData.batchNo || null,
                narration: formData.narration || null,
                status: formData.status,
                isActive: formData.status === "Active",
                itemType: "RAW_MATERIAL",
            };

            if (isEditMode && id) {
                await dispatch(updateRawMaterial({ id, data: payload })).unwrap();
                toast.success("Raw material updated successfully!");
            } else {
                await dispatch(createRawMaterial(payload)).unwrap();
                toast.success("Raw material created successfully!");
            }
            setIsDirty(false);
            navigate("/raw-materials");
        } catch (err: any) {
            toast.error(typeof err === 'string' ? err : err?.message || (isEditMode ? "Failed to update raw material" : "Failed to create raw material"));
            setIsSubmitting(false);
        }
    };

    if (isLoadingData) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1024px] xl:mr-auto h-full flex flex-col">
            <div className="bg-card rounded-xl shadow-xs border border-line-soft flex flex-col flex-1 h-full">
                <div className="px-6 py-4 border-b border-line-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-ink">
                        {isEditMode ? "Edit Raw Material" : "Create Raw Material"}
                    </h2>
                    <BackButton text="Back to List" to="/raw-materials" />
                </div>

                <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col flex-1" noValidate>
                    <div className="px-6 py-4 flex-1 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Row 1: ID (narrow) | Material Name (wide) */}
                            <TextInput
                                label="Raw Material ID"
                                name="rawMaterialId"
                                value={formData.rawMaterialId}
                                disabled={true}
                                required
                                error={errors.rawMaterialId}
                                onChange={handleChange}
                            />
                            <div className="md:col-span-2">
                                <TextInput
                                    label="Material Name"
                                    name="materialName"
                                    value={formData.materialName}
                                    required
                                    error={errors.materialName}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Row 2: Category | Store */}
                            <SelectInput
                                label="Category"
                                name="categoryId"
                                value={formData.categoryId}
                                options={categoryOptions}
                                onChange={handleChange}
                                searchable
                            />
                            <div className="md:col-span-2">
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
                            </div>

                            {/* Row 3: Base UOM (full width) */}
                            <div className="md:col-span-3">
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
                                />
                            </div>

                            {/* Row 4: Opening Stock | Minimum Stock | Reorder Level */}
                            <QuantityInput
                                label="Opening Stock"
                                name="onHandQty"
                                value={formData.onHandQty}
                                baseUoms={formData.baseUom}
                                uom={openingStockUom || undefined}
                                onUomChange={setOpeningStockUom}
                                required
                                error={errors.onHandQty}
                                onChange={handleChange}
                                disabled={isEditMode}
                            />
                            <QuantityInput
                                label="Minimum Stock"
                                name="minimumStock"
                                value={formData.minimumStock}
                                baseUoms={formData.baseUom}
                                uom={minimumStockUom || undefined}
                                onUomChange={setMinimumStockUom}
                                required
                                error={errors.minimumStock}
                                onChange={handleChange}
                            />
                            <QuantityInput
                                label="Reorder Level"
                                name="reorderLevel"
                                value={formData.reorderLevel}
                                baseUoms={formData.baseUom}
                                uom={reorderLevelUom || undefined}
                                onUomChange={setReorderLevelUom}
                                required
                                error={errors.reorderLevel}
                                onChange={handleChange}
                            />

                            {/* Row 5: Rate (narrow) | Status (narrow) | Narration (wide) */}
                            <TextInput
                                type="number"
                                label="Rate"
                                name="rate"
                                value={formData.rate}
                                required
                                error={errors.rate}
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
                            <TextInput
                                label="Narration"
                                name="narration"
                                value={formData.narration}
                                error={errors.narration}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="px-6 py-4 flex justify-end gap-3 border-t border-line-soft bg-card-2">
                        {!isEditMode && (
                            <CustomButton text="Clear" icon={FaEraser} variant="secondary" onClick={handleClear} disabled={isSubmitting} />
                        )}
                        <CustomButton
                            text={isSubmitting ? (isEditMode ? "Updating..." : "Saving...") : (isEditMode ? "Update Material" : "Save Material")}
                            icon={FaSave}
                            type="submit"
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
                onCancel={() => { setSaveConfirmOpen(false); setIsDirty(false); navigate("/raw-materials"); }}
            />
        </div>
    );
};

export default RawMaterialForm;
