import React, { useState, useCallback, useEffect, useRef } from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchStores, deleteStore } from "../../../features/stores/storeSlice";
import type { Store } from "../../../features/stores/types";
import { STORE_CATEGORY_OPTIONS, STORE_CATEGORY_LABELS } from "../../../features/stores/types";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import DataTable from "../../../components/ui/table/DataTable";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 10;

const storeCategoryFilterOptions = [
    { label: "All Categories", value: "" },
    ...STORE_CATEGORY_OPTIONS,
];

const activeFilterOptions = [
    { label: "All Status", value: "" },
    { label: "Active", value: "true" },
    { label: "Inactive", value: "false" },
];

const StorageStoreList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { can } = usePermission();

    const { data, loading, error, totalPages, total } = useAppSelector(state => state.stores);

    const [storeCategoryFilter, setStoreCategoryFilter] = useState("");
    const [activeFilter, setActiveFilter] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Store | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    // Debounce search — 300 ms
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchTerm]);

    const fetchStoreData = useCallback(() => {
        if (can("stores.view")) {
            dispatch(
                fetchStores({
                    search: debouncedSearch || undefined,
                    storeCategory: storeCategoryFilter || undefined,
                    isActive: activeFilter !== "" ? activeFilter === "true" : undefined,
                    page: currentPage,
                    limit: ITEMS_PER_PAGE,
                    sortBy: "createdAt",
                    sortOrder: "asc",
                })
            );
        }
    }, [dispatch, debouncedSearch, storeCategoryFilter, activeFilter, currentPage, can]);

    useEffect(() => {
        fetchStoreData();
    }, [fetchStoreData]);

    useSocketSync("store", undefined, fetchStoreData);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleCategoryFilter = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setStoreCategoryFilter(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleActiveFilter = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setActiveFilter(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleOpenView = useCallback((item: Store) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenEdit = useCallback((item: Store) => {
        navigate(`/storage-stores/edit/${item.storeId}`);
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await dispatch(deleteStore(itemToDelete)).unwrap();
                toast.success("Store deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete store");
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    return (
        <div>
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Storage Store Management</h2>
                        <p className="text-sm text-ink-subtle mt-1">Manage warehouse and storage locations</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="w-48">
                            <SelectInput
                                label="Store Category"
                                hideLabel={true}
                                name="storeCategoryFilter"
                                value={storeCategoryFilter}
                                options={storeCategoryFilterOptions}
                                onChange={handleCategoryFilter}
                            />
                        </div>
                        <div className="w-36">
                            <SelectInput
                                label="Status Filter"
                                hideLabel={true}
                                name="activeFilter"
                                value={activeFilter}
                                options={activeFilterOptions}
                                onChange={handleActiveFilter}
                            />
                        </div>
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search stores..."
                        />
                        {can("stores.create") && (
                            <CustomButton
                                text="Add Store"
                                icon={FaPlus}
                                onClick={() => navigate("/storage-stores/create")}
                            />
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="p-0">
                    <DataTable
                        data={data}
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
                            {
                                header: "#",
                                width: "60px",
                                render: (_item, index) =>
                                    (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                                align: "center",
                            },
                            { header: "STORE ID", accessor: "storeId" },
                            { header: "STORE NAME", accessor: "storeName" },
                            {
                                header: "CATEGORY",
                                render: (item) =>
                                    item.storeCategory
                                        ? STORE_CATEGORY_LABELS[item.storeCategory] ?? item.storeCategory
                                        : "N/A",
                            },
                            {
                                header: "INCHARGE",
                                render: (item) => item.incharge?.fullName || "N/A",
                            },
                            {
                                header: "STATUS",
                                render: (item) => (
                                    <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                                ),
                                align: "center",
                            },
                            {
                                header: "ACTIONS",
                                render: (item) => (
                                    <div className="flex items-center gap-2">
                                        <ViewButton onClick={() => handleOpenView(item)} />
                                        {can("stores.edit") && (
                                            <EditButton onClick={() => handleOpenEdit(item)} />
                                        )}
                                        {can("stores.delete") && (
                                            <DeleteButton onClick={() => triggerDelete(item.storeId)} />
                                        )}
                                    </div>
                                ),
                                align: "center",
                            },
                        ]}
                    />
                    <div className="px-4 pb-2 text-xs text-ink-subtle text-right">
                        Total: {total} record(s)
                    </div>
                </div>
            </div>

            {/* View Modal */}
            <CommonViewModal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
                modalTitle="Storage Store Details"
                avatarText={selectedItem ? selectedItem.storeName?.charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? selectedItem.storeName : ""}
                headerSubtitle={selectedItem ? `ID: ${selectedItem.storeId}` : ""}
                sections={
                    selectedItem
                        ? [
                            {
                                fields: [
                                    { label: "Store ID", value: selectedItem.storeId },
                                    { label: "Store Name", value: selectedItem.storeName },
                                    {
                                        label: "Store Category",
                                        value: selectedItem.storeCategory
                                            ? STORE_CATEGORY_LABELS[selectedItem.storeCategory] ?? selectedItem.storeCategory
                                            : "N/A",
                                    },
                                    {
                                        label: "Incharge",
                                        value: selectedItem.incharge?.fullName || "N/A",
                                    },
                                    {
                                        label: "Location Address",
                                        value: (() => {
                                            if (!selectedItem.locationDesc) return "N/A";
                                            try {
                                                const p = JSON.parse(selectedItem.locationDesc);
                                                if (typeof p === "object" && p !== null) {
                                                    return (
                                                        p.formatted ||
                                                        [p.addressLine, p.city, p.state, p.country, p.zipcode]
                                                            .filter(Boolean)
                                                            .join(", ")
                                                    );
                                                }
                                            } catch {
                                                return selectedItem.locationDesc;
                                            }
                                            return selectedItem.locationDesc;
                                        })(),
                                    },
                                    { label: "Cost Method", value: selectedItem.costMethod || "N/A" },
                                ],
                            },
                            {
                                title: "Status Information",
                                fields: [
                                    {
                                        label: "Status",
                                        value: selectedItem.isActive ? "Active" : "Inactive",
                                    },
                                    { label: "GST Place", value: selectedItem.gstPlace || "N/A" },
                                    {
                                        label: "Created At",
                                        value: selectedItem.createdAt
                                            ? new Date(selectedItem.createdAt).toLocaleDateString()
                                            : "N/A",
                                    },
                                ],
                            },
                        ]
                        : []
                }
            />

            {/* Delete Confirm Modal */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message="Are you sure you want to delete this store? This action cannot be undone."
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                confirmVariant="danger"
                isDangerous={true}
            />
        </div>
    );
};

export default StorageStoreList;
