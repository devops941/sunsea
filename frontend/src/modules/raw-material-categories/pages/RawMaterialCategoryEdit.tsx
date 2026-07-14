import React, { useState, useEffect } from "react";

import { FaSave, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import { rawMaterialCategoryService } from "../../../services/rawMaterialCategoryService";

const categorySchema = z.object({
    code: z
        .string()
        .trim()
        .min(1, "Category Code is required")
        .max(30, "Maximum 30 characters allowed")
        .regex(/^[A-Z0-9_-]+$/, "Only uppercase letters, numbers, hyphen (-) and underscore (_) are allowed"),
    name: z
        .string()
        .trim()
        .min(1, "Category Name is required")
        .max(100, "Maximum 100 characters allowed")
        .regex(
            /^(?=.*[A-Za-z]).+$/,
            "Category Name must contain at least one letter and can include special characters."
        ),
    description: z
        .string()
        .trim()
        .max(255, "Maximum 255 characters allowed")
        .optional()
        .or(z.literal("")),
    status: z.enum(["ACTIVE", "INACTIVE"]),
});

const RawMaterialCategoryEdit: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { editCategory, loading } = useRawMaterialCategories();

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [fetching, setFetching] = useState(false);
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        description: "",
        status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    });

    useEffect(() => {
        const loadInitialData = async () => {
            if (location.state) {
                const cat = location.state;
                setFormData({
                    code: cat.code || "",
                    name: cat.name || "",
                    description: cat.description || "",
                    status: cat.status || "ACTIVE",
                });
            } else if (id) {
                setFetching(true);
                try {
                    const data = await rawMaterialCategoryService.fetchById(Number(id));
                    setFormData({
                        code: data.code,
                        name: data.name,
                        description: data.description,
                        status: data.status,
                    });
                } catch (err: any) {
                    console.error(err);

                    toast.error("Failed to load category details");
                    navigate("/raw-material-categories");
                } finally {
                    setFetching(false);
                }
            }
        };

        loadInitialData();
    }, [id, location.state, navigate]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

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
            await editCategory(Number(id), formData);
            toast.success("Category updated successfully!");
            navigate("/raw-material-categories");
        } catch (err: any) {
            toast.error(err || "Failed to update category");
        }
    };

    if (fetching) {
        return (
            <div className="flex flex-col justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-slate-500">Loading category details...</p>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Page Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-800">Edit Raw Material Category</h2>
                        <CustomButton
                            text="Back to List"
                            icon={FaArrowLeft}
                            onClick={() => navigate("/raw-material-categories")}
                        />
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
                            <div className="lg:col-span-3">
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
                            text="Cancel"
                            icon={FaArrowLeft}
                            onClick={() => navigate("/raw-material-categories")}
                            disabled={loading}
                        />
                        <CustomButton
                            text={loading ? "Updating..." : "Update Category"}
                            icon={FaSave}
                            type="submit"
                            disabled={loading}
                        />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RawMaterialCategoryEdit;
