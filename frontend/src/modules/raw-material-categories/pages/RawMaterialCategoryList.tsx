import React, { useState, useEffect, useCallback } from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

const ITEMS_PER_PAGE = 10;

const RawMaterialCategoryList: React.FC = () => {
    const navigate = useNavigate();
    const {
        rawMaterialCategories,
        totalPages,
        loading,
        error,
        loadCategories,
        removeCategory,
    } = useRawMaterialCategories();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCategories({
                search: searchTerm,
                page: currentPage,
                limit: ITEMS_PER_PAGE,
                sortBy: "categoryCode",
                sortOrder: "asc",
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [loadCategories, searchTerm, currentPage]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenAdd = () => {
        navigate("/raw-material-categories/create");
    };

    const handleOpenEdit = useCallback((category: any) => {
        navigate(`/raw-material-categories/edit/${category.id}`, { state: category });
    }, [navigate]);

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
                toast.error(err || "Failed to delete category");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Raw Material Category Management</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search by code or name..."
                        />
                        <CustomButton
                            text="Add Category"
                            icon={FaPlus}
                            onClick={handleOpenAdd}
                        />
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
                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                    <DeleteButton onClick={() => triggerDelete(item.id)} />
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

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
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message="Are you sure you want to delete this category?"
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default RawMaterialCategoryList;
