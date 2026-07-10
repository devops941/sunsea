import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createStore } from "../../../features/stores/storeSlice";
import { fetchLocations } from "../../../features/locations/locationSlice";
import { fetchEmployees } from "../../../features/employee/employeeSlice";
import { fetchStoreTypes } from "../../../features/store-types/storeTypeSlice";
import { storeService } from "../../../services/storeService";
import { z } from "zod";
// Dynamic Store Types are now fetched from DB

// const COST_METHOD_OPTIONS = [
//     { label: "Weighted Average (WAVG)", value: "WAVG" },
//     { label: "First In First Out (FIFO)", value: "FIFO" },
// ];

const STATUS_OPTIONS = [
    { label: "Active", value: "Active" },
    { label: "Inactive", value: "Inactive" },
    { label: "System", value: "System" },
];

const initialFormState = {
    storeId: "",
    storeName: "",
    storeTypeId: "",
    locationId: "",
    // locationDesc: "",
    inchargeId: "",
    // costMethod: "WAVG",
    gstPlace: "",
    status: "Active",
    allowNegative: false,
    isActive: true,
};

const storeSchema = z.object({
   

    storeName: z
        .string()
        .trim()
        .min(1, "Store Name is required")
        .max(100, "Maximum 100 characters allowed")
        .regex(
            /^[A-Za-z0-9\s&()-]+$/,
            "Store Name can only contain letters, numbers, spaces, &, (, ), and -"
        ),

    storeTypeId: z
        .string()
        .trim()
        .min(1, "Store Type is required"),

    inchargeId: z
        .string()
        .trim()
        .min(1, "Store Incharge is required"),

    locationId: z
        .string()
        .trim()
        .min(1, "Location is required"),

    // locationDesc: z
    //     .string()
    //     .trim()
    //     .min(1, "Location Description is required")
    //     .max(255, "Maximum 255 characters allowed")
    //     .regex(
    //         /^[A-Za-z0-9\s,./()-]+$/,
    //         "Invalid characters in Location Description"
    //     ),

    gstPlace: z
        .string()
        .trim()
       
        .optional()
        .or(z.literal(""))
});

const StorageStoreCreate: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formData, setFormData] = useState(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: locations } = useAppSelector(state => state.locations);
    const { employees } = useAppSelector((state: any) => state.employees || { employees: [] });
    const { data: storeTypes } = useAppSelector(state => state.storeTypes);



    useEffect(() => {
        dispatch(fetchLocations(undefined));
        dispatch(fetchEmployees(undefined));
        dispatch(fetchStoreTypes(undefined));

        let isMounted = true;

        const getNextId = async () => {
            try {
                const nextId = await storeService.fetchNextId();
                if (isMounted) {
                    setFormData(prev => ({ ...prev, storeId: nextId }));
                }
            } catch (err) {
                console.error("Failed to fetch next store ID", err);
                if (isMounted) {
                    toast.error("Failed to fetch next store ID");
                }
            }
        };

        getNextId();

        return () => {
            isMounted = false;
        };
    }, [dispatch]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
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
    const handleClear = () => {
        setFormData(prev => ({
            ...initialFormState,
            storeId: prev.storeId
        }));

        setErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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
            const payload = {
                storeId: formData.storeId,
                storeName: formData.storeName,
                storeTypeId: formData.storeTypeId ? Number(formData.storeTypeId) : undefined,
                locationId: formData.locationId || undefined,
                // locationDesc: formData.locationDesc || undefined,
                inchargeId: formData.inchargeId || undefined,
                // costMethod: formData.costMethod,
                gstPlace: formData.gstPlace || undefined,
                status: formData.status,
                allowNegative: formData.allowNegative,
                isActive: formData.isActive
            };

            await dispatch(createStore(payload as any)).unwrap();

            toast.success("Store created successfully!");
            navigate("/storage-stores");

        } catch (err: any) {
            toast.error(err || "Failed to create store");
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
                                <h2 className="page-title">Create Storage Store</h2>
                                <div className="page-breadcrumb">Home / Inventory & Warehouse / Storage Stores / Create</div>
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

                <form onSubmit={handleSubmit} className="form-inner" noValidate>
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
                                error={errors.storeName}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={4}>
                            <SelectInput
                                label="Store Type"
                                name="storeTypeId"
                                value={formData.storeTypeId}
                                options={[
                                    { label: "Select a store type", value: "" },
                                    ...storeTypes.filter(st => st.isActive).map(st => ({
                                        label: st.name,
                                        value: st.id.toString()
                                    }))
                                ]}
                                required
                                error={errors.storeTypeId}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={4}>
                            <SelectInput
                                label="Location"
                                name="locationId"
                                value={formData.locationId}
                                options={[
                                    { label: "Select a location", value: "" },
                                    ...locations.filter(loc => loc.isActive).map(loc => ({
                                        label: `${loc.locationName} (${loc.locationCode})`,
                                        value: loc.locationId
                                    }))
                                ]}
                                required
                                error={errors.locationId}
                                onChange={handleChange}
                            />
                        </Col>
                        {/* <Col md={4}>
                            <TextInput
                                label="Location Description"
                                name="locationDesc"
                                value={formData.locationDesc}
                                placeholder="e.g. Building A, Floor 1"
                                error={errors.locationDesc}
                                onChange={handleChange}
                            />
                        </Col> */}
                        <Col md={4}>
                            <SelectInput
                                label="Store Incharge"
                                name="inchargeId"
                                value={formData.inchargeId}
                                options={[
                                    { label: "Select an incharge", value: "" },
                                    ...(employees || []).map((emp: any) => ({
                                        label: `${emp.fullName} (${emp.empCode})`,
                                        value: emp.id.toString()
                                    }))
                                ]}
                                required
                                error={errors.inchargeId}
                                onChange={handleChange}
                            />
                        </Col>
                        {/* <Col md={4}>
                            <SelectInput
                                label="Costing Method"
                                name="costMethod"
                                value={formData.costMethod}
                                options={COST_METHOD_OPTIONS}
                                onChange={handleChange}
                                required

                            />
                        </Col> */}
                        <Col md={4}>
                            <SelectInput
                                label="Status"
                                name="status"
                                value={formData.status}
                                options={STATUS_OPTIONS}
                                onChange={handleChange}
                                required

                            />
                        </Col>
                        <Col md={4}>
                            <TextInput
                                label="GST Place (State Code)"
                                name="gstPlace"
                                value={formData.gstPlace}
                                placeholder="e.g. 33"
                                error={errors.gstPlace}
                                onChange={handleChange}
                            />
                        </Col>
                        {/* <Col md={4}>
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
                        </Col> */}
                       
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
                                text={isSubmitting ? "Saving..." : "Save Store"}
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

export default StorageStoreCreate;
