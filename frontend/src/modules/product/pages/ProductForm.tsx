import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaSave, FaEraser, FaTimes, FaPlus, FaImage } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import CustomButton from "../../../components/ui/Button/Button";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import { useProducts } from "../../../hooks/useProducts";
import { useCategories } from "../../../hooks/useCategories";
import { productService } from "../../../services/productService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { getImageUrl } from "../../../utils/ImageUrls";
import { useSocketSync } from "../../../hooks/useSocketSync";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { employeeService } from "../../../services/employeeService";
import { departmentService } from "../../../services/departmentService";
import { roleService } from "../../../services/roleService";
import { shiftService } from "../../../services/shiftService";
import { machineService } from "../../../services/machineService";

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
    capacityLitres: "",
    weightPerPiece: "",
    weightUom: "kg",
    productType: "PRODUCTION",
    description: "",
    isActive: "true",
    hsnCode: "",
    rate: "",
    minimumQty: "",
    maximumQty: "",
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
type ExistingSnapshotRecord = {
    id: string;
    machineId: string;
    shiftId: string;
    capacity: string;
    operators: string;
    recordedAt: string;
    type: "CURRENT" | "PREVIOUS";
};

const ProductForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const location = useLocation();

    const { addProduct, editProduct } = useProducts();
    const { categories, loadCategories } = useCategories();

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
    const [existingSnapshots, setExistingSnapshots] = useState<Record<string, ExistingSnapshotRecord[]>>({});
    const [initialCapacities, setInitialCapacities] = useState<InitialCapacityRow[]>([]);

    const [employees, setEmployees] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [machines, setMachines] = useState<any[]>([]);

    const fetchCategoriesData = useCallback(() => { loadCategories({ isActive: true }); }, [loadCategories]);
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
    const fetchDepartmentsData = useCallback(() => {
        departmentService.fetchAll().then((res: any) => {
            const depts = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
            setDepartments(depts);
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

    useSocketSync("category", undefined, fetchCategoriesData);
    useSocketSync("store", undefined, fetchStoresData);
    useSocketSync("rawMaterial", undefined, fetchRawMaterialsData);
    useSocketSync("employee", undefined, fetchEmployeesData);
    useSocketSync("department", undefined, fetchDepartmentsData);
    useSocketSync("role", undefined, fetchRolesData);
    useSocketSync("shift", undefined, fetchShiftsData);
    useSocketSync("machine", undefined, fetchMachinesData);

    const populateFormData = useCallback((productData: any) => {
        let latestStock: any = null;
        if (productData.finishedGoodsStocks && productData.finishedGoodsStocks.length > 0) {
            latestStock = [...productData.finishedGoodsStocks].sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        }

        setFormData({
            productCode: productData.productCode || "",
            productName: productData.productName || "",
            categoryId: productData.categoryId ? String(productData.categoryId) : "",
            capacityLitres: productData.capacityLitres != null ? String(productData.capacityLitres) : "",
            weightPerPiece: productData.weightPerPiece != null ? String(productData.weightPerPiece) : "",
            weightUom: productData.weightUom || "kg",
            productType: productData.productType || "PRODUCTION",
            description: productData.description || "",
            isActive: productData.isActive ? "true" : "false",
            hsnCode: productData.hsnCode || "",
            rate: productData.rate != null ? String(productData.rate) : "",
            minimumQty: productData.minimumQty != null ? String(productData.minimumQty) : "",
            maximumQty: productData.maximumQty != null ? String(productData.maximumQty) : "",
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

        if (productData.capacityHistories && productData.capacityHistories.length > 0) {
            const grouped = productData.capacityHistories.reduce((acc: any, curr: any) => {
                if (!acc[curr.machineId]) acc[curr.machineId] = [];
                acc[curr.machineId].push(curr);
                return acc;
            }, {});

            const snapshotsByMachine: Record<string, ExistingSnapshotRecord[]> = {};
            Object.keys(grouped).forEach(mId => {
                const machineRecords = grouped[mId];
                snapshotsByMachine[mId] = [];
                if (machineRecords.length > 0) {
                    snapshotsByMachine[mId].push({
                        id: String(machineRecords[0].id),
                        machineId: mId,
                        shiftId: machineRecords[0].shiftId,
                        capacity: String(machineRecords[0].newCapacity),
                        operators: machineRecords[0].operators || "",
                        recordedAt: new Date(machineRecords[0].productionDate).toISOString().split('T')[0],
                        type: "CURRENT"
                    });
                }
                if (machineRecords.length > 1) {
                    snapshotsByMachine[mId].push({
                        id: String(machineRecords[1].id),
                        machineId: mId,
                        shiftId: machineRecords[1].shiftId,
                        capacity: String(machineRecords[1].newCapacity),
                        operators: machineRecords[1].operators || "",
                        recordedAt: new Date(machineRecords[1].productionDate).toISOString().split('T')[0],
                        type: "PREVIOUS"
                    });
                }
            });
            setExistingSnapshots(snapshotsByMachine);
        } else {
            setExistingSnapshots({});
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
        fetchDepartmentsData();
        fetchRolesData();
        fetchShiftsData();
        fetchMachinesData();

        if (isEditMode && id) {
            const stateData = location.state as any;
            if (stateData && String(stateData.id) === String(id)) {
                populateFormData(stateData);
            } else {
                setIsLoadingData(true);
                productService.fetchById(id)
                    .then(data => populateFormData(data))
                    .catch(err => {
                        console.error("Failed to fetch product:", err);
                        toast.error("Failed to load product data");
                        navigate("/products");
                    })
                    .finally(() => setIsLoadingData(false));
            }
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

        if (!formData.rate) {
            newErrors.rate = "Required";
        } else {
            const rate = Number(formData.rate);
            if (isNaN(rate) || rate <= 0) newErrors.rate = "Must be > 0";
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
            const derivedCapacity = totalCapQty > 0 ? String(totalCapQty) : formData.capacityLitres;
            if (derivedCapacity) payload.append("capacityLitres", derivedCapacity);

            if (formData.weightPerPiece) payload.append("weightPerPiece", formData.weightPerPiece);
            if (formData.weightUom) payload.append("weightUom", formData.weightUom);

            payload.append("productType", formData.productType);
            if (formData.description) payload.append("description", formData.description);
            payload.append("isActive", String(formData.isActive === "true"));

            if (formData.hsnCode) payload.append("hsnCode", formData.hsnCode);
            if (formData.rate) payload.append("rate", formData.rate);

            payload.append("minimumQty", formData.minimumQty || "0");
            payload.append("maximumQty", formData.maximumQty || "0");

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
                    .filter(cap => cap.capQty && cap.capOperatorIds.length > 0)
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
    const categoryOptions = useMemo(() => [
        { value: "", label: "-- Select Category --" },
        ...(categories || []).map(c => ({ value: String(c.id), label: c.name })),
    ], [categories]);

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto">
            <div className="bg-white  border border-gray-200">
                {/* Page Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-800">{isEditMode ? "Edit Product" : "Create Product"}</h2>
                        <BackButton text="Back to List" to="/products" />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-3 space-y-4">
                    {/* Basic Information */}
                    <div>
                        <h6 className="text-base font-semibold text-gray-800 mb-3">Basic Information</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            <TextInput
                                label="Product Code"
                                name="productCode"
                                value={formData.productCode}
                                placeholder="e.g. PRD-001"
                                required
                                onChange={handleChange}
                                disabled
                            />
                            <TextInput
                                label="Product Name"
                                name="productName"
                                value={formData.productName}
                                placeholder="e.g. Plastic Bucket 20L"
                                required
                                onChange={handleChange}
                                error={errors.productName}
                            />
                            <SelectInput
                                label="Category"
                                name="categoryId"
                                value={formData.categoryId}
                                options={categoryOptions}
                                required
                                onChange={handleChange}
                                error={errors.categoryId}
                                disabled={isEditMode}
                            />
                            <TextInput
                                label="Opening Stock Qty"
                                name="openingStockQty"
                                type="number"
                                placeholder="0"
                                required
                                value={formData.openingStockQty}
                                onChange={handleChange}
                                error={errors.openingStockQty}
                                disabled={isEditMode}
                            />
                            <TextInput
                                label="Minimum Stock Qty"
                                name="minimumQty"
                                type="number"
                                placeholder="0"
                                value={String(formData.minimumQty)}
                                onChange={handleChange}
                                required
                                error={errors.minimumQty}
                            />
                            <SelectInput
                                label="Opening Stock Store"
                                name="openingStockStoreId"
                                required
                                value={formData.openingStockStoreId}
                                options={storeOptions}
                                onChange={handleChange}
                                error={errors.openingStockStoreId}
                                disabled={isEditMode}
                            />
                            <QuantityInput
                                label="Weight per Piece"
                                name="weightPerPiece"
                                required
                                value={formData.weightPerPiece}
                                baseUoms="kg,g"
                                uom={formData.weightUom}
                                onUomChange={(val) => setFormData(prev => ({ ...prev, weightUom: val }))}
                                onChange={handleChange}
                                error={errors.weightPerPiece}
                                disabled={isEditMode}
                            />
                            <TextInput
                                label="HSN CODE"
                                name="hsnCode"
                                value={formData.hsnCode}
                                placeholder="e.g. 3924"
                                required
                                onChange={handleChange}
                                error={errors.hsnCode}
                            />
                            <TextInput
                                label="Rate (₹)"
                                name="rate"
                                type="number"
                                step="0.01"
                                required
                                value={formData.rate}
                                placeholder="0.00"
                                onChange={handleChange}
                                error={errors.rate}
                            />
                            <SelectInput
                                label="Product Type"
                                name="productType"
                                value={formData.productType}
                                options={[
                                    { value: "PRODUCTION", label: "Production" },
                                    { value: "SALES_PRODUCTION", label: "Sales Production" },
                                ]}
                                required
                                onChange={handleChange}
                                error={errors.productType}
                            />
                        </div>
                    </div>

                    {/* Raw Materials Composition */}
                    <div className="pt-2">
                        <div className="flex justify-between items-center mb-3">
                            <h6 className="text-base font-semibold text-gray-800 m-0">
                                Raw Materials Composition (BOM) <span className="text-rose-500 ml-1">*</span>
                            </h6>
                            <CustomButton
                                text="Add Raw Material"
                                icon={FaPlus}
                                onClick={handleAddRawMaterial}
                                type="button"
                                size="sm"
                                variant="secondary"
                            />
                        </div>
                        {rawMaterials.length > 0 ? (
                            <div className="border border-slate-200 rounded-xl overflow-visible">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 text-slate-600">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold border-b border-slate-200 w-[60%]">Raw Material</th>
                                            <th className="px-4 py-3 font-semibold border-b border-slate-200 w-[30%]">Percentage (%)</th>
                                            <th className="px-4 py-3 font-semibold border-b border-slate-200 w-[10%] text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {rawMaterials.map((rm, idx) => (
                                            <tr key={`rm-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 align-top">
                                                    <SelectInput
                                                        hideLabel={true}
                                                        name={`rm-${idx}`}
                                                        value={rm.rawMaterialId}
                                                        options={[{ value: "", label: "-- Select --" }, ...bomOptions]}
                                                        onChange={(e) => handleRawMaterialChange(idx, "rawMaterialId", e.target.value)}
                                                        error={errors[`rawMaterials.${idx}.rawMaterialId`]}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <TextInput
                                                        label=""
                                                        bottom={true}
                                                        name={`percent-${idx}`}
                                                        type="number"
                                                        step="0.01"
                                                        value={rm.percentage}
                                                        placeholder="0.00"
                                                        onChange={(e) => handleRawMaterialChange(idx, "percentage", e.target.value)}
                                                        error={errors[`rawMaterials.${idx}.percentage`]}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 align-top text-center">
                                                    <DeleteButton onClick={() => handleRemoveRawMaterial(idx)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {errors.rawMaterials && (
                                    <div className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium border-t border-slate-200">
                                        {errors.rawMaterials}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <div className={`text-sm italic p-4 rounded-xl border border-dashed text-center ${errors.rawMaterials ? 'bg-rose-50/50 border-rose-300 text-rose-600 font-medium' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                    No raw materials added. Click "Add Raw Material" to specify the composition.
                                </div>
                                {errors.rawMaterials && (
                                    <p className="mt-1.5 text-sm text-rose-500 font-medium">{errors.rawMaterials}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {isEditMode && (
                        <div className="pt-2">
                            <div className="text-sm bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-slate-500">
                                Kit/combo assembly (building this product from other products) is managed separately under <strong>Kit Components</strong>.
                            </div>
                        </div>
                    )}

                    {/* Existing Machine Production Snapshots (edit mode only) */}
                    {isEditMode && (
                        <div className="pt-6">
                            <div className="flex justify-between items-center mb-3">
                                <h6 className="text-base font-semibold text-gray-800 m-0">Machine Production Snapshots</h6>
                            </div>
                            {Object.keys(existingSnapshots).length > 0 ? (
                                <div className="space-y-4">
                                    {Object.keys(existingSnapshots).map(machineId => (
                                        <div key={machineId} className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-semibold text-sm text-slate-700">
                                                Machine: {machines.find(m => String(m.machineId) === machineId)?.machineName || machineId}
                                            </div>
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-white text-slate-500">
                                                    <tr>
                                                        <th className="px-4 py-2 font-medium border-b border-slate-100">Type</th>
                                                        <th className="px-4 py-2 font-medium border-b border-slate-100">Date</th>
                                                        <th className="px-4 py-2 font-medium border-b border-slate-100">Shift</th>
                                                        <th className="px-4 py-2 font-medium border-b border-slate-100">Operators</th>
                                                        <th className="px-4 py-2 font-medium border-b border-slate-100 text-right">Capacity</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 bg-white">
                                                    {existingSnapshots[machineId].map(snap => (
                                                        <tr key={snap.id}>
                                                            <td className="px-4 py-2">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${snap.type === 'CURRENT' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                                                                    {snap.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-slate-600">{snap.recordedAt}</td>
                                                            <td className="px-4 py-2 text-slate-600">
                                                                {shifts.find(s => s.shiftCode === snap.shiftId || s.id === snap.shiftId || s.shiftName === snap.shiftId)?.shiftName || snap.shiftId}
                                                            </td>
                                                            <td className="px-4 py-2 text-slate-600">{snap.operators}</td>
                                                            <td className="px-4 py-2 text-slate-900 font-medium text-right">{snap.capacity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                                    No production snapshots exist yet.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Capacity Setup */}
                    <div className="pt-2 mt-4">
                        <div className="flex justify-between items-center mb-3">
                            <h6 className="text-base font-semibold text-gray-800 m-0">
                                {isEditMode ? "Add New Machine Production Snapshot" : "Initial Capacity Setup"}
                            </h6>
                            <CustomButton
                                text={isEditMode ? "Add Snapshot" : "Add Capacity Setup"}
                                icon={FaPlus}
                                onClick={handleAddInitialCapacity}
                                type="button"
                                size="sm"
                                variant="secondary"
                            />
                        </div>
                        {initialCapacities.length > 0 ? (
                            <div className="space-y-4">
                                {initialCapacities.map((cap, idx) => (
                                    <div key={`cap-${idx}`} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200/80">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Capacity Setup #{idx + 1}</span>
                                            <DeleteButton onClick={() => handleRemoveInitialCapacity(idx)} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                            <div>
                                                <DatePickerCalendar
                                                    label="Date"
                                                    name={`capDate-${idx}`}
                                                    value={cap.capDate}
                                                    onChange={(e) => handleInitialCapacityChange(idx, "capDate", e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <SelectInput
                                                    label="Shift"
                                                    name={`capShiftId-${idx}`}
                                                    value={cap.capShiftId}
                                                    options={[
                                                        { value: "", label: "-- Shift --" },
                                                        ...shifts.map(s => ({ value: s.shiftName || s.shiftCode, label: s.shiftName || s.shiftCode }))
                                                    ]}
                                                    onChange={(e) => handleInitialCapacityChange(idx, "capShiftId", e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <SelectInput
                                                    label="Machine"
                                                    name={`capMachine-${idx}`}
                                                    value={cap.capMachine}
                                                    options={[
                                                        { value: "", label: "-- Machine --" },
                                                        ...machines
                                                            .filter(m =>
                                                                String(m.machineId) === String(cap.capMachine) ||
                                                                !initialCapacities.some((c, i) => i !== idx && String(c.capMachine) === String(m.machineId))
                                                            )
                                                            .map(m => ({ value: String(m.machineId), label: `${m.machineId} - ${m.machineName}` }))
                                                    ]}
                                                    onChange={(e) => handleInitialCapacityChange(idx, "capMachine", e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <SelectInput
                                                    label="Role"
                                                    name={`capRoleId-${idx}`}
                                                    value={cap.capRoleId}
                                                    options={[
                                                        { value: "", label: "-- Role --" },
                                                        ...roles.map(role => ({ value: String(role.id), label: role.name }))
                                                    ]}
                                                    onChange={(e) => handleInitialCapacityChange(idx, "capRoleId", e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-full xl:col-span-3">
                                                <MultiSelect
                                                    label="Operators"
                                                    name={`capOperatorIds-${idx}`}
                                                    options={employees
                                                        .filter(emp => {
                                                            if (!cap.capRoleId) return true;
                                                            const empRoleId = emp.roleId ?? emp.role?.id ?? emp.user?.roleId ?? emp.user?.role?.id;
                                                            return String(empRoleId) === String(cap.capRoleId);
                                                        })
                                                        .map(emp => ({ value: String(emp.id), label: emp.fullName }))}
                                                    value={cap.capOperatorIds}
                                                    onChange={(_, vals) => handleInitialCapacityChange(idx, "capOperatorIds", vals)}
                                                    placeholder={cap.capRoleId ? "Select operators" : "Select role first"}
                                                />
                                            </div>
                                            <div>
                                                <TextInput
                                                    label="Qty / Shift"
                                                    name={`capQty-${idx}`}
                                                    type="number"
                                                    step="any"
                                                    value={cap.capQty}
                                                    onChange={(e) => handleInitialCapacityChange(idx, "capQty", e.target.value)}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                                No {isEditMode ? "snapshots" : "initial capacity"} added. Click "{isEditMode ? "Add Snapshot" : "Add Capacity Setup"}" to configure machines and operators.
                            </div>
                        )}
                    </div>

                    {/* Status & Description */}
                    <div className="pt-6">
                        <h6 className="text-base font-semibold text-gray-800 mb-3">Status & Description</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            <SelectInput
                                label="Status"
                                name="isActive"
                                value={formData.isActive}
                                options={[
                                    { value: "true", label: "Active" },
                                    { value: "false", label: "Inactive" },
                                ]}
                                onChange={handleChange}
                            />
                            <div className="lg:col-span-2">
                                <TextInput
                                    label="Description"
                                    name="description"
                                    value={formData.description}
                                    placeholder="Enter catalogue description..."
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Product Images */}
                    <div className="pt-2">
                        <h6 className="text-base font-semibold text-gray-800 mb-3">Product Images</h6>
                        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            <div className="col-span-1 md:col-span-2 border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-center h-32">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/png,image/jpeg,image/webp"
                                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    onChange={handleImageChange}
                                    disabled={remainingSlots <= 0}
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    Maximum {MAX_IMAGES} images. First is primary.<br />
                                    {remainingSlots > 0 ? `${remainingSlots} slot(s) remaining.` : "Image limit reached."}
                                </p>
                                {errors.images && (
                                    <p className="text-xs text-red-500 mt-1">{errors.images}</p>
                                )}
                            </div>

                            {existingImages.map((img, index) => (
                                <div key={`existing-${img.id}`} className="col-span-1 border border-slate-200 rounded-xl p-2 relative h-32 flex items-center justify-center bg-white shadow-sm">
                                    <img
                                        src={getImageUrl(img.imageUrl)}
                                        alt={`Product image ${index + 1}`}
                                        className="max-h-full max-w-full object-contain rounded-lg"
                                    />
                                    {index === 0 && (
                                        <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded">
                                            Primary
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-sm"
                                        onClick={() => handleRemoveExistingImage(img.id)}
                                    >
                                        <FaTimes size={10} />
                                    </button>
                                </div>
                            ))}

                            {newImagePreviews.map((preview, index) => (
                                <div key={`new-${index}`} className="col-span-1 border border-slate-200 rounded-xl p-2 relative h-32 flex items-center justify-center bg-white shadow-sm">
                                    <img
                                        src={preview}
                                        alt={`New image ${index + 1}`}
                                        className="max-h-full max-w-full object-contain rounded-lg"
                                    />
                                    {existingImages.length === 0 && index === 0 && (
                                        <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded">
                                            Primary
                                        </span>
                                    )}
                                    <span className="absolute bottom-2 left-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded">
                                        New
                                    </span>
                                    <button
                                        type="button"
                                        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-sm"
                                        onClick={() => handleRemoveNewImage(index)}
                                    >
                                        <FaTimes size={10} />
                                    </button>
                                </div>
                            ))}

                            {!hasAnyImage && (
                                <div className="col-span-1 border border-slate-200 rounded-xl p-2 h-32 flex flex-col items-center justify-center bg-white text-slate-400">
                                    <FaImage size={24} className="mb-2" />
                                    <span className="text-xs">No images</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
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
