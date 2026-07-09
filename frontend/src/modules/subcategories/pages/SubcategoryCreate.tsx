import React, { useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser } from "react-icons/fa";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import Button from "../../../components/ui/Button/Button";
import CustomButton from "../../../components/ui/custombutton/CustomButton";

const Subcategorycreate: React.FC = () => {
    const [formData, setFormData] = useState({
        id: "",
        subCategoryCode: "",
        subCategoryName: "",
        description: "",
        categoryId: "",
        isActive: true,
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "isActive" ? value === "true" : value,
        }));
    };

    const handleReset = () => {
        setFormData({
            id: "",
            subCategoryCode: "",
            subCategoryName: "",
            description: "",
            categoryId: "",
            isActive: true,
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Created Sub Category:", formData);
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <div className="page-breadcrumb"> Settings / Sub Category / Add </div>
                                <h2 className="page-title "> Add New Sub Category </h2>
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-inner">
                        <Row className="mb-4">
                            <Col lg={4} md={6}>
                                <TextInput
                                    label="SUB CATEGORY ID"
                                    name="id"
                                    value={formData.id}
                                    placeholder="Auto Generated"
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={4} md={6}>
                                <TextInput
                                    label="SUB CATEGORY CODE"
                                    name="subCategoryCode"
                                    value={formData.subCategoryCode}
                                    placeholder="e.g. RM-HP"
                                    required
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={4} md={6}>
                                <TextInput
                                    label="SUB CATEGORY NAME"
                                    name="subCategoryName"
                                    value={formData.subCategoryName}
                                    placeholder="e.g. HP Virgin"
                                    required
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={4} md={6}>
                                <SelectInput
                                    label="CATEGORY"
                                    name="categoryId"
                                    value={formData.categoryId}
                                    options={[
                                        { value: "1", label: "Raw Material" },
                                        { value: "2", label: "Semi Finished Goods" },
                                        { value: "3", label: "Finished Goods" },
                                        { value: "4", label: "Packaging Material" },
                                        { value: "5", label: "Spare Parts" },
                                        { value: "6", label: "Consumables" },
                                    ]}
                                    required
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={12}>
                                <TextInput
                                    label="DESCRIPTION"
                                    name="description"
                                    value={formData.description}
                                    placeholder="Enter subcategory description"
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={4} md={6}>
                                <SelectInput
                                    label="STATUS"
                                    name="isActive"
                                    value={String(formData.isActive)}
                                    options={[
                                        { value: "true", label: "Active" },
                                        { value: "false", label: "Inactive" },
                                    ]}
                                    onChange={handleChange}
                                />
                            </Col>
                        </Row>

                        {/* Submit btn */}
                        <Row className="mt-4">
                            <Col lg={12}>
                                <div className="form-actions d-flex justify-content-end">
                                    <CustomButton
                                        text="Clear"
                                        icon={FaEraser}
                                        type="button"
                                        variant="secondary"
                                        className="me-3"
                                        onClick={handleReset}
                                    />

                                    <Button
                                        text="Save Sub Category"
                                        icon={FaSave}
                                        type="submit"
                                    />
                                </div>
                            </Col>
                        </Row>
                    </div>
                </form>
            </Container>
        </div>
    );
};

export default Subcategorycreate;