import React, { useState } from "react";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useAppDispatch } from "../../../hooks/reduxHooks";
import { createLocation } from "../../../features/locations/locationSlice";
import { locationService } from "../../../services/locationService";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import { z } from "zod";

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
        const { name, value } = e.target;
        const type = (e.target as any).type;
        const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
        setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
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
        <div className="p-4 md:p-6 min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto space-y-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-slate-800">Create Location</h2>
                        <CustomButton
                            text="Back to List"
                            icon={FaArrowLeft}
                            onClick={() => navigate("/locations")}
                        />
                    </div>

                    <form onSubmit={handleSubmit} className="p-6" noValidate>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <TextInput
                                label="Location ID"
                                name="locationId"
                                value={formData.locationId}
                                placeholder="e.g. LOC001"
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
                                text="Clear"
                                icon={FaEraser}
                                onClick={handleClear}
                                disabled={isSubmitting}
                                type="button"
                            />
                            <CustomButton
                                text={isSubmitting ? "Saving..." : "Save Location"}
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

export default LocationCreate;
