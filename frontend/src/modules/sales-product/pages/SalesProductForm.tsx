import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaSave, FaEraser, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { useForm, useFieldArray, useWatch } from "react-hook-form";

import TextInput from "../../../components/form/TextInput/TextInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import OrderItemsTable from "../../../components/form/OrderItemsTable/OrderItemsTable";

import { salesProductService } from "../../../services/salesProductService";
import { productService } from "../../../services/productService";
import { usePermission } from "../../../hooks/usePermission";
import { useSocketSync } from "../../../hooks/useSocketSync";

type ComponentItem = { productCode: string; quantity: string };

const productLabel = (p: any) => {
    const typeLabel = p.productType === "SALES_PRODUCTION" ? "Sales Production" : "Production";
    return `${p.productName}`;
};

const initialFormState = {
    salesProductName: "",
};

const SalesProductForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const location = useLocation();
    const { can } = usePermission();

    const canSave = isEditMode ? can("sales_products.edit") : can("sales_products.create");

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [products, setProducts] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const {
        control,
        getValues,
        setValue,
        setError,
        clearErrors,
        formState: { errors: itemErrors },
    } = useForm<{ items: ComponentItem[] }>({ defaultValues: { items: [] } });
    const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
    const currentItems = useWatch({ control, name: "items" }) || [];

    const loadProducts = useCallback(() => {
        productService.fetchAll().then(setProducts).catch(() => {});
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    // Keep products dropdown fresh when a product is added/updated in another tab
    useSocketSync("product", undefined, loadProducts);

    const populateForm = useCallback((sp: any) => {
        setFormData({
            salesProductName: sp.salesProductName || "",
        });
        replace((sp.components || []).map((it: any) => ({
            productCode: String(it.componentProductId),
            quantity: it.quantity != null ? String(it.quantity) : "",
        })));
    }, [replace]);

    useEffect(() => {
        if (isEditMode && id) {
            const stateData = location.state as any;
            if (stateData && String(stateData.id) === String(id)) {
                populateForm(stateData);
            } else {
                setIsLoadingData(true);
                salesProductService.fetchById(id)
                    .then(populateForm)
                    .catch(() => {
                        toast.error("Failed to load Sales Product");
                        navigate("/sales-products");
                    })
                    .finally(() => setIsLoadingData(false));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleAddItem = () => append({ productCode: "", quantity: "" });

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        clearErrors();

        if (!formData.salesProductName.trim()) newErrors.salesProductName = "Sales Product Name is required.";
        const items = getValues("items");
        if (items.length === 0) {
            newErrors.items = "At least one component product is required.";
        } else {
            const ids = items.map(it => it.productCode).filter(Boolean);
            if (new Set(ids).size !== ids.length) {
                newErrors.items = "Duplicate component products are not allowed.";
            }
            items.forEach((it, index) => {
                if (!it.productCode) setError(`items.${index}.productCode`, { type: "manual", message: "Required" });
                if (!it.quantity || Number(it.quantity) <= 0) setError(`items.${index}.quantity`, { type: "manual", message: "Must be > 0" });
            });
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0 || items.some(it => !it.productCode || !it.quantity || Number(it.quantity) <= 0)) {
            toast.error(newErrors.items || newErrors.salesProductName || "Please fix the highlighted fields.");
            return false;
        }
        return true;
    };

    const handleClear = () => {
        setFormData(initialFormState);
        replace([]);
        setErrors({});
        clearErrors();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!canSave) {
            toast.error("You do not have permission to perform this action.");
            return;
        }
        if (!validate()) return;

        const payload: any = {
            salesProductName: formData.salesProductName,
            components: getValues("items").map(it => ({
                componentProductId: Number(it.productCode),
                quantity: Number(it.quantity),
            })),
        };

        setIsSubmitting(true);
        try {
            if (isEditMode && id) {
                await salesProductService.update(id, payload);
                toast.success("Sales Product updated successfully!");
            } else {
                await salesProductService.create(payload);
                toast.success("Sales Product created successfully!");
            }
            navigate("/sales-products");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || (isEditMode ? "Failed to update Sales Product" : "Failed to create Sales Product"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const componentProductOptions = useMemo(() => {
        return products
            .filter((p: any) => p.productType === "SALES_PRODUCTION")
            .map((p: any) => ({
                value: String(p.id),
                label: productLabel(p),
                disabled: currentItems.some((it: any) => String(it.productCode) === String(p.id)),
            }));
    }, [products, currentItems]);

    if (isLoadingData) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1024px] xl:mr-auto">
            <div className="bg-card rounded-xl border border-line-soft shadow-xs">
                <div className="px-6 py-4 border-b border-line-soft">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-ink">{isEditMode ? "Edit Sales Product" : "Create Sales Product"}</h2>
                        <BackButton text="Back to List" to="/sales-products" />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-3 space-y-4">
                    <div>
                        <h6 className="text-base font-semibold text-ink mb-3">Basic Information</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <TextInput
                                label="Sales Product Name"
                                name="salesProductName"
                                value={formData.salesProductName}
                                placeholder="e.g. 3L Container"
                                required
                                onChange={handleChange}
                                error={errors.salesProductName}
                                disabled={!canSave}
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="flex justify-between items-center mb-3">
                            <h6 className="text-base font-semibold text-ink m-0">
                                Component Products <span className="text-rose-500 ml-1">*</span>
                            </h6>
                            {canSave && (
                                <CustomButton text="Add Component" icon={FaPlus} onClick={handleAddItem} type="button" size="sm" variant="secondary" />
                            )}
                        </div>
                        {fields.length > 0 ? (
                            <OrderItemsTable
                                control={control}
                                fields={fields}
                                errors={itemErrors}
                                productOptions={componentProductOptions}
                                remove={remove}
                                editable={canSave}
                            />
                        ) : (
                            <div className={`text-sm italic p-4 rounded-xl border border-dashed text-center ${errors.items ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-medium' : 'bg-card-2 border-line-soft text-ink-subtle'}`}>
                                No components added. Click "Add Component" to specify what this sales product is assembled from.
                            </div>
                        )}
                        {errors.items && fields.length > 0 && (
                            <p className="mt-1.5 text-sm text-rose-400 font-medium">{errors.items}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-line-soft mt-4">
                        {!isEditMode && canSave && (
                            <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} variant="secondary" disabled={isSubmitting} type="button" />
                        )}
                        {canSave && (
                            <CustomButton
                                text={isSubmitting ? "Saving..." : (isEditMode ? "Save Changes" : "Save Sales Product")}
                                icon={FaSave}
                                type="submit"
                                disabled={isSubmitting}
                            />
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SalesProductForm;
