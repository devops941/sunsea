import React, { useState, useEffect, useMemo, useRef } from "react";
import { FaSave, FaEraser, FaTimes, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useProducts } from "../../../hooks/useProducts";
import { useCategories } from "../../../hooks/useCategories";
import { productService } from "../../../services/productService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { useColors } from "../../../hooks/useColors";
import { useSizes } from "../../../hooks/useSizes";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";

// ─── Per‑color‑type pricing row ──────────────────────────────────────────
type ColorTypePriceRow = {
    typeId: string;      // "sc" or "mc"
    typeName: string;    // "Single Color" or "Multi Color"
    mrp: string;
    b2b: string;
    b2c: string;
    exportPrice: string;
};

const emptyTypePriceRow = (typeId: string, typeName: string): ColorTypePriceRow => ({
    typeId,
    typeName,
    mrp: "",
    b2b: "",
    b2c: "",
    exportPrice: "",
});

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
        colorType: [] as string[],     // selected color types (sc/mc)
        colorIds: [] as string[],      // selected actual colors (optional)
        sizeId: "",
        hsnCode: "",
        gstTaxRateId: "",
        minimumQty: "",
        maximumQty: "",
        openingStockQty: "",
        openingStockStoreId: "",
    });

    // ✅ Per‑color‑type pricing rows — automatically synchronised with colorType
    const [colorTypePricing, setColorTypePricing] = useState<ColorTypePriceRow[]>([]);

    // ✅ Raw Materials Composition
    type RawMaterialRow = { rawMaterialId: string; percentage: string; };
    const [rawMaterials, setRawMaterials] = useState<RawMaterialRow[]>([]);
    const [rawMaterialOptions, setRawMaterialOptions] = useState<{value: string, label: string}[]>([]);

    // Load initial data
    useEffect(() => {
        loadCategories({ isActive: true });
        dispatch(fetchGstTaxes({ status: "ACTIVE" }));
        loadColors({ isActive: true });
        loadSizes({ isActive: true });
        const fetchCode = async () => {
            try {
                const nextCode = await productService.fetchNextId();
                setFormData(prev => ({ ...prev, productCode: nextCode }));
            } catch (error) {
                console.error("Failed to fetch next product code", error);
            }
        };
        fetchCode();

        storeService.fetchAll({ limit: 1000 })
            .then(res => {
                const data = Array.isArray(res?.stores) ? res.stores : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setStores(data);
                const fgStore = data.find((s: any) => s.storeName.toLowerCase().includes('finish'));
                if (fgStore) {
                    setFormData(prev => ({ ...prev, openingStockStoreId: fgStore.storeId }));
                }
            }).catch(() => { });

        rawMaterialService.fetchAll({})
            .then((res: any) => {
                const data = Array.isArray(res?.rawMaterials) ? res.rawMaterials : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setRawMaterialOptions(data.map((rm: any) => ({ value: String(rm.rawMaterialId), label: rm.materialName })));
            }).catch(() => { });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup image previews
    useEffect(() => {
        return () => {
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [imagePreviews]);

    // ─── Sync pricing rows with selected color types ─────────────────────
    useEffect(() => {
        setColorTypePricing(prev => {
            const prevMap = new Map(prev.map(row => [row.typeId, row]));
            return formData.colorType.map(typeId => {
                const typeName = typeId === "sc" ? "Single Color" : "Multi Color";
                const existing = prevMap.get(typeId);
                return existing ? { ...existing, typeName } : emptyTypePriceRow(typeId, typeName);
            });
        });
    }, [formData.colorType]);

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

        if (formData.weightPerPiece) {
            const weight = Number(formData.weightPerPiece);
            if (isNaN(weight) || weight <= 0)
                newErrors.weightPerPiece = "Weight must be greater than 0.";
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

        if (!formData.sizeId) {
            newErrors.sizeId = "Size is required.";
        }

        // ── Images ──────────────────────────────────────────────────────

        // ── Color Type ──────────────────────────────────────────────────
        if (formData.colorType.length === 0) {
            newErrors.colorType = "Select at least one color type.";
        }

        // ── Colors ──────────────────────────────────────────────────────
        if (formData.colorIds.length === 0) {
            newErrors.colorIds = "Select at least one color.";
        }

        // ── Pricing validation (per color type) ─────────────────────────
        colorTypePricing.forEach(row => {
            const prefix = `colorTypePricing.${row.typeId}`;

            if (!row.mrp) {
                newErrors[`${prefix}.mrp`] = "Required";
            } else {
                const mrp = Number(row.mrp);
                if (isNaN(mrp) || mrp <= 0)
                    newErrors[`${prefix}.mrp`] = "Must be > 0";
            }

            if (!row.b2b) {
                newErrors[`${prefix}.b2b`] = "Required";
            } else {
                const price = Number(row.b2b);
                if (isNaN(price) || price <= 0)
                    newErrors[`${prefix}.b2b`] = "Must be > 0";
            }

            // Cross-check MRP >= B2B
            if (row.mrp && row.b2b) {
                const mrp = Number(row.mrp);
                const b2b = Number(row.b2b);
                if (!isNaN(mrp) && !isNaN(b2b) && mrp < b2b)
                    newErrors[`${prefix}.mrp`] = "Cannot be less than B2B price";
            }

            if (!row.b2c) {
                newErrors[`${prefix}.b2c`] = "Required";
            } else {
                const price = Number(row.b2c);
                if (isNaN(price) || price <= 0)
                    newErrors[`${prefix}.b2c`] = "Must be > 0";
            }

            if (!row.exportPrice) {
                newErrors[`${prefix}.exportPrice`] = "Required";
            } else {
                const price = Number(row.exportPrice);
                if (isNaN(price) || price <= 0)
                    newErrors[`${prefix}.exportPrice`] = "Must be > 0";
            }
        });

        if (rawMaterials.length > 0) {
            const totalPercent = rawMaterials.reduce((acc, rm) => acc + Number(rm.percentage), 0);
            if (Math.abs(totalPercent - 100) > 0.01) {
                newErrors.rawMaterials = "Total percentage must be exactly 100%";
                toast.error("Total Raw Material percentage must be 100%");
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

    const handleColorTypePriceChange = (
        typeId: string,
        field: keyof Omit<ColorTypePriceRow, "typeId" | "typeName">,
        value: string
    ) => {
        setColorTypePricing(prev =>
            prev.map(row => (row.typeId === typeId ? { ...row, [field]: value } : row))
        );
        const errorKey = `colorTypePricing.${typeId}.${field}`;
        if (errors[errorKey]) {
            setErrors(prev => ({ ...prev, [errorKey]: "" }));
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
            bundleQty: "",
            dimensions: "",
            mouldReference: "",
            typeCode: "",
            tags: "",
            description: "",
            isActive: "true",
            colorType: [],
            colorIds: [],
            sizeId: "",
            hsnCode: "",
            gstTaxRateId: "",
            minimumQty: '',
            maximumQty: '',
            openingStockQty: "",
            openingStockStoreId: "",
        });
        setColorTypePricing([]);
        setRawMaterials([]);
        setErrors({});
        setImageFiles([]);
        setImagePreviews([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        try {
            const payload = new FormData();
            payload.append("productCode", formData.productCode);
            payload.append("productName", formData.productName);
            if (formData.displayName) payload.append("displayName", formData.displayName);
            if (formData.itemCode) payload.append("itemCode", formData.itemCode);
            payload.append("categoryId", formData.categoryId);
            if (formData.uomId) payload.append("uomId", formData.uomId);
            if (formData.capacityLitres) payload.append("capacityLitres", formData.capacityLitres);
            if (formData.weightPerPiece) payload.append("weightPerPiece", formData.weightPerPiece);
            if (formData.bundleQty) payload.append("bundleQty", formData.bundleQty);
            if (formData.dimensions) payload.append("dimensions", formData.dimensions);
            if (formData.mouldReference) payload.append("mouldReference", formData.mouldReference);
            if (formData.typeCode) payload.append("typeCode", formData.typeCode);
            if (formData.tags) payload.append("tags", formData.tags);
            if (formData.description) payload.append("description", formData.description);
            payload.append("isActive", String(formData.isActive === "true"));
            if (formData.hsnCode) payload.append("hsnCode", formData.hsnCode);
            if (formData.gstTaxRateId) payload.append("gstTaxRateId", formData.gstTaxRateId);

            // Append selected colors and size
            formData.colorIds.forEach(id => payload.append("colorIds", id));
            if (formData.sizeId) payload.append("sizeId", formData.sizeId);
            payload.append("minimumQty", String(formData.minimumQty));
            payload.append("maximumQty", String(formData.maximumQty));

            if (formData.openingStockQty) payload.append("openingStockQty", formData.openingStockQty);
            if (formData.openingStockStoreId) payload.append("openingStockStoreId", formData.openingStockStoreId);

            // Append color type IDs (sc/mc) as an array
            formData.colorType.forEach(type => payload.append("colorType[]", type));

            // ── Pricing: per‑color‑type ───────────────────────────────────
            payload.append("colorTypePricing", JSON.stringify(
                colorTypePricing.map(row => ({
                    typeId: row.typeId,
                    b2b: Number(row.b2b),
                    mrp: row.mrp ? Number(row.mrp) : null,
                    b2c: row.b2c ? Number(row.b2c) : null,
                    exportPrice: row.exportPrice ? Number(row.exportPrice) : null,
                }))
            ));

            if (rawMaterials.length > 0) {
                payload.append("rawMaterials", JSON.stringify(
                    rawMaterials.map(rm => ({
                        rawMaterialId: rm.rawMaterialId,
                        percentage: Number(rm.percentage)
                    }))
                ));
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

    // ─── Render ───────────────────────────────────────────────────────────
    return (
        <div className="w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Page Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-800">Create Product</h2>
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
                                label="Status"
                                name="isActive"
                                value={formData.isActive}
                                options={[
                                    { value: "true", label: "Active" },
                                    { value: "false", label: "Inactive" },
                                ]}
                                onChange={handleChange}
                            />
                            <TextInput
                                label="Opening Stock Qty"
                                name="openingStockQty"
                                type="number"
                                placeholder="0"
                                value={formData.openingStockQty}
                                onChange={handleChange}
                                error={errors.openingStockQty}
                            />
                            <SelectInput
                                label="Opening Stock Store"
                                name="openingStockStoreId"
                                value={formData.openingStockStoreId}
                                options={storeOptions}
                                onChange={handleChange}
                                error={errors.openingStockStoreId}
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
                            <TextInput
                                label="Bundle/Package size"
                                name="bundleQty"
                                type="number"
                                value={formData.bundleQty}
                                placeholder="6 pcs / bundle"
                                onChange={handleChange}
                                error={errors.bundleQty}
                            />
                            <QuantityInput
                                label="Weight Per Piece"
                                name="weightPerPiece"
                                value={formData.weightPerPiece}
                                baseUoms="kg,g"
                                onChange={handleChange}
                                error={errors.weightPerPiece}
                            />
                            <MultiSelect
                                label="Color Type"
                                name="colorType"
                                value={formData.colorType}
                                options={[
                                    { value: "sc", label: "Single Color" },
                                    { value: "mc", label: "Multi Color" },
                                ]}
                                onChange={handleMultiSelect}
                                error={errors.colorType}
                                required
                                placeholder="Select color type"
                            />
                            <MultiSelect
                                label="Colors"
                                name="colorIds"
                                options={colorsOptions}
                                value={formData.colorIds}
                                onChange={handleMultiSelect}
                                required
                                error={errors.colorIds}
                                placeholder="-- Select Colors --"
                            />
                            <SelectInput
                                label="Sizes"
                                name="sizeId"
                                value={formData.sizeId}
                                options={sizeOptions}
                                onChange={handleChange}
                                required
                                error={errors.sizeId}
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
                        </div>

                        {colorTypePricing.length !== 0 && (
                            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                                <div className="bg-white px-4 py-3 border-b border-slate-200">
                                    <h6 className="font-semibold text-slate-700 m-0">Price Per Color Type</h6>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-50 text-slate-600">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold w-40 border-b border-slate-200">COLOR TYPE</th>
                                                <th className="px-4 py-3 font-semibold border-b border-slate-200">MRP (₹)</th>
                                                <th className="px-4 py-3 font-semibold border-b border-slate-200">B2B (₹)</th>
                                                <th className="px-4 py-3 font-semibold border-b border-slate-200">B2C (₹)</th>
                                                <th className="px-4 py-3 font-semibold border-b border-slate-200">EXPORT (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {colorTypePricing.map(row => (
                                                <tr key={row.typeId} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-slate-800">
                                                        {row.typeName}
                                                    </td>
                                                    <td className="px-4 py-3 align-top">
                                                        <TextInput
                                                            label=""
                                                            name={`colorTypePricing.${row.typeId}.mrp`}
                                                            type="number"
                                                            step="0.01"
                                                            value={row.mrp}
                                                            placeholder="0.00"
                                                            onChange={e => handleColorTypePriceChange(row.typeId, "mrp", e.target.value)}
                                                            error={errors[`colorTypePricing.${row.typeId}.mrp`]}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 align-top">
                                                        <TextInput
                                                            label=""
                                                            name={`colorTypePricing.${row.typeId}.b2b`}
                                                            type="number"
                                                            step="0.01"
                                                            value={row.b2b}
                                                            placeholder="0.00"
                                                            onChange={e => handleColorTypePriceChange(row.typeId, "b2b", e.target.value)}
                                                            error={errors[`colorTypePricing.${row.typeId}.b2b`]}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 align-top">
                                                        <TextInput
                                                            label=""
                                                            name={`colorTypePricing.${row.typeId}.b2c`}
                                                            type="number"
                                                            step="0.01"
                                                            value={row.b2c}
                                                            placeholder="0.00"
                                                            onChange={e => handleColorTypePriceChange(row.typeId, "b2c", e.target.value)}
                                                            error={errors[`colorTypePricing.${row.typeId}.b2c`]}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 align-top">
                                                        <TextInput
                                                            label=""
                                                            name={`colorTypePricing.${row.typeId}.exportPrice`}
                                                            type="number"
                                                            step="0.01"
                                                            value={row.exportPrice}
                                                            placeholder="0.00"
                                                            error={errors[`colorTypePricing.${row.typeId}.exportPrice`]}
                                                            onChange={e => handleColorTypePriceChange(row.typeId, "exportPrice", e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Raw Materials Composition */}
                    <div className="pt-2">
                        <div className="flex justify-between items-center mb-3">
                            <h6 className="text-base font-semibold text-gray-800 m-0">Raw Materials Composition (BOM)</h6>
                            <button
                                type="button"
                                onClick={handleAddRawMaterial}
                                className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium transition-colors border border-indigo-100 flex items-center gap-1"
                            >
                                <FaPlus size={10} /> Add Raw Material
                            </button>
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
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 align-top">
                                                    <SelectInput
                                                        label=""
                                                        name={`rm-${idx}`}
                                                        value={rm.rawMaterialId}
                                                        options={[{ value: "", label: "-- Select --" }, ...rawMaterialOptions]}
                                                        onChange={(e) => handleRawMaterialChange(idx, "rawMaterialId", e.target.value)}
                                                        error={errors[`rawMaterials.${idx}.rawMaterialId`]}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <TextInput
                                                        label=""
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
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRawMaterial(idx)}
                                                        className="text-red-500 hover:text-red-700 p-2"
                                                        title="Remove"
                                                    >
                                                        <FaTimes size={14} />
                                                    </button>
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

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
                        <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} variant="secondary" />
                        <CustomButton text="Save Product" icon={FaSave} type="submit" />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductCreatePage;
