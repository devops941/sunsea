import React, { useState } from "react";

import {
    Container,
    Row,
    Col,
} from "react-bootstrap";


import { FaSave, FaEraser } from "react-icons/fa";


import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import Button from "../../../components/ui/Button/Button";
import CustomButton from "../../../components/ui/custombutton/CustomButton";

const Categorycreate: React.FC = () => {


    const [formData, setFormData] = useState({
        id: "",
        categoryCode: "",
        categoryName: "",
        description: "",
        isActive: true,
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;

        if (name === "categoryName") {
            if (!/^[A-Za-z\s]*$/.test(value)) {
                return;
            }
        }
        setFormData({
            ...formData,
            [name]: value,
        });
    };
    return (


        <div className="inner-container">
            <Container fluid>

                <div className="page-header">

                    <Row className="align-items-center g-3">

                        {/* Left Section */}
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <div className="page-breadcrumb"> Settings / Categorie / Add </div>
                                <h2 className="page-title "> Add New Categorie </h2>


                            </div>
                        </Col>

                        {/* Right Section */}
                        {/* <Col lg={6} md={12}>
                <div className="page-header-actions">

                    <div className="page-search-wrap">

                    <FaSearch className="page-search-icon" />

                    <input
                        type="text"
                        className="page-search-input"
                        placeholder="Search customer..."
                    />

                    </div>

                    <CustomButton
                    text="Add Customer"
                    icon={FaPlus}
                    onClick={() => navigate("/customers/create")}
                    />

                </div>
                </Col> */}

                    </Row>

                </div>

                <div className="form-inner">



                    {/* basic detail */}
                    <Row className="mb-4">
                        {/* <h2 className="form-title">Category Details</h2> */}

                        <Col lg={4} md={6}>
                            <TextInput
                                label="CATEGORY ID"
                                name="id"
                                value={formData.id}
                                placeholder="Auto Generated"
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <TextInput
                                label="CATEGORY CODE"
                                name="categoryCode"
                                value={formData.categoryCode}
                                placeholder="e.g. RM"
                                required
                                onChange={handleChange}
                            />
                        </Col>



                        <Col lg={4} md={6}>
                            <TextInput
                                label="CATEGORY NAME"
                                name="categoryName"
                                value={formData.categoryName}
                                placeholder="e.g. Raw Material"
                                required
                                onChange={handleChange}
                            />
                        </Col>

                        <Col lg={12}>
                            <TextInput
                                label="DESCRIPTION"
                                name="description"
                                value={formData.description}
                                placeholder="Enter category description"
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
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        isActive: e.target.value === "true",
                                    })
                                }
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
                                    type="reset"
                                    variant="secondary"
                                    className="me-3"
                                />

                                <Button
                                    text="Save categorie"
                                    icon={FaSave}
                                    type="submit"
                                />


                            </div>

                        </Col>
                    </Row>

                </div>

            </Container>
        </div>
    );
};

export default Categorycreate;