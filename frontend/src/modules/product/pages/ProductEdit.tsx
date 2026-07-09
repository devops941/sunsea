import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaIdCard, FaUser, FaSave, FaImage, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { useProducts } from "../../../hooks/useProducts";
import { useCategories } from "../../../hooks/useCategories";
import { useColors } from "../../../hooks/useColors";
import { useSizes } from "../../../hooks/useSizes";
import { productService } from "../../../services/productService";
import { getImageUrl } from "../../../utils/ImageUrls";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";

const MAX_IMAGES = 3;

// ─── Per‑color‑type pricing row (matches create page) ──────────────────
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

// Build initial rows from product data
const buildInitialColorTypePricing = (product: any): ColorTypePriceRow[] => {
    const prices = product?.colorTypePrices || [];
    return prices.map((p: any) => ({
        typeId: p.colorType,           // "sc" or "mc"
        typeName: p.colorType === "sc" ? "Single Color" : "Multi Color",
        mrp: p.mrp != null ? String(p.mrp) : "",
        b2b: p.b2b != null ? String(p.b2b) : "",
        b2c: p.b2c != null ? String(p.b2c) : "",
        exportPrice: p.exportPrice != null ? String(p.exportPrice) : "",
    }));
};

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
        colorType: [] as string[],      // selected color types (sc/mc)
        colorIds: [] as string[],       // selected actual colors
        sizeId: "",
        hsnCode: "",
        gstTaxRateId: "",
        minimumQty: "",
        maximumQty: "",
    });

    const [colorTypePricing, setColorTypePricing] = useState<ColorTypePriceRow[]>([]);

    // Load dropdowns
    useEffect(() => {
        loadCategories({ isActive: true });
        loadActiveUOMs();
        dispatch(fetchGstTaxes({ status: "ACTIVE" }));
        loadColors({ isActive: true });
        loadSizes({ isActive: true });
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

        const colorTypesFromProduct = (productData.colorTypePrices || []).map(
            (p: any) => p.colorType
        );

        setFormData({
            productCode: productData.productCode || "",
            productName: productData.productName || "",
            displayName: productData.displayName || "",
            itemCode: productData.itemCode || "",
            categoryId: productData.categoryId ? String(productData.categoryId) : "",
            uomId: productData.uomId ? String(productData.uomId) : "",
            capacityLitres: productData.capacityLitres != null ? String(productData.capacityLitres) : "",
            weightPerPiece: productData.weightPerPiece != null ? String(productData.weightPerPiece) : "",
            bundleQty: productData.bundleQty != null ? String(productData.bundleQty) : "",
            dimensions: productData.dimensions || "",
            mouldReference: productData.mouldReference || "",
            typeCode: productData.typeCode || "",
            tags: productData.tags || "",
            description: productData.description || "",
            isActive: productData.isActive ? "true" : "false",
            colorType: colorTypesFromProduct,
            colorIds: (productData.colors || []).map((c: any) =>
                String(c.colorId ?? c.color?.id ?? c.id)
            ),
            sizeId: productData.sizeId ? String(productData.sizeId) : "",
            hsnCode: productData.hsnCode || "",
            gstTaxRateId: productData.gstTaxRateId ? String(productData.gstTaxRateId) : "",
            minimumQty: productData.minimumQty != null ? String(productData.minimumQty) : "",
            maximumQty: productData.maximumQty != null ? String(productData.maximumQty) : "",
        });

        setColorTypePricing(buildInitialColorTypePricing(productData));

        const images: ExistingProductImage[] = (productData.images || []).slice();
        images.sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
        setExistingImages(images);
        setRemovedImageIds([]);
    }, [productData]);

    // Sync pricing rows when colorType changes
    useEffect(() => {
        setColorTypePricing((prev) => {
            const prevMap = new Map(prev.map((row) => [row.typeId, row]));
            return formData.colorType.map((typeId) => {
                const typeName = typeId === "sc" ? "Single Color" : "Multi Color";
                const existing = prevMap.get(typeId);
                return existing ? { ...existing, typeName } : emptyTypePriceRow(typeId, typeName);
            });
        });
    }, [formData.colorType]);

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
        if (!formData.hsnCode.trim())
            newErrors.hsnCode = "HSN Code is required.";

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
        const maxQty = formData.maximumQty ? Number(formData.maximumQty) : NaN;

        if (!formData.minimumQty.toString().trim()) {
            newErrors.minimumQty = "Minimum Stock Qty is required.";
        } else if (isNaN(minQty) || minQty < 0) {
            newErrors.minimumQty = "Minimum Stock Qty must be 0 or greater.";
        }

        if (!formData.maximumQty.toString().trim()) {
            newErrors.maximumQty = "Maximum Stock Qty is required.";
        } else if (isNaN(maxQty) || maxQty < 0) {
            newErrors.maximumQty = "Maximum Stock Qty must be 0 or greater.";
        } else if (!isNaN(minQty) && maxQty < minQty) {
            newErrors.maximumQty = "Maximum Qty cannot be less than Minimum Qty.";
        }

        // --- UOM, Size ---
        if (!formData.uomId) {
            newErrors.uomId = "UOM is required.";
        }
        if (!formData.sizeId) {
            newErrors.sizeId = "Size is required.";
        }

        // --- Images (total existing + new > 0) ---
        if (existingImages.length + newImageFiles.length === 0) {
            newErrors.images = "At least one product image is required.";
        }

        // --- Color Type ---
        if (formData.colorType.length === 0) {
            newErrors.colorType = "Select at least one color type.";
        }

        // --- Colors ---
        if (formData.colorIds.length === 0) {
            newErrors.colorIds = "Select at least one color.";
        }

        // --- Per‑color‑type pricing validation (mirror Create) ---
        colorTypePricing.forEach((row) => {
            const prefix = `colorTypePricing.${row.typeId}`;

            // MRP
            if (!row.mrp) {
                newErrors[`${prefix}.mrp`] = "Required";
            } else {
                const mrp = Number(row.mrp);
                if (isNaN(mrp) || mrp <= 0)
                    newErrors[`${prefix}.mrp`] = "Must be > 0";
            }

            // B2B
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

            // B2C
            if (!row.b2c) {
                newErrors[`${prefix}.b2c`] = "Required";
            } else {
                const price = Number(row.b2c);
                if (isNaN(price) || price <= 0)
                    newErrors[`${prefix}.b2c`] = "Must be > 0";
            }

            // Export
            if (!row.exportPrice) {
                newErrors[`${prefix}.exportPrice`] = "Required";
            } else {
                const price = Number(row.exportPrice);
                if (isNaN(price) || price <= 0)
                    newErrors[`${prefix}.exportPrice`] = "Must be > 0";
            }
        });

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

    const handleColorTypePriceChange = (
        typeId: string,
        field: keyof Omit<ColorTypePriceRow, "typeId" | "typeName">,
        value: string
    ) => {
        setColorTypePricing((prev) =>
            prev.map((row) => (row.typeId === typeId ? { ...row, [field]: value } : row))
        );
        const errorKey = `colorTypePricing.${typeId}.${field}`;
        if (errors[errorKey]) {
            setErrors((prev) => ({ ...prev, [errorKey]: "" }));
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

            // Color & size
            formData.colorIds.forEach((colorId) => payload.append("colorIds", colorId));
            if (formData.sizeId) payload.append("sizeId", formData.sizeId);

            // Color type (sc/mc)
            formData.colorType.forEach((type) => payload.append("colorType[]", type));

            // Tax — FK to gst_tax_rates, plus a snapshot rate for historical accuracy
            if (formData.hsnCode) payload.append("hsnCode", formData.hsnCode);
            if (formData.gstTaxRateId) {
                payload.append("gstTaxRateId", formData.gstTaxRateId);
                const selectedTax = gstTaxes.find((t) => t.id === formData.gstTaxRateId);
                if (selectedTax) payload.append("gstRate", String(selectedTax.taxRate));
            }

            payload.append("minimumQty", formData.minimumQty || "0");
            payload.append("maximumQty", formData.maximumQty || "0");

            // ── Pricing: only per‑color‑type ─────────────────────────────
            payload.append(
                "colorTypePricing",
                JSON.stringify(
                    colorTypePricing.map((row) => ({
                        typeId: row.typeId,
                        mrp: row.mrp ? Number(row.mrp) : null,
                        b2b: Number(row.b2b),
                        b2c: row.b2c ? Number(row.b2c) : null,
                        exportPrice: Number(row.exportPrice),
                    }))
                )
            );

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

    const hasAnyImage = existingImages.length > 0 || newImagePreviews.length > 0;

    // ─── Render ───────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="inner-container d-flex justify-content-center align-items-center py-5">
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Edit Product</h2>
                                <div className="page-breadcrumb">Home / Products / Edit Product</div>
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner">
                    {/* Basic Information */}
                    <Row className="mb-4">
                        <h2 className="form-title">Basic Information</h2>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Product Code"
                                name="productCode"
                                value={formData.productCode}
                                placeholder="e.g. PRD-001"
                                icon={<FaIdCard />}
                                required
                                onChange={handleChange}
                                disabled
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Product Name"
                                name="productName"
                                value={formData.productName}
                                placeholder="e.g. Plastic Bucket 20L"
                                icon={<FaUser />}
                                required
                                onChange={handleChange}
                                error={errors.productName}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Display Name"
                                name="displayName"
                                value={formData.displayName}
                                placeholder="e.g. Bucket 20L"
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <SelectInput
                                label="Category"
                                name="categoryId"
                                value={formData.categoryId}
                                options={categoryOptions}
                                required
                                onChange={handleChange}
                                error={errors.categoryId}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Tags"
                                name="tags"
                                value={formData.tags}
                                placeholder="e.g. plastic, large, paint-industry"
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={8}>
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="Enter catalogue description..."
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6}>
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
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Minimum Stock Qty"
                                name="minimumQty"
                                type="number"
                                value={String(formData.minimumQty)}
                                required
                                error={errors.minimumQty}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Maximum Stock Qty"
                                name="maximumQty"
                                type="number"
                                value={String(formData.maximumQty)}
                                required
                                error={errors.maximumQty}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>

                    {/* Product Images */}
                    <Row className="mb-4 align-items-start">
                        <h2 className="form-title">Product Images</h2>
                        <Col lg={3} md={4} sm={12}>
                            <div className="border rounded p-3 h-100">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/png,image/jpeg,image/webp"
                                    className="form-control"
                                    onChange={handleImageChange}
                                    disabled={remainingSlots <= 0}
                                />
                                <small className="text-muted d-block mt-2">
                                    Maximum {MAX_IMAGES} images.<br />
                                    First image is the primary image.<br />
                                    {remainingSlots > 0
                                        ? `${remainingSlots} slot(s) remaining.`
                                        : "Image limit reached."}
                                </small>
                                {errors.images && <small className="text-danger d-block mt-1">{errors.images}</small>}
                            </div>
                        </Col>

                        {existingImages.map((img, index) => (
                            <Col lg={2} md={3} sm={4} xs={6} key={`existing-${img.id}`}>
                                <div className="border rounded p-2 position-relative" style={{ height: "120px" }}>
                                    <img
                                        src={getImageUrl(img.imageUrl)}
                                        alt={`Product image ${index + 1}`}
                                        className="w-100 h-100"
                                        style={{ objectFit: "contain", borderRadius: "6px" }}
                                    />
                                    {index === 0 && (
                                        <span className="badge bg-success position-absolute" style={{ top: "10px", left: "10px" }}>
                                            Primary
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-danger btn-sm position-absolute"
                                        style={{ top: "10px", right: "10px" }}
                                        onClick={() => handleRemoveExistingImage(img.id)}
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            </Col>
                        ))}

                        {newImagePreviews.map((preview, index) => (
                            <Col lg={2} md={3} sm={4} xs={6} key={`new-${index}`}>
                                <div className="border rounded p-2 position-relative" style={{ height: "120px" }}>
                                    <img
                                        src={preview}
                                        alt={`New image ${index + 1}`}
                                        className="w-100 h-100"
                                        style={{ objectFit: "contain", borderRadius: "6px" }}
                                    />
                                    {existingImages.length === 0 && index === 0 && (
                                        <span className="badge bg-success position-absolute" style={{ top: "10px", left: "10px" }}>
                                            Primary
                                        </span>
                                    )}
                                    <span className="badge bg-info position-absolute" style={{ bottom: "10px", left: "10px" }}>
                                        New
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-danger btn-sm position-absolute"
                                        style={{ top: "10px", right: "10px" }}
                                        onClick={() => handleRemoveNewImage(index)}
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            </Col>
                        ))}

                        {!hasAnyImage && (
                            <Col lg={3} md={4} sm={12}>
                                <div
                                    className="border rounded d-flex align-items-center justify-content-center text-muted"
                                    style={{ height: "120px" }}
                                >
                                    <div className="text-center">
                                        <FaImage size={24} />
                                        <div>No images</div>
                                    </div>
                                </div>
                            </Col>
                        )}
                    </Row>

                    {/* Variants & Specifications */}
                    <Row className="mb-4">
                        <h2 className="form-title">Variants & Specifications</h2>
                        <Col lg={4} md={6}>
                            <UOMSelect
                                name="uomId"
                                label="UOM"
                                value={formData.uomId}
                                required
                                category={["length", "mass", "each"]}
                                allowedCodes={[
                                    "kg", "g", "t", "ton",
                                    "l", "ml", "ltr",
                                    "m", "cm", "mtr",
                                    "ea", "dz"
                                ]}
                                onChange={(value) => {
                                    setFormData(prev => ({ ...prev, uomId: value }));
                                    if (errors.uomId) {
                                        setErrors(prev => ({ ...prev, uomId: "" }));
                                    }
                                }}
                                error={errors.uomId}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Bundle/Package size"
                                name="bundleQty"
                                type="number"
                                value={formData.bundleQty}
                                placeholder="6 pcs / bundle"
                                onChange={handleChange}
                                error={errors.bundleQty}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Capacity (Litres)"
                                name="capacityLitres"
                                value={formData.capacityLitres}
                                placeholder="e.g. 10"
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Weight Per Piece"
                                name="weightPerPiece"
                                type="number"
                                step="0.01"
                                value={formData.weightPerPiece}
                                placeholder="e.g. 1.25"
                                onChange={handleChange}
                                error={errors.weightPerPiece}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <MultiSelect
                                label="Color Type"
                                name="colorType"
                                value={formData.colorType}
                                options={[
                                    { value: "sc", label: "Single Color" },
                                    { value: "mc", label: "Multi Color" },
                                ]}
                                onChange={handleMultiSelect}
                                required
                                error={errors.colorType}
                                placeholder="Select color type"
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <MultiSelect
                                label="Colors"
                                name="colorIds"
                                options={colorsOptions}
                                value={formData.colorIds}
                                onChange={handleMultiSelect}
                                placeholder="-- Select Colors --"
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <SelectInput label="Sizes" name="sizeId" value={formData.sizeId} options={sizeOptions} onChange={handleChange} />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Dimensions (L×B×H CM)"
                                name="dimensions"
                                value={formData.dimensions}
                                placeholder="e.g. 30×30×35"
                                onChange={handleChange}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Mould Reference"
                                name="mouldReference"
                                value={formData.mouldReference}
                                placeholder="e.g. MLD-99"
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>

                    {/* Pricing & Tax */}
                    <Row className="mb-4">
                        <h2 className="form-title">Pricing & Tax</h2>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="HSN CODE"
                                name="hsnCode"
                                value={formData.hsnCode}
                                placeholder="e.g. 3924"
                                required
                                onChange={handleChange}
                                error={errors.hsnCode}
                            />
                        </Col>
                        <Col lg={4} md={6}>
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
                        </Col>

                        {/* ─── Per‑color‑type pricing table ──────────────── */}
                        <Col lg={12} className="mt-3">
                            <h6 className="fw-semibold mb-2">Price Per Color Type</h6>
                            <div className="master-table-body table-wrap">
                                <table className="master-data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "140px" }}>COLOR TYPE</th>
                                            <th>MRP (₹)</th>
                                            <th>B2B (₹)</th>
                                            <th>B2C (₹)</th>
                                            <th>EXPORT (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {colorTypePricing.map((row) => (
                                            <tr key={row.typeId} className="master-data-row">
                                                <td className="master-data-cell fw-semibold">{row.typeName}</td>
                                                <td className="master-data-cell">
                                                    <TextInput
                                                        label=""
                                                        name={`colorTypePricing.${row.typeId}.mrp`}
                                                        type="number"
                                                        step="0.01"
                                                        value={row.mrp}
                                                        placeholder="0.00"
                                                        onChange={(e) =>
                                                            handleColorTypePriceChange(row.typeId, "mrp", e.target.value)
                                                        }
                                                        error={errors[`colorTypePricing.${row.typeId}.mrp`]}
                                                    />
                                                </td>
                                                <td className="master-data-cell">
                                                    <TextInput
                                                        label=""
                                                        name={`colorTypePricing.${row.typeId}.b2b`}
                                                        type="number"
                                                        step="0.01"
                                                        value={row.b2b}
                                                        placeholder="0.00"
                                                        onChange={(e) =>
                                                            handleColorTypePriceChange(row.typeId, "b2b", e.target.value)
                                                        }
                                                        error={errors[`colorTypePricing.${row.typeId}.b2b`]}
                                                    />
                                                </td>
                                                <td className="master-data-cell">
                                                    <TextInput
                                                        label=""
                                                        name={`colorTypePricing.${row.typeId}.b2c`}
                                                        type="number"
                                                        step="0.01"
                                                        value={row.b2c}
                                                        placeholder="0.00"
                                                        onChange={(e) =>
                                                            handleColorTypePriceChange(row.typeId, "b2c", e.target.value)
                                                        }
                                                        error={errors[`colorTypePricing.${row.typeId}.b2c`]}
                                                    />
                                                </td>
                                                <td className="master-data-cell">
                                                    <TextInput
                                                        label=""
                                                        name={`colorTypePricing.${row.typeId}.exportPrice`}
                                                        type="number"
                                                        step="0.01"
                                                        value={row.exportPrice}
                                                        placeholder="0.00"
                                                        onChange={(e) =>
                                                            handleColorTypePriceChange(row.typeId, "exportPrice", e.target.value)
                                                        }
                                                        error={errors[`colorTypePricing.${row.typeId}.exportPrice`]}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        {colorTypePricing.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center text-muted py-3">
                                                    No color type selected.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Col>
                    </Row>

                    <Row className="mt-4">
                        <Col lg={12}>
                            <div className="form-actions d-flex justify-content-end">
                                <CustomButton text="Save Changes" icon={FaSave} type="submit" />
                            </div>
                        </Col>
                    </Row>
                </form>
            </Container>
        </div>
    );
};

export default ProductEdit;
