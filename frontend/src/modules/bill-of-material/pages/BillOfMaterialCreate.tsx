import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft, FaPlus } from "react-icons/fa";
import { z } from "zod";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import Button from "../../../components/ui/Button/Button";
import CustomButton from "../../../components/ui/Button/Button";
import { useNavigate } from "react-router-dom";
import { productService } from "../../../services/productService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { uomService } from "../../../services/uomService";
import { billOfMaterialService } from "../../../services/billOfMaterialService";
import { toast } from "react-toastify";

const BillOfMaterialCreate: React.FC = () => {

    const billOfMaterialItemSchema = z.object({
        rawMaterialId: z.string().trim().min(1, "Raw Material is required"),
        requiredQuantity: z.union([z.string(), z.number()])
            .transform(val => Number(val))
            .refine(val => !isNaN(val) && val > 0, { message: "Required Quantity must be a valid number greater than 0" }),
        uom: z.string().trim().min(1, "UOM is required"),
    });

    const billOfMaterialSchema = z.object({
        productId: z.string().trim().min(1, "Product is required"),
        remarks: z.string().trim().max(500, "Remarks cannot exceed 500 characters").optional().or(z.literal("")),
        items: z.array(billOfMaterialItemSchema).min(1, "At least one Raw Material is required"),
    }).superRefine((data, ctx) => {
        const ids = data.items.map(item => item.rawMaterialId);
        ids.forEach((id, index) => {
            if (ids.indexOf(id) !== index) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["items", index, "rawMaterialId"],
                    message: "Duplicate Raw Material is not allowed",
                });
            }
        });
    });

    const [formData, setFormData] = useState({
        id: "",
        productId: "",
        remarks: "",
        items: [
            {
                rawMaterialId: "",
                requiredQuantity: "",
                uom: "",
            },
        ],
    });

    const [products, setProducts] = useState<any[]>([]);
    const [rawMaterials, setRawMaterials] = useState<any[]>([]);
    const [uoms, setUoms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<any>({});

    useEffect(() => {
        const loadData = async () => {
            try {
                const fetchedProducts = await productService.fetchAll();
                setProducts(fetchedProducts);

                const fetchedRawMaterials = await rawMaterialService.fetchAll();
                setRawMaterials(fetchedRawMaterials);

                const fetchedUoms = await uomService.fetchAll();
                setUoms(fetchedUoms);
            } catch (error) {
                console.error("Failed to load products, raw materials, or UOMs", error);
                toast.error("Failed to load initial data.");
            }
        };
        loadData();
    }, []);

    const addRow = () => {
        setFormData((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                { rawMaterialId: "", requiredQuantity: "", uom: "" },
            ],
        }));
    };

    const removeRow = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
        // Clear error when typing
        if (errors[name]) {
            setErrors({ ...errors, [name]: undefined });
        }
    };

    const handleRowChange = (index: number, field: string, value: string) => {
        const updatedItems = [...formData.items];
        updatedItems[index] = {
            ...updatedItems[index],
            [field]: value,
        };
        setFormData({
            ...formData,
            items: updatedItems,
        });
        
        const errorKey = `items.${index}.${field}`;
        if (errors[errorKey]) {
            setErrors({ ...errors, [errorKey]: undefined });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // Validate form data
            billOfMaterialSchema.parse(formData);

            setIsLoading(true);
            const payload = {
                productId: Number(formData.productId),
                remarks: formData.remarks,
                items: formData.items.map(item => ({
                    rawMaterialId: item.rawMaterialId,
                    requiredQuantity: Number(item.requiredQuantity),
                    uom: item.uom,
                }))
            };

            await billOfMaterialService.create(payload);
            toast.success("Bill of Material created successfully!");
            navigate("/bill-of-materials");
        } catch (error: any) {
            console.error("Failed to update BOM:", error);

            if (error instanceof z.ZodError) {
                const issues = error.issues;
                const fieldErrors: any = {};
                issues.forEach(issue => {
                    const path = issue.path.join(".");
                    fieldErrors[path] = issue.message;
                });
                setErrors(fieldErrors);
                toast.error("Please fix the validation errors below.");
            } else if (error.response?.data?.message) {
                toast.error("Server Error: " + error.response.data.message);
            } else {
                toast.error("Failed to update Bill of Material.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setFormData({
            id: "",
            productId: "",
            remarks: "",
            items: [{ rawMaterialId: "", requiredQuantity: "", uom: "" }],
        });
        setErrors({});
    };

    const navigate = useNavigate();

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                
                                <h2 className="page-title">
                                    Add New Bill Of Material
                                </h2>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions justify-content-end">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/bill-of-materials")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <div className="form-inner">
                    <form onSubmit={handleSubmit}>
                        <Row className="mb-4">
                            <Col lg={4} md={6}>
                                <TextInput
                                    label="BOM ID"
                                    name="id"
                                    value={formData.id}
                                    placeholder="Auto Generated"
                                    disabled
                                    onChange={() => { }}
                                />
                            </Col>
                            <Col lg={8} md={6}>
                                <SelectInput
                                    label="PRODUCT"
                                    name="productId"
                                    value={formData.productId}
                                    required
                                    error={errors.productId}
                                    options={[
                                        { value: "", label: "Select Product" },
                                        ...products.map(p => ({
                                            value: p.id.toString(),
                                            label: `${p.productName} (${p.productCode})`
                                        }))
                                    ]}
                                    onChange={handleChange}
                                />
                            </Col>
                            <Col lg={12}>
                                <TextInput
                                    label="REMARKS"
                                    name="remarks"
                                    value={formData.remarks}
                                    error={errors.remarks}
                                    placeholder="Enter remarks (Optional)"
                                    onChange={handleChange}
                                />
                            </Col>
                        </Row>

                        <div className="form-section">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="form-title mb-0">
                                    Raw Material Details
                                </h5>
                                <CustomButton
                                    text="Add Row"
                                    icon={FaPlus}
                                    type="button"
                                    onClick={addRow}
                                />
                            </div>

                            {formData.items.map((item, index) => {
                                const selectedRawMaterialIds = formData.items.map(i => i.rawMaterialId).filter(Boolean);
                                return (
                                    <Row key={index} className="align-items-end mb-3">
                                        <Col lg={4} md={12}>
                                            <SelectInput
                                                label="RAW MATERIAL"
                                                name="rawMaterialId"
                                                value={item.rawMaterialId}
                                                error={errors[`items.${index}.rawMaterialId`]}
                                                required
                                                options={[
                                                    { value: "", label: "Select Raw Material" },
                                                    ...rawMaterials.map(rm => ({
                                                        value: rm.rawMaterialId,
                                                        label: `${rm.materialName} (${rm.rawMaterialId})`,
                                                        disabled: selectedRawMaterialIds.includes(rm.rawMaterialId) && item.rawMaterialId !== rm.rawMaterialId
                                                    }))
                                                ]}
                                                onChange={(e) => handleRowChange(index, "rawMaterialId", e.target.value)}
                                            />
                                        </Col>
                                        <Col lg={3} md={12}>
                                            <TextInput
                                                label="REQUIRED QUANTITY"
                                                name="requiredQuantity"
                                                type="number"
                                                value={item.requiredQuantity}
                                                error={errors[`items.${index}.requiredQuantity`]}
                                                placeholder="Enter Quantity"
                                                required
                                                onChange={(e) => handleRowChange(index, "requiredQuantity", e.target.value)}
                                            />
                                        </Col>
                                        <Col lg={3} md={12}>
                                            <SelectInput
                                                label="UOM"
                                                name="uom"
                                                value={item.uom}
                                                error={errors[`items.${index}.uom`]}
                                                required
                                                options={[
                                                    { value: "", label: "Select UOM" },
                                                    ...uoms.map(u => ({
                                                        value: u.code, // Assuming UOM code is used (e.g. KG, G) or u.id if it's an ID
                                                        label: u.name
                                                    }))
                                                ]}
                                                onChange={(e) => handleRowChange(index, "uom", e.target.value)}
                                            />
                                        </Col>
                                        <Col lg={2} md={12} className="justify-content-center align-items-center ">
                                            <DeleteButton onClick={() => removeRow(index)} />
                                        </Col>
                                    </Row>
                                );
                            })}
                        </div>
                        <Row className="mt-4">
                            <Col lg={12}>
                                <div className="form-actions d-flex justify-content-end">
                                    <CustomButton
                                        text="Clear"
                                        icon={FaEraser}
                                        type="button"
                                        onClick={handleClear}
                                        className="me-3"
                                    />
                                    <Button
                                        text={isLoading ? "Saving..." : "Save BOM"}
                                        icon={FaSave}
                                        type="submit"
                                        disabled={isLoading}
                                    />
                                </div>
                            </Col>
                        </Row>
                    </form>
                </div>
            </Container>
        </div>
    );
};

export default BillOfMaterialCreate;