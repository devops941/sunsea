import React, { useState, useEffect } from "react";
import { Container, Row, Col, Table, Card } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import { productionOrderService } from "../../../services/productionOrderService";
import { productService } from "../../../services/productService";
import { billOfMaterialService } from "../../../services/billOfMaterialService";
import { storeService } from "../../../services/storeService";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DateInput from "../../../components/form/DateInput/DateInput";
import TextArea from "../../../components/form/TextArea/TextArea";
import CustomButton from "../../../components/ui/custombutton/CustomButton";

const STATUS_OPTIONS = [
    { label: "PLANNED", value: "PLANNED" },
    { label: "IN PROGRESS", value: "IN_PROGRESS" },
    { label: "COMPLETED", value: "COMPLETED" },
    { label: "CANCELLED", value: "CANCELLED" },
];

const PRIORITY_OPTIONS = [
    { label: "LOW", value: "LOW" },
    { label: "NORMAL", value: "NORMAL" },
    { label: "MEDIUM", value: "MEDIUM" },
    { label: "HIGH", value: "HIGH" },
    { label: "URGENT", value: "URGENT" },
];

const ORDER_TYPE_OPTIONS = [
    { label: "STANDARD", value: "STANDARD" },
    { label: "REWORK", value: "REWORK" },
    { label: "CUSTOM", value: "CUSTOM" },
];

const productionOrderSchema = z.object({
    productionOrderId: z.string().min(1, "Order No is required"),
    orderDate: z.string().min(1, "Order Date is required"),
    dueDate: z.string().min(1, "Due Date is required"),
    productItemId: z.string().min(1, "Product is required"),
    targetQty: z.number().min(0.01, "Target Quantity must be greater than 0"),
    uom: z.string().min(1, "UOM is required"),
});

