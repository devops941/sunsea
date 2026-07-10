import React, { useState, useEffect, useMemo, useRef } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaIdCard, FaUser, FaSave, FaEraser, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { useProducts } from "../../../hooks/useProducts";
import { useCategories } from "../../../hooks/useCategories";
import { productService } from "../../../services/productService";
import { useColors } from "../../../hooks/useColors";
import { useSizes } from "../../../hooks/useSizes";
import { useUOMs } from "../../../hooks/useUOMs";
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
    const { loadActiveUOMs } = useUOMs();
    const dispatch = useAppDispatch();

    // ── GST taxes from Redux store ──────────────────────────────────────
    const gstTaxes = useAppSelector(selectActiveGstTaxes);
    const gstLoading = useAppSelector((state) => state.gst.loading);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

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
        // cess: "",
        // Flat pricing — used when no color type selected
        minimumQty: "",
        maximumQty: "",
    });

    // ✅ Per‑color‑type pricing rows — automatically synchronised with colorType
    const [colorTypePricing, setColorTypePricing] = useState<ColorTypePriceRow[]>([]);

    // Load initial data
    useEffect(() => {
        loadCategories({ isActive: true });
        // loadActiveUOMs();
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
        if (!formData.hsnCode.trim())
            newErrors.hsnCode = "HSN Code is required.";

        if (!formData.gstTaxRateId) {
            newErrors.gstTaxRateId = "GST Tax Type is required.";
        }

        // if (formData.cess) {
        //     const cess = Number(formData.cess);
        //     if (isNaN(cess) || cess < 0 || cess > 100)
        //         newErrors.cess = "CESS must be between 0 and 100.";
        // }

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

        // ── UOM ─────────────────────────────────────────────────────────
        if (!formData.uomId) {
            newErrors.uomId = "UOM is required.";
        }

        if (!formData.sizeId) {
            newErrors.sizeId = "Size is required.";
        }

        // ── Images ──────────────────────────────────────────────────────
        if (imageFiles.length === 0) {
            newErrors.images = "At least one product image is required.";
        }

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

            // Cross-check MRP >= B2B, now that both are validated numbers
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

    // Edit a single cell in the per‑type pricing table
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
            // cess: "",
            minimumQty: '',
            maximumQty: '',
        });
        setColorTypePricing([]);
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
            // if (formData.cess) payload.append("cess", formData.cess);

            // Append selected colors and size
            formData.colorIds.forEach(id => payload.append("colorIds", id));
            if (formData.sizeId) payload.append("sizeId", formData.sizeId);
            payload.append("minimumQty", String(formData.minimumQty));
            payload.append("maximumQty", String(formData.maximumQty));

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

    // ─── Render ───────────────────────────────────────────────────────────
    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Create Product</h2>
                                <div className="page-breadcrumb">Home / Products / Create Product</div>
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
                                placeholder="0"
                                value={String(formData.minimumQty)}
                                onChange={handleChange}
                                required
                                error={errors.minimumQty}
                            />
                        </Col>
                        <Col lg={4} md={6}>
                            <TextInput
                                label="Maximum Stock Qty"
                                name="maximumQty"
                                type="number"
                                placeholder="0"
                                value={String(formData.maximumQty)}
                                onChange={handleChange}
                                required
                                error={errors.maximumQty}
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
                                />
                                <small className="text-muted d-block mt-2">
                                    Maximum 3 images.<br />
                                    First image will be the primary image.
                                </small>
                                {errors.images && (
                                    <small className="text-danger d-block mt-1">{errors.images}</small>
                                )}
                            </div>
                        </Col>

                        {imagePreviews.map((preview, index) => (
                            <Col lg={2} md={3} sm={4} xs={6} key={index}>
                                <div className="border rounded p-2 position-relative" style={{ height: "120px" }}>
                                    <img
                                        src={preview}
                                        alt={`Preview ${index + 1}`}
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
                                        onClick={() => handleRemoveImage(index)}
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            </Col>
                        ))}
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
                                    "ea"
                                    // ,"dz"
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
                            <QuantityInput
                                label="Weight Per Piece"
                                name="weightPerPiece"
                                value={formData.weightPerPiece}
                                baseUoms="kg,g"
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
                                error={errors.colorType}
                                required
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
                                required
                                error={errors.colorIds}
                                placeholder="-- Select Colors --"
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <SelectInput label="Sizes" name="sizeId" value={formData.sizeId} options={sizeOptions} onChange={handleChange} required error={errors.sizeId} />
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
                                error={errors.gstRate}
                                disabled={gstLoading}
                            />
                        </Col>

                        {/* <Col lg={4} md={6}>
                            <TextInput
                                label="CESS (%)"
                                name="cess"
                                type="number"
                                step="0.01"
                                value={formData.cess}
                                placeholder="e.g. 0"
                                onChange={handleChange}
                                error={errors.cess}
                            />
                        </Col> */}

                        {colorTypePricing.length !== 0 && (
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
                                            {colorTypePricing.map(row => (
                                                <tr key={row.typeId} className="master-data-row">
                                                    <td className="master-data-cell fw-semibold">
                                                        {row.typeName}
                                                    </td>

                                                    <td className="master-data-cell">
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
                                                    <td className="master-data-cell">
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
                                                    <td className="master-data-cell">
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
                                                    <td className="master-data-cell">
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
                            </Col>
                        )}
                    </Row>

                    <Row className="mt-4">
                        <Col lg={12}>
                            <div className="form-actions d-flex justify-content-end gap-3">
                                <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} />
                                <CustomButton text="Save Product" icon={FaSave} type="submit" />
                            </div>
                        </Col>
                    </Row>
                </form>
            </Container>
        </div>
    );
};

export default ProductCreatePage;
