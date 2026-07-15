import React, { useState, useEffect } from "react";
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

    gstPlace: z
        .string()
        .trim()
        .optional()
        .or(z.literal(""))
});

const initialFormState = {
    storeId: "",
    storeName: "",
    storeTypeId: "",
    locationId: "",
    inchargeId: "",
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
                inchargeId: location.state.inchargeId ? location.state.inchargeId.toString() : "",
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
        const { name, value } = e.target;
        const type = (e.target as any).type;
        const checked =
            type === "checkbox"
                ? (e.target as HTMLInputElement).checked
                : undefined;

        setFormData(prev => {
            const updated = {
                ...prev,
                [name]: type === "checkbox" ? checked : value
            };

            // Keep status and isActive in sync
            if (name === "status") {
                updated.isActive = value === "Active";
            }

            return updated;
        });

        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
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
            await dispatch(
                updateStore({
                    id: formData.storeId,
                    data: {
                        storeName: formData.storeName,
                        storeTypeId: formData.storeTypeId
                            ? Number(formData.storeTypeId)
                            : undefined,
                        locationId: formData.locationId || undefined,
                        inchargeId: formData.inchargeId || undefined,
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
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className=" space-y-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-slate-800">Edit Storage Store</h2>
                        <CustomButton
                            text="Back to List"
                            icon={FaArrowLeft}
                            onClick={() => navigate("/storage-stores")}
                        />
                    </div>

                    <form onSubmit={handleSubmit} className="p-6" noValidate>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <TextInput
                                label="Store ID"
                                name="storeId"
                                value={formData.storeId}
                                placeholder="e.g. STR001"
                                required
                                disabled={true}
                                onChange={handleChange}
                            />

                            <TextInput
                                label="Store Name"
                                name="storeName"
                                value={formData.storeName}
                                placeholder="e.g. Main Warehouse"
                                required
                                onChange={handleChange}
                                error={errors.storeName}
                            />
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

                            <SelectInput
                                label="Status"
                                name="status"
                                value={formData.status}
                                options={STATUS_OPTIONS}
                                onChange={handleChange}
                            />
                            
                            {/* <TextInput
                                label="GST Place"
                                name="gstPlace"
                                value={formData.gstPlace}
                                placeholder="e.g. Maharashtra"
                                onChange={handleChange}
                            /> */}
                            <div className="flex items-center gap-2 mt-8 h-[42px]">
                                <input
                                    type="checkbox"
                                    id="allowNegative"
                                    name="allowNegative"
                                    checked={formData.allowNegative}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                />
                                <label htmlFor="allowNegative" className="text-sm font-medium text-slate-700 cursor-pointer">
                                    Allow Negative Stock
                                </label>
                            </div>
                            
                            
                        </div>

                        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-200">
                            <CustomButton
                                text="Cancel"
                                icon={FaEraser}
                                onClick={() => navigate("/storage-stores")}
                                disabled={isSubmitting}
                                type="button"
                            />
                            <CustomButton
                                text={isSubmitting ? "Updating..." : "Update Store"}
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

export default StorageStoreEdit;
