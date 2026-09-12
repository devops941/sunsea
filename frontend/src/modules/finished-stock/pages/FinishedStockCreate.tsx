import React, { useState } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { formatAmountOnBlur } from "../../../utils/pricingUtils";

const CATEGORY_OPTIONS = [
    { label: "T-Shirt", value: "T-Shirt" },
    { label: "Shirt", value: "Shirt" },
    { label: "Trouser", value: "Trouser" },
    { label: "Jacket", value: "Jacket" },
    { label: "Shorts", value: "Shorts" },
    { label: "Accessories", value: "Accessories" },
];

const SIZE_OPTIONS = [
    { label: "XS", value: "XS" },
    { label: "S", value: "S" },
    { label: "M", value: "M" },
    { label: "L", value: "L" },
    { label: "XL", value: "XL" },
    { label: "XXL", value: "XXL" },
    { label: "Free Size", value: "Free Size" },
];

const initialFormState = {
    productCode: "",
    productName: "",
    category: "",
    size: "",
    color: "",
    quantity: "",
    batchNo: "",
    storeName: "",
    manufactureDate: "",
    unitPrice: "",
};

const FinishedStockCreate: React.FC = () => {
    const [formData, setFormData] = useState(initialFormState);

    useFormShortcuts({ autoFocusField: "productCode" });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleClear = () => {
        setFormData(initialFormState);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormData(initialFormState);
        toast.success("Saved");
        setTimeout(() => {
            document.querySelector<HTMLInputElement>('input[name="productCode"]')?.focus();
        }, 0);
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Create Finished Stock</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <BackButton text="Back to List" to="/finished-stock" />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner">
                    <Row className="g-3">
                        <Col md={6}>
                            <TextInput
                                label="Product Code"
                                name="productCode"
                                value={formData.productCode}
                                placeholder="e.g. FP-001"
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Product Name"
                                name="productName"
                                value={formData.productName}
                                placeholder="e.g. Men's Polo T-Shirt"
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <SelectInput
                                label="Category"
                                name="category"
                                value={formData.category}
                                options={CATEGORY_OPTIONS}
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <SelectInput
                                label="Size"
                                name="size"
                                value={formData.size}
                                options={SIZE_OPTIONS}
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Color"
                                name="color"
                                value={formData.color}
                                placeholder="e.g. Navy Blue"
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Quantity"
                                name="quantity"
                                value={formData.quantity}
                                type="number"
                                placeholder="e.g. 250"
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Batch No"
                                name="batchNo"
                                value={formData.batchNo}
                                placeholder="e.g. BATCH-2024-001"
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Store Location"
                                name="storeName"
                                value={formData.storeName}
                                placeholder="e.g. Finished Goods Store"
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Manufacture Date"
                                name="manufactureDate"
                                value={formData.manufactureDate}
                                type="date"
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Unit Price (₹)"
                                name="unitPrice"
                                value={formData.unitPrice}
                                type="number"
                                step="0.01"
                                placeholder="e.g. 599.00"
                                onChange={handleChange}
                                onBlur={formatAmountOnBlur((v) => handleChange({ target: { name: "unitPrice", value: v } } as any))}
                            />
                        </Col>
                    </Row>

                    <div className="form-actions d-flex justify-content-end gap-3 mt-4">
                        <CustomButton
                            text="Clear"
                            icon={FaEraser}
                            variant="secondary"
                            onClick={handleClear}
                        />
                        <div className="ms-2">
                            <CustomButton
                                text="Save Stock"
                                icon={FaSave}
                                type="submit"
                            />
                        </div>
                    </div>
                </form>
            </Container>
        </div>
    );
};

export default FinishedStockCreate;
