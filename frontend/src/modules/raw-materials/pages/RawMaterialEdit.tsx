import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { updateRawMaterial } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import { z } from "zod";

// const CATEGORY_OPTIONS = [
//     { label: "Yarn", value: "Yarn" },
//     { label: "Fabric", value: "Fabric" },
//     { label: "Colorant", value: "Colorant" },
//     { label: "Chemical", value: "Chemical" },
//     { label: "Packaging", value: "Packaging" },
//     { label: "Accessories", value: "Accessories" },
// ];


const initialFormState = {
    rawMaterialId: "",
    materialName: "",
    categoryId: "",
    hsnCode: "",
    minimumStock: "",
    leadTimeDays: "",
    storeId: "",

    baseUom: "",
    reorderLevel: "",
    unitPrice: "",

    batchNo: "",
    onHandQty: "",
    reservedQty: "",
    avgCost: "",
    remarks: "",
    lastMovementAt: "",

    status: "Active",
};


const rawMaterialSchema = z
    .object({
        materialName: z
            .string()
            .trim()
            .min(1, "Material Name is required")
            .max(100, "Material Name cannot exceed 100 characters")
            .regex(
                /^(?=.*[A-Za-z])[A-Za-z0-9\s&().,-]+$/,
                "Material Name must contain at least one letter and only valid characters"
            ),

        categoryId: z
            .string()
            .trim()
            .min(1, "Raw Material Category is required"),

        hsnCode: z
            .string()
            .trim()
            .min(1, "HSN Code is required")
            .regex(
                /^\d{4,8}$/,
                "HSN Code must contain 4 to 8 digits"
            ),

        storeId: z
            .string()
            .trim()
            .min(1, "Store is required"),

        baseUom: z
            .string()
            .trim()
            .min(1, "Base UOM is required"),

        minimumStock: z
            .string()
            .trim()
            .min(1, "Minimum Stock is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Minimum Stock must be greater than or equal to 0",
                }
            ),

        reorderLevel: z
            .string()
            .trim()
            .min(1, "Reorder Level is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Reorder Level must be greater than or equal to 0",
                }
            ),

        leadTimeDays: z
            .string()
            .trim()
            .min(1, "Lead Time is required")
            .refine(
                value =>
                    Number.isInteger(Number(value)) &&
                    Number(value) >= 0,
                {
                    message: "Lead Time must be a whole number greater than or equal to 0",
                }
            ),

        unitPrice: z
            .string()
            .trim()
            .min(1, "Unit Price is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Unit Price must be greater than or equal to 0",
                }
            ),

        batchNo: z
            .string()
            .trim()
            .max(40, "Maximum 40 characters allowed")
            .optional(),

        onHandQty: z
            .string()
            .trim()
            .optional()
            .refine(
                value =>
                    !value ||
                    (!isNaN(Number(value)) && Number(value) >= 0),
                {
                    message: "Opening Stock must be greater than or equal to 0",
                }
            ),

        reservedQty: z
            .string()
            .trim()
            .optional()
            .refine(
                value =>
                    !value ||
                    (!isNaN(Number(value)) && Number(value) >= 0),
                {
                    message: "Reserved Quantity must be greater than or equal to 0",
                }
            ),

        avgCost: z
            .string()
            .trim()
            .optional()
            .refine(
                value =>
                    !value ||
                    (!isNaN(Number(value)) && Number(value) >= 0),
                {
                    message: "Average Cost must be greater than or equal to 0",
                }
            ),

        remarks: z
            .string()
            .trim()
            .max(500, "Maximum 500 characters allowed")
            .optional(),

        lastMovementAt: z
            .string()
            .optional()
            .refine(
                val => {
                    if (!val) return true;
                    // Check if date is today or in the future
                    return new Date(val) >= new Date(new Date().setHours(0, 0, 0, 0));
                },
                { message: "Date cannot be in the past" }
            ),

        status: z
            .enum(["Active", "Inactive"], {
                error: "Status is required",
            }),
    })
    .refine(
        data =>
            Number(data.reorderLevel) <= Number(data.minimumStock),
        {
            path: ["reorderLevel"],
            message:
                "Reorder Level cannot be greater than Minimum Stock",
        }
    );

