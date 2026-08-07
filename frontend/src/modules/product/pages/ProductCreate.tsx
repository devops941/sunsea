import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FaSave, FaEraser, FaTimes, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import CustomButton from "../../../components/ui/Button/Button";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import { useProducts } from "../../../hooks/useProducts";
import { useCategories } from "../../../hooks/useCategories";
import { productService } from "../../../services/productService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { useColors } from "../../../hooks/useColors";
import { useSizes } from "../../../hooks/useSizes";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";
import FlowInput from "../../../components/ui/FlowInput/FlowInput";
import { useSocketSync } from "../../../hooks/useSocketSync";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { employeeService } from "../../../services/employeeService";
import { departmentService } from "../../../services/departmentService";
import { shiftService } from "../../../services/shiftService";
import { machineService } from "../../../services/machineService";

const ProductCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { addProduct } = useProducts();
    const { categories, loadCategories } = useCategories();
    const { colors, loadColors } = useColors();
    const { sizes, loadSizes } = useSizes();
    const dispatch = useAppDispatch();

    // ── GST taxes from Redux store ──────────────────────────────────────
    const gstTaxes = useAppSelector(selectActiveGstTaxes);
    const gstLoading = useAppSelector((state) => state.gst.loading);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [stores, setStores] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        productCode: "",
        productName: "",
        displayName: "",
        itemCode: "",
        categoryId: "",
        uomId: "",
        capacityLitres: "",
        weightPerPiece: "",
        bundleQty: "",
        dimensions: "",
        mouldReference: "",
        typeCode: "",
        tags: "",
        description: "",
        isActive: "true",
        hsnCode: "",
        gstTaxRateId: "",
        minimumQty: "",
        maximumQty: "",
        openingStockQty: "",
        openingStockStoreId: "",
        mrp: "",
        b2b: "",
        b2c: "",
        exportPrice: "",
        weightUom: "kg",
    });

    // ✅ Raw Materials Composition
    type RawMaterialRow = { rawMaterialId: string; percentage: string; };
    const [rawMaterials, setRawMaterials] = useState<RawMaterialRow[]>([]);

    // ✅ Accessories / Additional Items
    type AccessoryRow = { rawMaterialId: string; quantity: string; };
    const [accessories, setAccessories] = useState<AccessoryRow[]>([]);

    const [allRawMaterials, setAllRawMaterials] = useState<any[]>([]);
    const [productionSteps, setProductionSteps] = useState<string[]>([]);

    // ✅ Capacity initial setup (multiple entries)
    type InitialCapacityRow = {
        capDate: string;
        capShiftId: string;
        capDeptId: string;
        capOperatorIds: string[];
        capQty: string;
        capMachine: string;
    };
    const [initialCapacities, setInitialCapacities] = useState<InitialCapacityRow[]>([]);

    const [employees, setEmployees] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [machines, setMachines] = useState<any[]>([]);

    const fetchCategoriesData = useCallback(() => { loadCategories({ isActive: true }); }, [loadCategories]);
    const fetchGstData = useCallback(() => { dispatch(fetchGstTaxes({ status: "ACTIVE" })); }, [dispatch]);
    const fetchColorsData = useCallback(() => { loadColors({ isActive: true }); }, [loadColors]);
    const fetchSizesData = useCallback(() => { loadSizes({ isActive: true }); }, [loadSizes]);
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
    useSocketSync("gstTax", undefined, fetchGstData);
    useSocketSync("color", undefined, fetchColorsData);
    useSocketSync("size", undefined, fetchSizesData);
    useSocketSync("store", undefined, fetchStoresData);
    useSocketSync("rawMaterial", undefined, fetchRawMaterialsData);
    useSocketSync("employee", undefined, fetchEmployeesData);
    useSocketSync("department", undefined, fetchDepartmentsData);
    useSocketSync("shift", undefined, fetchShiftsData);
    useSocketSync("machine", undefined, fetchMachinesData);

    // Load initial data
    useEffect(() => {
        fetchCategoriesData();
        fetchGstData();
        fetchColorsData();
        fetchSizesData();
        fetchStoresData();
        fetchRawMaterialsData();
        fetchEmployeesData();
        fetchDepartmentsData();
        fetchShiftsData();
        fetchMachinesData();

        const fetchCode = async () => {
            try {
                const nextCode = await productService.fetchNextId();
                setFormData(prev => ({ ...prev, productCode: nextCode }));
            } catch (error) {
                console.error("Failed to fetch next product code", error);
            }
        };
        fetchCode();
    }, [fetchCategoriesData, fetchGstData, fetchColorsData, fetchSizesData, fetchStoresData, fetchRawMaterialsData, fetchEmployeesData, fetchDepartmentsData, fetchShiftsData, fetchMachinesData]);

    // Cleanup image previews
    useEffect(() => {
        return () => {
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [imagePreviews]);



    // ─── Validation ──────────────────────────────────────────────────────
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.productName.trim())
            newErrors.productName = "Product Name is required.";
        if (!formData.categoryId)
            newErrors.categoryId = "Category is required.";


        if (!formData.gstTaxRateId) {
            newErrors.gstTaxRateId = "GST Tax Type is required.";
        }

        if (formData.bundleQty) {
            const qty = Number(formData.bundleQty);
            if (!Number.isInteger(qty) || qty <= 0)
                newErrors.bundleQty = "Bundle Qty must be a positive whole number.";
        }

        if (!formData.weightPerPiece.toString().trim()) {
            newErrors.weightPerPiece = "Weight Per Piece is required.";
        } else {
            const weight = Number(formData.weightPerPiece);
            if (isNaN(weight) || weight <= 0)
                newErrors.weightPerPiece = "Weight must be greater than 0.";
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

        // ── Minimum / Maximum Stock Qty ────────────────────────────────
        const minQty = formData.minimumQty ? Number(formData.minimumQty) : NaN;

        if (!formData.minimumQty.toString().trim()) {
            newErrors.minimumQty = "Minimum Stock Qty is required.";
        } else if (isNaN(minQty) || minQty < 0) {
            newErrors.minimumQty = "Minimum Stock Qty must be 0 or greater.";
        }

        // ── UOM ─────────────────────────────────────────────────────────
        if (!formData.uomId) {
            newErrors.uomId = "UOM is required.";
        }

        // ── Pricing validation ─────────────────────────
        if (!formData.mrp) {
            newErrors.mrp = "Required";
        } else {
            const mrp = Number(formData.mrp);
            if (isNaN(mrp) || mrp <= 0) newErrors.mrp = "Must be > 0";
        }

        if (!formData.b2b) {
            newErrors.b2b = "Required";
        } else {
            const b2b = Number(formData.b2b);
            if (isNaN(b2b) || b2b <= 0) newErrors.b2b = "Must be > 0";
        }

        if (formData.mrp && formData.b2b) {
            const mrp = Number(formData.mrp);
            const b2b = Number(formData.b2b);
            if (!isNaN(mrp) && !isNaN(b2b) && mrp < b2b)
                newErrors.mrp = "Cannot be less than B2B price";
        }

        if (!formData.b2c) {
            newErrors.b2c = "Required";
        } else {
            const b2c = Number(formData.b2c);
            if (isNaN(b2c) || b2c <= 0) newErrors.b2c = "Must be > 0";
        }

        if (!formData.exportPrice) {
            newErrors.exportPrice = "Required";
        } else {
            const exp = Number(formData.exportPrice);
            if (isNaN(exp) || exp <= 0) newErrors.exportPrice = "Must be > 0";
        }

        if (rawMaterials.length > 0) {
            const totalPercent = rawMaterials.reduce((acc, rm) => acc + Number(rm.percentage), 0);
            if (totalPercent !== 100) {
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

        if (accessories.length > 0) {
            const selectedAccIds = accessories.map(a => a.rawMaterialId).filter(Boolean);
            const uniqueAccIds = new Set(selectedAccIds);
            if (uniqueAccIds.size !== selectedAccIds.length) {
                newErrors.accessories = "Duplicate items selected in Accessories.";
                toast.error("Duplicate items selected in Accessories");
            }

            accessories.forEach((acc, index) => {
                if (!acc.rawMaterialId) newErrors[`accessories.${index}.rawMaterialId`] = "Required";
                if (!acc.quantity || Number(acc.quantity) <= 0) newErrors[`accessories.${index}.quantity`] = "Invalid Qty";
            });
        }


        if (productionSteps.length > 0) {
            const normalized = productionSteps.map(s => s.trim().toLowerCase());
            const uniqueCount = new Set(normalized).size;
            if (uniqueCount !== normalized.length) {
                newErrors.productionSteps = "Each step can only be added once";
                toast.error("The same production step has been added more than once");
            }
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
        if (errors.images) {
            setErrors(prev => ({ ...prev, images: "" }));
        }
    };

    const handleMultiSelect = (name: string, values: string[]) => {
        setFormData(prev => ({ ...prev, [name]: values }));
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

    const handleAddAccessory = () => {
        setAccessories(prev => [...prev, { rawMaterialId: "", quantity: "" }]);
    };

    const handleRemoveAccessory = (index: number) => {
        setAccessories(prev => prev.filter((_, i) => i !== index));
    };

    const handleAccessoryChange = (index: number, field: keyof AccessoryRow, value: string) => {
        setAccessories(prev => {
            const newAcc = [...prev];
            newAcc[index] = { ...newAcc[index], [field]: value };
            return newAcc;
        });
        if (errors[`accessories.${index}.${field}`] || errors.accessories) {
            setErrors(prev => ({ ...prev, [`accessories.${index}.${field}`]: "", accessories: "" }));
        }
    };

    const handleProductionStepsChange = (steps: string[]) => {
        setProductionSteps(steps);
        if (errors.productionSteps) {
            setErrors(prev => ({ ...prev, productionSteps: "" }));
        }
    };

    const handleAddInitialCapacity = () => {
        setInitialCapacities(prev => [...prev, {
            capDate: new Date().toISOString().split("T")[0],
            capShiftId: "",
            capDeptId: "",
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
            if (field === 'capDeptId') {
                newCap[index].capOperatorIds = [];
            }
            return newCap;
        });
    };




    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        if (files.length > 3) {
            toast.error("Maximum 3 images allowed");
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
        setImageFiles(files);
        setImagePreviews(previews);
    };

    const handleRemoveImage = (index: number) => {
        URL.revokeObjectURL(imagePreviews[index]);
        const updatedFiles = imageFiles.filter((_, i) => i !== index);
        const updatedPreviews = imagePreviews.filter((_, i) => i !== index);
        setImageFiles(updatedFiles);
        setImagePreviews(updatedPreviews);
        if (updatedFiles.length === 0 && fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleClear = () => {
        setFormData({
            productCode: formData.productCode,
            productName: "",
            displayName: "",
            itemCode: "",
            categoryId: "",
            uomId: "",
            capacityLitres: "",
        weightPerPiece: "",
        weightUom: "kg",
            bundleQty: "",
            dimensions: "",
            mouldReference: "",
            typeCode: "",
            tags: "",
            description: "",
            isActive: "true",
            hsnCode: "",
            gstTaxRateId: "",
            minimumQty: '',
            maximumQty: '',
            openingStockQty: "",
            openingStockStoreId: "",
            mrp: "",
            b2b: "",
            b2c: "",
            exportPrice: "",
        });
        setRawMaterials([]);
        setAccessories([]);
        setProductionSteps([]);
        setInitialCapacities([]);
        setErrors({});
        setImageFiles([]);
        setImagePreviews([]);
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
            if (formData.displayName) payload.append("displayName", formData.displayName);
            if (formData.itemCode) payload.append("itemCode", formData.itemCode);
            payload.append("categoryId", formData.categoryId);
            if (formData.uomId) payload.append("uomId", formData.uomId);
            const totalCapQty = initialCapacities.reduce((acc, cap) => acc + Number(cap.capQty || 0), 0);
            const derivedCapacity = totalCapQty > 0 ? String(totalCapQty) : formData.capacityLitres;
            if (derivedCapacity) payload.append("capacityLitres", derivedCapacity);
            let weightVal = formData.weightPerPiece;
            if (weightVal && (formData as any).weightUom === "g") {
                weightVal = String(Number(weightVal) / 1000);
            }
            if (weightVal) payload.append("weightPerPiece", weightVal);
            if (formData.bundleQty) payload.append("bundleQty", formData.bundleQty);
            if (formData.dimensions) payload.append("dimensions", formData.dimensions);
            if (formData.mouldReference) payload.append("mouldReference", formData.mouldReference);
            if (formData.typeCode) payload.append("typeCode", formData.typeCode);
            if (formData.tags) payload.append("tags", formData.tags);
            if (formData.description) payload.append("description", formData.description);
            payload.append("isActive", String(formData.isActive === "true"));
            if (formData.hsnCode) payload.append("hsnCode", formData.hsnCode);
            if (formData.gstTaxRateId) payload.append("gstTaxRateId", formData.gstTaxRateId);

            payload.append("minimumQty", String(formData.minimumQty));
            payload.append("maximumQty", String(formData.maximumQty));

            if (formData.openingStockQty) payload.append("openingStockQty", formData.openingStockQty);
            if (formData.openingStockStoreId) payload.append("openingStockStoreId", formData.openingStockStoreId);

            if (formData.mrp) payload.append("mrp", formData.mrp);
            if (formData.b2b) payload.append("b2b", formData.b2b);
            if (formData.b2c) payload.append("b2c", formData.b2c);
            if (formData.exportPrice) payload.append("exportPrice", formData.exportPrice);

            if (rawMaterials.length > 0 || accessories.length > 0) {
                const combinedBOM = [
                    ...rawMaterials.map(rm => ({
                        rawMaterialId: rm.rawMaterialId,
                        percentage: rm.percentage,
                        requiredQuantity: 0
                    })),
                    ...accessories.map(acc => ({
                        rawMaterialId: acc.rawMaterialId,
                        percentage: null,
                        requiredQuantity: acc.quantity
                    }))
                ];
                payload.append("rawMaterials", JSON.stringify(combinedBOM));
            }

            if (productionSteps.length > 0) {
                payload.append("productionSteps", JSON.stringify(
                    productionSteps.map((step, index) => ({
                        stepKey: step,
                        stepOrder: index + 1,
                    }))
                ));
            }

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

            // Append images
            imageFiles.forEach((file, index) => {
                payload.append("images", file);
                if (index === 0) payload.append("primaryImageIndex", "0");
            });

            await addProduct(payload as any);
            toast.success("Product created successfully!");
            navigate("/products");
        } catch (err: any) {
            toast.error(err.message || "Failed to create product");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Options for dropdowns ───────────────────────────────────────────
    const categoryOptions = useMemo(() => [
        { value: "", label: "-- Select Category --" },
        ...(categories || []).map(c => ({ value: String(c.id), label: c.name })),
    ], [categories]);

    const colorsOptions = useMemo(() =>
        (colors || []).map(c => ({ value: String(c.id), label: c.name })),
        [colors]);

    const sizeOptions = useMemo(() => [
        { value: "", label: "-- Select Size --" },
        ...(sizes || []).map(s => ({ value: String(s.id), label: `${s.name} (${s.code})` })),
    ], [sizes]);

    // ── GST rate options — sourced from the Redux store, with a loading state ──
    const gstOptions = useMemo(() => [
        { value: "", label: gstLoading ? "Loading GST rates..." : "-- Select GST Rate --" },
        ...(gstTaxes || []).map(t => ({
            value: String(t.id),
            label: `${t.taxName} (${t.taxRate}%)`,
        })),
    ], [gstTaxes, gstLoading]);

    const storeOptions = useMemo(() => [
        { value: "", label: "-- Select Store --" },
        ...stores.map(s => ({ value: String(s.storeId), label: s.storeCode ? `${s.storeName} (${s.storeCode})` : s.storeName })),
    ], [stores]);

    const bomOptions = useMemo(() => {
        return allRawMaterials
            .filter(rm => {
                const uom = (rm.baseUom || "").split(',')[0].toLowerCase().trim();
                return uom !== "ea" && uom !== "pcs";
            })
            .map(rm => ({
                value: String(rm.rawMaterialId),
                label: rm.materialName,
                disabled: rawMaterials.some(r => String(r.rawMaterialId) === String(rm.rawMaterialId))
            }));
    }, [allRawMaterials, rawMaterials]);

    const accessoryOptions = useMemo(() => {
        return allRawMaterials
            .filter(rm => {
                const uom = (rm.baseUom || "").split(',')[0].toLowerCase().trim();
                return uom === "ea" || uom === "pcs" || uom === "each";
            })
            .map(rm => ({
                value: String(rm.rawMaterialId),
                label: rm.materialName,
                disabled: accessories.some(a => String(a.rawMaterialId) === String(rm.rawMaterialId))
            }));
    }, [allRawMaterials, accessories]);

    return (
        <div className="w-full mx-auto">
            <div className="bg-white  border border-gray-200">
                {/* Page Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-800">Create Product</h2>
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
                            />
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
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    Max 3 images. First is primary.
                                </p>
                                {errors.images && (
                                    <p className="text-xs text-red-500 mt-1">{errors.images}</p>
                                )}
                            </div>

                            {imagePreviews.map((preview, index) => (
                                <div key={index} className="col-span-1 border border-slate-200 rounded-xl p-2 relative h-32 flex items-center justify-center bg-white shadow-sm">
                                    <img
                                        src={preview}
                                        alt={`Preview ${index + 1}`}
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
                                        onClick={() => handleRemoveImage(index)}
                                    >
                                        <FaTimes size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Variants & Specifications */}
                    <div className="pt-2">
                        <h6 className="text-base font-semibold text-gray-800 mb-3">Variants & Specifications</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            <UOMSelect
                                name="uomId"
                                label="UOM"
                                value={formData.uomId}
                                required
                                category={["length", "mass", "each"]}
                                allowedCodes={["ea"]}
                                onChange={(value) => {
                                    setFormData(prev => ({ ...prev, uomId: value }));
                                    if (errors.uomId) {
                                        setErrors(prev => ({ ...prev, uomId: "" }));
                                    }
                                }}
                                error={errors.uomId}
                            />
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Weight Per Piece <span className="text-rose-500 ml-1">*</span>
                                </label>
                                <div className="flex rounded-md h-10 border border-slate-200 overflow-hidden">
                                    <input
                                        type="number"
                                        name="weightPerPiece"
                                        value={formData.weightPerPiece}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        step="any"
                                        className="flex-1 w-full bg-transparent px-3 py-2 text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none border-r border-slate-200 h-full"
                                    />
                                    <select
                                        name="weightUom"
                                        value={(formData as any).weightUom || "kg"}
                                        onChange={handleChange}
                                        className="px-2 text-sm font-medium text-slate-700 bg-slate-50 border-0 focus:outline-none h-full cursor-pointer"
                                    >
                                        <option value="kg">kg</option>
                                        <option value="g">g</option>
                                    </select>
                                </div>
                                {errors.weightPerPiece && (
                                    <p className="mt-1.5 text-sm text-rose-500 font-medium">{errors.weightPerPiece}</p>
                                )}
                            </div>
                            <TextInput
                                label="Bundle/Package size"
                                name="bundleQty"
                                type="number"
                                value={formData.bundleQty}
                                placeholder="6 pcs / bundle"
                                onChange={handleChange}
                                error={errors.bundleQty}
                            />

                            <TextInput
                                label="Dimensions (L×B×H CM)"
                                name="dimensions"
                                value={formData.dimensions}
                                placeholder="e.g. 30×30×35"
                                onChange={handleChange}
                            />
                            <TextInput
                                label="Mould Reference"
                                name="mouldReference"
                                value={formData.mouldReference}
                                placeholder="e.g. MLD-99"
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Pricing & Tax */}
                    <div className="pt-2">
                        <h6 className="text-base font-semibold text-gray-800 mb-3">Pricing & Tax</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                            <TextInput
                                label="HSN CODE"
                                name="hsnCode"
                                value={formData.hsnCode}
                                placeholder="e.g. 3924"
                                onChange={handleChange}
                                error={errors.hsnCode}
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


                            <TextInput
                                label="MRP (₹)"
                                name="mrp"
                                type="number"
                                step="0.01"
                                value={formData.mrp}
                                placeholder="0.00"
                                onChange={handleChange}
                                error={errors.mrp}
                            />
                            <TextInput
                                label="B2B (₹)"
                                name="b2b"
                                type="number"
                                step="0.01"
                                value={formData.b2b}
                                placeholder="0.00"
                                onChange={handleChange}
                                error={errors.b2b}
                            />
                            <TextInput
                                label="B2C (₹)"
                                name="b2c"
                                type="number"
                                step="0.01"
                                value={formData.b2c}
                                placeholder="0.00"
                                onChange={handleChange}
                                error={errors.b2c}
                            />
                            <TextInput
                                label="Export Price (₹)"
                                name="exportPrice"
                                type="number"
                                step="0.01"
                                value={formData.exportPrice}
                                placeholder="0.00"
                                onChange={handleChange}
                                error={errors.exportPrice}
                            />
                        </div>
                    </div>

                    {/* Capacity — initial setup (multiple entries) */}
                    <div className="pt-2">
                        <div className="flex justify-between items-center mb-3">
                            <h6 className="text-base font-semibold text-gray-800 m-0">Initial Capacity Setup</h6>
                            <CustomButton
                                text="Add Capacity Setup"
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
                                    <div key={`cap-${idx}`} className="p-4 border border-slate-200 rounded-xl relative bg-slate-50/50">
                                        <div className="absolute top-2 right-2">
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
                                                        ...machines.map(m => ({ value: m.machineId, label: `${m.machineId} - ${m.machineName}` }))
                                                    ]}
                                                    onChange={(e) => handleInitialCapacityChange(idx, "capMachine", e.target.value)}
                                                />
                                            </div>
                                           
                                             <div>
                                                <SelectInput
                                                    label="Role"
                                                    name={`capDeptId-${idx}`}
                                                    value={cap.capDeptId}
                                                    options={[
                                                        { value: "", label: "-- Role --" },
                                                        ...departments.map(dept => ({ value: String(dept.id), label: dept.name }))
                                                    ]}
                                                    onChange={(e) => handleInitialCapacityChange(idx, "capDeptId", e.target.value)}
                                                />
                                            </div>

                                            <div className="col-span-full xl:col-span-3">
                                                <MultiSelect
                                                    label="Operators"
                                                    name={`capOperatorIds-${idx}`}
                                                    options={employees
                                                        .filter(emp => !cap.capDeptId || String(emp.departmentId) === cap.capDeptId)
                                                        .map(emp => ({ value: String(emp.id), label: emp.fullName }))}
                                                    value={cap.capOperatorIds}
                                                    onChange={(_, vals) => handleInitialCapacityChange(idx, "capOperatorIds", vals)}
                                                    placeholder={cap.capDeptId ? "Select operators" : "Select role first"}
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
                                No initial capacity added. Click "Add Capacity Setup" to configure machines and operators.
                            </div>
                        )}
                    </div>

                    

                    {/* Raw Materials Composition */}
                    <div className="pt-2">
                        <div className="flex justify-between items-center mb-3">
                            <h6 className="text-base font-semibold text-gray-800 m-0">Raw Materials Composition (BOM)</h6>
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
                            <div className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                                No raw materials added. Click "Add Raw Material" to specify the composition.
                            </div>
                        )}
                    </div>

                    {/* Accessories / Additional Items */}
                    <div className="pt-6">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h6 className="text-base font-semibold text-gray-800 m-0">Accessories / Additional Items (Optional)</h6>
                                <span className="text-xs text-slate-500 font-normal bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    (Only items measured in pcs are shown here)
                                </span>
                            </div>
                            <CustomButton
                                text="Add Item"
                                icon={FaPlus}
                                onClick={handleAddAccessory}
                                type="button"
                                size="sm"
                                variant="secondary"
                            />
                        </div>
                        {accessories.length > 0 ? (
                            <div className="border border-slate-200 rounded-xl overflow-visible">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 text-slate-600">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold border-b border-slate-200 w-[60%]">Raw Material (Item)</th>
                                            <th className="px-4 py-3 font-semibold border-b border-slate-200 w-[30%]">Quantity</th>
                                            <th className="px-4 py-3 font-semibold border-b border-slate-200 w-[10%] text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {accessories.map((acc, idx) => (
                                            <tr key={`acc-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 align-top">
                                                    <SelectInput
                                                        hideLabel={true}

                                                        name={`acc-rm-${idx}`}
                                                        value={acc.rawMaterialId}
                                                        options={[{ value: "", label: "-- Select --" }, ...accessoryOptions]}
                                                        onChange={(e) => handleAccessoryChange(idx, "rawMaterialId", e.target.value)}
                                                        error={errors[`accessories.${idx}.rawMaterialId`]}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <TextInput
                                                        label=""
                                                        name={`acc-qty-${idx}`}
                                                        type="number"
                                                        bottom={true}
                                                        step="any"
                                                        value={acc.quantity}
                                                        placeholder="0"
                                                        onChange={(e) => handleAccessoryChange(idx, "quantity", e.target.value)}
                                                        error={errors[`accessories.${idx}.quantity`]}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 align-top text-center">
                                                    <DeleteButton onClick={() => handleRemoveAccessory(idx)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {errors.accessories && (
                                    <div className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium border-t border-slate-200">
                                        {errors.accessories}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                                No accessories added. Click "Add Item" to specify additional quantities.
                            </div>
                        )}
                    </div>

                    {/* Production Workflow (optional, free-text step-by-step pipeline) */}
                    <div className="pt-2 flex flex-col w-full md:w-[50%]">
                        <FlowInput
                            value={productionSteps}
                            onChange={handleProductionStepsChange}
                            error={errors.productionSteps}
                        />
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
                        <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} variant="secondary" disabled={isSubmitting} />
                        <CustomButton text={isSubmitting ? "Saving..." : "Save Product"} icon={FaSave} type="submit" disabled={isSubmitting} />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductCreatePage;