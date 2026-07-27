import React, { useState, useCallback, useEffect } from "react";
import { FaSearch, FaPlus, FaSave, FaEraser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchStoreTypes, deleteStoreType, createStoreType, updateStoreType } from "../../../features/store-types/storeTypeSlice";
import { storeTypeService } from "../../../services/storeTypeService";
import type { StoreType } from "../../../features/store-types/types";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DataTable from "../../../components/ui/table/DataTable";

const ITEMS_PER_PAGE = 10;

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
        .max(255, "Maximum 255 characters allowed")
        .regex(
            /^[A-Za-z0-9\s,./()&-]*$/,
            "Description contains invalid characters"
        )
        .optional()
        .nullable(),
});

const StoreTypeList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const {
        data,
        loading,
        error,
        totalPages,
    } = useAppSelector(state => state.storeTypes);


    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<StoreType | null>(null);

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
        const delayDebounce = setTimeout(() => {
            dispatch(
                fetchStoreTypes({
                    search: searchTerm,
                    page: currentPage,
                    limit: ITEMS_PER_PAGE,
                    sortBy: "code",
                    sortOrder: "asc",
                })
            );
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [dispatch, searchTerm, currentPage]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenView = useCallback((item: StoreType) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = async () => {
        setEditMode(false);
        setErrors({});
        
        let nextCode = "";
        try {
            nextCode = await storeTypeService.fetchNextId();
        } catch (err) {
            console.error("Failed to fetch next store type code:", err);
        }
        
        setFormData({ ...initialFormState, code: nextCode });
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((item: StoreType) => {
        setEditMode(true);
        setErrors({});
        setFormData({
            id: item.id,
            code: item.code,
            name: item.name,
            description: item.description || "",
            isActive: item.isActive,
        });
        setShowFormModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            setIsDeleting(true);
            try {
                await dispatch(deleteStoreType(itemToDelete)).unwrap();
                toast.success("Store Type deleted successfully!");
            } catch (err: any) {
                const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to delete store type";
                toast.error(errorMessage);
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target;
        const { name, value } = target;
        const type = (target as any).type;

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
            code: prev.code
        }));
        setErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            storeTypeSchema.parse(formData);
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
            if (editMode) {
                await dispatch(updateStoreType({ id: formData.id, data: formData })).unwrap();
                toast.success("Store Type updated successfully!");
            } else {
                await dispatch(createStoreType(formData)).unwrap();
                toast.success("Store Type created successfully!");
            }
            setShowFormModal(false);
        } catch (err: any) {
            const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to save store type";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    return (
        <div>
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Store Type Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search types..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <CustomButton
                                text="Add Type"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="p-0">
                        <DataTable
                            data={data}
                            rowKey={(item) => item.id}
                            emptyMessage="No store types found."
                            loading={loading}
                            pagination={
                                totalPages > 1
                                    ? {
                                        currentPage,
                                        totalPages,
                                        onPageChange: setCurrentPage,
                                    }
                                    : undefined
                            }
                            columns={[
                                { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
                                { header: "CODE", accessor: "code" },
                                { header: "NAME", accessor: "name" },
                                { header: "DESCRIPTION", render: (item) => item.description || "N/A" },
                                {
                                    header: "STATUS", render: (item) => (
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${item.isActive
                                            ? "bg-green-100 text-green-700 border border-green-200"
                                            : "bg-red-100 text-red-700 border border-red-200"
                                            }`}>
                                            {item.isActive ? "ACTIVE" : "INACTIVE"}
                                        </span>
                                    )
                                },
                                {
                                    header: "ACTIONS",
                                    render: (item) => (
                                        <div className="flex items-center gap-2">
                                            <ViewButton onClick={() => handleOpenView(item)} />
                                            <EditButton onClick={() => handleOpenEdit(item)} />
                                            <DeleteButton onClick={() => triggerDelete(item.id)} />
                                        </div>
                                    ),
                                    align: "left"
                                },
                            ]}
                        />
                    </div>
                </div>
                
                {/* Form Modal (Add / Edit) */}
                <CommonModal
                    show={showFormModal}
                    onHide={() => setShowFormModal(false)}
                    title={editMode ? "Edit Store Type" : "Add New Store Type"}

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
                                text={editMode ? "Update Type" : "Save Type"}
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
                                label="Store Type Code"
                                name="code"
                                value={formData.code}
                                placeholder="e.g. ST001"
                                required
                                onChange={handleChange}
                                disabled
                                error={errors.code}
                            />
                            <TextInput
                                label="Store Type Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Raw Material Store"
                                required
                                onChange={handleChange}
                                error={errors.name}
                            />
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description || ""}
                                placeholder="Enter description..."
                                onChange={handleChange}
                                error={errors.description}
                            />
                            <SelectInput
                                label="Status"
                                name="isActive"
                                value={formData.isActive.toString()}
                                options={[
                                    { label: "Active", value: "true" },
                                    { label: "Inactive", value: "false" }
                                ]}
                                required
                                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === "true" }))}
                            />
                        </div>
                    </form>
                </CommonModal>

                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Store Type Details"
                    avatarText={selectedItem ? selectedItem.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.name : ""}
                    headerSubtitle={selectedItem ? `Code: ${selectedItem.code}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Code", value: selectedItem.code },
                                { label: "Name", value: selectedItem.name },
                                { label: "Description", value: selectedItem.description || "N/A", xs: 12 },
                            ]
                        },
                        {
                            title: "Status",
                            fields: [
                                { label: "Status", value: selectedItem.isActive ? "Active" : "Inactive" },
                            ]
                        }
                    ] : []}
                />

                <CommonConfirmModal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this store type?"
                    confirmText={isDeleting ? "Deleting..." : "Delete"}
                    cancelText="Cancel"
                    isDangerous={true}
                    isLoading={isDeleting}
                />
            </div>
        </div>
    );
};

export default StoreTypeList;
