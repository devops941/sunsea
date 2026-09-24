import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaSave, FaEraser, FaPlus, FaCheck } from "react-icons/fa";
import { toast } from "react-toastify";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";

import TextInput from "../../../components/form/TextInput/TextInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import BusyItemsTable, { type BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import AutocompleteInput, { type AutocompleteOption } from "../../../components/form/AutocompleteInput/AutocompleteInput";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import RecordAuditInfo, { type AuditData } from "../../../components/ui/RecordAuditInfo/RecordAuditInfo";
import { invalidateCacheByPrefix } from "../../../hooks/useListCache";

import { salesProductService } from "../../../services/salesProductService";
import { productService } from "../../../services/productService";
import { usePermission } from "../../../hooks/usePermission";
import { useSocketSync } from "../../../hooks/useSocketSync";

type ComponentItem = { productCode: string; quantity: string };

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
    const [components, setComponents] = useState<ComponentItem[]>([{ productCode: "", quantity: "" }]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [products, setProducts] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const [isDirty, setIsDirty] = useState(false);
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
    const [auditInfo, setAuditInfo] = useState<AuditData | null>(null);

    const formRef = useRef<HTMLFormElement>(null);
    const handleSubmitRef = useRef<() => void>(() => {});
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    const handleFormKeyDown = useFormKeyboardNav(formRef);

    useFormShortcuts({ onSave: () => handleSubmitRef.current() });

    const loadProducts = useCallback(() => {
        productService.fetchAll().then((data: any) => {
            const list = Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : Array.isArray(data?.data) ? data.data : [];
            setProducts(list);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    useSocketSync("product", undefined, loadProducts);

    const populateForm = useCallback((sp: any) => {
        setFormData({
            salesProductName: sp.salesProductName || "",
        });
        if (sp.components && sp.components.length > 0) {
            setComponents(sp.components.map((it: any) => ({
                productCode: String(it.componentProductId),
                quantity: it.quantity != null ? String(it.quantity) : "",
            })));
        } else {
            setComponents([{ productCode: "", quantity: "" }]);
        }
    }, []);

    useEffect(() => {
        if (isEditMode && id) {
            setIsLoadingData(true);
            salesProductService.fetchById(id)
                .then((data: any) => {
                    populateForm(data);
                    setAuditInfo({
                        createdAt: data.createdAt,
                        createdBy: data.createdUserName || data.createdBy,
                        editHistory: data.editHistory,
                    });
                })
                .catch(() => {
                    toast.error("Failed to load Sales Product");
                    navigate("/sales-products");
                })
                .finally(() => setIsLoadingData(false));
        }
    }, [isEditMode, id, navigate, populateForm]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleAddComponent = useCallback(() => {
        setComponents(prev => [...prev, { productCode: "", quantity: "" }]);
        setIsDirty(true);
    }, []);

    const handleRemoveComponent = useCallback((index: number) => {
        setComponents(prev => {
            const next = prev.filter((_, i) => i !== index);
            return next.length > 0 ? next : [{ productCode: "", quantity: "" }];
        });
        setIsDirty(true);
    }, []);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.salesProductName.trim()) {
            newErrors.salesProductName = "Sales Product Name is required.";
        }

        const filledRows = components.filter(it => (it.productCode && it.productCode.trim() !== "") || (it.quantity && it.quantity.trim() !== ""));

        if (filledRows.length === 0) {
            newErrors.components = "At least one component product is required.";
            toast.error("At least one component product is required.");
        } else {
            components.forEach((it, index) => {
                if (it.productCode && (!it.quantity || Number(it.quantity) <= 0)) {
                    newErrors[`components.${index}.quantity`] = "Must be > 0";
                }
                if (!it.productCode && it.quantity) {
                    newErrors[`components.${index}.productCode`] = "Required";
                }
            });

            const validRows = components.filter(it => it.productCode && it.productCode.trim() !== "");
            if (validRows.length === 0) {
                newErrors.components = "At least one component product is required.";
                toast.error("At least one component product is required.");
            } else {
                const selectedIds = validRows.map(it => it.productCode).filter(Boolean);
                if (new Set(selectedIds).size !== selectedIds.length) {
                    newErrors.components = "Duplicate component products are not allowed.";
                    toast.error("Duplicate component products are not allowed.");
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleClear = () => {
        setFormData(initialFormState);
        setComponents([{ productCode: "", quantity: "" }]);
        setErrors({});
    };

    const handleResume = useCallback(() => {
        setSaveConfirmOpen(false);
        if (resetRef.current) {
            const r = resetRef.current;
            proceedRef.current = null;
            resetRef.current = null;
            r();
        }
        setTimeout(() => {
            lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus();
        }, 50);
    }, []);

    const handleDiscard = useCallback(() => {
        setSaveConfirmOpen(false);
        setIsDirty(false);
        if (proceedRef.current) {
            const p = proceedRef.current;
            proceedRef.current = null;
            resetRef.current = null;
            p();
            return;
        }
        navigate("/sales-products");
    }, [navigate]);

    const handleSaveFromModal = useCallback(async () => {
        setSaveConfirmOpen(false);
        setTimeout(() => {
            handleSubmitRef.current();
        }, 50);
    }, []);

    handleSubmitRef.current = () => handleSubmit();

    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

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
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
            e.preventDefault();
            e.stopPropagation();
            if (saveConfirmOpenRef.current) {
                handleResume();
            } else if (isDirtyRef.current) {
                lastFocusedRef.current = document.activeElement as HTMLElement;
                setSaveConfirmOpen(true);
            } else {
                navigate("/sales-products");
            }
        };
        window.addEventListener("keydown", handleEscape, { capture: true });
        return () => window.removeEventListener("keydown", handleEscape, { capture: true });
    }, [handleResume, navigate]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e?.preventDefault) e.preventDefault();
        if (isSubmitting) return;
        if (!canSave) {
            toast.error("You do not have permission to perform this action.");
            return;
        }
        if (!validate()) return;

        const validRows = components.filter(it => it.productCode && it.productCode.trim() !== "");
        const payload: any = {
            salesProductName: formData.salesProductName,
            components: validRows.map(it => ({
                componentProductId: Number(it.productCode),
                quantity: Number(it.quantity) || 1,
            })),
        };

        setIsSubmitting(true);
        try {
            if (isEditMode && id) {
                const updated: any = await salesProductService.update(id, payload);
                invalidateCacheByPrefix("salesProducts");
                toast.success("Sales Product updated successfully!");
                if (updated) {
                    populateForm(updated);
                    setAuditInfo({
                        createdAt: updated.createdAt,
                        createdBy: updated.createdUserName || updated.createdBy,
                        editHistory: updated.editHistory,
                    });
                }
                setIsDirty(false);
            } else {
                await salesProductService.create(payload);
                invalidateCacheByPrefix("salesProducts");
                toast.success("Sales Product created successfully!");
                setIsDirty(false);
                handleClear();
                setTimeout(() => {
                    formRef.current?.querySelector<HTMLInputElement>("input[name='salesProductName']")?.focus();
                }, 50);
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.message || (isEditMode ? "Failed to update Sales Product" : "Failed to create Sales Product"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const productAutocompleteOptions: AutocompleteOption[] = useMemo(() => {
        return products
            .filter((p: any) => p.productType === "SALES_PRODUCTION")
            .map((p: any) => ({
                value: String(p.id),
                label: p.productName || p.productCode || String(p.id),
                info: p.productCode ? (
                    <span className="text-[11px] font-semibold text-ink-subtle">
                        {p.productCode}
                    </span>
                ) : undefined,
            }));
    }, [products]);

    const componentColumns: BusyColumn<ComponentItem>[] = useMemo(() => [
        {
            key: "productCode",
            header: "Product",
            width: "1fr",
            render: (row: ComponentItem, index: number, update: (patch: Partial<ComponentItem>) => void) => {
                const selectedInOtherRows = new Set(
                    components
                        .filter((_, i) => i !== index)
                        .map(r => String(r.productCode))
                        .filter(Boolean)
                );
                const opts = productAutocompleteOptions.map(o => ({
                    ...o,
                    disabled: selectedInOtherRows.has(o.value),
                }));
                return (
                    <AutocompleteInput
                        inline
                        name={`components.${index}.productCode`}
                        value={row?.productCode || ""}
                        options={opts}
                        placeholder="Type to search..."
                        error={errors[`components.${index}.productCode`]}
                        onChange={(pId) => {
                            update({ productCode: pId });
                            setIsDirty(true);
                            setErrors(prev => {
                                if (!prev[`components.${index}.productCode`] && !prev.components) return prev;
                                const next = { ...prev };
                                delete next[`components.${index}.productCode`];
                                delete next.components;
                                return next;
                            });
                            setTimeout(() => {
                                const qtyCell = document.querySelector(`[data-r="${index}"][data-c="1"]`) as HTMLElement | null;
                                const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                                if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
                            }, 50);
                        }}
                    />
                );
            },
        },
        {
            key: "quantity",
            header: "Quantity",
            width: "140px",
            align: "center" as const,
            render: (row: ComponentItem, index: number, update: (patch: Partial<ComponentItem>) => void) => {
                return (
                    <input
                        type="text"
                        inputMode="numeric"
                        data-nav
                        value={row?.quantity ?? ""}
                        onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, "");
                            update({ quantity: val });
                            setIsDirty(true);
                            setErrors(prev => {
                                if (!prev[`components.${index}.quantity`] && !prev.components) return prev;
                                const next = { ...prev };
                                delete next[`components.${index}.quantity`];
                                delete next.components;
                                return next;
                            });
                        }}
                        placeholder="0"
                        className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0"
                    />
                );
            },
        },
    ], [components, productAutocompleteOptions, errors]);

    if (isLoadingData) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <>
        <div className="w-full max-w-[1024px] xl:mr-auto">
            <div className="bg-card rounded-xl border border-line-soft shadow-xs">
                <div className="px-6 py-4 border-b border-line-soft flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold text-ink">{isEditMode ? "Edit Sales Product" : "Create Sales Product"}</h2>
                        {isEditMode && <RecordAuditInfo auditData={auditInfo} title="Sales Product" />}
                    </div>
                    <BackButton
                        text="Back to List"
                        onClick={() => {
                            if (isDirty) {
                                lastFocusedRef.current = document.activeElement as HTMLElement;
                                setSaveConfirmOpen(true);
                            } else {
                                navigate("/sales-products");
                            }
                        }}
                    />
                </div>

                <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="px-6 py-4 space-y-4" noValidate>
                    <div>
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
                        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-line-soft">
                            <h6 className="text-xs font-bold text-ink uppercase tracking-wide m-0">
                                Component Products <span className="text-rose-500 ml-1">*</span>
                            </h6>
                        </div>

                        {errors.components && (
                            <p className="mb-2 text-[11px] text-rose-400 font-medium">{errors.components}</p>
                        )}

                        <BusyItemsTable<ComponentItem>
                            columns={componentColumns}
                            rows={components}
                            onChange={(newRows) => {
                                setComponents(newRows);
                                setIsDirty(true);
                            }}
                            emptyRow={{ productCode: "", quantity: "" }}
                            onAdd={handleAddComponent}
                            onRemove={handleRemoveComponent}
                            editable={canSave}
                            visibleRows={10}
                        />
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
        <CommonConfirmModal
            isOpen={saveConfirmOpen}
            onClose={handleResume}
            onCancel={handleDiscard}
            onConfirm={handleSaveFromModal}
            title="Unsaved Changes"
            message="You have unsaved changes. Do you want to save before leaving?"
            warningText="Save to keep your changes, or Discard to leave."
            confirmText="Save"
            cancelText="Discard"
            cancelVariant="danger"
            confirmVariant="primary"
            confirmIcon={FaCheck}
            isDangerous={false}
            defaultFocusCancel={false}
        />
        </>
    );
};

export default SalesProductForm;
