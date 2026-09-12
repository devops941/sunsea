import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";
import { useNavigate, useParams } from "react-router-dom";
import { FaSave, FaEraser, FaTimes, FaPlus, FaImage, FaCheck } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import CustomButton from "../../../components/ui/Button/Button";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import { useProducts } from "../../../hooks/useProducts";
import { productService } from "../../../services/productService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { getImageUrl } from "../../../utils/ImageUrls";
import { useSocketSync } from "../../../hooks/useSocketSync";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import BusyItemsTable, { type BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import AutocompleteInput, { type AutocompleteOption } from "../../../components/form/AutocompleteInput/AutocompleteInput";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { employeeService } from "../../../services/employeeService";
import { roleService } from "../../../services/roleService";
import { shiftService } from "../../../services/shiftService";
import { machineService } from "../../../services/machineService";
import { customerGradeService, type CustomerGrade } from "../../../services/customerGradeService";
import { categoryService } from "../../../services/categoryService";

const MAX_IMAGES = 7;

interface ExistingProductImage {
    id: string | number;
    imageUrl: string;
    isPrimary?: boolean;
}

const initialFormState = {
    productCode: "",
    productName: "",
    categoryId: "",
    weightPerPiece: "",
    weightUom: "g",
    productType: "SALES_PRODUCTION",
    description: "",
    isActive: "true",
    rate: "",
    minimumQty: "",
    openingStockQty: "",
    openingStockStoreId: "",
};

type RawMaterialRow = { rawMaterialId: string; percentage: string };
type InitialCapacityRow = {
    capDate: string;
    capShiftId: string;
    capRoleId: string;
    capOperatorIds: string[];
    capQty: string;
    capMachine: string;
};

const ProductForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();

    const { addProduct, editProduct } = useProducts();

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [existingImages, setExistingImages] = useState<ExistingProductImage[]>([]);
    const [removedImageIds, setRemovedImageIds] = useState<(string | number)[]>([]);
    const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [stores, setStores] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const [formData, setFormData] = useState(initialFormState);

    const [rawMaterials, setRawMaterials] = useState<RawMaterialRow[]>([{ rawMaterialId: "", percentage: "" }]);
    const [allRawMaterials, setAllRawMaterials] = useState<any[]>([]);
    const [initialCapacities, setInitialCapacities] = useState<InitialCapacityRow[]>([]);

    const [employees, setEmployees] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [machines, setMachines] = useState<any[]>([]);
    const [customerGrades, setCustomerGrades] = useState<CustomerGrade[]>([]);
    // Grade-based dynamic pricing: { "<gradeName>": "<rate>" }
    const [gradeRates, setGradeRates] = useState<Record<string, string>>({});
    const [categories, setCategories] = useState<any[]>([]);

    const [isDirty, setIsDirty] = useState(false);
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const handleSubmitRef = useRef<() => void>(() => {});
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    const handleFormKeyDown = useFormKeyboardNav(formRef);

    useFormShortcuts({ onSave: () => handleSubmitRef.current() });

    const fetchStoresData = useCallback(() => {
        storeService.fetchAll({ storeCategory: "FINISHED_GOODS" }).then(res => {
            const data = Array.isArray(res?.stores) ? res.stores : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            setStores(data);
        }).catch(() => {});
    }, []);
    const fetchRawMaterialsData = useCallback(() => {
        rawMaterialService.fetchAll({}).then((res: any) => {
            const data = Array.isArray(res?.rawMaterials) ? res.rawMaterials : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
         
            setAllRawMaterials(data);
        }).catch(() => {});
    }, []);
    const fetchEmployeesData = useCallback(() => {
        employeeService.fetchAll({ limit: 500 }).then((res: any) => {
            const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.employees) ? res.employees : [];
            setEmployees(data);
        }).catch(() => {});
    }, []);
    const fetchRolesData = useCallback(() => {
        roleService.fetchAll({ limit: 100 }).then((res: any) => {
            const roleList = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
            setRoles(roleList);
        }).catch(() => {});
    }, []);
    const fetchShiftsData = useCallback(() => {
        shiftService.fetchAll().then((res: any) => {
            const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
            setShifts(data);
        }).catch(() => {});
    }, []);
    const fetchMachinesData = useCallback(() => {
        machineService.getAll().then((res: any) => {
            const data = Array.isArray(res) ? res : Array.isArray(res?.machines) ? res.machines : Array.isArray(res?.data) ? res.data : [];
            setMachines(data);
        }).catch(() => {});
    }, []);
    const fetchCustomerGradesData = useCallback(() => {
        customerGradeService.getAll().then((res: any) => {
            const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
            setCustomerGrades(data);
        }).catch(() => {});
    }, []);
    const fetchCategoriesData = useCallback(() => {
        categoryService.fetchAll({ type: "PRODUCT", isActive: true }).then((res: any) => {
            const list = res?.categories ?? res ?? [];
            if (Array.isArray(list) && list.length > 0) {
                setCategories(list);
            } else {
                categoryService.fetchAll({ isActive: true }).then((allRes: any) => {
                    const allList = allRes?.categories ?? allRes ?? [];
                    setCategories(Array.isArray(allList) ? allList : []);
                });
            }
        }).catch(() => {});
    }, []);

    useSocketSync("store", undefined, fetchStoresData);
    useSocketSync("rawMaterial", undefined, fetchRawMaterialsData);
    useSocketSync("employee", undefined, fetchEmployeesData);
    useSocketSync("role", undefined, fetchRolesData);
    useSocketSync("shift", undefined, fetchShiftsData);
    useSocketSync("machine", undefined, fetchMachinesData);
    useSocketSync("customerGrade", undefined, fetchCustomerGradesData);
    useSocketSync("category", undefined, fetchCategoriesData);

    const populateFormData = useCallback((productData: any) => {
        let latestStock: any = null;
        if (productData.finishedGoodsStocks && productData.finishedGoodsStocks.length > 0) {
            latestStock = [...productData.finishedGoodsStocks].sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        }

        setFormData({
            productCode: productData.productCode || "",
            productName: productData.productName || "",
            categoryId: productData.categoryId ? String(productData.categoryId) : (productData.category?.id ? String(productData.category.id) : ""),
            weightPerPiece: productData.weightPerPiece != null ? String(productData.weightPerPiece) : "",
            weightUom: productData.weightUom || "g",
            productType: productData.productType || "SALES_PRODUCTION",
            description: productData.description || "",
            isActive: productData.isActive ? "true" : "false",
            rate: productData.rate != null ? String(productData.rate) : "",
            minimumQty: productData.minimumQty != null ? String(productData.minimumQty) : "",
            openingStockQty: latestStock ? String(latestStock.onHandQty) : "",
            openingStockStoreId: latestStock ? String(latestStock.storeId) : "",
        });

        if (productData.billOfMaterials && productData.billOfMaterials.length > 0) {
            const loadedBOM = productData.billOfMaterials
                .filter((bom: any) => bom.percentage !== null)
                .map((bom: any) => ({
                    rawMaterialId: String(bom.rawMaterialId),
                    percentage: bom.percentage ? String(bom.percentage) : ""
                }));
            setRawMaterials(loadedBOM.length > 0 ? loadedBOM : [{ rawMaterialId: "", percentage: "" }]);
        } else {
            setRawMaterials([{ rawMaterialId: "", percentage: "" }]);
        }

        // Load grade-based rates from product data
        if (productData.gradeRates && typeof productData.gradeRates === "object") {
            const loaded: Record<string, string> = {};
            for (const [key, val] of Object.entries(productData.gradeRates)) {
                loaded[key] = String(val);
            }
            setGradeRates(loaded);
        } else {
            setGradeRates({});
        }

        const images: ExistingProductImage[] = (productData.images || []).slice();
        images.sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
        setExistingImages(images);
        setRemovedImageIds([]);
    }, []);

    useEffect(() => {
        fetchCategoriesData();
        fetchStoresData();
        fetchRawMaterialsData();
        fetchEmployeesData();
        fetchRolesData();
        fetchShiftsData();
        fetchMachinesData();
        fetchCustomerGradesData();

        if (isEditMode && id) {
            setIsLoadingData(true);
            productService.fetchById(id)
                .then(data => populateFormData(data))
                .catch(err => {
                    console.error("Failed to fetch product:", err);
                    toast.error("Failed to load product data");
                    navigate("/products");
                })
                .finally(() => setIsLoadingData(false));
        } else {
            productService.fetchNextId()
                .then(nextCode => setFormData(prev => ({ ...prev, productCode: nextCode })))
                .catch(err => console.error("Failed to fetch next product code", err));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, id]);

    useEffect(() => {
        return () => {
            newImagePreviews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [newImagePreviews]);

    // ─── Validation ──────────────────────────────────────────────────────
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.productName.trim())
            newErrors.productName = "Product Name is required.";

        if (!formData.categoryId)
            newErrors.categoryId = "Category is required.";

        if (!formData.weightPerPiece.toString().trim()) {
            newErrors.weightPerPiece = "Required";
        } else {
            const weight = Number(formData.weightPerPiece);
            if (isNaN(weight) || weight <= 0)
                newErrors.weightPerPiece = "Must be > 0";
        }


        if (!formData.openingStockQty.toString().trim()) {
            newErrors.openingStockQty = "Opening Stock Qty is required.";
        } else {
            const qty = Number(formData.openingStockQty);
            if (isNaN(qty) || qty < 0)
                newErrors.openingStockQty = "Must be 0 or greater.";
        }

        if (!formData.openingStockStoreId.toString().trim()) {
            newErrors.openingStockStoreId = "Opening Stock Store is required.";
        }

        const minQty = formData.minimumQty ? Number(formData.minimumQty) : NaN;
        if (!formData.minimumQty.toString().trim()) {
            newErrors.minimumQty = "Minimum Stock Qty is required.";
        } else if (isNaN(minQty) || minQty < 0) {
            newErrors.minimumQty = "Minimum Stock Qty must be 0 or greater.";
        }

        // Validate grade rates only when grades are configured
        if (customerGrades.length > 0) {
            const filledGradeRates = Object.entries(gradeRates).filter(([, v]) => v.toString().trim() !== "");
            if (filledGradeRates.length === 0) {
                newErrors.gradeRates = "At least one grade rate is required.";
            } else {
                for (const [gradeName, val] of filledGradeRates) {
                    const n = Number(val);
                    if (isNaN(n) || n <= 0) {
                        newErrors[`gradeRate_${gradeName}`] = "Must be > 0";
                    }
                }
            }
        }

        const filledRows = rawMaterials.filter(rm => (rm.rawMaterialId && rm.rawMaterialId.trim() !== "") || (rm.percentage && rm.percentage.trim() !== ""));

        if (filledRows.length === 0) {
            newErrors.rawMaterials = "At least one raw material is required for BOM composition.";
            toast.error("At least one raw material is required for BOM composition.");
        } else {
            rawMaterials.forEach((rm, index) => {
                if (rm.rawMaterialId && (!rm.percentage || Number(rm.percentage) <= 0)) {
                    newErrors[`rawMaterials.${index}.percentage`] = "Invalid %";
                }
                if (!rm.rawMaterialId && rm.percentage) {
                    newErrors[`rawMaterials.${index}.rawMaterialId`] = "Required";
                }
            });

            const validRmRows = rawMaterials.filter(rm => rm.rawMaterialId && rm.rawMaterialId.trim() !== "");
            if (validRmRows.length === 0) {
                newErrors.rawMaterials = "At least one raw material is required for BOM composition.";
                toast.error("At least one raw material is required for BOM composition.");
            } else {
                const totalPercent = validRmRows.reduce((acc, rm) => acc + (Number(rm.percentage) || 0), 0);
                if (Math.abs(totalPercent - 100) > 0.01) {
                    newErrors.rawMaterials = `Total percentage must be exactly 100% (currently ${totalPercent.toFixed(2)}%)`;
                    toast.error(`Total Raw Material percentage must be exactly 100% (currently ${totalPercent.toFixed(2)}%)`);
                }

                const selectedRmIds = validRmRows.map(rm => rm.rawMaterialId).filter(Boolean);
                const uniqueRmIds = new Set(selectedRmIds);
                if (uniqueRmIds.size !== selectedRmIds.length) {
                    newErrors.rawMaterials = "Duplicate raw materials selected in BOM.";
                    toast.error("Duplicate raw materials selected in BOM");
                }
            }
        }

        // Validate Initial Capacity Setup fields — all fields mandatory when a setup is added
        if (initialCapacities.length > 0) {
            initialCapacities.forEach((cap, idx) => {
                if (!cap.capDate) newErrors[`cap_${idx}_date`] = "Date is required";
                if (!cap.capShiftId) newErrors[`cap_${idx}_shift`] = "Shift is required";
                if (!cap.capMachine) newErrors[`cap_${idx}_machine`] = "Machine is required";
                if (!cap.capRoleId) newErrors[`cap_${idx}_role`] = "Role is required";
                if (cap.capOperatorIds.length === 0) newErrors[`cap_${idx}_operators`] = "At least one operator is required";
                if (!cap.capQty || Number(cap.capQty) <= 0) newErrors[`cap_${idx}_qty`] = "Qty / Shift must be > 0";
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ─── Handlers ─────────────────────────────────────────────────────────
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleAddRawMaterial = useCallback(() => {
        setRawMaterials(prev => [...prev, { rawMaterialId: "", percentage: "" }]);
        setIsDirty(true);
    }, []);

    const handleRemoveRawMaterial = useCallback((index: number) => {
        setRawMaterials(prev => {
            const next = prev.filter((_, i) => i !== index);
            return next.length > 0 ? next : [{ rawMaterialId: "", percentage: "" }];
        });
        setIsDirty(true);
    }, []);

    const handleRawMaterialChange = useCallback((index: number, field: keyof RawMaterialRow, value: string) => {
        setRawMaterials(prev => {
            const newRm = [...prev];
            if (!newRm[index]) {
                newRm[index] = { rawMaterialId: "", percentage: "" };
            }
            newRm[index] = { ...newRm[index], [field]: value };
            return newRm;
        });
        setIsDirty(true);
        setErrors(prev => {
            if (!prev[`rawMaterials.${index}.${field}`] && !prev.rawMaterials) return prev;
            const next = { ...prev };
            delete next[`rawMaterials.${index}.${field}`];
            delete next.rawMaterials;
            return next;
        });
    }, []);

    const handleAddInitialCapacity = () => {
        setInitialCapacities(prev => [...prev, {
            capDate: new Date().toISOString().split("T")[0],
            capShiftId: "",
            capRoleId: "",
            capOperatorIds: [],
            capQty: "",
            capMachine: ""
        }]);
    };

    const handleRemoveInitialCapacity = (index: number) => {
        setInitialCapacities(prev => prev.filter((_, i) => i !== index));
    };

    const handleInitialCapacityChange = (index: number, field: keyof InitialCapacityRow, value: any) => {
        setInitialCapacities(prev => {
            const newCap = [...prev];
            newCap[index] = { ...newCap[index], [field]: value };
            if (field === 'capRoleId') {
                newCap[index].capOperatorIds = [];
            }
            return newCap;
        });
    };

    const remainingSlots = MAX_IMAGES - existingImages.length - newImageFiles.length;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        if (files.length > remainingSlots) {
            toast.error(
                remainingSlots > 0
                    ? `You can only add ${remainingSlots} more image(s) (max ${MAX_IMAGES} total).`
                    : `Maximum ${MAX_IMAGES} images allowed.`
            );
            return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        for (const file of files) {
            if (!allowedTypes.includes(file.type)) {
                toast.error("Only JPG, PNG, WEBP allowed");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error("Each image must be under 5MB");
                return;
            }
        }

        const previews = files.map(file => URL.createObjectURL(file));
        setNewImageFiles(prev => [...prev, ...files]);
        setNewImagePreviews(prev => [...prev, ...previews]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleRemoveExistingImage = (imageId: string | number) => {
        setExistingImages(prev => prev.filter(img => img.id !== imageId));
        setRemovedImageIds(prev => [...prev, imageId]);
    };

    const handleRemoveNewImage = (index: number) => {
        URL.revokeObjectURL(newImagePreviews[index]);
        setNewImageFiles(prev => prev.filter((_, i) => i !== index));
        setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleClear = () => {
        setFormData(prev => ({ ...initialFormState, productCode: prev.productCode }));
        setRawMaterials([{ rawMaterialId: "", percentage: "" }]);
        setInitialCapacities([]);
        setGradeRates({});
        setErrors({});
        setNewImageFiles([]);
        setNewImagePreviews([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    handleSubmitRef.current = () => handleSubmit({ preventDefault: () => {} } as React.FormEvent);

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
                setSaveConfirmOpen(false);
                setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50);
            } else if (isDirtyRef.current) {
                lastFocusedRef.current = document.activeElement as HTMLElement;
                setSaveConfirmOpen(true);
            } else {
                navigate(-1);
            }
        };
        window.addEventListener("keydown", handleEscape, { capture: true });
        return () => window.removeEventListener("keydown", handleEscape, { capture: true });
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!validateForm()) return;

        try {
            setIsSubmitting(true);
            const payload = new FormData();
            payload.append("productCode", formData.productCode);
            payload.append("productName", formData.productName);
            payload.append("categoryId", formData.categoryId);

            const totalCapQty = initialCapacities.reduce((acc, cap) => acc + Number(cap.capQty || 0), 0);
            if (totalCapQty > 0) payload.append("capacityLitres", String(totalCapQty));

            if (formData.weightPerPiece) payload.append("weightPerPiece", formData.weightPerPiece);
            if (formData.weightUom) payload.append("weightUom", formData.weightUom);

            payload.append("productType", formData.productType);
            if (formData.description) payload.append("description", formData.description);
            payload.append("isActive", String(formData.isActive === "true"));

            if (formData.rate) payload.append("rate", formData.rate);

            // Build grade rates object (only filled-in grades)
            const builtGradeRates: Record<string, number> = {};
            for (const [gradeName, val] of Object.entries(gradeRates)) {
                const n = Number(val);
                if (val.toString().trim() !== "" && !isNaN(n) && n > 0) {
                    builtGradeRates[gradeName] = n;
                }
            }
            if (Object.keys(builtGradeRates).length > 0) {
                payload.append("gradeRates", JSON.stringify(builtGradeRates));
            }

            payload.append("minimumQty", formData.minimumQty || "0");

            if (formData.openingStockQty) payload.append("openingStockQty", formData.openingStockQty);
            if (formData.openingStockStoreId) payload.append("openingStockStoreId", formData.openingStockStoreId);

            const validRawMaterials = rawMaterials.filter(rm => rm.rawMaterialId && String(rm.rawMaterialId).trim() !== "");
            const combinedBOM = validRawMaterials.map(rm => ({
                rawMaterialId: rm.rawMaterialId,
                percentage: rm.percentage,
                requiredQuantity: 0
            }));
            payload.append("rawMaterials", JSON.stringify(combinedBOM));

            if (initialCapacities.length > 0) {
                const capacityHistory = initialCapacities
                    .filter(cap => cap.capQty && Number(cap.capQty) > 0)
                    .map(cap => ({
                        recordedAt: cap.capDate,
                        shiftId: cap.capShiftId,
                        machineId: cap.capMachine,
                        operatorName: cap.capOperatorIds.map(id =>
                            employees.find(e => String(e.id) === id)?.fullName || id
                        ).join(", "),
                        newCapacity: Number(cap.capQty),
                    }));
                if (capacityHistory.length > 0) {
                    payload.append("capacityHistory", JSON.stringify(capacityHistory));
                }
            }

            newImageFiles.forEach(file => payload.append("images", file));
            removedImageIds.forEach(imgId => payload.append("removedImageIds", String(imgId)));
            if (existingImages.length > 0) {
                payload.append("primaryImageId", String(existingImages[0].id));
            }

            if (isEditMode && id) {
                await editProduct(id, payload as any);
                toast.success("Product updated successfully!");
                setIsDirty(false);
                navigate(-1);
            } else {
                await addProduct(payload as any);
                toast.success("Saved");
                setIsDirty(false);
                handleClear();
                try {
                    const nextCode = await productService.fetchNextId();
                    setFormData(prev => ({ ...prev, productCode: nextCode }));
                } catch (err) {
                    console.error("Failed to fetch next product code", err);
                }
                setTimeout(() => formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(), 50);
            }
        } catch (err: any) {
            toast.error(err.message || (isEditMode ? "Failed to update product" : "Failed to create product"));
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Options for dropdowns ───────────────────────────────────────────
    const categoryOptions = useMemo(() => (
        (categories || []).map(c => ({ value: String(c.id), label: c.name }))
    ), [categories]);

    const storeOptions = useMemo(() => [
        { value: "", label: "-- Select Store --" },
        ...stores.map(s => ({ value: String(s.storeId), label: s.storeCode ? `${s.storeName} (${s.storeCode})` : s.storeName })),
    ], [stores]);

    const bomAutocompleteOptions: AutocompleteOption[] = useMemo(() => {
        return allRawMaterials.map(rm => ({
            value: String(rm.rawMaterialId),
            label: rm.materialName || rm.materialCode || String(rm.rawMaterialId),
            info: rm.materialCode ? (
                <span className="text-[11px] font-semibold text-ink-subtle">
                    {rm.materialCode}
                </span>
            ) : undefined,
        }));
    }, [allRawMaterials]);

    const totalBOMPercentage = useMemo(() => {
        return rawMaterials.reduce((acc, rm) => acc + (Number(rm.percentage) || 0), 0);
    }, [rawMaterials]);

    const bomColumns: BusyColumn<RawMaterialRow>[] = useMemo(() => [
        {
            key: "rawMaterialId",
            header: "Item",
            width: "1fr",
            render: (row: RawMaterialRow, index: number, update: (patch: Partial<RawMaterialRow>) => void) => {
                const selectedInOtherRows = new Set(
                    rawMaterials
                        .filter((_, i) => i !== index)
                        .map(r => String(r.rawMaterialId))
                        .filter(Boolean)
                );
                const opts = bomAutocompleteOptions.map(o => ({
                    ...o,
                    disabled: selectedInOtherRows.has(o.value),
                }));
                return (
                    <AutocompleteInput
                        inline
                        name={`rawMaterials.${index}.rawMaterialId`}
                        value={row?.rawMaterialId || ""}
                        options={opts}
                        placeholder="Type to search..."
                        error={errors[`rawMaterials.${index}.rawMaterialId`]}
                        onChange={(rmId) => {
                            update({ rawMaterialId: rmId });
                            setIsDirty(true);
                            setErrors(prev => {
                                if (!prev[`rawMaterials.${index}.rawMaterialId`] && !prev.rawMaterials) return prev;
                                const next = { ...prev };
                                delete next[`rawMaterials.${index}.rawMaterialId`];
                                delete next.rawMaterials;
                                return next;
                            });
                            setTimeout(() => {
                                const pctCell = document.querySelector(`[data-r="${index}"][data-c="1"]`) as HTMLElement | null;
                                const pctInput = pctCell?.querySelector("input") as HTMLInputElement | null;
                                if (pctInput) { pctInput.focus(); pctInput.select(); }
                            }, 50);
                        }}
                    />
                );
            },
        },
        {
            key: "percentage",
            header: "Percentage (%)",
            width: "140px",
            align: "center" as const,
            render: (row: RawMaterialRow, index: number, update: (patch: Partial<RawMaterialRow>) => void) => {
                return (
                    <input
                        type="text"
                        inputMode="decimal"
                        data-nav
                        value={row?.percentage ?? ""}
                        onChange={e => {
                            const val = e.target.value.replace(/[^0-9.]/g, "");
                            const parts = val.split(".");
                            const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : val;
                            update({ percentage: cleanVal });
                            setIsDirty(true);
                            setErrors(prev => {
                                if (!prev[`rawMaterials.${index}.percentage`] && !prev.rawMaterials) return prev;
                                const next = { ...prev };
                                delete next[`rawMaterials.${index}.percentage`];
                                delete next.rawMaterials;
                                return next;
                            });
                        }}
                        placeholder="0.00"
                        className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0"
                    />
                );
            },
        },
    ], [rawMaterials, bomAutocompleteOptions, errors]);

    const hasAnyImage = existingImages.length > 0 || newImagePreviews.length > 0;

    if (isLoadingData) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <>
        <div className="w-full max-w-[1200px] mr-auto product-form-compact">
            {/* Compact overrides for child form components */}
            <style>{`
                .product-form-compact label { margin-bottom: 3px !important; font-size: 11px !important; }
                .product-form-compact input, .product-form-compact select,
                .product-form-compact button[role="combobox"] { height: 34px !important; min-height: 34px !important; font-size: 12px !important; padding-top: 0 !important; padding-bottom: 0 !important; }
                .product-form-compact [data-r] input { height: 100% !important; min-height: 0 !important; font-size: 13px !important; }
                .product-form-compact .group { margin-bottom: 0 !important; }
            `}</style>
            <div className="bg-card rounded-xl shadow-xs border border-line-soft overflow-visible">

                {/* ── Page Header ── */}
                <div className="px-5 py-3 border-b border-line-soft flex items-center justify-between">
                    <h2 className="text-base font-bold text-ink">{isEditMode ? "Edit Product" : "Create Product"}</h2>
                    <BackButton text="Back to List" to="/products" />
                </div>

                <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="px-5 py-3 space-y-3" noValidate>

                    {/* ── Section 1: Basic Product Details ── */}
                    <div>
                        <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-line-soft">
                            <h3 className="text-xs font-bold text-ink uppercase tracking-wide">Basic Product Details</h3>
                        </div>
                        <div className="grid grid-cols-4 gap-x-4 gap-y-1.5">
                            <TextInput label="Product Code" name="productCode" value={formData.productCode} placeholder="e.g. PRD-001" required onChange={handleChange} disabled />
                            <TextInput label="Product Name" name="productName" value={formData.productName} placeholder="e.g. Plastic Bucket 20L" required onChange={handleChange} error={errors.productName} />
                            <SelectInput label="Category" name="categoryId" value={formData.categoryId} options={categoryOptions} defaultOptionLabel="-- Select Category --" required onChange={handleChange} error={errors.categoryId} disabled={isEditMode} />
                            <SelectInput label="Product Type" name="productType" value={formData.productType} options={[{ value: "PRODUCTION", label: "Production" }, { value: "SALES_PRODUCTION", label: "Sales Production" }]} required onChange={handleChange} error={errors.productType} />
                            <QuantityInput label="Weight per Piece" name="weightPerPiece" required value={formData.weightPerPiece} baseUoms="g,kg" uom={formData.weightUom} onUomChange={(val) => setFormData(prev => ({ ...prev, weightUom: val }))} onChange={handleChange} error={errors.weightPerPiece} disabled={isEditMode} />
                            <TextInput label="Rate (₹)" name="rate" type="number" step="0.01" value={formData.rate} placeholder="0.00" onChange={handleChange} error={errors.rate} />
                            <SelectInput label="Opening Stock Store" name="openingStockStoreId" required value={formData.openingStockStoreId} options={storeOptions} onChange={handleChange} error={errors.openingStockStoreId} disabled={isEditMode} />
                            <TextInput label="Opening Stock Qty" name="openingStockQty" type="number" placeholder="0" required value={formData.openingStockQty} onChange={handleChange} error={errors.openingStockQty} disabled={isEditMode} />
                            <TextInput label="Minimum Stock Qty" name="minimumQty" type="number" placeholder="0" value={String(formData.minimumQty)} onChange={handleChange} required error={errors.minimumQty} />
                            <SelectInput label="Status" name="isActive" value={formData.isActive} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} onChange={handleChange} />
                            <TextInput label="Description" name="description" value={formData.description} placeholder="Enter catalogue description..." onChange={handleChange} />
                        </div>
                    </div>

                    {/* ── Section 2: Grade Rates ── */}
                    {customerGrades.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-line-soft">
                                <h3 className="text-xs font-bold text-ink uppercase tracking-wide">Grade Rates (₹) <span className="text-rose-500">*</span></h3>
                            </div>
                            <div className="grid grid-cols-4 gap-x-4 gap-y-1.5">
                                {customerGrades.map((grade) => (
                                    <TextInput
                                        key={grade.id}
                                        label={`${grade.name} Rate (₹)`}
                                        name={`gradeRate_${grade.name}`}
                                        type="number"
                                        step="0.01"
                                        value={gradeRates[grade.name] ?? ""}
                                        placeholder="0.00"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setGradeRates(prev => ({ ...prev, [grade.name]: val }));
                                            if (errors[`gradeRate_${grade.name}`] || errors.gradeRates) {
                                                setErrors(prev => ({ ...prev, [`gradeRate_${grade.name}`]: "", gradeRates: "" }));
                                            }
                                        }}
                                        error={errors[`gradeRate_${grade.name}`]}
                                    />
                                ))}
                            </div>
                            {errors.gradeRates && <p className="mt-0.5 text-[11px] text-rose-500">{errors.gradeRates}</p>}
                        </div>
                    )}

                    {/* ── Images & BOM stacked full-width ── */}
                    <div className="flex flex-col gap-4">

                        {/* Product Images */}
                        <div>
                            <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-line-soft">
                                <h3 className="text-xs font-bold text-ink uppercase tracking-wide">Product Images</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Left: file input */}
                                <div className="border border-line-soft rounded p-3 bg-card-2 flex flex-col justify-center">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        data-nav
                                        multiple
                                        accept="image/png,image/jpeg,image/webp"
                                        className="w-full text-[11px] text-ink-muted file:mr-1 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-primary/15 file:text-primary hover:file:bg-primary/25 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
                                        onChange={handleImageChange}
                                        disabled={remainingSlots <= 0}
                                        style={{ height: 'auto', minHeight: 'auto' }}
                                    />
                                    <p className="text-[10px] text-ink-subtle mt-1 leading-tight">
                                        Max {MAX_IMAGES} · First = primary · {remainingSlots > 0 ? `${remainingSlots} left` : "Limit reached"}
                                    </p>
                                    {errors.images && <p className="text-[10px] text-red-500 mt-0.5">{errors.images}</p>}
                                </div>

                                {/* Right: image previews */}
                                <div className="border border-line-soft rounded p-3 bg-card-2 flex flex-wrap gap-2 items-center min-h-[60px]">
                                    {existingImages.map((img, index) => (
                                        <div key={`existing-${img.id}`} className="w-14 h-14 border border-line-soft rounded relative flex items-center justify-center bg-card flex-shrink-0">
                                            <img src={getImageUrl(img.imageUrl)} alt={`img-${index + 1}`} className="max-h-full max-w-full object-contain rounded" />
                                            {index === 0 && <span className="absolute top-0.5 left-0.5 bg-emerald-500 text-white text-[7px] font-bold px-0.5 rounded leading-none">Pri</span>}
                                            <button type="button" className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600" onClick={() => handleRemoveExistingImage(img.id)}><FaTimes size={6} /></button>
                                        </div>
                                    ))}

                                    {newImagePreviews.map((preview, index) => (
                                        <div key={`new-${index}`} className="w-14 h-14 border border-line-soft rounded relative flex items-center justify-center bg-card flex-shrink-0">
                                            <img src={preview} alt={`new-${index + 1}`} className="max-h-full max-w-full object-contain rounded" />
                                            {existingImages.length === 0 && index === 0 && <span className="absolute top-0.5 left-0.5 bg-emerald-500 text-white text-[7px] font-bold px-0.5 rounded leading-none">Pri</span>}
                                            <span className="absolute bottom-0.5 left-0.5 bg-primary text-white text-[7px] font-bold px-0.5 rounded leading-none">New</span>
                                            <button type="button" className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600" onClick={() => handleRemoveNewImage(index)}><FaTimes size={6} /></button>
                                        </div>
                                    ))}

                                    {!hasAnyImage && (
                                        <div className="flex flex-col items-center justify-center w-full h-full text-ink-subtle opacity-50">
                                            <FaImage size={20} />
                                            <span className="text-[10px] mt-1">No images</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Raw Materials BOM */}
                        <div>
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-line-soft">
                                <h3 className="text-xs font-bold text-ink uppercase tracking-wide">
                                    Raw Materials (BOM) <span className="text-rose-500">*</span>
                                </h3>
                            </div>

                            {errors.rawMaterials && (
                                <p className="mb-2 text-[11px] text-rose-400 font-medium">{errors.rawMaterials}</p>
                            )}

                            <BusyItemsTable<RawMaterialRow>
                                columns={bomColumns}
                                rows={rawMaterials}
                                onChange={(newRows) => {
                                    setRawMaterials(newRows);
                                    setIsDirty(true);
                                }}
                                emptyRow={{ rawMaterialId: "", percentage: "" }}
                                onAdd={handleAddRawMaterial}
                                onRemove={handleRemoveRawMaterial}
                                editable={true}
                                showTotals={[
                                    {
                                        colKey: "percentage",
                                        value: `${totalBOMPercentage % 1 === 0 ? totalBOMPercentage : Number(totalBOMPercentage.toFixed(2))}%`,
                                    },
                                ]}
                                visibleRows={10}
                            />
                        </div>
                    </div>

                    {/* ── Initial Capacity Setup — create mode only ── */}
                    {!isEditMode && (
                        <div>
                            <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-line-soft">
                                <h3 className="text-xs font-bold text-ink uppercase tracking-wide">Initial Capacity Setup</h3>
                                <CustomButton text="Add Capacity Setup" icon={FaPlus} onClick={handleAddInitialCapacity} type="button" size="sm" variant="secondary" />
                            </div>
                            {initialCapacities.length > 0 ? (
                                <div className="space-y-1.5">
                                    {initialCapacities.map((cap, idx) => (
                                        <div key={`cap-${idx}`} className="p-2 border border-line-soft rounded-lg bg-card-2/40">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Setup #{idx + 1}</span>
                                                <DeleteButton onClick={() => handleRemoveInitialCapacity(idx)} />
                                            </div>
                                            <div className="grid grid-cols-6 gap-x-2 gap-y-1">
                                                <DatePickerCalendar label="Date" name={`capDate-${idx}`} value={cap.capDate} onChange={(e) => handleInitialCapacityChange(idx, "capDate", e.target.value)} required error={errors[`cap_${idx}_date`]} />
                                                <SelectInput label="Shift" name={`capShiftId-${idx}`} value={cap.capShiftId} options={[{ value: "", label: "-- Shift --" }, ...shifts.map(s => ({ value: s.shiftName || s.shiftCode, label: s.shiftName || s.shiftCode }))]} onChange={(e) => handleInitialCapacityChange(idx, "capShiftId", e.target.value)} required error={errors[`cap_${idx}_shift`]} />
                                                <SelectInput label="Machine" name={`capMachine-${idx}`} value={cap.capMachine} options={[{ value: "", label: "-- Machine --" }, ...machines.filter(m => String(m.machineId) === String(cap.capMachine) || !initialCapacities.some((c, i) => i !== idx && String(c.capMachine) === String(m.machineId))).map(m => ({ value: String(m.machineId), label: m.machineName }))]} onChange={(e) => handleInitialCapacityChange(idx, "capMachine", e.target.value)} required error={errors[`cap_${idx}_machine`]} />
                                                <SelectInput label="Role" name={`capRoleId-${idx}`} value={cap.capRoleId} options={[{ value: "", label: "-- Role --" }, ...roles.map(role => ({ value: String(role.id), label: role.name }))]} onChange={(e) => handleInitialCapacityChange(idx, "capRoleId", e.target.value)} required error={errors[`cap_${idx}_role`]} />
                                                <TextInput label="Qty / Shift" name={`capQty-${idx}`} type="number" step="any" value={cap.capQty} onChange={(e) => handleInitialCapacityChange(idx, "capQty", e.target.value)} placeholder="0" required error={errors[`cap_${idx}_qty`]} />
                                                <div className="col-span-full">
                                                    <MultiSelect label="Operators" name={`capOperatorIds-${idx}`} options={employees.filter(emp => { if (!cap.capRoleId) return false; const empRoleId = emp.roleId ?? emp.role?.id ?? emp.user?.roleId ?? emp.user?.role?.id; return String(empRoleId) === String(cap.capRoleId); }).map(emp => ({ value: String(emp.id), label: emp.fullName }))} value={cap.capOperatorIds} onChange={(_, vals) => handleInitialCapacityChange(idx, "capOperatorIds", vals)} placeholder={cap.capRoleId ? "Select operators" : "Select role first"} required error={errors[`cap_${idx}_operators`]} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[11px] italic p-1.5 rounded-lg bg-card-2 border border-dashed border-line-soft text-ink-subtle text-center">
                                    No capacity added. Click "Add Capacity Setup" to configure machines and operators.
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Footer Action Buttons ── */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-line-soft">
                        {!isEditMode && (
                            <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} variant="secondary" disabled={isSubmitting} />
                        )}
                        <CustomButton
                            text={isSubmitting ? "Saving..." : (isEditMode ? "Save Changes" : "Save Product")}
                            icon={FaSave}
                            type="submit"
                            disabled={isSubmitting}
                        />
                    </div>
                </form>
            </div>
        </div>
        <CommonConfirmModal
            show={saveConfirmOpen}
            onHide={() => {
                if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); }
                setSaveConfirmOpen(false);
                setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50);
            }}
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
            onCancel={() => {
                setSaveConfirmOpen(false);
                setIsDirty(false);
                if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
                navigate(-1);
            }}
        />
        </>
    );
};

export default ProductForm;
