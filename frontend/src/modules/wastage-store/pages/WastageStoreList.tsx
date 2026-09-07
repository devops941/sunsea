import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { FaPlus, FaTimes, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import type { RawMaterial } from "../../../features/raw-materials/types";
import { usePermission } from "../../../hooks/usePermission";
import { useListCache } from "../../../hooks/useListCache";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { storeService } from "../../../services/storeService";

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
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { formatStockQty, parseBaseUom } from "../../../utils/uomConversion";

const ITEMS_PER_PAGE = 15;

type SortOrder = "default" | "asc" | "desc";
const WASTAGE_SORT_KEY = "sunsea_wastage_sort_name";

const WastageStoreList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();

    const [searchTerm, setSearchTerm] = useState("");
    const [storeFilter, setStoreFilter] = useState("");
    const [activeFilter, setActiveFilter] = useState("");
    const [draftStoreFilter, setDraftStoreFilter] = useState("");
    const [draftActiveFilter, setDraftActiveFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<RawMaterial | null>(null);

    const [stores, setStores] = useState<any[]>([]);

    const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
        try {
            const saved = localStorage.getItem(WASTAGE_SORT_KEY);
            if (saved === "asc" || saved === "desc") return saved;
        } catch (_) {}
        return "default";
    });

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prev) => {
            const next: SortOrder = prev === "default" ? "asc" : prev === "asc" ? "desc" : "default";
            try { localStorage.setItem(WASTAGE_SORT_KEY, next); } catch (_) {}
            return next;
        });
    }, []);

    const activeFilterCount = [
        storeFilter !== "",
        activeFilter !== "",
    ].filter(Boolean).length;

    const hasActiveFilters = activeFilterCount > 0;

    const handleApplyFilters = useCallback(() => {
        setStoreFilter(draftStoreFilter);
        setActiveFilter(draftActiveFilter);
        setCurrentPage(1);
    }, [draftStoreFilter, draftActiveFilter]);

    const handleClearFilters = useCallback(() => {
        setDraftStoreFilter("");
        setDraftActiveFilter("");
        setStoreFilter("");
        setActiveFilter("");
        setCurrentPage(1);
    }, []);

    // Fetch WASTAGE stores for filter dropdown
    useEffect(() => {
        storeService.fetchAll({ storeCategory: "WASTAGE" }).then((res: any) => {
            const list = Array.isArray(res) ? res : (res?.stores || res?.data || []);
            setStores(list);
        }).catch(() => {});
    }, []);

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const res = await rawMaterialService.fetchAll({ itemType: "WASTAGE", limit: 10000 });
        const list = Array.isArray(res) ? res : (res?.rawMaterials || res?.data || []);
        return { data: list, total: list.length };
    }, []);

    const { data: allWastageItems, loading, refresh } = useListCache<any>({
        cacheKey: "wastageStore:list",
        socketModule: "rawMaterial",
        fetcher,
    });

    usePageShortcuts({
        onRefresh: () => refresh(),
        onDelete: () => setShowDeleteModal(true),
        onNew: () => can("wastage-store.create") && navigate("/wastage-store/create"),
        onSort: () => toggleSortOrder(),
    });

    const filteredData = useMemo(() => {
        return allWastageItems.filter((item: any) => {
            const matchesSearch = !searchTerm ||
                item.rawMaterialId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.materialName?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStore = !storeFilter || item.storeId === storeFilter;
            const matchesActive = activeFilter === "" ||
                (activeFilter === "true" ? item.isActive : !item.isActive);
            return matchesSearch && matchesStore && matchesActive;
        });
    }, [allWastageItems, searchTerm, storeFilter, activeFilter]);

    const sortedData = useMemo(() => {
        if (sortOrder === "default") return filteredData;
        return [...filteredData].sort((a, b) => {
            const nameA = (a.materialName || "").toLowerCase();
            const nameB = (b.materialName || "").toLowerCase();
            return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [filteredData, sortOrder]);

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const total = sortedData.length;
    const paginatedData = sortedData.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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


    const tableRef = useRef<HTMLDivElement>(null);

    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: paginatedData.length,
        onEnter: (i) => { const item = paginatedData[i]; if (item) handleOpenView(item); },
        onEdit: (i) => { const item = paginatedData[i]; if (item && can("wastage-store.edit")) handleOpenEdit(item); },
        containerRef: tableRef,
    });

    const handleOpenView = useCallback((item: RawMaterial) => {
        setSelectedItem(item);
        setShowViewModal(true);
        setTimeout(() => tableRef.current?.focus(), 50);
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
                await rawMaterialService.delete(itemToDelete);
                toast.success("Wastage product deleted successfully!");
                refresh();
            } catch (err: any) {
                toast.error(err || "Failed to delete item");
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const fetchWastageForExport = useCallback(async () => {
        const res = await rawMaterialService.fetchAll({ itemType: "WASTAGE", limit: 100000 });
        return Array.isArray(res) ? res : (res?.rawMaterials || res?.data || []);
    }, []);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Product ID", accessor: (item: any) => item.rawMaterialId },
            { header: "Product Name", accessor: (item: any) => item.materialName },
            { header: "Category", accessor: (item: any) => item.category?.name || "—" },
            { header: "Store", accessor: (item: any) => item.store?.storeName || item.storeId || "—" },
            {
                header: "Physical Stock",
                accessor: (item: any) =>
                    item.onHandQty != null ? `${item.onHandQty} ${item.baseUom || ""}`.trim() : "0",
            },
            { header: "Status", accessor: (item: any) => (item.isActive ? "ACTIVE" : "INACTIVE") },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Wastage_Store_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    const columns: DataTableColumn<RawMaterial>[] = [
        {
            header: "#",
            width: "60px",
            align: "center",
            render: (_, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
        },
        {
            header: "NAME",
            headerNode: (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSortOrder(); }}
                    title={`Sort Alphabetically (F6) — ${sortOrder === "default" ? "Default" : sortOrder === "asc" ? "A to Z" : "Z to A"}`}
                    className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-[1.5px] outline-none hover:opacity-90 transition-opacity"
                >
                    <span className={sortOrder !== "default" ? "text-primary font-black" : "group-hover/sort:text-ink transition-colors"}>NAME</span>
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
            <div className="max-w-[1250px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Wastage Products</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search products..."
                        />

                        {/* Filter Popover */}
                        <FilterPopover
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            onOpen={() => {
                                setDraftStoreFilter(storeFilter);
                                setDraftActiveFilter(activeFilter);
                            }}
                            onApply={handleApplyFilters}
                            onClear={handleClearFilters}
                        >
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Store
                                    </label>
                                    <SelectInput
                                        name="storeFilter"
                                        value={draftStoreFilter}
                                        onChange={(e) => setDraftStoreFilter(e.target.value)}
                                        options={storeOptions}
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
                                        options={[
                                            { label: "All Status", value: "" },
                                            { label: "Active", value: "true" },
                                            { label: "Inactive", value: "false" },
                                        ]}
                                        noMargin
                                    />
                                </div>
                            </div>
                        </FilterPopover>

                        {can("wastage-store.export") && (
                            <ExportCSVButton
                                fetchData={fetchWastageForExport}
                                columns={csvColumns}
                                filename={csvFilename}
                                text="Export"
                            />
                        )}
                        {can("wastage-store.create") && (
                            <CustomButton
                                text="Add Wastage Product"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        )}
                    </div>
                </div>

                {/* Active filter chips */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2 px-6 py-2.5 border-b border-line flex-wrap">
                        <span className="text-xs text-ink-subtle">Active filters:</span>

                        {storeFilter && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                Store: {storeOptions.find((s) => s.value === storeFilter)?.label || storeFilter}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setStoreFilter(""); setDraftStoreFilter(""); setCurrentPage(1); }}
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

                {/* Data Table */}
                <div ref={tableRef} tabIndex={0} data-table-nav className="outline-none">
                    <DataTable
                        columns={columns}
                        data={paginatedData}
                        rowKey={(row) => row.rawMaterialId}
                        loading={loading}
                        emptyMessage="No wastage products found."
                        rowClassName={(_, i) => i === focusedIndex ? "bg-primary/8" : ""}
                        onRowClick={(item, i) => { setFocusedIndex(i); handleOpenView(item); }}
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
