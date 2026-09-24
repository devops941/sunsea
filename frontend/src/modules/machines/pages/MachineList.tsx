import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { FaPlus, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useListCache, invalidateCacheByPrefix } from "../../../hooks/useListCache";
import { machineService } from "../../../services/machineService";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import MachineViewModal from "../components/MachineViewModal";
import { Search } from "lucide-react";
import { useEmployees } from "../../../hooks/useEmployees";
import { usePermission } from "../../../hooks/usePermission";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";

const ITEMS_PER_PAGE = 15;
const SORT_STORAGE_KEY = "sunsea_machine_sort_name";

type SortOrder = "default" | "asc" | "desc";

const MachineList: React.FC = () => {
    const navigate = useNavigate();
    const tableRef = useRef<HTMLDivElement>(null);
    const { employees, loadEmployees } = useEmployees();
    const { can } = usePermission();
    const canCreateMachine = can("machines.create");
    const canEditMachine = can("machines.edit");
    const canDeleteMachine = can("machines.delete");
    const canExportMachine = can("machines.export");

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState<any | null>(null);

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

    // F6 / Alt+S direct listener
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

    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const cacheKey = `machines:list:${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}:${sortOrder}`;

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const res = await machineService.getAll({
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            search: debouncedSearch || undefined,
            sortBy: sortOrder !== "default" ? "machineName" : undefined,
            sortOrder: sortOrder !== "default" ? sortOrder : undefined,
        });
        const list = Array.isArray(res) ? res : (res?.data || res?.machines || []);
        const total = Array.isArray(res) ? res.length : (res?.total ?? list.length);
        return { data: Array.isArray(list) ? list : [], total };
    }, [currentPage, debouncedSearch, sortOrder]);

    const { data: machines, total, loading, refresh } = useListCache<any>({
        cacheKey,
        socketModule: "machine",
        fetcher,
    });

    usePageShortcuts({
        onRefresh: () => refresh(),
        onSort: () => toggleSortOrder(),
        onDelete: () => setShowDeleteModal(true),
        onNew: () => canCreateMachine && navigate("/machines/create"),
        onExport: () => {
            const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-btn], button:has(svg):has(span)");
            exportBtn?.click();
        },
    });

    const fetchMachinesForExport = useCallback(async () => {
        const res = await machineService.getAll({
            limit: 100000,
            search: debouncedSearch || undefined,
            sortBy: sortOrder !== "default" ? "machineName" : undefined,
            sortOrder: sortOrder !== "default" ? sortOrder : undefined,
        });
        return Array.isArray(res) ? res : (res?.machines || res?.data || []);
    }, [debouncedSearch, sortOrder]);

    const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = machines;

    // ── Table keyboard navigation ─────────────────────────────────────────────
    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: paginatedData.length,
        onEnter: (i) => { const m = paginatedData[i]; if (m) { setSelectedMachine(m); setShowViewModal(true); } },
        onEdit: (i) => { const m = paginatedData[i]; if (m && canEditMachine) handleOpenEdit(m); },
        containerRef: tableRef,
    });

    useEffect(() => {
        if (can("employees.view")) {
            loadEmployees({ limit: 500 });
        }
    }, [loadEmployees, can]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleCloseViewModal = useCallback(() => {
        setShowViewModal(false);
        setSelectedMachine(null);
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/machines/edit/${item.machineId}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await machineService.delete(itemToDelete);
                invalidateCacheByPrefix("machines:");
                toast.success("Machine deleted successfully!");
                refresh();
            } catch (err: any) {
                toast.error(err?.response?.data?.message || err.message || err || "Failed to delete machine");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
                setIsDeleting(false);
            }
        }
    };

    // CSV Export Configuration
    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Machine ID", accessor: (item: any) => item.machineId },
            { header: "Machine Name", accessor: (item: any) => item.machineName },
            { header: "Tech Type", accessor: (item: any) => item.technologyType || "—" },
            { header: "Machine Type", accessor: (item: any) => item.machineType || "—" },
            {
                header: "Machine Incharge",
                accessor: (item: any) => {
                    if (!item.operatorId) return "—";
                    const emp = employees.find((e: any) => e.id === item.operatorId);
                    return emp ? emp.fullName : item.operatorId;
                },
            },
            { header: "Status", accessor: (item: any) => (item.isActive ? "ACTIVE" : "INACTIVE") },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Machine_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, [employees]);

    return (
        <div>
            <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
                    <div>
                        <h2 className="text-base font-bold text-ink flex items-center gap-2">
                            Machine Management
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-xs dark:bg-slate-800/90 dark:text-slate-200 dark:border dark:border-slate-700/60">
                                {total ?? machines.length}
                            </span>
                        </h2>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={15} />
                            <input
                                type="text"
                                data-search-input
                                className="w-full pl-10 pr-4 py-2 bg-card-2 border border-line-soft rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                placeholder="Search machines..."
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                        </div>
                        {canExportMachine && (
                            <ExportCSVButton fetchData={fetchMachinesForExport} columns={csvColumns} filename={csvFilename} text="Export" />
                        )}
                        {canCreateMachine && (
                            <CustomButton text="Add Machine" icon={FaPlus} onClick={() => navigate("/machines/create")} />
                        )}
                    </div>
                </div>

                {/* Table — data-table-nav lets F3-exit restore focus here */}
                <div
                    ref={tableRef}
                    tabIndex={0}
                    data-table-nav
                    className="p-0 overflow-hidden rounded-b-2xl outline-none"
                >
                    <DataTable
                        data={paginatedData}
                        rowKey={(item) => item.machineId}
                        loading={loading}
                        emptyMessage="No machines found."
                        rowClassName={(_row, index) =>
                            index === focusedIndex ? "bg-primary/8" : ""
                        }
                        onRowClick={(item, index) => {
                            setFocusedIndex(index);
                            tableRef.current?.focus({ preventScroll: true });
                            setSelectedMachine(item);
                            setShowViewModal(true);
                        }}
                        pagination={
                            totalPages > 1
                                ? { currentPage, totalPages, onPageChange: setCurrentPage }
                                : undefined
                        }
                        columns={[
                            {
                                header: "#",
                                width: "60px",
                                align: "center",
                                render: (_item, index) => (
                                    <span className="text-ink-subtle font-mono text-xs">{String(startIndex + index + 1).padStart(2, '0')}</span>
                                ),
                            },
                            { header: "MACHINE ID", accessor: "machineId", width: "110px" },
                            {
                                header: "MACHINE NAME",
                                accessor: "machineName",
                                width: "160px",
                                headerNode: (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleSortOrder(); }}
                                        title="Sort Alphabetically (F6)"
                                        className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-[1.5px] outline-none hover:opacity-90 transition-opacity"
                                    >
                                        <span className={sortOrder !== "default" ? "text-primary font-black" : "group-hover/sort:text-ink transition-colors"}>
                                            Machine Name
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
                            {
                                header: "TECH TYPE", width: "150px", render: (item) => {
                                    const val = item.technologyType || "—";
                                    return <span className="block truncate" title={val}>{val}</span>;
                                }
                            },
                            {
                                header: "MACHINE TYPE", width: "120px", render: (item) => {
                                    const val = item.machineType || "—";
                                    return <span className="block truncate" title={val}>{val}</span>;
                                }
                            },
                            {
                                header: "MACHINE INCHARGE",
                                render: (item) => {
                                    if (!item.operatorId) return "—";
                                    const emp = employees.find(e => e.id === item.operatorId);
                                    const val = emp ? emp.fullName : item.operatorId;
                                    return <span className="block truncate" title={val}>{val}</span>;
                                }
                            },
                            {
                                header: "STATUS",
                                width: "110px",
                                align: "center",
                                render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                            },
                            {
                                header: "ACTIONS",
                                width: "120px",
                                align: "center",
                                render: (item) => (
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <ViewButton onClick={() => { setSelectedMachine(item); setShowViewModal(true); }} />
                                        {canEditMachine && <EditButton onClick={() => handleOpenEdit(item)} />}
                                        {canDeleteMachine && <DeleteButton onClick={() => triggerDelete(item.machineId)} />}
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>
            </div>

            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message="Are you sure you want to delete this machine? This action cannot be undone."
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                confirmVariant="danger"
                isDangerous={true}
            />

            <MachineViewModal
                show={showViewModal}
                onHide={handleCloseViewModal}
                machine={selectedMachine}
            />
        </div>
    );
};

export default MachineList;
