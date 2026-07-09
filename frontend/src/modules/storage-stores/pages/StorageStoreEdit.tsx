import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { updateStore } from "../../../features/stores/storeSlice";
import { fetchLocations } from "../../../features/locations/locationSlice";
import { fetchEmployees } from "../../../features/employee/employeeSlice";
import { fetchStoreTypes } from "../../../features/store-types/storeTypeSlice";
import { z } from "zod";
// Dynamic Store Types are now fetched from DB

const COST_METHOD_OPTIONS = [
    { label: "Weighted Average (WAVG)", value: "WAVG" },
    { label: "First In First Out (FIFO)", value: "FIFO" },
];

const STATUS_OPTIONS = [
    { label: "Active", value: "Active" },
    { label: "Inactive", value: "Inactive" },
    { label: "System", value: "System" },
];



const storeSchema = z.object({
    storeName: z
        .string()
        .trim()
        .min(1, "Store Name is required")
        .max(100, "Maximum 100 characters allowed")
        .regex(
            /^[A-Za-z][A-Za-z0-9\s&()-]*$/,
            "Store Name must start with a letter and may contain letters, numbers, spaces, &, (, ), and -"
        ),

    storeTypeId: z
        .string()
        .min(1, "Store Type is required"),

    locationId: z
        .string()
        .min(1, "Location is required"),

    inchargeId: z
        .string()
        .min(1, "Store Incharge is required"),

    locationDesc: z
        .string()
        .trim()
        .min(1, "Location Description is required")
        .max(255, "Maximum 255 characters allowed"),

    gstPlace: z
        .string()
        .max(10, "Maximum 10 characters allowed")
        .optional()
});

const initialFormState = {
    storeId: "",
    storeName: "",
    storeTypeId: "",
    locationId: "",
    locationDesc: "",
    inchargeId: "",
    costMethod: "WAVG",
    gstPlace: "",
    status: "Active",
    allowNegative: false,
    isActive: true,
};

const StorageStoreEdit: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();

    const [errors, setErrors] = useState<Record<string, string>>({});
    const { data: locations } = useAppSelector(state => state.locations);
    const { employees } = useAppSelector((state: any) => state.employees || { employees: [] });
    const { data: storeTypes } = useAppSelector(state => state.storeTypes);

    useEffect(() => {
        dispatch(fetchLocations(undefined));
        dispatch(fetchEmployees(undefined));
        dispatch(fetchStoreTypes(undefined));
    }, [dispatch]);

    const [formData, setFormData] = useState(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (location.state) {
            setFormData({
                storeId: location.state.storeId,
                storeName: location.state.storeName || "",
                storeTypeId: location.state.storeTypeId ? location.state.storeTypeId.toString() : "",
                locationId: location.state.locationId || "",
                locationDesc: location.state.locationDesc || "",
                inchargeId: location.state.inchargeId ? location.state.inchargeId.toString() : "",
                costMethod: location.state.costMethod || "WAVG",
                gstPlace: location.state.gstPlace || "",
                status: location.state.status || "Active",
                allowNegative: location.state.allowNegative || false,
                isActive: location.state.isActive,
            });
        } else {
            toast.error("No store data provided.");
            navigate("/storage-stores");
        }
    }, [location.state, navigate]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target as any;
        const checked =
            type === "checkbox"
                ? (e.target as HTMLInputElement).checked
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        try {
            storeSchema.parse(formData);
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
            await dispatch(
                updateStore({
                    id: formData.storeId,
                    data: {
                        storeName: formData.storeName,
                        storeTypeId: formData.storeTypeId
                            ? Number(formData.storeTypeId)
                            : undefined,
                        locationId: formData.locationId || undefined,
                        locationDesc: formData.locationDesc || undefined,
                        inchargeId: formData.inchargeId || undefined,
                        costMethod: formData.costMethod,
                        gstPlace: formData.gstPlace || undefined,
                        status: formData.status,
                        allowNegative: formData.allowNegative,
                        isActive: formData.isActive,
                    },
                })
            ).unwrap();

            toast.success("Store updated successfully!");
            navigate("/storage-stores");
        } catch (err: any) {
            toast.error(err || "Failed to update store");
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
                                <h2 className="page-title">Edit Storage Store</h2>
                                <div className="page-breadcrumb">Home / Inventory & Warehouse / Storage Stores / Edit</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/storage-stores")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner">
                    <Row className="g-3">
                        <Col md={4}>
                            <TextInput
                                label="Store ID"
                                name="storeId"
                                value={formData.storeId}
                                placeholder="e.g. STR001"
                                required
                                disabled={true}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col md={4}>
                            <TextInput
                                label="Store Name"
                                name="storeName"
                                value={formData.storeName}
                                placeholder="e.g. Main Warehouse"
                                required
                                onChange={handleChange}
                                error={errors.storeName}
                            />
                        </Col>
                        <Col md={4}>
                            <SelectInput
                                label="Store Type"
                                name="storeTypeId"
                                value={formData.storeTypeId}
                                error={errors.storeTypeId}
                                options={[
                                    { label: "Select a store type", value: "" },
                                    ...storeTypes.filter(st => st.isActive).map(st => ({
                                        label: st.name,
                                        value: st.id.toString()
                                    }))
                                ]}
                                required
                                onChange={handleChange}
                            />
                        </Col>

                        <Col md={4}>
                            <SelectInput
                                label="Location"
                                name="locationId"
                                error={errors.locationId}
                                value={formData.locationId}
                                options={[
                                    { label: "Select a location", value: "" },
                                    ...locations.filter(loc => loc.isActive).map(loc => ({
                                        label: `${loc.locationName} (${loc.locationCode})`,
                                        value: loc.locationId
                                    }))
                                ]}
                                required
                                onChange={handleChange}
                            />
                        </Col>

                        <Col md={4}>
                            <SelectInput
                                label="Store Incharge"
                                name="inchargeId"
                                error={errors.inchargeId}
                                value={formData.inchargeId}
                                options={[
                                    { label: "Select an incharge", value: "" },
                                    ...(employees || []).map((emp: any) => ({
                                        label: `${emp.fullName} (${emp.empCode})`,
                                        value: emp.id?.toString() || ""
                                    }))
                                ]}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col md={4}>
                            <SelectInput
                                label="Costing Method"
                                name="costMethod"
                                value={formData.costMethod}
                                options={COST_METHOD_OPTIONS}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={4}>
                            <SelectInput
                                label="Status"
                                name="status"
                                value={formData.status}
                                options={STATUS_OPTIONS}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={4}>
                            <TextInput
                                label="GST Place (State Code)"
                                name="gstPlace"
                                required
                                error={errors.gstPlace}
                                value={formData.gstPlace}
                                placeholder="e.g. 33"
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={4}>
                            <div className="form-group mb-3 d-flex align-items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="allowNegative"
                                    name="allowNegative"
                                    checked={formData.allowNegative}
                                    onChange={handleChange}
                                    style={{ width: 'auto', marginTop: '2rem' }}
                                />
                                <label htmlFor="allowNegative" className="form-label mb-0" style={{ marginTop: '2rem' }}>Allow Negative Stock</label>
                            </div>
                        </Col>

                    </Row>

                    <div className="form-actions d-flex justify-content-end gap-3 mt-4">
                        <CustomButton
                            text="Cancel"
                            icon={FaEraser}
                            onClick={() => navigate("/storage-stores")}
                            disabled={isSubmitting}
                        />
                        <div className="ms-2">
                            <CustomButton
                                text={isSubmitting ? "Updating..." : "Update Store"}
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
};

export default StorageStoreEdit;
