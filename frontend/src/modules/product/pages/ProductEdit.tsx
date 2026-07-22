import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaSave, FaImage, FaTimes, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import CustomButton from "../../../components/ui/Button/Button";
import { useProducts } from "../../../hooks/useProducts";
import { useCategories } from "../../../hooks/useCategories";
import { useColors } from "../../../hooks/useColors";
import { useSizes } from "../../../hooks/useSizes";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import { productService } from "../../../services/productService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { getImageUrl } from "../../../utils/ImageUrls";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";
import FlowInput from "../../../components/ui/FlowInput/FlowInput";

const MAX_IMAGES = 3;



interface ExistingProductImage {
    id: string | number;
    imageUrl: string;
    isPrimary?: boolean;
}

const ProductEdit: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const dispatch = useAppDispatch();

    const [productData, setProductData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const { editProduct } = useProducts();
    const { categories, loadCategories } = useCategories();
    const { colors, loadColors } = useColors();
    const { sizes, loadSizes } = useSizes();

    // ── GST taxes from Redux store ──────────────────────────────────────
    const gstTaxes = useAppSelector(selectActiveGstTaxes);
    const gstLoading = useAppSelector((state) => state.gst.loading);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [existingImages, setExistingImages] = useState<ExistingProductImage[]>([]);
    const [removedImageIds, setRemovedImageIds] = useState<(string | number)[]>([]);
    const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [stores, setStores] = useState<any[]>([]);

    // ─── Form state (no flat pricing fields) ────────────────────────────
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
    });

    // ✅ Raw Materials Composition
    type RawMaterialRow = { rawMaterialId: string; percentage: string; };
    const [rawMaterials, setRawMaterials] = useState<RawMaterialRow[]>([]);
    const [rawMaterialOptions, setRawMaterialOptions] = useState<{ value: string, label: string }[]>([]);
    const [productionSteps, setProductionSteps] = useState<string[]>([]);

    // Load dropdowns
    useEffect(() => {
        loadCategories({ isActive: true });
        // loadActiveUOMs();
        dispatch(fetchGstTaxes({ status: "ACTIVE" }));
        loadColors({ isActive: true });
        loadSizes({ isActive: true });

        storeService.fetchAll({ limit: 1000 })
            .then(res => {
                const data = Array.isArray(res?.stores) ? res.stores : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setStores(data);
                if (data.length > 0) {
                    const fgStore = data.find((s: any) => s.storeName.toLowerCase().includes('finish'));
                    setFormData(prev => ({
                        ...prev,
                        openingStockStoreId: prev.openingStockStoreId || (fgStore ? fgStore.storeId : data[0].storeId)
                    }));
                }
            }).catch(() => { });

        rawMaterialService.fetchAll({})
            .then((res: any) => {
                const data = Array.isArray(res?.rawMaterials) ? res.rawMaterials : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setRawMaterialOptions(data.map((rm: any) => ({ value: String(rm.rawMaterialId), label: rm.materialName })));
            }).catch(() => { });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch product
    useEffect(() => {
        (async () => {
            try {
                if (id) {
                    const data = await productService.fetchById(id);
                    setProductData(data);
                }
            } catch (err) {
                console.error("Failed to fetch product:", err);
                toast.error("Failed to load product data");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    // Hydrate form
    useEffect(() => {
        if (!productData) return;

        let latestStock: any = null;
        if (productData.finishedGoodsStocks && productData.finishedGoodsStocks.length > 0) {
            latestStock = [...productData.finishedGoodsStocks].sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        }

        setFormData((prev) => ({
            ...prev,
            productCode: productData.productCode || "",
            productName: productData.productName || "",
            displayName: productData.displayName || "",
            itemCode: productData.itemCode || "",
            categoryId: productData.categoryId ? String(productData.categoryId) : "",
            uomId: productData.uom?.code || productData.uom?.uomCode || (productData.uomId ? String(productData.uomId) : ""),
            capacityLitres: productData.capacityLitres != null ? String(productData.capacityLitres) : "",
            weightPerPiece: productData.weightPerPiece != null ? String(productData.weightPerPiece) : "",
            bundleQty: productData.bundleQty != null ? String(productData.bundleQty) : "",
            dimensions: productData.dimensions || "",
            mouldReference: productData.mouldReference || "",
            typeCode: productData.typeCode || "",
            tags: productData.tags || "",
            description: productData.description || "",
            isActive: productData.isActive ? "true" : "false",
            mrp: productData.mrp != null ? String(productData.mrp) : "",
            b2b: productData.b2b != null ? String(productData.b2b) : "",
            b2c: productData.b2c != null ? String(productData.b2c) : "",
            exportPrice: productData.exportPrice != null ? String(productData.exportPrice) : "",
            hsnCode: productData.hsnCode || "",
            gstTaxRateId: productData.gstTaxRateId ? String(productData.gstTaxRateId) : "",
            minimumQty: productData.minimumQty != null ? String(productData.minimumQty) : "",
            maximumQty: productData.maximumQty != null ? String(productData.maximumQty) : "",
            openingStockQty: latestStock ? String(latestStock.onHandQty) : "",
            openingStockStoreId: latestStock ? String(latestStock.storeId) : (prev.openingStockStoreId || ""),
        }));


        if (productData.billOfMaterials) {
            setRawMaterials(productData.billOfMaterials.map((bom: any) => ({
                rawMaterialId: bom.rawMaterialId,
                percentage: bom.percentage ? String(bom.percentage) : ""
            })));
        } else {
            setRawMaterials([]);
        }

        if (productData.productionSteps) {
            setProductionSteps(productData.productionSteps.map((s: any) => s.stepKey));
        } else {
            setProductionSteps([]);
        }

        const images: ExistingProductImage[] = (productData.images || []).slice();
        images.sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
        setExistingImages(images);
        setRemovedImageIds([]);
    }, [productData]);



    // Cleanup previews
    useEffect(() => {
        return () => {
            newImagePreviews.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [newImagePreviews]);

    // ─── Validation ──────────────────────────────────────────────────────
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        // --- Basic Information ---
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

        // --- Minimum / Maximum Stock Qty (same as Create) ---
        const minQty = formData.minimumQty ? Number(formData.minimumQty) : NaN;

        if (!formData.minimumQty.toString().trim()) {
            newErrors.minimumQty = "Minimum Stock Qty is required.";
        } else if (isNaN(minQty) || minQty < 0) {
            newErrors.minimumQty = "Minimum Stock Qty must be 0 or greater.";
        }



        // --- Pricing validation ---
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
            if (Math.abs(totalPercent - 100) > 0.01) {
                newErrors.rawMaterials = "Total percentage must be exactly 100%";
                toast.error("Total Raw Material percentage must be 100%");
            }
            rawMaterials.forEach((rm, index) => {
                if (!rm.rawMaterialId) newErrors[`rawMaterials.${index}.rawMaterialId`] = "Required";
                if (!rm.percentage || Number(rm.percentage) <= 0) newErrors[`rawMaterials.${index}.percentage`] = "Invalid %";
            });
        }

        if (productionSteps.length > 0) {
            const normalized = productionSteps.map(s => s.trim().toLowerCase());
            const unique = new Set(normalized);
            if (unique.size !== normalized.length) {
                newErrors.productionSteps = "Each step can only be added once";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ─── Handlers ─────────────────────────────────────────────────────────
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const handleMultiSelect = (name: string, values: string[]) => {
        setFormData((prev) => ({ ...prev, [name]: values }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const handleProductionStepsChange = (steps: string[]) => {
        setProductionSteps(steps);
        if (errors.productionSteps) {
            setErrors(prev => ({ ...prev, productionSteps: "" }));
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

        const previews = files.map((file) => URL.createObjectURL(file));
        setNewImageFiles((prev) => [...prev, ...files]);
        setNewImagePreviews((prev) => [...prev, ...previews]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleRemoveExistingImage = (imageId: string | number) => {
        setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
        setRemovedImageIds((prev) => [...prev, imageId]);
    };

    const handleRemoveNewImage = (index: number) => {
        URL.revokeObjectURL(newImagePreviews[index]);
        setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
        setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    // ─── Submit ───────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

        if (!validateForm()) return;

        try {
            const payload = new FormData();
            // Basic info
            payload.append("productCode", formData.productCode);
            payload.append("productName", formData.productName);
            if (formData.displayName) payload.append("displayName", formData.displayName);
            if (formData.itemCode) payload.append("itemCode", formData.itemCode);
            payload.append("categoryId", formData.categoryId);
            if (formData.uomId) payload.append("uomId", formData.uomId);
            payload.append("isActive", String(formData.isActive === "true"));
            if (formData.tags) payload.append("tags", formData.tags);
            if (formData.description) payload.append("description", formData.description);

            // Variants & specs
            if (formData.capacityLitres) payload.append("capacityLitres", formData.capacityLitres);
            if (formData.weightPerPiece) payload.append("weightPerPiece", formData.weightPerPiece);
            if (formData.bundleQty) payload.append("bundleQty", formData.bundleQty);
            if (formData.dimensions) payload.append("dimensions", formData.dimensions);
            if (formData.mouldReference) payload.append("mouldReference", formData.mouldReference);
            if (formData.typeCode) payload.append("typeCode", formData.typeCode);



            // Tax — FK to gst_tax_rates, plus a snapshot rate for historical accuracy
            if (formData.hsnCode) payload.append("hsnCode", formData.hsnCode);
            if (formData.gstTaxRateId) {
                payload.append("gstTaxRateId", formData.gstTaxRateId);
                const selectedTax = gstTaxes.find((t) => t.id === formData.gstTaxRateId);
                if (selectedTax) payload.append("gstRate", String(selectedTax.taxRate));
            }

            payload.append("minimumQty", formData.minimumQty || "0");
            payload.append("maximumQty", formData.maximumQty || "0");

            if (formData.openingStockQty) payload.append("openingStockQty", formData.openingStockQty);
            if (formData.openingStockStoreId) payload.append("openingStockStoreId", formData.openingStockStoreId);

            // ── Pricing ─────────────────────────────
            if (formData.mrp) payload.append("mrp", formData.mrp);
            if (formData.b2b) payload.append("b2b", formData.b2b);
            if (formData.b2c) payload.append("b2c", formData.b2c);
            if (formData.exportPrice) payload.append("exportPrice", formData.exportPrice);

            if (rawMaterials.length > 0) {
                payload.append("rawMaterials", JSON.stringify(
                    rawMaterials.map(rm => ({
                        rawMaterialId: rm.rawMaterialId,
                        percentage: Number(rm.percentage)
                    }))
                ));
            } else {
                payload.append("rawMaterials", "[]");
            }

            if (productionSteps.length > 0) {
                payload.append("productionSteps", JSON.stringify(
                    productionSteps.map((step, index) => ({
                        stepKey: step,
                        stepOrder: index + 1,
                    }))
                ));
            } else {
                payload.append("productionSteps", "[]");
            }

            // Images
            newImageFiles.forEach((file) => payload.append("images", file));
            removedImageIds.forEach((imgId) => payload.append("removedImageIds", String(imgId)));

            if (existingImages.length > 0) {
                payload.append("primaryImageId", String(existingImages[0].id));
            } else if (newImageFiles.length > 0) {
                payload.append("primaryImageIndex", "0");
            }

            await editProduct(id, payload as any);
            toast.success("Product updated successfully!");
            navigate("/products");
        } catch (err: any) {
            toast.error(err.message || "Failed to update product");
        }
    };

    // ─── Options ─────────────────────────────────────────────────────────
    const categoryOptions = useMemo(
        () => [
            { value: "", label: "-- Select Category --" },
            ...categories.map((c) => ({ value: String(c.id), label: c.name })),
        ],
        [categories]
    );


    const colorsOptions = useMemo(
        () => colors.map((c) => ({ value: String(c.id), label: c.name })),
        [colors]
    );

    const sizeOptions = useMemo(
        () => [
            { value: "", label: "-- Select Size --" },
            ...sizes.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` })),
        ],
        [sizes]
    );

    // ── GST rate options — sourced from the Redux store, with a loading state ──
    const gstOptions = useMemo(() => [
        { value: "", label: gstLoading ? "Loading GST rates..." : "-- Select GST Rate --" },
        ...(gstTaxes || []).map(t => ({
            value: String(t.id),
            label: `${t.taxName} (${t.taxRate}%)`,
        })),
    ], [gstTaxes, gstLoading]);

    const storeOptions = useMemo(
        () => [
            { value: "", label: "-- Select Store --" },
            ...stores.map((s) => ({ value: String(s.storeId), label: s.storeCode ? `${s.storeName} (${s.storeCode})` : s.storeName })),
        ],
        [stores]
    );

    const hasAnyImage = existingImages.length > 0 || newImagePreviews.length > 0;

    // ─── Render ───────────────────────────────────────────────────────────
    if (loading) {
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
                        <h2 className="text-xl font-bold text-gray-800">Edit Product</h2>
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
                                allowedCodes={["kg", "g", "t", "ton", "l", "ml", "ltr", "m", "cm", "mtr", "ea", "dz"]}
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
                        <CustomButton text="Save Changes" icon={FaSave} type="submit" />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductEdit;
