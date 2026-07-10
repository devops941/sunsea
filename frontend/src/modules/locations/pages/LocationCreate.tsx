import React, { useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import Button from "../../../components/ui/custombutton/CustomButton";
import { useAppDispatch } from "../../../hooks/reduxHooks";
import { createLocation } from "../../../features/locations/locationSlice";
import { locationService } from "../../../services/locationService";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../components/ui/CityStateSelect/CityStateSelect";

import { z } from "zod";

const LOCATION_TYPE_OPTIONS = [
    { label: "Warehouse", value: "Warehouse" },
    { label: "Office", value: "Office" },
    { label: "Factory", value: "Factory" },
    { label: "Retail", value: "Retail" },
];

const initialFormState = {
    locationId: "",
    // locationCode: "",
    locationName: "",
    locationType: "",
    address: "",
    city: "",
    state: "",
    // country: "",
    isActive: true,
};

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
        .max(100, "Maximum 100 characters allowed"),

    state: z
        .string()
        .trim()
        .min(1, "State is required")
        .max(100, "Maximum 100 characters allowed"),

    // country: z
    //     .string()
    //     .trim()
    //     .min(1, "Country is required")
    //     .max(50, "Maximum 50 characters allowed")
    //     .regex(
    //         /^[A-Za-z\s]+$/,
    //         "Country cannot contain numbers or special characters"
    //     ),
});

const LocationCreate: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        const getNextId = async () => {
            try {
                const nextId = await locationService.fetchNextId();
                setFormData(prev => ({ ...prev, locationId: nextId }));
            } catch (err) {
                console.error("Failed to fetch next location ID", err);
            }
        };
        getNextId();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;
        const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
        setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleStateChange = (stateData: StateCityOption) => {
        setFormData((prev) => ({
            ...prev,
            state: stateData.name,
            city: "",
        }));
        setErrors((prev) => ({
            ...prev,
            state: "",
            city: "",
        }));
    };

    const handleCityChange = (cityData: StateCityOption) => {
        setFormData((prev) => ({ ...prev, city: cityData.name }));
        setErrors((prev) => ({ ...prev, city: "" }));
    };

    const handleClear = () => {
        setFormData(prev => ({ ...initialFormState, locationId: prev.locationId }));
        setErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            locationSchema.parse(formData);
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
            await dispatch(createLocation(formData)).unwrap();
            toast.success("Location created successfully!");
            navigate("/locations");
        } catch (err: any) {
            toast.error(err || "Failed to create location");
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
                                <h2 className="page-title">Create Location</h2>
                                <div className="page-breadcrumb">Home / Settings / Locations / Create</div>
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

                <form onSubmit={handleSubmit} className="form-inner" noValidate>
                    <Row className="g-3">
                        <Col md={6}>
                            <TextInput
                                label="Location ID"
                                name="locationId"
                                value={formData.locationId}
                                placeholder="e.g. LOC001"

                                disabled={true}
                                error={errors.locationId}
                                onChange={handleChange}
                            />
                        </Col>
                        {/* <Col md={6}> <TextInput label="Location Code" name="locationCode" value={formData.locationCode} placeholder="e.g. LC-001" required error={errors.locationCode} onChange={handleChange} /> </Col> */}
                        <Col md={6}> <TextInput label="Location Name" name="locationName" value={formData.locationName} placeholder="e.g. Main Warehouse" required error={errors.locationName} onChange={handleChange} /> </Col>
                        <Col md={12}> <SelectInput label="Location Type" name="locationType" value={formData.locationType} options={LOCATION_TYPE_OPTIONS} required defaultOptionLabel="Select Location Type" error={errors.locationType} onChange={handleChange} /> </Col>
                        <Col md={12}> <TextInput label="Address" name="address" required value={formData.address} placeholder="e.g. 123 Main St" error={errors.address} onChange={handleChange} /> </Col>
                        <CityStateSelect
                            stateValue={formData.state}
                            cityValue={formData.city}
                            onStateChange={handleStateChange}
                            onCityChange={handleCityChange}
                            stateError={errors.state}
                            cityError={errors.city}
                            required
                        />
                        {/* <Col md={4}> <TextInput label="Country" name="country" value={formData.country} required placeholder="e.g. India" error={errors.country} onChange={handleChange} /> </Col> */}
                        <Col md={4}>
                            <SelectInput
                                label="Status"
                                name="isActive"
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
                            text="Clear"
                            icon={FaEraser}
                            onClick={handleClear}
                            disabled={isSubmitting}
                        />
                        <div className="ms-2">
                            <Button
                                text={isSubmitting ? "Saving..." : "Save Location"}
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

export default LocationCreate;
