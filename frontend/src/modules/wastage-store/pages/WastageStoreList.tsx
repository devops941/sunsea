import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchRawMaterials, deleteRawMaterial, rawMaterialCreated, rawMaterialUpdated, rawMaterialDeleted } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import type { RawMaterial } from "../../../features/raw-materials/types";
import { usePermission } from "../../../hooks/usePermission";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import { formatStockQty, parseBaseUom } from "../../../utils/uomConversion";

const ITEMS_PER_PAGE = 10;

const WastageStoreList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const { data, loading, error, totalPages, total } = useAppSelector((state) => state.rawMaterials);
    const { data: stores } = useAppSelector((state) => state.stores);
    const { can } = usePermission();

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [storeFilter, setStoreFilter] = useState("");
    const [activeFilter, setActiveFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<RawMaterial | null>(null);

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

    // Fetch WASTAGE stores for filter dropdown
    const fetchWastageStoresData = useCallback(() => {
        if (can("wastage-store.view")) {
            dispatch(fetchStores({ storeCategory: "WASTAGE" }));
        }
    }, [dispatch, can]);

    useEffect(() => {
        fetchWastageStoresData();
    }, [fetchWastageStoresData]);

    // Server-side data load with all active filters
    const loadData = useCallback(() => {
        if (can("wastage-store.view")) {
            dispatch(
                fetchRawMaterials({
                    search: debouncedSearch || undefined,
                    storeId: storeFilter || undefined,
                    isActive: activeFilter !== "" ? activeFilter === "true" : undefined,
                    itemType: "WASTAGE",
                    page: currentPage,
                    limit: ITEMS_PER_PAGE,
                })
            );
        }
    }, [dispatch, can, debouncedSearch, storeFilter, activeFilter, currentPage]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Real-time socket sync — in-place Redux state updates
    useSocketSync<RawMaterial>("rawMaterial", {
        created: rawMaterialCreated,
        updated: rawMaterialUpdated,
        deleted: rawMaterialDeleted,
    });

    // Keep store dropdown fresh when stores change in another tab
    useSocketSync("store", undefined, fetchWastageStoresData);

    const storeOptions = useMemo(
        () => [
            { label: "All Stores", value: "" },
            ...(stores || []).map((s: any) => ({ label: s.storeName, value: s.storeId })),
        ],
        [stores]
    );

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleStoreFilter = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setStoreFilter(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleActiveFilter = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setActiveFilter(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleOpenView = useCallback((item: RawMaterial) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = useCallback(() => {
        navigate("/wastage-store/create");
    }, [navigate]);

    const handleOpenEdit = useCallback((item: RawMaterial) => {
        navigate(`/wastage-store/edit/${item.rawMaterialId}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await dispatch(deleteRawMaterial(itemToDelete)).unwrap();
                toast.success("Wastage product deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete wastage product");
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const columns: DataTableColumn<RawMaterial>[] = [
        {
            header: "#",
            width: "60px",
            align: "center",
            render: (_, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
        },
        {
            header: "NAME",
            render: (item) => (
                <div>
                    <div className="font-semibold text-ink">{item.materialName}</div>
                    <span className="text-xs text-ink-subtle">ID: {item.rawMaterialId}</span>
                </div>
            ),
        },
        { header: "CATEGORY", render: (item) => item.category?.name || "-" },
        { header: "STORE", render: (item) => item.store?.storeName || item.storeId || "-" },
        {
            header: "PHYSICAL STOCK",
            render: (item) => formatStockQty(item.onHandQty, item.baseUom),
        },
        {
            header: "STATUS",
            align: "center",
            render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />,
        },
        {
            header: "ACTIONS",
            align: "center",
            render: (item) => (
                <div className="flex items-center gap-2">
                    <ViewButton onClick={() => handleOpenView(item)} />
                    {can("wastage-store.edit") && (
                        <EditButton onClick={() => handleOpenEdit(item)} />
                    )}
                    {can("wastage-store.delete") && (
                        <DeleteButton onClick={() => triggerDelete(item.rawMaterialId)} />
                    )}
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="max-w-[1600px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Wastage Products Management</h2>
                        <p className="text-sm text-ink-subtle mt-1">
                            Manage wastage product master records and stock levels
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="w-44">
                            <SelectInput
                                label="Store Filter"
                                hideLabel
                                name="storeFilter"
                                value={storeFilter}
                                options={storeOptions}
                                onChange={handleStoreFilter}
                            />
                        </div>
                        <div className="w-36">
                            <SelectInput
                                label="Status Filter"
                                hideLabel
                                name="activeFilter"
                                value={activeFilter}
                                options={[
                                    { label: "All Status", value: "" },
                                    { label: "Active", value: "true" },
                                    { label: "Inactive", value: "false" },
                                ]}
                                onChange={handleActiveFilter}
                            />
                        </div>
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search products..."
                        />
                        {can("wastage-store.create") && (
                            <CustomButton
                                text="Add Wastage Product"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        )}
                    </div>
                </div>

                {/* Data Table */}
                <DataTable
                    columns={columns}
                    data={data}
                    rowKey={(row) => row.rawMaterialId}
                    loading={loading}
                    emptyMessage="No wastage products found."
                    pagination={
                        totalPages > 1
                            ? { currentPage, totalPages, onPageChange: setCurrentPage }
                            : undefined
                    }
                />
                <div className="px-4 pb-2 text-xs text-ink-subtle text-right">
                    Total: {total} record(s)
                </div>
            </div>

            {/* View Modal */}
            <CommonViewModal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
                modalTitle="Wastage Product Details"
                avatarText={selectedItem ? selectedItem.materialName.charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? selectedItem.materialName : ""}
                headerSubtitle={selectedItem ? `ID: ${selectedItem.rawMaterialId}` : ""}
                sections={
                    selectedItem
                        ? [
                            {
                                fields: [
                                    { label: "Wastage ID", value: selectedItem.rawMaterialId },
                                    { label: "Material Name", value: selectedItem.materialName },
                                    { label: "Category", value: selectedItem.category?.name || "N/A" },
                                    { label: "Primary UOM", value: parseBaseUom(selectedItem.baseUom).primary },
                                    { label: "Secondary UOM(s)", value: parseBaseUom(selectedItem.baseUom).secondary },
                                    { label: "Store", value: selectedItem.store?.storeName || selectedItem.storeId || "N/A" },
                                    { label: "Physical Stock", value: formatStockQty(selectedItem.onHandQty, selectedItem.baseUom) },
                                    { label: "Status", value: selectedItem.isActive ? "Active" : "Inactive" },
                                    { label: "Narration", value: selectedItem.narration || selectedItem.remarks || "N/A" },
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
                message="Are you sure you want to delete this wastage product? This action cannot be undone."
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                confirmVariant="danger"
                isDangerous={true}
            />
        </div>
    );
};

export default WastageStoreList;
