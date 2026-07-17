import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useAppDispatch } from "../../../hooks/reduxHooks";
import { updateStoreType } from "../../../features/store-types/storeTypeSlice";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { z } from "zod";
import BackButton from "../../../components/ui/BackButton/BackButton";

const initialFormState = {
    id: 0,
    code: "",
    name: "",
    description: "",
    isActive: true,
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

const StoreTypeEdit: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (location.state) {
            setFormData({
                id: location.state.id,
                code: location.state.code,
                name: location.state.name,
                description: location.state.description || "",
                isActive: location.state.isActive,
            });
        } else {
            toast.error("No store type data provided.");
            navigate("/store-types");
        }
    }, [location.state, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target;
        const { name, value } = target;
        const type = (target as any).type;

        const checked = type === "checkbox" ? (target as HTMLInputElement).checked : undefined;

        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Zod Validation
        const validation = storeTypeSchema.safeParse({
            code: formData.code,
            name: formData.name,
            description: formData.description,
        });

        if (!validation.success) {
            const firstError = validation.error.issues[0];
            toast.error(firstError.message);
            return;
        }

        setIsSubmitting(true);

        try {
            await dispatch(
                updateStoreType({
                    id: formData.id,
                    data: {
                        code: validation.data.code,
                        name: validation.data.name,
                        description: validation.data.description,
                        isActive: formData.isActive,
                    },
                })
            ).unwrap();

            toast.success("Store Type updated successfully!");
            navigate("/store-types");
        } catch (err: any) {
            toast.error(err || "Failed to update store type");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className=" space-y-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-slate-800">Edit Store Type</h2>
                        <BackButton text="Back to List" to="/store-types" />
                    </div>

                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <TextInput
                                label="Store Type Code"
                                name="code"
                                value={formData.code}
                                placeholder="e.g. ST-RAW"
                                required
                                onChange={handleChange}
                                disabled
                            />
                            <TextInput
                                label="Store Type Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Raw Material"
                                required
                                onChange={handleChange}
                            />
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="e.g. Used for all raw materials..."
                                onChange={handleChange}
                            />
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
                        </div>

                        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-200">
                            <CustomButton
                                text="Cancel"
                                icon={FaEraser}
                                onClick={() => navigate("/store-types")}
                                disabled={isSubmitting}
                                type="button"
                            />
                            <CustomButton
                                text={isSubmitting ? "Updating..." : "Update Store Type"}
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

export default StoreTypeEdit;
