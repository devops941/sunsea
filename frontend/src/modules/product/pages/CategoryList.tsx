import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FaSearch, FaPlus, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { useCategories } from "../../../hooks/useCategories";
import { usePermission } from "../../../hooks/usePermission";
import { categoryService } from "../../../services/categoryService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CommonModal from "../../../components/ui/Modal/CommonModal";

const ITEMS_PER_PAGE = 10;

const CategoryList: React.FC = () => {
    const { categories, loading, error, loadCategories, addCategory, editCategory, removeCategory } = useCategories();
    const { can } = usePermission();

    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [errors, setErrors] = useState({ code: "", name: "" });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        id: "",
        code: "",
        name: "",
        description: "",
        status: "ACTIVE",
    });

    useEffect(() => {
        if (can("categories.view")) {
            loadCategories("");
        }
    }, [loadCategories, can]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setCurrentPage(1);
        loadCategories(value);
    };

    const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedCategories = categories.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = async () => {
        setEditMode(false);
        let nextCode = "";
        try {
            nextCode = await categoryService.fetchNextId();
        } catch (error) {
            console.error("Failed to fetch next category code:", error);
        }

        setFormData({
            id: "",
            code: nextCode,
            name: "",
            description: "",
            status: "ACTIVE",
        });
        setErrors({ code: "", name: "" });
        setShowFormModal(true);
    };

    // Lets the "Add Category" sidebar link open the create modal directly.
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
        setFormData({
            id: String(category.id),
            code: category.code,
            name: category.name,
            description: category.description || "",
            status: category.status,
        });
        setErrors({ code: "", name: "" });
        setShowFormModal(true);
    }, []);

    const validateForm = () => {
        const newErrors = { code: "", name: "" };
        let isValid = true;

        if (!formData.code.trim()) {
            newErrors.code = "category code is required";
            isValid = false;
        }

        if (!formData.name.trim()) {
            newErrors.name = "category name is required";
            isValid = false;
        } else if (/^[0-9]+$/.test(formData.name.trim())) {
            newErrors.name = "Category name cannot be only numbers";
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

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
            try {
                await removeCategory(itemToDelete);
                toast.success("Category deleted successfully!");
            } catch (err: any) {
                toast.error("Failed to delete category! as it is already assigned in product");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const payload = {
                code: formData.code,
                name: formData.name,
                description: formData.description,
                status: formData.status
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

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        { header: "Code", accessor: "code" },
        { header: "Name", accessor: "name" },
        { header: "Status", render: (cat) => <StatusBadge status={cat.status} />, align: "center" },
        { header: "Created Date", render: (cat) => new Date(cat.createdAt).toLocaleDateString() },
        {
            header: "Actions",
            render: (cat) => (
                <div className="flex items-center gap-2 justify-end">
                    <ViewButton onClick={() => handleOpenView(cat)} />
                    {can("categories.edit") && <EditButton onClick={() => handleOpenEdit(cat)} />}
                    {can("categories.delete") && <DeleteButton onClick={() => triggerDelete(cat.id)} />}
                </div>
            ),
            align: "left"
        }
    ];

    return (
        <div>
            <div>
                <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                        <div>
                            <h2 className="text-2xl font-bold text-ink">Product Category Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-card border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search categories..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            {can("categories.create") && <CustomButton text="Add Category" icon={FaPlus} onClick={handleOpenAdd} />}
                        </div>
                    </div>

                    {/* Categories Table */}
                    <div className="p-0">
                        <DataTable
                            columns={columns}
                            data={paginatedCategories}
                            rowKey={(row) => row.id}
                            loading={loading}
                            emptyMessage="No categories found."
                            pagination={totalPages > 1 ? {
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage
                            } : undefined}
                        />
                    </div>
                </div>

                {/* Add/Edit Modal */}
                <CommonModal
                    show={showFormModal}
                    onHide={() => setShowFormModal(false)}
                    title={editMode ? "Edit Category" : "Add New Category"}
                    overflowVisible={true}
                    footer={
                        <div className="flex items-center justify-end gap-2 w-full">
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                onClick={() => setFormData({
                                    id: formData.id,
                                    code: formData.code,
                                    name: "",
                                    description: "",
                                    status: "ACTIVE",
                                })}
                            />
                            <CustomButton
                                text={editMode ? "Update" : "Save"}
                                icon={FaSave}
                                onClick={handleSubmit}
                                disabled={loading || isSubmitting}
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
                                placeholder="e.g. CAT-01"
                                required
                                onChange={handleChange}
                                disabled
                                error={errors.code}
                            />
                            <TextInput
                                label="Category Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Electronics"
                                required
                                onChange={handleChange}
                                error={errors.name}
                            />
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="Enter category description"
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
                                onChange={handleChange}
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
                                { label: "Description", value: selectedCategory.description || "N/A" },
                                { label: "Status", value: <StatusBadge status={selectedCategory.status} /> },
                                { label: "Created Date", value: new Date(selectedCategory.createdAt).toLocaleString() },
                                { label: "Updated Date", value: new Date(selectedCategory.updatedAt).toLocaleString() },
                            ]
                        }
                    ] : []}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this category?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default CategoryList;
