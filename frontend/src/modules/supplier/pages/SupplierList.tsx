import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { FaTimes, FaPlus, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import SupplierViewModal from "../components/SupplierViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { supplierService } from "../../../services/supplierService";
import { usePermission } from "../../../hooks/usePermission";
import DataTable from "../../../components/ui/table/DataTable";
import { useListCache } from "../../../hooks/useListCache";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";

type SortOrder = "default" | "asc" | "desc";

const ITEMS_PER_PAGE = 15;
const SORT_STORAGE_KEY = "sunsea_supplier_sort_name";

interface FilterState {
    status: string; // "" = all | "Active" | "Backup" | "Inactive" | "Blacklisted"
}

const DEFAULT_FILTERS: FilterState = {
    status: "",
};

const SupplierList: React.FC = () => {
    const navigate = useNavigate();
    const tableRef = useRef<HTMLDivElement>(null);
    const { can } = usePermission();
    const canEditSupplier = can("suppliers.edit");
    const canDeleteSupplier = can("suppliers.delete");
    const canCreateSupplier = can("suppliers.create");
    const canExportSupplier = can("suppliers.export");

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";

    const [searchTerm, setSearchTerm] = useState(initialSearch);

    // Filters state
    const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);

    const activeFilterCount = [
        appliedFilters.status !== "",
    ].filter(Boolean).length;

    const hasActiveFilters = activeFilterCount > 0;

    // Custom confirm delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ── Alphabetical sort with localStorage persistence ───────────────────────
    const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
        try {
            const saved = localStorage.getItem(SORT_STORAGE_KEY);
            if (saved === "asc" || saved === "desc") return saved;
        } catch (_) {}
        return "default";
    });

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prev) => {
            let next: SortOrder = "default";
            if (prev === "default") next = "asc";
            else if (prev === "asc") next = "desc";
            else next = "default";
            try { localStorage.setItem(SORT_STORAGE_KEY, next); } catch (_) {}
            return next;
        });
        setCurrentPage(1);
    }, []);

    // Alt+S direct listener (F6 is handled by usePageShortcuts)
    useEffect(() => {
        const handleSortShortcut = (e: globalThis.KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
            if (e.altKey && (e.key === "s" || e.key === "S")) {
                e.preventDefault();
                toggleSortOrder();
            }
        };
        window.addEventListener("keydown", handleSortShortcut);
        return () => window.removeEventListener("keydown", handleSortShortcut);
    }, [toggleSortOrder]);

    const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchSuppliersForExport = useCallback(async () => {
        const res = await supplierService.fetchAll({ page: 1, limit: 100000 });
        const list = res?.suppliers || (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        return Array.isArray(list) ? list : [];
    }, []);

    const cacheKey = `suppliers:${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}:${appliedFilters.status}:${sortOrder}`;

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const res = await supplierService.fetchAll({
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            search: debouncedSearch || undefined,
            status: appliedFilters.status || undefined,
            sortBy: sortOrder !== "default" ? "name" : undefined,
            sortOrder: sortOrder !== "default" ? sortOrder : undefined,
        });
        const list = res?.suppliers || (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        const total = res?.total ?? (Array.isArray(list) ? list.length : 0);
        return { data: list, total };
    }, [currentPage, debouncedSearch, appliedFilters.status, sortOrder]);

    const { data: rawSuppliers, total, loading, refresh } = useListCache<any>({
        cacheKey,
        socketModule: "supplier",
        fetcher,
    });

    usePageShortcuts({
        onRefresh: () => refresh(),
        onSort: () => toggleSortOrder(),
        onDelete: () => setShowDeleteModal(true),
        onNew: () => canCreateSupplier && navigate("/suppliers/create"),
        onExport: () => {
            const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-btn], button:has(svg):has(span)");
            exportBtn?.click();
        },
    });

    // Suppliers are sorted across all total records in the database on the backend before pagination
    const suppliers = rawSuppliers ?? [];
    const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedSuppliers = suppliers;

    // ── Table keyboard navigation ─────────────────────────────────────────────
    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: paginatedSuppliers.length,
        onEnter: (i) => { const sup = paginatedSuppliers[i]; if (sup) handleOpenView(sup); },
        onEdit: (i) => { const sup = paginatedSuppliers[i]; if (sup && canEditSupplier) handleEdit(sup); },
        containerRef: tableRef,
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleFilterOpen = useCallback(() => {
        setDraftFilters(appliedFilters);
    }, [appliedFilters]);

    const handleApplyFilters = useCallback(() => {
        setAppliedFilters(draftFilters);
        setCurrentPage(1);
    }, [draftFilters]);

    const handleClearFilters = useCallback(() => {
        setDraftFilters(DEFAULT_FILTERS);
        setAppliedFilters(DEFAULT_FILTERS);
        setCurrentPage(1);
    }, []);

    const handleOpenView = useCallback((sup: any) => {
        setSelectedSupplier(sup);
        setShowViewModal(true);
    }, []);

    const handleCloseViewModal = useCallback(() => {
        setShowViewModal(false);
        setSelectedSupplier(null);
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    const handleEdit = useCallback((sup: any) => {
        navigate(`/suppliers/edit/${sup.id}`);
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setSupplierToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (supplierToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await supplierService.delete(supplierToDelete);
                toast.success("Supplier deleted successfully!");
                refresh();
            } catch (err: any) {
                toast.error(err?.response?.data?.message || err.message || err || "Failed to delete supplier");
            } finally {
                setShowDeleteModal(false);
                setSupplierToDelete(null);
                setIsDeleting(false);
            }
        }
    };

    // CSV Export Configuration
    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Supplier Code", accessor: (item: any) => item.supplierCode || "" },
            { header: "Name", accessor: (item: any) => item.legalName || item.displayName || "" },
            { header: "Contact Person", accessor: (item: any) => item.contactPerson || "" },
            { header: "Mobile", accessor: (item: any) => Array.isArray(item.mobile) && item.mobile.length > 0 ? item.mobile[0].number : (typeof item.mobile === "string" ? item.mobile : "") },
            { header: "Email", accessor: (item: any) => item.email || "" },
            { header: "GSTIN", accessor: (item: any) => item.gstin || "" },
            { header: "Opening Balance", accessor: (item: any) => Number(item.openingBalance || 0).toFixed(2) },
            { header: "Balance Type", accessor: (item: any) => item.openingBalanceType || "CREDIT" },
            { header: "Status", accessor: (item: any) => item.status || "" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Supplier_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    return (
        <div className="max-w-[1400px] xl:mr-auto">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Supplier Master</h2>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search Supplier..."
                            className="w-full md:w-64"
                        />

                        <FilterPopover
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            onOpen={handleFilterOpen}
                            onApply={handleApplyFilters}
                            onClear={handleClearFilters}
                        >
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Status
                                    </label>
                                    <SelectInput
                                        name="filterStatus"
                                        value={draftFilters.status}
                                        options={[
                                            { value: "Active", label: "Active" },
                                            { value: "Backup", label: "Backup" },
                                            { value: "Inactive", label: "Inactive" },
                                            { value: "Blacklisted", label: "Blacklisted" },
                                        ]}
                                        defaultOptionLabel="All Statuses"
                                        searchable={false}
                                        noMargin
                                        onChange={(e) =>
                                            setDraftFilters((p) => ({ ...p, status: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>
                        </FilterPopover>

                        {canExportSupplier && (
                            <ExportCSVButton
                                fetchData={fetchSuppliersForExport}
                                columns={csvColumns}
                                filename={csvFilename}
                                text="Export"
                            />
                        )}
                        {canCreateSupplier && (
                            <CustomButton
                                text="Add Supplier"
                                icon={FaPlus}
                                onClick={() => navigate("/suppliers/create")}
                            />
                        )}
                    </div>
                </div>

                {/* Active filter chips */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2 px-6 py-2 border-b border-line flex-wrap">
                        <span className="text-xs text-ink-subtle">Active filters:</span>

                        {appliedFilters.status && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                Status: {appliedFilters.status}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, status: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}
                    </div>
                )}

                {/* Table — data-table-nav lets F3-exit restore focus here */}
                <div
                    ref={tableRef}
                    tabIndex={0}
                    data-table-nav
                    className="p-0 outline-none"
                >
                    <DataTable
                        data={paginatedSuppliers}
                        rowKey={(supplier) => supplier.id}
                        loading={loading}
                        emptyMessage="No suppliers found."
                        rowClassName={(_row, index) =>
                            index === focusedIndex
                                ? "bg-primary/8"
                                : ""
                        }
                        onRowClick={(supplier, index) => {
                            setFocusedIndex(index);
                            tableRef.current?.focus({ preventScroll: true });
                            handleOpenView(supplier);
                        }}
                        pagination={
                            totalPages > 1
                                ? { currentPage, totalPages, onPageChange: (page) => setCurrentPage(page) }
                                : undefined
                        }
                        columns={[
                            { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
                            {
                                header: "NAME",
                                accessor: "legalName",
                                headerNode: (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleSortOrder(); }}
                                        title={`Sort Alphabetically: ${
                                            sortOrder === "default"
                                                ? "Default Order"
                                                : sortOrder === "asc"
                                                ? "A to Z (Ascending)"
                                                : "Z to A (Descending)"
                                        } (Click or press F6)`}
                                        className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-[1.5px] outline-none hover:opacity-90 transition-opacity"
                                    >
                                        <span className={sortOrder !== "default" ? "text-primary font-black" : "group-hover/sort:text-ink transition-colors"}>
                                            NAME
                                        </span>
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
                            },
                            { header: "CONTACT PERSON", render: (supplier) => supplier.contactPerson || "—" },
                            {
                                header: "MOBILE",
                                render: (supplier) =>
                                    Array.isArray(supplier.mobile) && supplier.mobile.length > 0
                                        ? supplier.mobile[0].number
                                        : typeof supplier.mobile === "string"
                                        ? supplier.mobile
                                        : "N/A"
                            },
                            { header: "EMAIL", render: (supplier) => supplier.email || "N/A" },
                            { header: "GSTIN", render: (supplier) => supplier.gstin || "—" },
                            {
                                header: "BALANCE",
                                align: "right",
                                render: (s: any) => {
                                    let amt = 0;
                                    let bType = "";

                                    if (s.balanceType !== undefined && s.balanceType !== null && s.balanceType !== "") {
                                        amt = Number(s.balanceAmount ?? Math.abs(s.netBalance ?? 0));
                                        bType = s.balanceType;
                                    } else {
                                        const netBal = Number(
                                            s.netBalance ??
                                                (s.openingBalanceType === "DEBIT"
                                                    ? -Math.abs(s.openingBalance || 0)
                                                    : Math.abs(s.openingBalance || 0))
                                        );
                                        amt = Math.abs(netBal);
                                        bType = netBal > 0 ? "Cr" : netBal < 0 ? "Dr" : "";
                                    }

                                    if (amt === 0 || !bType) {
                                        return <span className="font-mono text-ink-muted">₹0.00</span>;
                                    }

                                    const formattedAmt = amt.toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    });

                                    if (bType.toUpperCase() === "DR") {
                                        return (
                                            <span className="font-mono font-bold text-blue-400">
                                                ₹{formattedAmt} Dr
                                            </span>
                                        );
                                    } else {
                                        return (
                                            <span className="font-mono font-bold text-emerald-400">
                                                ₹{formattedAmt} Cr
                                            </span>
                                        );
                                    }
                                }
                            },
                            {
                                header: "STATUS",
                                render: (supplier) => <StatusBadge status={supplier.status?.toUpperCase() || "ACTIVE"} />,
                                align: "center"
                            },
                            {
                                header: "ACTIONS",
                                render: (supplier) => (
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <ViewButton onClick={() => handleOpenView(supplier)} />
                                        {canEditSupplier && <EditButton onClick={() => handleEdit(supplier)} />}
                                        {canDeleteSupplier && <DeleteButton onClick={() => triggerDelete(String(supplier.id))} />}
                                    </div>
                                ),
                                align: "center"
                            },
                        ]}
                    />
                </div>
            </div>

            <SupplierViewModal
                show={showViewModal}
                onHide={handleCloseViewModal}
                supplier={selectedSupplier}
            />

            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message="Are you sure you want to delete this supplier? This action cannot be undone."
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                confirmVariant="danger"
                isDangerous={true}
            />
        </div>
    );
};

export default SupplierList;
