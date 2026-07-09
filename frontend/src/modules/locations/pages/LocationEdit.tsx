import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import Button from "../../../components/ui/custombutton/CustomButton";
import { useAppDispatch } from "../../../hooks/reduxHooks";
import { updateLocation } from "../../../features/locations/locationSlice";

const LOCATION_TYPE_OPTIONS = [
    { label: "Warehouse", value: "Warehouse" },
    { label: "Office", value: "Office" },
    { label: "Factory", value: "Factory" },
    { label: "Retail", value: "Retail" },
];

const initialFormState = {
    locationId: "",
    locationName: "",
    locationType: "",
    address: "",
    city: "",
    state: "",
    country: "",
    isActive: true,
};

import { z } from "zod";

const locationSchema = z.object({
    // locationCode: z
    //     .string()
    //     .trim()
    //     .min(1, "Location Code is required")
    //     .max(30, "Maximum 30 characters allowed")
    //     .regex(
    //         /^[A-Z0-9_-]+$/,
    //         "Only uppercase letters, numbers, hyphen (-) and underscore (_) are allowed"
    //     ),

    locationName: z
        .string()
        .trim()
        .min(1, "Location Name is required")
        .max(100, "Maximum 100 characters allowed")
        .regex(
            /^[A-Za-z0-9\s&()-]+$/,
            "Location Name contains invalid characters"
        ),

    locationType: z
        .string()
        .trim()
        .min(1, "Location Type is required"),

    address: z
        .string()
        .trim()
        .min(1, "Address is required")
        .max(255, "Maximum 255 characters allowed"),

    city: z
        .string()
        .trim()
        .min(1, "City is required")
        .max(50, "Maximum 50 characters allowed")
        .regex(
            /^[A-Za-z\s]+$/,
            "City cannot contain numbers or special characters"
        ),

    state: z
        .string()
        .trim()
        .min(1, "State is required")
        .max(50, "Maximum 50 characters allowed")
        .regex(
            /^[A-Za-z\s]+$/,
            "State cannot contain numbers or special characters"
        ),

    country: z
        .string()
        .trim()
        .min(1, "Country is required")
        .max(50, "Maximum 50 characters allowed")
        .regex(
            /^[A-Za-z\s]+$/,
            "Country cannot contain numbers or special characters"
        ),
});

const LocationEdit: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (locationState.state) {
            setFormData({
                locationId: locationState.state.locationId,
                locationName: locationState.state.locationName,
                locationType: locationState.state.locationType || "",
                address: locationState.state.address || "",
                city: locationState.state.city || "",
                state: locationState.state.state || "",
                country: locationState.state.country || "",
                isActive: locationState.state.isActive,
            });
        } else {
            toast.error("No location data provided.");
            navigate("/locations");
        }
    }, [locationState.state, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;
        const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
        setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            locationSchema.parse(formData);
            setErrors({});
        } catch (error) {
            if (error instanceof z.ZodError) {
                const newErrors: Record<string, string> = {};

                error.issues.forEach((issue) => {
                    const field = issue.path[0];

                    if (field) {
                        newErrors[field.toString()] = issue.message;
                    }
                });

                setErrors(newErrors);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await dispatch(updateLocation({
                id: formData.locationId,
                data: {
                    // locationCode: formData.locationCode,
                    locationName: formData.locationName,
                    locationType: formData.locationType,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    country: formData.country,
                    isActive: formData.isActive
                }
            })).unwrap();
            toast.success("Location updated successfully!");
            navigate("/locations");
        } catch (err: any) {
            toast.error(err || "Failed to update location");
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
                                <h2 className="page-title">Edit Location</h2>
                                <div className="page-breadcrumb">Home / Settings / Locations / Edit</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/locations")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner">
                    <Row className="g-3">
                        <Col md={6}>
                            <TextInput
                                label="Location ID"
                                name="locationId"
                                value={formData.locationId}
                                placeholder="e.g. LOC001"
                                required
                                disabled={true}
                                error={errors.locationId}
                                onChange={handleChange}
                            />
                        </Col>
                        
                        <Col md={6}>
                            <TextInput
                                label="Location Name"
                                name="locationName"
                                value={formData.locationName}
                                placeholder="e.g. Main Warehouse"
                                required
                                error={errors.locationName}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <SelectInput
                                label="Location Type"
                                name="locationType"
                                value={formData.locationType}
                                options={LOCATION_TYPE_OPTIONS}
                                required
                                defaultOptionLabel="Select Location Type"
                                error={errors.locationType}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Address"
                                name="address"
                                value={formData.address}
                                placeholder="e.g. 123 Main St"
                                error={errors.address}
                                onChange={handleChange}
                                required

                            />
                        </Col>
                        <Col md={4}>
                            <TextInput
                                label="City"
                                name="city"
                                value={formData.city}
                                placeholder="e.g. New York"
                                error={errors.city}
                                onChange={handleChange}
                                required

                            />
                        </Col>
                        <Col md={4}>
                            <TextInput
                                label="State"
                                name="state"
                                value={formData.state}
                                placeholder="e.g. NY"
                                error={errors.state}
                                required
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={4}>
                            <TextInput
                                label="Country"
                                name="country"
                                value={formData.country}
                                placeholder="e.g. USA"
                                error={errors.country}
                                onChange={handleChange}
                                required

                            />
                        </Col>
                        <Col md={4}>
                             <SelectInput
                                label="Status"
                                name="isActive"
                                required

                                options={[
                                    { label: "Active", value: "true" },
                                    { label: "Inactive", value: "false" },
                                ]}
                                value={String(formData.isActive)}
                                error={errors.isActive}
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
                            text="Cancel"
                            icon={FaEraser}
                            onClick={() => navigate("/locations")}
                            disabled={isSubmitting}
                        />
                        <div className="ms-2">
                            <Button
                                text={isSubmitting ? "Updating..." : "Update Location"}
                                icon={FaSave}
                                type="submit"
                                variant="primary"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </form>
            </Container>
        </div>
    );
};

export default LocationEdit;
