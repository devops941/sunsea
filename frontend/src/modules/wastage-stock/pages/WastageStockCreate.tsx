import React, { useState } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { formatAmountOnBlur } from "../../../utils/pricingUtils";

const CATEGORY_OPTIONS = [
    { label: "Fabric Scraps", value: "Fabric Scraps" },
    { label: "Yarn Waste", value: "Yarn Waste" },
    { label: "Rejected Garments", value: "Rejected Garments" },
    { label: "Chemical Waste", value: "Chemical Waste" },
    { label: "Packaging Scrap", value: "Packaging Scrap" },
];

const DEPT_OPTIONS = [
    { label: "Cutting Department", value: "Cutting Department" },
    { label: "Stitching Department", value: "Stitching Department" },
    { label: "Dye House", value: "Dye House" },
    { label: "Knitting Department", value: "Knitting Department" },
    { label: "Finishing & Packing", value: "Finishing & Packing" },
];

const STATUS_OPTIONS = [
    { label: "Stored", value: "Stored" },
    { label: "Disposed", value: "Disposed" },
    { label: "Recycled", value: "Recycled" },
    { label: "Sold", value: "Sold" },
];

const initialFormState = {
    wastageCode: "",
    logDate: "",
    category: "",
    quantity: "",
    uom: "",
    department: "",
    cause: "",
    scrapUnitPrice: "",
    status: "Stored",
};

const WastageStockCreate: React.FC = () => {
    const [formData, setFormData] = useState(initialFormState);

    useFormShortcuts({ autoFocusField: "wastageCode" });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleClear = () => {
        setFormData(initialFormState);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        toast.success("Wastage Stock record created successfully!");
        setFormData(initialFormState);
        // Return caret to first field so the next entry can start immediately
        setTimeout(() => {
            const el = document.querySelector<HTMLElement>('[data-nav], input[name="wastageCode"]');
            el?.focus();
        }, 0);
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Log Wastage Stock Entry</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <BackButton text="Back to List" to="/wastage-stock" />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner">
                    <Row className="g-3">
                        <Col md={6}>
                            <TextInput
                                label="Wastage Code / Log No"
                                name="wastageCode"
                                value={formData.wastageCode}
                                placeholder="e.g. WST-2024-001"
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Log Date"
                                name="logDate"
                                value={formData.logDate}
                                type="date"
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <SelectInput
                                label="Material Type"
                                name="category"
                                value={formData.category}
                                options={CATEGORY_OPTIONS}
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <UOMSelect
                                label="UOM"
                                name="uom"
                                value={formData.uom}
                                required
                                onChange={(val) => handleChange({ target: { name: "uom", value: val } } as any)}
                                category={["length", "mass", "each"]}
                                allowedCodes={[
                                    "kg", "g", "mt",
                                    "l", "ml",
                                    "m", "cm", "mm",
                                    "ea", "dz"
                                ]}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Wastage Quantity"
                                name="quantity"
                                value={formData.quantity}
                                type="number"
                                step="0.01"
                                placeholder="e.g. 25.5"
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <SelectInput
                                label="Source Department"
                                name="department"
                                value={formData.department}
                                options={DEPT_OPTIONS}
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Cause of Wastage"
                                name="cause"
                                value={formData.cause}
                                placeholder="e.g. End-bit fabric scrap"
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Scrap Price per Unit (₹)"
                                name="scrapUnitPrice"
                                value={formData.scrapUnitPrice}
                                type="number"
                                step="0.01"
                                placeholder="e.g. 15.00"
                                onChange={handleChange}
                                onBlur={formatAmountOnBlur((v) => handleChange({ target: { name: "scrapUnitPrice", value: v } } as any))}
                            />
                        </Col>
                        <Col md={12}>
                            <SelectInput
                                label="Wastage Disposal Status"
                                name="status"
                                value={formData.status}
                                options={STATUS_OPTIONS}
                                required
                                onChange={handleChange}
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
                                text="Save Wastage Log"
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

export default WastageStockCreate;