const RawMaterialEdit: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: stores } = useAppSelector(state => state.stores);
    const { rawMaterialCategories, loadCategories } = useRawMaterialCategories();

    useEffect(() => {
        dispatch(fetchStores(undefined));
        loadCategories();
        if (locationState.state) {
            setFormData({
                rawMaterialId: locationState.state.rawMaterialId,
                materialName: locationState.state.materialName,
                categoryId: locationState.state.categoryId ? String(locationState.state.categoryId) : "",
                hsnCode: locationState.state.hsnCode || "",
                minimumStock: locationState.state.minimumStock !== null && locationState.state.minimumStock !== undefined ? String(locationState.state.minimumStock) : "",
                leadTimeDays: locationState.state.leadTimeDays !== null && locationState.state.leadTimeDays !== undefined ? String(locationState.state.leadTimeDays) : "",
                storeId: locationState.state.storeId || "",

                baseUom: locationState.state.baseUom || "",
                reorderLevel:
                    locationState.state.reorderLevel != null
                        ? String(locationState.state.reorderLevel)
                        : "",

                unitPrice:
                    locationState.state.unitPrice != null
                        ? String(locationState.state.unitPrice)
                        : "",

                batchNo:
                    locationState.state.batchNo ?? "",

                onHandQty:
                    locationState.state.onHandQty != null
                        ? String(locationState.state.onHandQty)
                        : "",

                reservedQty:
                    locationState.state.reservedQty != null
                        ? String(locationState.state.reservedQty)
                        : "",

                avgCost:
                    locationState.state.avgCost != null
                        ? String(locationState.state.avgCost)
                        : "",

                remarks: locationState.state.remarks || "",

                lastMovementAt: locationState.state.lastMovementAt
                    ? locationState.state.lastMovementAt.substring(0, 16)
                    : "",

                status: locationState.state.status || "Active",

            });
        } else {
            toast.error("No raw material data provided.");
            navigate("/raw-materials");
        }
    }, [locationState.state, navigate, dispatch, loadCategories]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;
        const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
        setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            rawMaterialSchema.parse(formData);
            setErrors({});
        } catch (error) {
            if (error instanceof z.ZodError) {
                const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
                const formattedErrors: Record<string, string> = {};
                Object.keys(fieldErrors).forEach((key) => {
                    const message = fieldErrors[key]?.[0];
                    if (message) {
                        formattedErrors[key] = message;
                    }
                });
                setErrors(formattedErrors);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await dispatch(updateRawMaterial({
                id: formData.rawMaterialId,
                data: {
                    materialName: formData.materialName,
                    categoryId: formData.categoryId ? Number(formData.categoryId) : null,
                    hsnCode: formData.hsnCode || null,
                    minimumStock: formData.minimumStock ? Number(formData.minimumStock) : null,
                    leadTimeDays: formData.leadTimeDays ? Number(formData.leadTimeDays) : null,
                    storeId: formData.storeId || null,

                    baseUom: formData.baseUom,
                    reorderLevel: formData.reorderLevel ? Number(formData.reorderLevel) : null,
                    unitPrice: formData.unitPrice ? Number(formData.unitPrice) : null,
                }
            })).unwrap();
            toast.success("Raw material updated successfully!");
            navigate("/raw-materials");
        } catch (err: any) {
            toast.error(err || "Failed to update raw material");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Edit Raw Material</h2>
                                <div className="page-breadcrumb">Home / Inventory & Warehouse / Raw Materials / Edit</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/raw-materials")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner" noValidate>
                    {/* Basic Information */}
                    <Row className="mb-4">
                        <h2 className="form-title">Basic Information</h2>

                        <Col lg={4} md={6}>
                            <TextInput
                                label="Raw Material ID"
                                name="rawMaterialId"
                                value={formData.rawMaterialId}
                                placeholder="e.g. RM001"
                                required
                                disabled={true}
                                error={errors.rawMaterialId}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <TextInput
                                label="Material Name"
                                name="materialName"
                                value={formData.materialName}
                                placeholder="e.g. Cotton Yarn 40s"
                                required
                                error={errors.materialName}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <SelectInput
                                label="Store"
                                name="storeId"
                                value={formData.storeId}
                                options={[
                                    { label: "Select a store", value: "" },
                                    ...(stores || []).map((store: any) => ({
                                        label: store.storeName,
                                        value: store.storeId
                                    }))
                                ]}
                                required
                                error={errors.storeId}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <SelectInput
                                label="Raw Material Category"
                                name="categoryId"
                                value={formData.categoryId}
                                options={[
                                    { label: "Select category", value: "" },
                                    ...(rawMaterialCategories || []).map((cat: any) => ({
                                        label: cat.name,
                                        value: String(cat.id)
                                    }))
                                ]}
                                error={errors.categoryId}
                                onChange={handleChange}
                                required
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <UOMSelect
                                name="baseUom"
                                label="Base UOM"
                                value={formData.baseUom}
                                required
                                isMulti
                                category={["length", "mass", "each"]}
                                allowedCodes={[
                                    "kg", "g", "t", "ton",
                                    "l", "ml", "ltr",
                                    "m", "cm", "mtr",
                                    "ea", "dz"
                                ]}
                                onChange={(value) => {
                                    setFormData(prev => ({ ...prev, baseUom: value }));
                                    if (errors.baseUom) {
                                        setErrors(prev => ({ ...prev, baseUom: "" }));
                                    }
                                }}
                                error={errors.baseUom}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <TextInput
                                label="HSN Code"
                                name="hsnCode"
                                value={formData.hsnCode}
                                placeholder="e.g. 3901"
                                error={errors.hsnCode}
                                onChange={handleChange}
                                required
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <SelectInput
                                label="Status"
                                name="status"
                                value={formData.status}
                                options={[
                                    { label: "Active", value: "Active" },
                                    { label: "Inactive", value: "Inactive" }
                                ]}
                                required
                                error={errors.status}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>

                    {/* Stock Information */}
                    <Row className="mb-4">
                        <h2 className="form-title">Stock Information</h2>

                        <Col lg={4} md={6}>
                            <QuantityInput
                                label="Opening Stock"
                                name="onHandQty"
                                value={formData.onHandQty}
                                baseUoms={formData.baseUom}
                                required
                                error={errors.onHandQty}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <QuantityInput
                                label="Reserved Quantity"
                                name="reservedQty"
                                value={formData.reservedQty}
                                baseUoms={formData.baseUom}
                                required
                                error={errors.reservedQty}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <QuantityInput
                                label="Minimum Stock"
                                name="minimumStock"
                                value={formData.minimumStock}
                                baseUoms={formData.baseUom}
                                error={errors.minimumStock}
                                onChange={handleChange}
                                required
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <QuantityInput
                                label="Reorder Level"
                                name="reorderLevel"
                                value={formData.reorderLevel}
                                baseUoms={formData.baseUom}
                                error={errors.reorderLevel}
                                onChange={handleChange}
                                required
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <TextInput
                                type="number"
                                label="Lead Time (Days)"
                                name="leadTimeDays"
                                value={formData.leadTimeDays}
                                placeholder="e.g. 5"
                                error={errors.leadTimeDays}
                                onChange={handleChange}
                                required
                            />
                        </Col>
                    </Row>

                    {/* Pricing & Value */}
                    <Row className="mb-4">
                        <h2 className="form-title">Pricing & Value</h2>

                        <Col lg={4} md={6}>
                            <TextInput
                                type="number"
                                label="Unit Price"
                                name="unitPrice"
                                value={formData.unitPrice}
                                placeholder="e.g. 50.00"
                                required
                                error={errors.unitPrice}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>

                    <Row className="mt-4">
                        <Col lg={12}>
                            <div className="form-actions d-flex justify-content-end gap-3">
                                <CustomButton text="Cancel" icon={FaEraser} onClick={() => navigate("/raw-materials")} disabled={isSubmitting} />
                                <CustomButton text={isSubmitting ? "Updating..." : "Update Material"} icon={FaSave} type="submit" disabled={isSubmitting} />
                            </div>
                        </Col>
                    </Row>
                </form>
            </Container>
        </div>
    );
};

export default RawMaterialEdit;
