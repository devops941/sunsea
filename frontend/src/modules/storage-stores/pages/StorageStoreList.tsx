import React, { useState, useCallback, useEffect } from "react";
import { FaSearch, FaPlus, FaSave, FaEraser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchStores, deleteStore, createStore, updateStore } from "../../../features/stores/storeSlice";
import { fetchLocations } from "../../../features/locations/locationSlice";
import { fetchEmployees } from "../../../features/employee/employeeSlice";
import { storeService } from "../../../services/storeService";
import type { Store } from "../../../features/stores/types";
import { STORE_CATEGORY_OPTIONS, STORE_CATEGORY_LABELS } from "../../../features/stores/types";
import { useRoles } from "../../../hooks/useRoles";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import DataTable from "../../../components/ui/table/DataTable";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 10;



const initialFormState = {
    storeId: "",
    storeName: "",
    storeCategory: "",
    locationId: "",
    inchargeId: "",
    gstPlace: "",
    isActive: true,
};

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

    storeCategory: z
        .string()
        .trim()
        .min(1, "Store Category is required"),

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

const StorageStoreList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { can } = usePermission();

    const { data, loading, error, totalPages } = useAppSelector(state => state.stores);

    // For form dependencies
    const { data: locations } = useAppSelector(state => state.locations);
    const { employees } = useAppSelector((state: any) => state.employees || { employees: [] });
    const { roles, loadRoles } = useRoles();

    useEffect(() => { if (error) toast.error(error); }, [error]);
    const [storeCategoryFilter, setStoreCategoryFilter] = useState("");
    const storeCategoryFilterOptions = [
        { label: "All Categories", value: "" },
        ...STORE_CATEGORY_OPTIONS,
    ];
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Store | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Form Modal State
    const [showFormModal, setShowFormModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedRoleId, setSelectedRoleId] = useState("");

    // Initial loading for list and dependencies
    useEffect(() => {
        if (can("locations.view")) dispatch(fetchLocations(undefined));
        if (can("employees.view")) dispatch(fetchEmployees(undefined));
        if (can("roles.view")) loadRoles();
    }, [dispatch, loadRoles, can]);

    const fetchStoreData = useCallback(() => {
        if (can("stores.view")) {
            dispatch(
                fetchStores({
                    search: searchTerm,
                    storeCategory: storeCategoryFilter,
                    page: currentPage,
                    limit: ITEMS_PER_PAGE,
                    sortBy: "storeId",
                    sortOrder: "asc",
                })
            );
        }
    }, [dispatch, searchTerm, storeCategoryFilter, currentPage, can]);

    useSocketSync("store", undefined, fetchStoreData);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchStoreData();
        }, 300);

        return () => clearTimeout(timer);
    }, [fetchStoreData]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = data;

    const handleOpenView = useCallback((item: Store) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = async () => {
        setEditMode(false);
        setErrors({});
        setSelectedRoleId("");

        let nextId = "";
        try {
            nextId = await storeService.fetchNextId();
        } catch (err) {
            console.error("Failed to fetch next store ID", err);
        }

        setFormData({ ...initialFormState, storeId: nextId });
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((item: Store) => {
        setEditMode(true);
        setErrors({});
        setSelectedRoleId("");

        setFormData({
            storeId: item.storeId,
            storeName: item.storeName || "",
            storeCategory: item.storeCategory || "",
            locationId: item.locationId || "",
            inchargeId: item.inchargeId ? item.inchargeId.toString() : "",
            gstPlace: item.gstPlace || "",
            isActive: item.isActive,
        });
        setShowFormModal(true);
    }, []);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            setIsDeleting(true);
            try {
                await dispatch(deleteStore(itemToDelete)).unwrap();
                toast.success("Store deleted successfully!");
            } catch (err: any) {
                const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to delete store";
                toast.error(errorMessage);
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target;
        const { name, value } = target;
        const type = (target as any).type;

        const checked =
            type === "checkbox"
                ? (target as HTMLInputElement).checked
                : undefined;

        setFormData(prev => {
            const updated = {
                ...prev,
                [name]: type === "checkbox" ? checked : value
            };
            return updated;
        });

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleClear = () => {
        setFormData(prev => ({
            ...initialFormState,
            storeId: prev.storeId
        }));
        setSelectedRoleId("");
        setErrors({});
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
                    if (message) formattedErrors[key] = message;
                });
                setErrors(formattedErrors);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                storeId: formData.storeId,
                storeName: formData.storeName,
                storeCategory: formData.storeCategory || undefined,
                locationId: formData.locationId || undefined,
                inchargeId: formData.inchargeId || undefined,
                gstPlace: formData.gstPlace || undefined,
                isActive: formData.isActive
            };

            if (editMode) {
                await dispatch(updateStore({ id: formData.storeId, data: payload as any })).unwrap();
                toast.success("Store updated successfully!");
            } else {
                await dispatch(createStore(payload as any)).unwrap();
                toast.success("Store created successfully!");
            }
            setShowFormModal(false);
        } catch (err: any) {
            const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to save store";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Storage Store Management</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="w-48">
                                <SelectInput
                                    label="Store Category"
                                    hideLabel={true}
                                    name="storeCategoryFilter"
                                    value={storeCategoryFilter}
                                    options={storeCategoryFilterOptions}
                                    onChange={(e) => {
                                        setStoreCategoryFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search stores..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            {can("stores.create") && (
                                <CustomButton
                                    text="Add Store"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="p-0">
                        <DataTable
                            data={paginatedData}
                            rowKey={(item) => item.storeId}
                            emptyMessage="No stores found."
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
                                { header: "STORE ID", accessor: "storeId" },
                                { header: "STORE NAME", accessor: "storeName" },
                                { header: "CATEGORY", render: (item) => item.storeCategory ? STORE_CATEGORY_LABELS[item.storeCategory] : "N/A" },
                                { header: "LOCATION", render: (item) => (item as any).location?.locationName || "N/A" },
                                { header: "INCHARGE", render: (item) => item.incharge?.fullName || "N/A" },
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
                                            {can("stores.edit") && <EditButton onClick={() => handleOpenEdit(item)} />}
                                            {can("stores.delete") && <DeleteButton onClick={() => triggerDelete(item.storeId)} />}
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
                    title={editMode ? "Edit Storage Store" : "Add New Storage Store"}
                    maxWidth="3xl"
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
                                text={editMode ? "Update Store" : "Save Store"}
                                icon={FaSave}
                                variant="primary"
                                disabled={isSubmitting}
                                onClick={handleSubmit}
                            />
                        </div>
                    }
                >
                    <form onSubmit={handleSubmit} className="space-y-4 p-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
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
                                error={errors.storeName}
                                onChange={handleChange}
                            />

                            <SelectInput
                                label="Store Category"
                                name="storeCategory"
                                value={formData.storeCategory}
                                options={[
                                    { label: "Select a category", value: "" },
                                    ...STORE_CATEGORY_OPTIONS
                                ]}
                                required
                                error={errors.storeCategory}
                                onChange={handleChange}
                            />

                            <SelectInput
                                label="Location"
                                name="locationId"
                                value={formData.locationId}
                                options={[
                                    { label: "Select a location", value: "" },
                                    ...locations.filter(loc => loc.isActive).map(loc => ({
                                        label: `${loc.locationName} (${loc.locationCode})`,
                                        value: loc.locationId
                                    }))
                                ]}
                                required
                                error={errors.locationId}
                                onChange={handleChange}
                            />

                            <SelectInput
                                label="Filter Incharge by Role"
                                name="selectedRoleId"
                                value={selectedRoleId}
                                options={[
                                    { label: "Select a role", value: "" },
                                    ...(roles || []).map(r => ({ label: r.name, value: String(r.id) }))
                                ]}
                                onChange={(e) => {
                                    setSelectedRoleId(e.target.value);
                                    setFormData(prev => ({ ...prev, inchargeId: "" }));
                                }}
                            />

                            <SelectInput
                                label="Store Incharge"
                                name="inchargeId"
                                value={formData.inchargeId}
                                options={[
                                    { label: "Select an incharge", value: "" },
                                    ...(employees || [])
                                        .filter((emp: any) => !selectedRoleId || String(emp.user?.roleId) === selectedRoleId)
                                        .map((emp: any) => ({
                                            label: `${emp.fullName} (${emp.empCode})`,
                                            value: emp.id?.toString() || ""
                                        }))
                                ]}
                                required
                                error={errors.inchargeId}
                                onChange={handleChange}
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

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Storage Store Details"
                    avatarText={selectedItem ? selectedItem.storeName?.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.storeName : ""}
                    headerSubtitle={selectedItem ? `ID: ${selectedItem.storeId}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Store ID", value: selectedItem.storeId },
                                { label: "Store Name", value: selectedItem.storeName },
                                { label: "Store Category", value: selectedItem.storeCategory ? STORE_CATEGORY_LABELS[selectedItem.storeCategory] : "N/A" },
                                { label: "Location", value: (selectedItem as any).location?.locationName || "N/A" },
                                { label: "Incharge", value: selectedItem.incharge?.fullName || "N/A" },
                                { label: "Cost Method", value: selectedItem.costMethod || "N/A" },
                            ]
                        },
                        {
                            title: "Status Information",
                            fields: [
                                { label: "Status", value: selectedItem.status },
                                { label: "Active", value: selectedItem.isActive ? "Yes" : "No" },
                                { label: "GST Place", value: selectedItem.gstPlace || "N/A" },
                            ]
                        }
                    ] : []}
                />

                {/* Delete Modal */}
                <CommonConfirmModal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this store?"
                    confirmText={isDeleting ? "Deleting..." : "Delete"}
                    cancelText="Cancel"
                    isDangerous={true}
                    isLoading={isDeleting}
                />
            </div>
        </div>
    );
};

export default StorageStoreList;
