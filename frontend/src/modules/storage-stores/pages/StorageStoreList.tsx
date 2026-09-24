import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { FaPlus, FaTimes, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

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
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { storeService } from "../../../services/storeService";
import { usePermission } from "../../../hooks/usePermission";
import { useListCache } from "../../../hooks/useListCache";

const ITEMS_PER_PAGE = 15;

type SortOrder = "default" | "asc" | "desc";
const STORE_SORT_KEY = "sunsea_store_sort_name";

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
    const { can } = usePermission();

    const [storeCategoryFilter, setStoreCategoryFilter] = useState("");
    const [activeFilter, setActiveFilter] = useState("");
    const [draftStoreCategoryFilter, setDraftStoreCategoryFilter] = useState("");
    const [draftActiveFilter, setDraftActiveFilter] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Store | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
        try {
            const saved = localStorage.getItem(STORE_SORT_KEY);
            if (saved === "asc" || saved === "desc") return saved;
        } catch (_) {}
        return "default";
    });

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prev) => {
            const next: SortOrder = prev === "default" ? "asc" : prev === "asc" ? "desc" : "default";
            try { localStorage.setItem(STORE_SORT_KEY, next); } catch (_) {}
            return next;
        });
        setCurrentPage(1);
    }, []);

    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const activeFilterCount = [
        storeCategoryFilter !== "",
        activeFilter !== "",
    ].filter(Boolean).length;

    const hasActiveFilters = activeFilterCount > 0;

    const handleApplyFilters = useCallback(() => {
        setStoreCategoryFilter(draftStoreCategoryFilter);
        setActiveFilter(draftActiveFilter);
        setCurrentPage(1);
    }, [draftStoreCategoryFilter, draftActiveFilter]);

    const handleClearFilters = useCallback(() => {
        setDraftStoreCategoryFilter("");
        setDraftActiveFilter("");
        setStoreCategoryFilter("");
        setActiveFilter("");
        setCurrentPage(1);
    }, []);

    usePageShortcuts({
        onRefresh: () => refresh(),
        onDelete: () => setShowDeleteModal(true),
        onNew: () => can("stores.create") && navigate("/storage-stores/create"),
        onSort: () => toggleSortOrder(),
    });

    const cacheKey = `stores:list:${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}:${storeCategoryFilter}:${activeFilter}:${sortOrder}`;

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const res = await storeService.fetchAll({
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            search: debouncedSearch || undefined,
            storeCategory: storeCategoryFilter || undefined,
            isActive: activeFilter !== "" ? activeFilter === "true" : undefined,
            sortBy: sortOrder !== "default" ? "storeName" : undefined,
            sortOrder: sortOrder !== "default" ? sortOrder : undefined,
        });
        const list = Array.isArray(res) ? res : (res?.stores || res?.data || []);
        const total = Array.isArray(res) ? res.length : (res?.total ?? list.length);
        return { data: list, total };
    }, [currentPage, debouncedSearch, storeCategoryFilter, activeFilter, sortOrder]);

    const { data: stores, total, loading, refresh } = useListCache<any>({
        cacheKey,
        socketModule: "store",
        fetcher,
    });

    const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE);
    const paginatedStores = stores;

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);


    const handleOpenView = useCallback((item: Store) => {
        setSelectedItem(item);
        setShowViewModal(true);
        setTimeout(() => tableRef.current?.focus(), 50);
    }, []);

    const handleOpenEdit = useCallback((item: Store) => {
        navigate(`/storage-stores/edit/${item.storeId}`);
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const tableRef = useRef<HTMLDivElement>(null);

    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: paginatedStores.length,
        onEnter: (i) => { const item = paginatedStores[i]; if (item) handleOpenView(item); },
        containerRef: tableRef,
    });

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await storeService.delete(itemToDelete);
                toast.success("Store deleted successfully!");
                refresh();
            } catch (err: any) {
                toast.error(err || "Failed to delete store");
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const fetchStoresForExport = useCallback(async () => {
        const res = await storeService.fetchAll({
            limit: 100000,
            search: debouncedSearch || undefined,
            storeCategory: storeCategoryFilter || undefined,
            isActive: activeFilter !== "" ? activeFilter === "true" : undefined,
            sortBy: sortOrder !== "default" ? "storeName" : undefined,
            sortOrder: sortOrder !== "default" ? sortOrder : undefined,
        });
        return Array.isArray(res) ? res : (res?.stores || res?.data || []);
    }, [debouncedSearch, storeCategoryFilter, activeFilter, sortOrder]);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Store ID", accessor: (item: any) => item.storeId },
            { header: "Store Name", accessor: (item: any) => item.storeName },
            {
                header: "Category",
                accessor: (item: any) =>
                    item.storeCategory
                        ? (STORE_CATEGORY_LABELS as any)[item.storeCategory] ?? item.storeCategory
                        : "N/A",
            },
            { header: "Incharge", accessor: (item: any) => item.incharge?.fullName || "N/A" },
            { header: "Location", accessor: (item: any) => item.location || "N/A" },
            { header: "Status", accessor: (item: any) => (item.isActive ? "ACTIVE" : "INACTIVE") },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Storage_Store_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    return (
        <div>
            <div className="max-w-[1200px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
                            Store Management
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-xs dark:bg-slate-800/90 dark:text-slate-200 dark:border dark:border-slate-700/60">
                                {total ?? stores.length}
                            </span>
                        </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search stores..."
                        />

                        {/* Filter Popover */}
                        <FilterPopover
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            onOpen={() => {
                                setDraftStoreCategoryFilter(storeCategoryFilter);
                                setDraftActiveFilter(activeFilter);
                            }}
                            onApply={handleApplyFilters}
                            onClear={handleClearFilters}
                        >
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Store Category
                                    </label>
                                    <SelectInput
                                        name="storeCategoryFilter"
                                        value={draftStoreCategoryFilter}
                                        onChange={(e) => setDraftStoreCategoryFilter(e.target.value)}
                                        options={storeCategoryFilterOptions}
                                        noMargin
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Status
                                    </label>
                                    <SelectInput
                                        name="activeFilter"
                                        value={draftActiveFilter}
                                        onChange={(e) => setDraftActiveFilter(e.target.value)}
                                        options={activeFilterOptions}
                                        noMargin
                                    />
                                </div>
                            </div>
                        </FilterPopover>

                        {can("stores.export") && (
                            <ExportCSVButton
                                fetchData={fetchStoresForExport}
                                columns={csvColumns}
                                filename={csvFilename}
                                text="Export"
                            />
                        )}
                        {can("stores.create") && (
                            <CustomButton
                                text="Add Store"
                                icon={FaPlus}
                                onClick={() => navigate("/storage-stores/create")}
                            />
                        )}
                    </div>
                </div>

                {/* Active filter chips */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2 px-6 py-2.5 border-b border-line flex-wrap">
                        <span className="text-xs text-ink-subtle">Active filters:</span>

                        {storeCategoryFilter && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                Category: {(STORE_CATEGORY_LABELS as any)[storeCategoryFilter] || storeCategoryFilter}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setStoreCategoryFilter(""); setDraftStoreCategoryFilter(""); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {activeFilter !== "" && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                Status: {activeFilter === "true" ? "Active" : "Inactive"}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setActiveFilter(""); setDraftActiveFilter(""); setCurrentPage(1); }}
                                />
                            </span>
                        )}
                    </div>
                )}

                {/* Table */}
                <div ref={tableRef} tabIndex={0} data-table-nav className="p-0 outline-none">
                    <DataTable
                        data={paginatedStores}
                        rowKey={(item) => item.storeId}
                        emptyMessage="No stores found."
                        loading={loading}
                        rowClassName={(_, i) => i === focusedIndex ? "bg-primary/8" : ""}
                        onRowClick={(item, i) => { setFocusedIndex(i); handleOpenView(item); }}
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
                            {
                                header: "STORE NAME",
                                headerNode: (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleSortOrder(); }}
                                        title={`Sort Alphabetically (F6) — ${sortOrder === "default" ? "Default" : sortOrder === "asc" ? "A to Z" : "Z to A"}`}
                                        className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-[1.5px] outline-none hover:opacity-90 transition-opacity"
                                    >
                                        <span className={sortOrder !== "default" ? "text-primary font-black" : "group-hover/sort:text-ink transition-colors"}>STORE NAME</span>
                                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded transition-all duration-200 ${sortOrder === "asc" || sortOrder === "desc" ? "bg-primary/20 text-primary scale-110" : "text-ink-subtle/60 group-hover/sort:text-ink group-hover/sort:bg-card-2"}`}>
                                            {sortOrder === "asc" ? <FaArrowUp size={10} /> : sortOrder === "desc" ? <FaArrowDown size={10} /> : <FaSort size={10} />}
                                        </span>
                                        {sortOrder !== "default" && (
                                            <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-primary text-white tracking-tighter shadow-xs">
                                                {sortOrder === "asc" ? "A-Z" : "Z-A"}
                                            </span>
                                        )}
                                    </button>
                                ),
                                accessor: "storeName",
                            },
                            {
                                header: "CATEGORY",
                                render: (item) =>
                                    item.storeCategory
                                        ? (STORE_CATEGORY_LABELS as any)[item.storeCategory] ?? item.storeCategory
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
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                                ],
                            },
                            {
                                title: "Status Information",
                                fields: [
                                    {
                                        label: "Status",
                                        value: selectedItem.isActive ? "Active" : "Inactive",
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
