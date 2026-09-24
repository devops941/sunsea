import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { FaPlus, FaTimes, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { salesProductService } from "../../../services/salesProductService";
import { usePermission } from "../../../hooks/usePermission";
import { useListCache } from "../../../hooks/useListCache";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";

const ITEMS_PER_PAGE = 15;

type SortOrder = "default" | "asc" | "desc";
const SALESPRODUCT_SORT_KEY = "sunsea_salesproduct_sort_name";

const SalesProductList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState("");
    const [draftActiveFilter, setDraftActiveFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
        try {
            const saved = localStorage.getItem(SALESPRODUCT_SORT_KEY);
            if (saved === "asc" || saved === "desc") return saved;
        } catch (_) {}
        return "default";
    });

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prev) => {
            const next: SortOrder = prev === "default" ? "asc" : prev === "asc" ? "desc" : "default";
            try { localStorage.setItem(SALESPRODUCT_SORT_KEY, next); } catch (_) {}
            return next;
        });
        setCurrentPage(1);
    }, []);

    const activeFilterCount = [
        activeFilter !== "",
    ].filter(Boolean).length;

    const hasActiveFilters = activeFilterCount > 0;

    const handleApplyFilters = useCallback(() => {
        setActiveFilter(draftActiveFilter);
        setCurrentPage(1);
    }, [draftActiveFilter]);

    const handleClearFilters = useCallback(() => {
        setDraftActiveFilter("");
        setActiveFilter("");
        setCurrentPage(1);
    }, []);

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const params: any = {
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            search: debouncedSearch || undefined,
            isActive: activeFilter === "" ? undefined : activeFilter === "true",
        };
        if (sortOrder === "asc" || sortOrder === "desc") {
            params.sortBy = "salesProductName";
            params.sortOrder = sortOrder;
        }
        const res = await salesProductService.fetchAll(params);
        const list = Array.isArray(res) ? res : res?.salesProducts || [];
        const totalCount = res?.total ?? list.length;
        return { data: list, total: totalCount };
    }, [currentPage, debouncedSearch, activeFilter, sortOrder]);

    const { data: salesProducts, total, loading, refresh } = useListCache<any>({
        cacheKey: `salesProducts:list:${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}:${activeFilter}:${sortOrder}`,
        socketModule: "salesProduct",
        fetcher,
    });

    usePageShortcuts({
        onRefresh: () => refresh(),
        onDelete: () => setShowDeleteModal(true),
        onNew: () => can("sales_products.create") && navigate("/sales-products/create"),
        onSort: () => toggleSortOrder(),
    });

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);

    const totalPages = Math.max(1, Math.ceil((total || 0) / ITEMS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handleOpenAdd = useCallback(() => navigate("/sales-products/create"), [navigate]);
    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/sales-products/edit/${item.id}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const tableRef = useRef<HTMLDivElement>(null);

    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: salesProducts.length,
        onEnter: () => {},
        containerRef: tableRef,
    });

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null || isDeleting) return;
        setIsDeleting(true);
        try {
            await salesProductService.delete(itemToDelete);
            toast.success("Sales Product deleted successfully!");
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to delete Sales Product");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
            setItemToDelete(null);
        }
    };

    const fetchSalesProductsForExport = useCallback(async () => {
        const params: any = {
            search: debouncedSearch || undefined,
            isActive: activeFilter === "" ? undefined : activeFilter === "true",
        };
        if (sortOrder === "asc" || sortOrder === "desc") {
            params.sortBy = "salesProductName";
            params.sortOrder = sortOrder;
        }
        const res = await salesProductService.fetchAll(params);
        return Array.isArray(res) ? res : res?.salesProducts || [];
    }, [debouncedSearch, activeFilter, sortOrder]);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Sales Product Code", accessor: (item: any) => item.salesProductCode },
            { header: "Sales Product Name", accessor: (item: any) => item.salesProductName },
            {
                header: "Components",
                accessor: (item: any) =>
                    (item.components || [])
                        .map((c: any) => {
                            const name = c.componentProduct?.productName;
                            if (!name) return null;
                            return `${name} (${c.quantity ?? 1})`;
                        })
                        .filter(Boolean)
                        .join("; ") || "—",
            },
            { header: "Status", accessor: (item: any) => (item.isActive ? "ACTIVE" : "INACTIVE") },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Sales_Product_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    const columns: DataTableColumn<any>[] = [
        {
            header: "#",
            width: "60px",
            align: "center",
            render: (_, index) => startIndex + index + 1,
        },
        {
            header: "SALES PRODUCT",
            headerNode: (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSortOrder(); }}
                    title={`Sort Alphabetically (F6) — ${sortOrder === "default" ? "Default" : sortOrder === "asc" ? "A to Z" : "Z to A"}`}
                    className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-[1.5px] outline-none hover:opacity-90 transition-opacity"
                >
                    <span className={sortOrder !== "default" ? "text-primary font-black" : "group-hover/sort:text-ink transition-colors"}>SALES PRODUCT</span>
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
                <div className="font-semibold text-ink">{item.salesProductName}</div>
            ),
        },
        {
            header: "COMPONENTS",
            render: (item) =>
                (item.components || [])
                    .map((c: any) => {
                        const name = c.componentProduct?.productName;
                        if (!name) return null;
                        return `${name} (${c.quantity ?? 1})`;
                    })
                    .filter(Boolean)
                    .join(", ") || "-",
        },
        // {
        //     header: "RATE (₹)",
        //     align: "right",
        //     render: (item) => item.rate != null ? Number(item.rate).toFixed(2) : "-",
        // },
        {
            header: "STATUS",
            align: "center",
            render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />,
        },
        {
            header: "ACTIONS",
            align: "left",
            render: (item) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {can("sales_products.edit") && <EditButton onClick={() => handleOpenEdit(item)} />}
                    {can("sales_products.delete") && <DeleteButton onClick={() => triggerDelete(item.id)} />}
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="max-w-[1200px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
                            Sales Product
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-xs dark:bg-slate-800/90 dark:text-slate-200 dark:border dark:border-slate-700/60">
                                {total ?? salesProducts.length}
                            </span>
                        </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="w-full md:w-64">
                            <SearchInput
                                value={searchTerm}
                                onChange={handleSearch}
                                placeholder="Search by sales product..."
                            />
                        </div>

                        {/* Filter Popover */}
                        <FilterPopover
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            onOpen={() => {
                                setDraftActiveFilter(activeFilter);
                            }}
                            onApply={handleApplyFilters}
                            onClear={handleClearFilters}
                        >
                            <div className="space-y-3">
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

                        {can("sales_products.export") && (
                            <ExportCSVButton
                                fetchData={fetchSalesProductsForExport}
                                columns={csvColumns}
                                filename={csvFilename}
                                text="Export"
                            />
                        )}
                        {can("sales_products.create") && (
                            <CustomButton text="Add Sales Product" icon={FaPlus} onClick={handleOpenAdd} />
                        )}
                    </div>
                </div>

                {/* Active filter chips */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2 px-6 py-2.5 border-b border-line flex-wrap">
                        <span className="text-xs text-ink-subtle">Active filters:</span>

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

                <div ref={tableRef} tabIndex={0} data-table-nav className="outline-none">
                    <DataTable
                        columns={columns}
                        data={salesProducts}
                        rowKey={(row) => row.id}
                        loading={loading}
                        emptyMessage="No sales products found."
                        rowClassName={(_, i) => i === focusedIndex ? "bg-primary/8" : ""}
                        onRowClick={(_, i) => setFocusedIndex(i)}
                        pagination={totalPages > 1 ? {
                            currentPage: safeCurrentPage,
                            totalPages,
                            onPageChange: setCurrentPage,
                        } : undefined}
                    />
                </div>
            </div>

            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message="Are you sure you want to delete this sales product?"
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                confirmVariant="danger"
                isDangerous={true}
            />
        </div>
    );
};

export default SalesProductList;