const ProductionOrderCreate: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [products, setProducts] = useState<any[]>([]);
    const [boms, setBoms] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    
    const [calculatedBom, setCalculatedBom] = useState<any | null>(null);

    const [formData, setFormData] = useState({
        productionOrderId: "",
        orderDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split("T")[0],
        productItemId: "",
        targetQty: 0,
        uom: "PCS",
        priority: "MEDIUM",
        orderType: "STANDARD",
        batchNo: "",
        lotNo: "",
        sourceSalesOrderId: "",
        sourceSalesOrderLineId: "",
        sourceStoreId: "",
        destinationStoreId: "",
        billOfMaterialId: "",
        routingId: "",
        status: "PLANNED",
        remarks: ""
    });

    useEffect(() => {
        const loadDependencies = async () => {
            const extractArray = (d: any) => {
                if (Array.isArray(d)) return d;
                if (d?.data && Array.isArray(d.data)) return d.data;
                if (d?.data?.data && Array.isArray(d.data.data)) return d.data.data;
                return [];
            };

            productService.fetchAll()
                .then(data => setProducts(extractArray(data)))
                .catch(err => console.error("Products error", err));

            billOfMaterialService.fetchAll()
                .then(data => setBoms(extractArray(data)))
                .catch(err => console.error("BOM error", err));

            storeService.fetchAll()
                .then(data => setStores(extractArray(data)))
                .catch(err => console.error("Store error", err));

            productionOrderService.fetchNextId()
                .then(nextId => {
                    if (nextId) setFormData(prev => ({ ...prev, productionOrderId: nextId }));
                })
                .catch(() => null);
        };
        loadDependencies();
    }, []);

    useEffect(() => {
        if (formData.productItemId) {
            let productBom: any = null;
            
            if (formData.billOfMaterialId) {
                productBom = boms.find(b => b.id?.toString() === formData.billOfMaterialId);
            } else {
                productBom = boms.find(b => b.productId?.toString() === formData.productItemId || b.productItem?.id?.toString() === formData.productItemId);
                if (productBom) {
                    setFormData(prev => ({ ...prev, billOfMaterialId: productBom.id.toString() }));
                }
            }

            if (productBom) {
                const items = productBom.items?.map((item: any) => ({
                    ...item,
                    calculatedQty: (Number(item.requiredQuantity) * (formData.targetQty || 0)).toFixed(3)
                })) || [];
                setCalculatedBom({ ...productBom, items });
            } else {
                setCalculatedBom(null);
            }
        } else {
            setCalculatedBom(null);
        }
    }, [formData.productItemId, formData.targetQty, formData.billOfMaterialId, boms]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        let parsedValue: string | number = value;
        if (name === "targetQty") {
            parsedValue = value === "" ? "" : Number(value);
        }

        setFormData((prev) => ({ ...prev, [name]: parsedValue }));
        
        if (name === "productItemId") {
            const product = products.find(p => p.id?.toString() === value || p.productId?.toString() === value);
            if (product) {
                 setFormData(prev => ({ ...prev, uom: product.uom?.name || product.uom || "PCS", [name]: value, billOfMaterialId: "" }));
            }
        }

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            productionOrderSchema.parse(formData);
            setErrors({});
        } catch (err) {
            if (err instanceof z.ZodError) {
                const formattedErrors: Record<string, string> = {};
                err.issues.forEach(issue => {
                    if (issue.path[0]) {
                        formattedErrors[issue.path[0].toString()] = issue.message;
                    }
                });
                setErrors(formattedErrors);
                toast.error("Please fix the validation errors");
                return;
            }
        }

        setLoading(true);
        try {
            const payload = {
                ...formData,
                targetQty: Number(formData.targetQty),
                sourceSalesOrderId: formData.sourceSalesOrderId || undefined,
                sourceSalesOrderLineId: formData.sourceSalesOrderLineId || undefined,
                sourceStoreId: formData.sourceStoreId || undefined,
                destinationStoreId: formData.destinationStoreId || undefined,
                billOfMaterialId: formData.billOfMaterialId || undefined,
                routingId: formData.routingId || undefined,
            };

            await productionOrderService.create(payload);
            toast.success("Production Order created successfully");
            navigate("/production-orders");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || "Failed to create order");
        } finally {
            setLoading(false);
        }
    };

    const availableBoms = boms.filter(b => b.productId?.toString() === formData.productItemId || b.productItem?.id?.toString() === formData.productItemId);

    return (
        <Container fluid>
            <div className="d-flex align-items-center justify-content-between mb-4 mt-3">
                <h2>Create Production Order</h2>
            </div>
            
            <form onSubmit={handleSubmit}>
                <Row>
                    <Col lg={8}>
                        <Card className="shadow-sm mb-4">
                            <Card.Header className="bg-white">
                                <h5 className="mb-0">Order Details</h5>
                            </Card.Header>
                            <Card.Body>
                                <Row>
                                    <Col md={6}>
                                        <TextInput
                                            label="Order No"
                                            name="productionOrderId"
                                            value={formData.productionOrderId}
                                            onChange={handleChange}
                                            error={errors.productionOrderId}
                                            required
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <SelectInput
                                            label="Status"
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange as any}
                                            options={STATUS_OPTIONS}
                                        />
                                    </Col>

                                    <Col md={6}>
                                        <DateInput
                                            label="Order Date"
                                            name="orderDate"
                                            value={formData.orderDate}
                                            onChange={handleChange}
                                            required
                                        />
                                        {errors.orderDate && <span className="text-danger small">{errors.orderDate}</span>}
                                    </Col>
                                    <Col md={6}>
                                        <DateInput
                                            label="Due Date"
                                            name="dueDate"
                                            value={formData.dueDate}
                                            onChange={handleChange}
                                            required
                                        />
                                        {errors.dueDate && <span className="text-danger small">{errors.dueDate}</span>}
                                    </Col>

                                    <Col md={6}>
                                        <SelectInput
                                            label="Order Type"
                                            name="orderType"
                                            value={formData.orderType}
                                            onChange={handleChange as any}
                                            options={ORDER_TYPE_OPTIONS}
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <SelectInput
                                            label="Priority"
                                            name="priority"
                                            value={formData.priority}
                                            onChange={handleChange as any}
                                            options={PRIORITY_OPTIONS}
                                        />
                                    </Col>

                                    <Col md={12}>
                                        <hr />
                                        <h6>Product Information</h6>
                                    </Col>

                                    <Col md={12}>
                                        <SelectInput
                                            label="Product"
                                            name="productItemId"
                                            value={formData.productItemId}
                                            onChange={handleChange as any}
                                            options={products.map(p => ({ label: p.productName || p.productCode || p.id, value: p.id?.toString() }))}
                                            defaultOptionLabel="Select Product..."
                                            error={errors.productItemId}
                                            required
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <TextInput
                                            label="Target Quantity"
                                            name="targetQty"
                                            value={formData.targetQty.toString()}
                                            onChange={handleChange}
                                            error={errors.targetQty}
                                            required
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <TextInput
                                            label="UOM"
                                            name="uom"
                                            value={formData.uom}
                                            onChange={handleChange}
                                            error={errors.uom}
                                            disabled
                                            required
                                        />
                                    </Col>

                                    <Col md={12}>
                                        <SelectInput
                                            label="Bill of Material"
                                            name="billOfMaterialId"
                                            value={formData.billOfMaterialId}
                                            onChange={handleChange as any}
                                            options={availableBoms.map(b => ({ label: b.bomNo || b.id, value: b.id?.toString() }))}
                                            defaultOptionLabel={formData.productItemId ? "Select BOM (Optional)..." : "Select Product First"}
                                            disabled={!formData.productItemId}
                                        />
                                    </Col>

                                    <Col md={6}>
                                        <TextInput
                                            label="Batch No"
                                            name="batchNo"
                                            value={formData.batchNo}
                                            onChange={handleChange}
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <TextInput
                                            label="Lot No"
                                            name="lotNo"
                                            value={formData.lotNo}
                                            onChange={handleChange}
                                        />
                                    </Col>

                                    <Col md={12}>
                                        <hr />
                                        <h6>Reference Information</h6>
                                    </Col>

                                    <Col md={6}>
                                        <TextInput
                                            label="Source Sales Order"
                                            name="sourceSalesOrderId"
                                            value={formData.sourceSalesOrderId}
                                            onChange={handleChange}
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <TextInput
                                            label="Sales Order Line ID"
                                            name="sourceSalesOrderLineId"
                                            value={formData.sourceSalesOrderLineId}
                                            onChange={handleChange}
                                        />
                                    </Col>

                                    <Col md={6}>
                                        <SelectInput
                                            label="Source Store"
                                            name="sourceStoreId"
                                            value={formData.sourceStoreId}
                                            onChange={handleChange as any}
                                            options={stores.map(s => ({ label: s.storeName || s.storeId, value: s.id?.toString() || s.storeId }))}
                                            defaultOptionLabel="Select Store..."
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <SelectInput
                                            label="Destination Store"
                                            name="destinationStoreId"
                                            value={formData.destinationStoreId}
                                            onChange={handleChange as any}
                                            options={stores.map(s => ({ label: s.storeName || s.storeId, value: s.id?.toString() || s.storeId }))}
                                            defaultOptionLabel="Select Store..."
                                        />
                                    </Col>

                                    <Col md={12}>
                                        <TextArea
                                            label="Remarks"
                                            name="remarks"
                                            value={formData.remarks}
                                            onChange={handleChange}
                                        />
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                    
                    <Col lg={4}>
                        <Card className="shadow-sm mb-4">
                            <Card.Header className="bg-light">
                                <h5 className="mb-0">BOM Requirements</h5>
                            </Card.Header>
                            <Card.Body>
                                {!formData.productItemId ? (
                                    <p className="text-muted text-center py-4">Select a product to see required materials.</p>
                                ) : !calculatedBom ? (
                                    <p className="text-warning text-center py-4">No Bill of Material found for this product.</p>
                                ) : (
                                    <Table size="sm" responsive hover>
                                        <thead>
                                            <tr>
                                                <th>Material</th>
                                                <th className="text-end">Required Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {calculatedBom.items?.map((item: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td>{item.rawMaterial?.materialName || item.rawMaterial?.materialCode || `Item ${item.rawMaterialId}`}</td>
                                                    <td className="text-end fw-bold text-primary">
                                                        {item.calculatedQty} {item.uom}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <div className="d-flex justify-content-end mb-5">
                    <CustomButton variant="secondary" onClick={() => navigate("/production-orders")} className="me-2" text="Cancel" />
                    <CustomButton variant="primary" type="submit" disabled={loading} text={loading ? "Saving..." : "Create Order"} />
                </div>
            </form>
        </Container>
    );
};

export default ProductionOrderCreate;