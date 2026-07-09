import React, { useEffect, useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser } from "react-icons/fa";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import Button from "../../../components/ui/Button/Button";
import CustomButton from "../../../components/ui/custombutton/CustomButton";

const SubcategoryEdit: React.FC = () => {
    const [formData, setFormData] = useState({
        id: "",
        subCategoryCode: "",
        subCategoryName: "",
        description: "",
        categoryId: "",
        isActive: true,
    });

    useEffect(() => {
        const subCategoryData = {
            id: 1,
            subCategoryCode: "RM-HP",
            subCategoryName: "HP Virgin",
            description: "High quality virgin polymer material",
            categoryId: "1",
            isActive: true,
        };

        setFormData({
            id: String(subCategoryData.id),
            subCategoryCode: subCategoryData.subCategoryCode,
            subCategoryName: subCategoryData.subCategoryName,
            description: subCategoryData.description,
            categoryId: subCategoryData.categoryId,
            isActive: subCategoryData.isActive,
        });
    }, []);


    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]:
                name === "isActive"
                    ? value === "true"
                    : value,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        console.log("Updated Sub Category:", formData);

        // API Update Call
        // await axios.put(`/api/category/${formData.id}`, formData);
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

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <h2 className="page-title">Edit Sub Category</h2>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-inner">
                        <Row className="mb-4">
                            {/* <h2 className="form-title">Sub Category Details</h2> */}

                            <Col lg={4}>
                                <TextInput
                                    label="SUB CATEGORY ID"
                                    name="id"
                                    value={formData.id}
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={4}>
                                <TextInput
                                    label="SUB CATEGORY CODE"
                                    name="subCategoryCode"
                                    value={formData.subCategoryCode}
                                    placeholder="Enter sub category code"
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={4}>
                                <TextInput
                                    label="SUB CATEGORY NAME"
                                    name="subCategoryName"
                                    value={formData.subCategoryName}
                                    placeholder="Enter sub category name"
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={4}>
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
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={12}>
                                <TextInput
                                    label="DESCRIPTION"
                                    name="description"
                                    value={formData.description}
                                    placeholder="Enter description"
                                    onChange={handleChange}
                                />
                            </Col>

                            <Col lg={4}>
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
                                        text="Update Sub Category"
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

export default SubcategoryEdit;