import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createRawMaterial } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";

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
    // materialCode: "",
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
    gstTaxRateId:"",
    avgCost: "",
    remarks: "",
    lastMovementAt: "",
    status: "Active",
};

import { z } from "zod";

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
            .min(1, "Lead Time Days is required")
            .refine(
                value =>
                    Number.isInteger(Number(value)) &&
                    Number(value) >= 0,
                {
                    message:
                        "Lead Time Days must be a positive whole number",
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
            .max(40, "Batch Number cannot exceed 40 characters")
            .optional(),

        onHandQty: z
            .string()
            .trim()
            .min(1, "Opening Stock is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
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
                    message:
                        "Reserved Quantity must be greater than or equal to 0",
                }
            ),

        avgCost: z
            .string()
            .trim()
            .min(1, "Average Cost is required")
            .refine(
                value => !isNaN(Number(value)) && Number(value) >= 0,
                {
                    message: "Average Cost must be greater than or equal to 0",
                }
            ),

        remarks: z
            .string()
            .trim()
            .max(500, "Remarks cannot exceed 500 characters")
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

        status: z.enum(["Active", "Inactive"], {
            error: "Status is required",
        }),

        gstTaxRateId: z
            .string()
            .trim()
            .min(1, "GST Tax Type is required"),
    })
    .refine(
        data =>
            Number(data.reorderLevel) >= Number(data.minimumStock),
        {
            path: ["reorderLevel"],
            message:
                "Reorder Level must be greater than or equal to Minimum Stock",
        }
    );

const RawMaterialCreate: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: stores } = useAppSelector(state => state.stores);
    const { rawMaterialCategories, loadCategories } = useRawMaterialCategories();

    const gstTaxes = useAppSelector(selectActiveGstTaxes);
    const gstLoading = useAppSelector((state) => state.gst.loading);

    const gstOptions = useMemo(() => [
        { value: "", label: gstLoading ? "Loading GST rates..." : "-- Select GST Rate --" },
        ...(gstTaxes || []).map((t: any) => ({
            value: String(t.id),
            label: `${t.taxName} (${t.taxRate}%)`,
        })),
    ], [gstTaxes, gstLoading]);

    useEffect(() => {
        dispatch(fetchStores(undefined));
        loadCategories();
        dispatch(fetchGstTaxes({ status: "ACTIVE" }));
        const getNextId = async () => {
            try {
                const nextId = await rawMaterialService.fetchNextId();
                setFormData(prev => ({ ...prev, rawMaterialId: nextId }));
            } catch (err) {
                console.error("Failed to fetch next raw material ID", err);
            }
        };
        getNextId();
    }, [dispatch, loadCategories]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target as any;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));


        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
    };

    const handleClear = () => {
        setFormData(prev => ({ ...initialFormState, rawMaterialId: prev.rawMaterialId }));
        setErrors({});
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
            await dispatch(
                createRawMaterial({
                    ...formData,

                    categoryId: formData.categoryId
                        ? Number(formData.categoryId)
                        : null,

                    minimumStock: formData.minimumStock
                        ? Number(formData.minimumStock)
                        : null,

                    reorderLevel: formData.reorderLevel
                        ? Number(formData.reorderLevel)
                        : null,

                    leadTimeDays: formData.leadTimeDays
                        ? Number(formData.leadTimeDays)
                        : null,

                    unitPrice: formData.unitPrice
                        ? Number(formData.unitPrice)
                        : null,

                    onHandQty: formData.onHandQty
                        ? Number(formData.onHandQty)
                        : 0,

                    reservedQty: formData.reservedQty
                        ? Number(formData.reservedQty)
                        : 0,

                    avgCost: formData.avgCost
                        ? Number(formData.avgCost)
                        : 0,

                    batchNo: formData.batchNo || null,
                    remarks: formData.remarks || null,
                    lastMovementAt: formData.lastMovementAt
                        ? new Date(formData.lastMovementAt).toISOString()
                        : null,
                })
            ).unwrap();
            toast.success("Raw material created successfully!");
            navigate("/raw-materials");
        } catch (err: any) {
            toast.error(err || "Failed to create raw material");
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
                                <h2 className="page-title">Create Raw Material</h2>
                                
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
                                disabled
                                required
                                error={errors.rawMaterialId}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <TextInput
                                label="Material Name"
                                name="materialName"
                                value={formData.materialName}
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
                                    { label: "Select Store", value: "" },
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
                                    { label: "Select Category", value: "" },
                                    ...(rawMaterialCategories || []).map((cat: any) => ({
                                        label: cat.name,
                                        value: String(cat.id)
                                    }))
                                ]}
                                required
                                error={errors.categoryId}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <UOMSelect
                                name="baseUom"
                                label="Base UOM"
                                value={formData.baseUom}
                                required
                                isMulti
                                category={["length", "mass", "each","volume"]}
                                allowedCodes={[
                                    "kg", "g", "t", "ton",
                                    "l", "ml", "ltr",
                                    "m", "cm", "mtr",
                                    "dz", "ea"
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
                                required
                                error={errors.hsnCode}
                                onChange={handleChange}
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
                                label="Minimum Stock"
                                name="minimumStock"
                                value={formData.minimumStock}
                                baseUoms={formData.baseUom}
                                required
                                error={errors.minimumStock}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <QuantityInput
                                label="Reorder Level"
                                name="reorderLevel"
                                value={formData.reorderLevel}
                                baseUoms={formData.baseUom}
                                required
                                error={errors.reorderLevel}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <TextInput
                                type="number"
                                label="Delivery Days"
                                name="leadTimeDays"
                                value={formData.leadTimeDays}
                                required
                                error={errors.leadTimeDays}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>

                    {/* Pricing & Value */}
                    <Row className="mb-4">
                        <h2 className="form-title">Pricing & Value</h2>

                        <Col lg={4} md={6}>
                            <TextInput
                                type="number"
                                label="Average Cost"
                                name="avgCost"
                                value={formData.avgCost}
                                required
                                error={errors.avgCost}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <TextInput
                                type="number"
                                label="Unit Price"
                                name="unitPrice"
                                value={formData.unitPrice}
                                required
                                error={errors.unitPrice}
                                onChange={handleChange}
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
                    </Row>

                    {/* Other Details */}
                    <Row className="mb-4">
                        <h2 className="form-title">Other Details</h2>

                        <Col lg={4} md={6}>
                            <TextInput
                                label="Remarks"
                                name="remarks"
                                value={formData.remarks}
                                required
                                error={errors.remarks}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>

                    <Row className="mt-4">
                        <Col lg={12}>
                            <div className="form-actions d-flex justify-content-end gap-3">
                                <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} disabled={isSubmitting} />
                                <CustomButton text={isSubmitting ? "Saving..." : "Save Material"} icon={FaSave} type="submit" disabled={isSubmitting} />
                            </div>
                        </Col>
                    </Row>
                </form>
            </Container>
        </div>
    );
};

export default RawMaterialCreate;
