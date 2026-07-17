import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useAppDispatch } from "../../../hooks/reduxHooks";
import { updateLocation } from "../../../features/locations/locationSlice";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import { z } from "zod";
import BackButton from "../../../components/ui/BackButton/BackButton";

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
    isActive: true,
};

const locationSchema = z.object({
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
                isActive: locationState.state.isActive,
            });
        } else {
            toast.error("No location data provided.");
            navigate("/locations");
        }
    }, [locationState.state, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const type = (e.target as any).type;
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
                    locationName: formData.locationName,
                    locationType: formData.locationType,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
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
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className=" space-y-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-slate-800">Edit Location</h2>
                        <BackButton text="Back to List" to="/locations" />
                    </div>

                    <form onSubmit={handleSubmit} className="p-6" noValidate>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            
                            <TextInput
                                label="Location Name"
                                name="locationName"
                                value={formData.locationName}
                                placeholder="e.g. Main Warehouse"
                                required
                                error={errors.locationName}
                                onChange={handleChange}
                            />
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
                            
                            <TextInput
                                label="Address"
                                name="address"
                                value={formData.address}
                                placeholder="e.g. 123 Main St"
                                required
                                error={errors.address}
                                onChange={handleChange}
                            />
                            
                            <CityStateSelect
                                stateValue={formData.state}
                                onStateChange={(v) => {
                                    setFormData(prev => ({ ...prev, state: v.name, city: "" }));
                                    setErrors(prev => ({ ...prev, state: "", city: "" }));
                                }}
                                stateError={errors.state}
                                cityValue={formData.city}
                                onCityChange={(v) => {
                                    setFormData(prev => ({ ...prev, city: v.name }));
                                    setErrors(prev => ({ ...prev, city: "" }));
                                }}
                                cityError={errors.city}
                                required
                            />
                            
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
                        </div>

                        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-200">
                            <CustomButton
                                text={isSubmitting ? "Updating..." : "Update Location"}
                                icon={FaSave}
                                type="submit"
                                disabled={isSubmitting}
                            />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LocationEdit;
