import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaSave, FaEraser, FaTimes, FaPlus, FaImage } from "react-icons/fa";
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
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { employeeService } from "../../../services/employeeService";
import { roleService } from "../../../services/roleService";
import { shiftService } from "../../../services/shiftService";
import { machineService } from "../../../services/machineService";
import { customerGradeService, type CustomerGrade } from "../../../services/customerGradeService";
import { categoryService } from "../../../services/categoryService";

const MAX_IMAGES = 3;

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
    weightUom: "kg",
    productType: "SALES_PRODUCTION",
    description: "",
    isActive: "true",
    hsnCode: "",
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

    const [rawMaterials, setRawMaterials] = useState<RawMaterialRow[]>([]);
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

    const fetchStoresData = useCallback(() => {
        storeService.fetchAll({ storeCategory: "FINISHED_GOODS" }).then(res => {
            const data = Array.isArray(res?.stores) ? res.stores : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            setStores(data);
        }).catch(() => {});
    }, []);
    const fetchRawMaterialsData = useCallback(() => {
        rawMaterialService.fetchAll({}).then((res: any) => {
            const data = Array.isArray(res?.rawMaterials) ? res.rawMaterials : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            const rmOnly = data.filter((item: any) => item.itemType !== "WASTAGE");
            setAllRawMaterials(rmOnly);
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
            const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
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
            weightUom: productData.weightUom || "kg",
            productType: productData.productType || "SALES_PRODUCTION",
            description: productData.description || "",
            isActive: productData.isActive ? "true" : "false",
            hsnCode: productData.hsnCode || "",
            rate: productData.rate != null ? String(productData.rate) : "",
            minimumQty: productData.minimumQty != null ? String(productData.minimumQty) : "",
            openingStockQty: latestStock ? String(latestStock.onHandQty) : "",
            openingStockStoreId: latestStock ? String(latestStock.storeId) : "",
        });

        if (productData.billOfMaterials) {
            setRawMaterials(productData.billOfMaterials.filter((bom: any) => bom.percentage !== null).map((bom: any) => ({
                rawMaterialId: bom.rawMaterialId,
                percentage: bom.percentage ? String(bom.percentage) : ""
            })));
        } else {
            setRawMaterials([]);
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

        if (!formData.hsnCode.trim())
            newErrors.hsnCode = "HSN Code is required.";

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

        if (rawMaterials.length === 0) {
            newErrors.rawMaterials = "At least one raw material is required for BOM composition.";
            toast.error("At least one raw material is required for BOM composition.");
        } else {
            const totalPercent = rawMaterials.reduce((acc, rm) => acc + Number(rm.percentage), 0);
            if (Math.abs(totalPercent - 100) > 0.01) {
                newErrors.rawMaterials = "Total percentage must be exactly 100%";
                toast.error("Total Raw Material percentage must be exactly 100%");
            }

            const selectedRmIds = rawMaterials.map(rm => rm.rawMaterialId).filter(Boolean);
            const uniqueRmIds = new Set(selectedRmIds);
            if (uniqueRmIds.size !== selectedRmIds.length) {
                newErrors.rawMaterials = "Duplicate raw materials selected in BOM.";
                toast.error("Duplicate raw materials selected in BOM");
            }

            rawMaterials.forEach((rm, index) => {
                if (!rm.rawMaterialId) newErrors[`rawMaterials.${index}.rawMaterialId`] = "Required";
                if (!rm.percentage || Number(rm.percentage) <= 0) newErrors[`rawMaterials.${index}.percentage`] = "Invalid %";
            });
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
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleAddRawMaterial = () => {
        setRawMaterials(prev => [...prev, { rawMaterialId: "", percentage: "" }]);
    };

    const handleRemoveRawMaterial = (index: number) => {
        setRawMaterials(prev => prev.filter((_, i) => i !== index));
    };

    const handleRawMaterialChange = (index: number, field: keyof RawMaterialRow, value: string) => {
        setRawMaterials(prev => {
            const newRm = [...prev];
            newRm[index] = { ...newRm[index], [field]: value };
            return newRm;
        });
        if (errors[`rawMaterials.${index}.${field}`] || errors.rawMaterials) {
            setErrors(prev => ({ ...prev, [`rawMaterials.${index}.${field}`]: "", rawMaterials: "" }));
        }
    };

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
        setRawMaterials([]);
        setInitialCapacities([]);
        setGradeRates({});
        setErrors({});
        setNewImageFiles([]);
        setNewImagePreviews([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

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

            if (formData.hsnCode) payload.append("hsnCode", formData.hsnCode);
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

            const combinedBOM = rawMaterials.map(rm => ({
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
            } else {
                await addProduct(payload as any);
                toast.success("Product created successfully!");
            }
            navigate("/products");
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

    const bomOptions = useMemo(() => {
        return allRawMaterials.map(rm => ({
            value: String(rm.rawMaterialId),
            label: rm.materialName,
            disabled: rawMaterials.some(r => String(r.rawMaterialId) === String(rm.rawMaterialId))
        }));
    }, [allRawMaterials, rawMaterials]);

    const hasAnyImage = existingImages.length > 0 || newImagePreviews.length > 0;

    if (isLoadingData) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1200px] mr-auto product-form-compact">
            {/* Compact overrides for child form components */}
            <style>{`
                .product-form-compact label { margin-bottom: 3px !important; font-size: 11px !important; }
                .product-form-compact input, .product-form-compact select,
                .product-form-compact button[role="combobox"] { height: 34px !important; min-height: 34px !important; font-size: 12px !important; padding-top: 0 !important; padding-bottom: 0 !important; }
                .product-form-compact .group { margin-bottom: 0 !important; }
            `}</style>
            <div className="bg-card rounded-xl shadow-xs border border-line-soft overflow-visible">

                {/* ── Page Header ── */}
                <div className="px-5 py-3 border-b border-line-soft flex items-center justify-between">
                    <h2 className="text-base font-bold text-ink">{isEditMode ? "Edit Product" : "Create Product"}</h2>
                    <BackButton text="Back to List" to="/products" />
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-3 space-y-3" noValidate>

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
                            <TextInput label="HSN Code" name="hsnCode" value={formData.hsnCode} placeholder="e.g. 3924" required onChange={handleChange} error={errors.hsnCode} />
                            <QuantityInput label="Weight per Piece" name="weightPerPiece" required value={formData.weightPerPiece} baseUoms="kg,g" uom={formData.weightUom} onUomChange={(val) => setFormData(prev => ({ ...prev, weightUom: val }))} onChange={handleChange} error={errors.weightPerPiece} disabled={isEditMode} />
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

                    {/* ── Images & BOM side-by-side ── */}
                    <div className="grid grid-cols-2 gap-x-4">

                        {/* Product Images */}
                        <div>
                            <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-line-soft">
                                <h3 className="text-xs font-bold text-ink uppercase tracking-wide">Product Images</h3>
                            </div>
                            <div className="flex gap-2 items-stretch">
                                <div className="flex-1 border border-line-soft rounded p-2 bg-card-2 flex flex-col justify-center min-w-0">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/png,image/jpeg,image/webp"
                                        className="w-full text-[11px] text-ink-muted file:mr-1 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-primary/15 file:text-primary hover:file:bg-primary/25 cursor-pointer"
                                        onChange={handleImageChange}
                                        disabled={remainingSlots <= 0}
                                        style={{ height: 'auto', minHeight: 'auto' }}
                                    />
                                    <p className="text-[10px] text-ink-subtle mt-0.5 leading-tight">
                                        Max {MAX_IMAGES} · First = primary · {remainingSlots > 0 ? `${remainingSlots} left` : "Limit reached"}
                                    </p>
                                    {errors.images && <p className="text-[10px] text-red-500">{errors.images}</p>}
                                </div>

                                {existingImages.map((img, index) => (
                                    <div key={`existing-${img.id}`} className="w-14 h-14 border border-line-soft rounded relative flex items-center justify-center bg-card-2 flex-shrink-0">
                                        <img src={getImageUrl(img.imageUrl)} alt={`img-${index + 1}`} className="max-h-full max-w-full object-contain rounded" />
                                        {index === 0 && <span className="absolute top-0.5 left-0.5 bg-emerald-500 text-white text-[7px] font-bold px-0.5 rounded leading-none">Pri</span>}
                                        <button type="button" className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600" onClick={() => handleRemoveExistingImage(img.id)}><FaTimes size={6} /></button>
                                    </div>
                                ))}

                                {newImagePreviews.map((preview, index) => (
                                    <div key={`new-${index}`} className="w-14 h-14 border border-line-soft rounded relative flex items-center justify-center bg-card-2 flex-shrink-0">
                                        <img src={preview} alt={`new-${index + 1}`} className="max-h-full max-w-full object-contain rounded" />
                                        {existingImages.length === 0 && index === 0 && <span className="absolute top-0.5 left-0.5 bg-emerald-500 text-white text-[7px] font-bold px-0.5 rounded leading-none">Pri</span>}
                                        <span className="absolute bottom-0.5 left-0.5 bg-primary text-white text-[7px] font-bold px-0.5 rounded leading-none">New</span>
                                        <button type="button" className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600" onClick={() => handleRemoveNewImage(index)}><FaTimes size={6} /></button>
                                    </div>
                                ))}

                                {!hasAnyImage && (
                                    <div className="w-14 h-14 border border-dashed border-line-soft rounded flex flex-col items-center justify-center bg-card-2 text-ink-subtle flex-shrink-0">
                                        <FaImage size={12} className="opacity-40" />
                                        <span className="text-[8px] mt-0.5">No img</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Raw Materials BOM */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-line-soft">
                                <h3 className="text-xs font-bold text-ink uppercase tracking-wide">Raw Materials (BOM) <span className="text-rose-500">*</span></h3>
                                <CustomButton text="Add Raw Material" icon={FaPlus} onClick={handleAddRawMaterial} type="button" size="sm" variant="secondary" />
                            </div>
                            {rawMaterials.length > 0 ? (
                                <div className="border border-line-soft rounded-lg overflow-visible bg-card">
                                    <table className="w-full text-left text-[11px]">
                                        <thead className="bg-card-2 text-ink-muted border-b border-line-soft">
                                            <tr>
                                                <th className="px-2 py-1 font-semibold text-[10px] w-[60%]">Raw Material</th>
                                                <th className="px-2 py-1 font-semibold text-[10px] w-[28%]">Percentage (%)</th>
                                                <th className="px-2 py-1 font-semibold text-[10px] w-[12%] text-center">Del</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft">
                                            {rawMaterials.map((rm, idx) => (
                                                <tr key={`rm-${idx}`} className="hover:bg-card-2/60 transition-colors">
                                                    <td className="px-2 py-0.5 align-top">
                                                        <SelectInput hideLabel={true} name={`rm-${idx}`} value={rm.rawMaterialId} options={[{ value: "", label: "-- Select --" }, ...bomOptions]} onChange={(e) => handleRawMaterialChange(idx, "rawMaterialId", e.target.value)} error={errors[`rawMaterials.${idx}.rawMaterialId`]} />
                                                    </td>
                                                    <td className="px-2 py-0.5 align-top">
                                                        <TextInput label="" bottom={true} name={`percent-${idx}`} type="number" step="0.01" value={rm.percentage} placeholder="0.00" onChange={(e) => handleRawMaterialChange(idx, "percentage", e.target.value)} error={errors[`rawMaterials.${idx}.percentage`]} />
                                                    </td>
                                                    <td className="px-2 py-0.5 align-top text-center">
                                                        <DeleteButton onClick={() => handleRemoveRawMaterial(idx)} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {errors.rawMaterials && <div className="px-2 py-1 bg-red-500/10 text-red-400 text-[10px] font-medium border-t border-line-soft">{errors.rawMaterials}</div>}
                                </div>
                            ) : (
                                <div>
                                    <div className={`text-[11px] italic p-2 rounded-lg border border-dashed text-center ${errors.rawMaterials ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-medium' : 'bg-card-2 border-line-soft text-ink-subtle'}`}>
                                        No raw materials added. Click "Add Raw Material" to specify the composition.
                                    </div>
                                    {errors.rawMaterials && <p className="mt-0.5 text-[10px] text-rose-400 font-medium">{errors.rawMaterials}</p>}
                                </div>
                            )}
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
                                                <SelectInput label="Machine" name={`capMachine-${idx}`} value={cap.capMachine} options={[{ value: "", label: "-- Machine --" }, ...machines.filter(m => String(m.machineId) === String(cap.capMachine) || !initialCapacities.some((c, i) => i !== idx && String(c.capMachine) === String(m.machineId))).map(m => ({ value: String(m.machineId), label: `${m.machineId} - ${m.machineName}` }))]} onChange={(e) => handleInitialCapacityChange(idx, "capMachine", e.target.value)} required error={errors[`cap_${idx}_machine`]} />
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
    );
};

export default ProductForm;
