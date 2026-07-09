import React, { useEffect, useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser } from "react-icons/fa";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import Button from "../../../components/ui/Button/Button";
import CustomButton from "../../../components/ui/custombutton/CustomButton";

const CategoryEdit: React.FC = () => {
  const [formData, setFormData] = useState({
    id: "",
    categoryCode: "",
    categoryName: "",
    description: "",
    isActive: true,
  });

  useEffect(() => {
    // Replace with API response
    const categoryData = {
      id: 1,
      categoryCode: "RM",
      categoryName: "Raw Material",
      description: "Materials used in production",
      isActive: true,
    };

    setFormData({
      id: String(categoryData.id),
      categoryCode: categoryData.categoryCode,
      categoryName: categoryData.categoryName,
      description: categoryData.description,
      isActive: categoryData.isActive,
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

    console.log("Updated Category:", formData);

    // API Update Call
    // await axios.put(`/api/category/${formData.id}`, formData);
  };

  const handleReset = () => {
    setFormData({
      id: "",
      categoryCode: "",
      categoryName: "",
      description: "",
      isActive: true,
    });
  };

  return (
    <div className="inner-container">
      <Container fluid>
        <div className="page-header">
          <h2 className="page-title">Edit Category</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-inner">
            <Row className="mb-4">
              <h2 className="form-title">Category Details</h2>

              <Col lg={4}>
                <TextInput
                  label="CATEGORY ID"
                  name="id"
                  value={formData.id}
                  onChange={handleChange}
                />
              </Col>

              <Col lg={4}>
                <TextInput
                  label="CATEGORY CODE"
                  name="categoryCode"
                  value={formData.categoryCode}
                  placeholder="Enter category code"
                  required
                  onChange={handleChange}
                />
              </Col>

              <Col lg={4}>
                <TextInput
                  label="CATEGORY NAME"
                  name="categoryName"
                  value={formData.categoryName}
                  placeholder="Enter category name"
                  required
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
                    text="Update Category"
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

export default CategoryEdit;