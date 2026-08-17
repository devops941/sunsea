import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FaPlus, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import { z } from "zod";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import { usePermission } from "../../../hooks/usePermission";
import { rawMaterialCategoryService } from "../../../services/rawMaterialCategoryService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

const ITEMS_PER_PAGE = 10;

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
    id: "",
    code: "",
    name: "",
    description: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
};

const RawMaterialCategoryList: React.FC = () => {
    const {
        rawMaterialCategories,
        totalPages,
        loading,
        error,
        loadCategories,
        addCategory,
        editCategory,
        removeCategory,
    } = useRawMaterialCategories();
    const { can } = usePermission();

    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    
    // View Modal State
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Form Modal State
    const [showFormModal, setShowFormModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (can("raw_material_categories.view")) {
                loadCategories({
                    search: searchTerm,
                    page: currentPage,
                    limit: ITEMS_PER_PAGE,
                    sortBy: "categoryCode",
                    sortOrder: "asc",
                });
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [loadCategories, searchTerm, currentPage, can]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenAdd = async () => {
        setEditMode(false);
        setErrors({});
        
        let nextCode = "";
        try {
            nextCode = await rawMaterialCategoryService.fetchNextId();
        } catch (err) {
            console.error("Failed to fetch next raw material category code:", err);
        }
        
        setFormData({ ...initialFormState, code: nextCode });
        setShowFormModal(true);
    };

    // Lets the "Add RM Category" sidebar link open the create modal directly.
    // The param is cleared straight away so a refresh or back-nav doesn't
    // reopen the modal, which also stops this effect from looping.
    useEffect(() => {
        if (searchParams.get("action") === "add") {
            handleOpenAdd();
            searchParams.delete("action");
            setSearchParams(searchParams, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const handleOpenEdit = useCallback((category: any) => {
        setEditMode(true);
        setErrors({});
        setFormData({
            id: String(category.id),
            code: category.code,
            name: category.name,
            description: category.description || "",
            status: category.status,
        });
        setShowFormModal(true);
    }, []);

    const handleOpenView = useCallback((category: any) => {
        setSelectedCategory(category);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            setIsDeleting(true);
            try {
                await removeCategory(itemToDelete);
                toast.success("Category deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete category");
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const handleClear = () => {
        setFormData(prev => ({ ...initialFormState, code: prev.code }));
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
                    if (message) formattedErrors[key] = message;
                });
                setErrors(formattedErrors);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                code: formData.code,
                name: formData.name,
                description: formData.description,
                status: formData.status,
            };

            if (editMode) {
                await editCategory(Number(formData.id), payload);
                toast.success("Category updated successfully!");
            } else {
                await addCategory(payload);
                toast.success("Category created successfully!");
            }
            setShowFormModal(false);
        } catch (err: any) {
            toast.error(err || "Operation failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Raw Material Category Management</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search by code or name..."
                        />
                        {can("raw_material_categories.create") && (
                            <CustomButton
                                text="Add Category"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        )}
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={rawMaterialCategories}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No categories found."
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => setCurrentPage(page),
                    }}
                    columns={[
                        {
                            header: "#",
                            width: "60px",
                            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                        },
                        { header: "CODE", accessor: "code" },
                        { header: "NAME", accessor: "name" },
                        { header: "STATUS", render: (item) => <StatusBadge status={item.status} /> },
                        { header: "CREATED DATE", render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-" },
                        {
                            header: "ACTIONS",
                            render: (item) => (
                                <div className="flex items-center gap-2">
                                    <ViewButton onClick={() => handleOpenView(item)} />
                                    {can("raw_material_categories.edit") && <EditButton onClick={() => handleOpenEdit(item)} />}
                                    {can("raw_material_categories.delete") && <DeleteButton onClick={() => triggerDelete(item.id)} />}
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

            {/* Form Modal (Add / Edit) */}
            <CommonModal
                show={showFormModal}
                onHide={() => setShowFormModal(false)}
                title={editMode ? "Edit Raw Material Category" : "Add New Category"}
                overflowVisible={true}
                footer={
                    <div className="flex items-center justify-end gap-2 w-full">
                        <CustomButton
                            text="Clear"
                            icon={FaEraser}
                            onClick={handleClear}
                            disabled={isSubmitting}
                        />
                        <CustomButton
                            type="submit"
                            text={editMode ? "Update Category" : "Save Category"}
                            icon={FaSave}
                            variant="primary"
                            disabled={isSubmitting}
                            onClick={handleSubmit}
                        />
                    </div>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-4 p-2">
                    <div className="grid grid-cols-1 gap-4">
                        <TextInput
                            label="Category Code"
                            name="code"
                            value={formData.code}
                            placeholder="e.g. RMC001"
                            required
                            onChange={handleChange}
                            disabled
                            error={errors.code}
                        />
                        <TextInput
                            label="Category Name"
                            name="name"
                            value={formData.name}
                            placeholder="e.g. Polymer"
                            required
                            onChange={handleChange}
                            error={errors.name}
                        />
                        <TextInput
                            label="Description"
                            name="description"
                            value={formData.description}
                            placeholder="Enter category description..."
                            onChange={handleChange}
                            error={errors.description}
                        />
                        <SelectInput
                            label="Status"
                            name="status"
                            value={formData.status}
                            options={[
                                { value: "ACTIVE", label: "Active" },
                                { value: "INACTIVE", label: "Inactive" },
                            ]}
                            onChange={handleChange}
                            error={errors.status}
                        />
                    </div>
                </form>
            </CommonModal>

            <CommonViewModal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
                modalTitle="Category Details"
                avatarText={selectedCategory ? selectedCategory.name.charAt(0).toUpperCase() : ""}
                headerTitle={selectedCategory ? selectedCategory.name : ""}
                headerSubtitle={selectedCategory ? `Code: ${selectedCategory.code}` : ""}
                sections={selectedCategory ? [
                    {
                        fields: [
                            { label: "Category Name", value: selectedCategory.name },
                            { label: "Category Code", value: selectedCategory.code },
                            { label: "Description", value: selectedCategory.description || "N/A", xs: 12 },
                            { label: "Status", value: selectedCategory.status },
                            { label: "Created Date", value: selectedCategory.createdAt ? new Date(selectedCategory.createdAt).toLocaleString() : "-" },
                            { label: "Updated Date", value: selectedCategory.updatedAt ? new Date(selectedCategory.updatedAt).toLocaleString() : "-" },
                        ]
                    }
                ] : []}
            />

            <CommonConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message="Are you sure you want to delete this category?"
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                isDangerous={true}
                isLoading={isDeleting}
            />
        </div>
    );
};

export default RawMaterialCategoryList;
