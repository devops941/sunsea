import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useAppDispatch } from "../../../hooks/reduxHooks";
import { createStoreType } from "../../../features/store-types/storeTypeSlice";
import { storeTypeService } from "../../../services/storeTypeService";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { z } from "zod";

const initialFormState = {
    code: "",
    name: "",
    description: "",
    isActive: true,
};

const StoreTypeCreate: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [formData, setFormData] = useState(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchNextCode = async () => {
            try {
                const nextId = await storeTypeService.fetchNextId();
                setFormData(prev => ({ ...prev, code: nextId }));
            } catch (err) {
                console.error("Failed to fetch next store type code:", err);
            }
        };
        fetchNextCode();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const target = e.target;
        const { name, value, type } = target;

        const checked =
            type === "checkbox"
                ? (target as HTMLInputElement).checked
                : undefined;

        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));

        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
    };
    const storeTypeSchema = z.object({
        code: z
            .string()
            .trim()
            .min(1, "Store Type Code is required")
            .max(20, "Maximum 20 characters allowed")
            .regex(
                /^[A-Z0-9_-]+$/,
                "Only uppercase letters, numbers, hyphen (-) and underscore (_) are allowed"
            ),

        name: z
            .string()
            .trim()
            .min(1, "Store Type Name is required")
            .max(100, "Maximum 100 characters allowed")
            .regex(
                /^[A-Za-z0-9\s&()-]+$/,
                "Store Type Name contains invalid characters"
            )
            .refine(
                (value) => /[A-Za-z]/.test(value),
                "Store Type Name must contain at least one alphabet"
            ),

        description: z
            .string()
            .trim()
            .min(1, "Description is required")
            .max(255, "Maximum 255 characters allowed")
            .regex(
                /^[A-Za-z0-9\s,./()&-]+$/,
                "Description contains invalid characters"
            ),
    });

    const handleClear = () => {
        setFormData(prev => ({
            ...initialFormState,
            code: prev.code
        }));

        setErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            storeTypeSchema.parse(formData);
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
            await dispatch(createStoreType(formData)).unwrap();

            toast.success("Store Type created successfully!");

            navigate("/store-types");
        } catch (err: any) {
            toast.error(err || "Failed to create store type");
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
                                <h2 className="page-title">Create Store Type</h2>
                                <div className="page-breadcrumb">Home / Settings / Store Types / Create</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/store-types")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner">
                    <Row className="g-3">
                        <Col md={6}>
                            <TextInput
                                label="Store Type Code"
                                name="code"
                                value={formData.code}
                                placeholder="e.g. ST001"
                                required
                                onChange={handleChange}
                                disabled
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Store Type Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Raw Material"
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
                                placeholder="e.g. Used for all raw materials..."
                                error={errors.description}
                                onChange={handleChange}
                                required
                            />
                        </Col>
                        <Col md={6}>
                            <SelectInput
                                label="Status"
                                name="isActive"
                                value={formData.isActive ? "true" : "false"}
                                options={[
                                    { label: "Active", value: "true" },
                                    { label: "Inactive", value: "false" },
                                ]}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        isActive: e.target.value === "true",
                                    }))
                                }
                            />
                        </Col>
                    </Row>

                    <div className="form-actions d-flex justify-content-end gap-3 mt-4">
                        <CustomButton
                            text="Clear"
                            icon={FaEraser}
                            onClick={handleClear}
                            disabled={isSubmitting}
                        />
                        <div className="ms-2">
                            <CustomButton
                                text={isSubmitting ? "Saving..." : "Save Store Type"}
                                icon={FaSave}
                                type="submit"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </form>
            </Container>
        </div>
    );
}

export default StoreTypeCreate;
