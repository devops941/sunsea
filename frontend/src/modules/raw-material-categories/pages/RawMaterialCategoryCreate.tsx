import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import { rawMaterialCategoryService } from "../../../services/rawMaterialCategoryService";

const categorySchema = z.object({
    code: z
        .string()
        .trim()
        .min(1, "Category Code is required")
        .max(30, "Maximum 30 characters allowed")
        .regex(
            /^[A-Z0-9_-]+$/,
            "Only uppercase letters, numbers, hyphen (-) and underscore (_) are allowed"
        ),

    name: z
        .string()
        .min(1, "Category name is required")
        .regex(/^(?=.*[A-Za-z]).+$/, {
            message: "Category name must contain at least one letter and can include special characters.",
        }),

    description: z
        .string()
        .trim()
        .max(255, "Maximum 255 characters allowed")
        .regex(
            /^[A-Za-z0-9\s&().,/_-]*$/,
            "Description contains invalid characters"
        )
        .optional()
        .or(z.literal("")),


});

const initialFormState = {
    code: "",
    name: "",
    description: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
};

const RawMaterialCategoryCreate: React.FC = () => {
    const navigate = useNavigate();
    const { addCategory, loading } = useRawMaterialCategories();
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        const fetchNextCode = async () => {
            try {
                const nextId = await rawMaterialCategoryService.fetchNextId();
                setFormData(prev => ({ ...prev, code: nextId }));
            } catch (err) {
                console.error("Failed to fetch next raw material category code:", err);
            }
        };
        fetchNextCode();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));

        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: "",
            }));
        }
    };

    const handleClear = () => {
        setFormData(prev => ({
            ...initialFormState,
            code: prev.code,
        }));
        setErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            categorySchema.parse(formData);
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

        try {
            await addCategory(formData);
            toast.success("Category created successfully!");
            navigate("/raw-material-categories");
        } catch (err: any) {
            toast.error(err || "Failed to create category");
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Create Raw Material Category</h2>
                                <div className="page-breadcrumb">Home / Inventory & Warehouse / Raw Material Categories / Create</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/raw-material-categories")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner">
                    <Row className="g-3">
                        <Col md={6}>
                            <TextInput
                                label="Category Code"
                                name="code"
                                value={formData.code}
                                placeholder="e.g. RMC001"
                                required
                                onChange={handleChange}
                                disabled
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Category Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Polymer"
                                required
                                error={errors.name}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={12}>
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="Enter category description..."
                                error={errors.description}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <SelectInput
                                label="Status"
                                name="status"

                                value={formData.status}
                                options={[
                                    { value: "ACTIVE", label: "Active" },
                                    { value: "INACTIVE", label: "Inactive" },
                                ]}
                                error={errors.status}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>

                    <div className="form-actions d-flex justify-content-end gap-3 mt-4">
                        <CustomButton
                            text="Clear"
                            icon={FaEraser}
                            onClick={handleClear}
                            disabled={loading}
                        />
                        <div className="ms-2">
                            <CustomButton
                                text={loading ? "Saving..." : "Save Category"}
                                icon={FaSave}
                                type="submit"
                                disabled={loading}
                            />
                        </div>
                    </div>
                </form>
            </Container>
        </div>
    );
};

export default RawMaterialCategoryCreate;
