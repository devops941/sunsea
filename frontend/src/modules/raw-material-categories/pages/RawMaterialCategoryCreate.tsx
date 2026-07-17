import React, { useState, useEffect } from "react";

import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import { rawMaterialCategoryService } from "../../../services/rawMaterialCategoryService";
import BackButton from "../../../components/ui/BackButton/BackButton";

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
        <div className="w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Page Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-800">Create Raw Material Category</h2>
                        <BackButton text="Back to List" to="/raw-material-categories" />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-3 space-y-4">
                    {/* Basic Information */}
                    <div>
                        <h6 className="text-base font-semibold text-gray-800 mb-3">Category Details</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <TextInput
                                label="Category Code"
                                name="code"
                                value={formData.code}
                                placeholder="e.g. RMC001"
                                required
                                onChange={handleChange}
                                disabled
                            />
                            <TextInput
                                label="Category Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Polymer"
                                required
                                error={errors.name}
                                onChange={handleChange}
                            />
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
                            <div className="lg:col-span-2">
                                <TextInput
                                    label="Description"
                                    name="description"
                                    value={formData.description}
                                    placeholder="Enter category description..."
                                    error={errors.description}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
                        <CustomButton
                            text="Clear"
                            icon={FaEraser}
                            onClick={handleClear}
                            disabled={loading}
                        />
                        <CustomButton
                            text={loading ? "Saving..." : "Save Category"}
                            icon={FaSave}
                            type="submit"
                            disabled={loading}
                        />
                    </div>
                </form>
            </div >
        </div >
    );
};

export default RawMaterialCategoryCreate;
