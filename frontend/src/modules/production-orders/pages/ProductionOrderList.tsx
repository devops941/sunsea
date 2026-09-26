import { formatDate } from "../../../utils/dateUtils";
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { FaPlus, FaTimes, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import { machineService } from "../../../services/machineService";
import { productionOrderService } from "../../../services/productionOrderService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 15;
const SORT_STORAGE_KEY = "sunsea_production_order_sort";

type SortOrder = "default" | "asc" | "desc";

interface FilterState {
    status: string;
    machineId: string;
    fromDate: string;
    toDate: string;
}

const DEFAULT_FILTERS: FilterState = {
    status: "",
    machineId: "",
    fromDate: "",
    toDate: "",
};

const statusOptions = [
    { label: "Draft", value: "DRAFT" },
    { label: "Weekly Scheduled", value: "WEEKLY_SCHEDULED" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Completed", value: "COMPLETED" },
];

const ProductionOrderList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();

    // --- State ---
    const [combinedData, setCombinedData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
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
            if (prev === "default") next = "desc";
            else if (prev === "desc") next = "asc";
            else next = "default";
            try {
                localStorage.setItem(SORT_STORAGE_KEY, next);
            } catch (_) {}
            return next;
        });
    }, []);

    const [machines, setMachines] = useState<any[]>([]);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchMachines = useCallback(async () => {
        try {
            const res = await machineService.getAll({ limit: 1000 });
            const list = Array.isArray(res) ? res : (res?.machines || res?.data || []);
            if (Array.isArray(list)) setMachines(list);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        fetchMachines();
    }, [fetchMachines]);

    const machineOptions = useMemo(() => {
        return machines.map((m: any) => {
            const id = m.machineId || m.id;
            const name = m.machineName ? `${m.machineName} (${id})` : String(id);
            return {
                label: name,
                value: String(id),
            };
        });
    }, [machines]);

    const activeFilterCount = useMemo(() => {
        return Object.values(appliedFilters).filter(Boolean).length;
    }, [appliedFilters]);

    const hasActiveFilters = activeFilterCount > 0;

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

    const getBaseId = (poId: string): string | null => {
        const match = poId.match(/^(.+)-M\d+-\d+$/);
        return match ? match[1] : null;
    };

    // Fetch and combine Production Orders
    const fetchCombinedData = useCallback(async () => {
        setLoading(true);
        try {
            let poList: any[] = [];
            try {
                const poRes = await productionOrderService.fetchAll({
                    pageSize: 1000
                });
                const rawList = (poRes as any)?.data?.data || (poRes as any)?.data || (Array.isArray(poRes) ? poRes : []);
                poList = Array.isArray(rawList) ? rawList : [];
            } catch (err: any) {
                console.error("Failed to fetch production orders:", err);
                toast.error(err?.response?.data?.message || "Failed to load production orders");
            }

            // Group all POs — weekly plan POs by base ID, standalone as-is
            const weeklyGroupMap = new Map<string, any[]>();
            const standalonePOs: any[] = [];

            poList.forEach((po: any) => {
                const baseId = getBaseId(po.productionOrderId);
                if (baseId) {
                    if (!weeklyGroupMap.has(baseId)) weeklyGroupMap.set(baseId, []);
                    weeklyGroupMap.get(baseId)!.push(po);
                } else {
                    standalonePOs.push(po);
                }
            });

            // Build weekly group entries
            const weeklyGroupEntries = Array.from(weeklyGroupMap.entries()).map(([baseId, pos]) => {
                const isAllCompleted = pos.length > 0 && pos.every((p: any) => {
                    return p.status?.toUpperCase() === 'COMPLETED' || 
                        (Number(p.producedQty || 0) >= Number(p.targetQty || 0) && Number(p.targetQty || 0) > 0);
                });
                const hasAnyInProgress = pos.some((p: any) => {
                    const st = p.status?.toUpperCase();
                    return st === 'IN_PROGRESS' || (Number(p.producedQty || 0) > 0 && Number(p.producedQty || 0) < Number(p.targetQty || 0));
                });
                const hasAnyDraft = pos.some((p: any) => p.status?.toUpperCase() === 'DRAFT');

                let overallStatus = 'WEEKLY_SCHEDULED';
                if (isAllCompleted) {
                    overallStatus = 'COMPLETED';
                } else if (hasAnyInProgress) {
                    overallStatus = 'IN_PROGRESS';
                } else if (hasAnyDraft) {
                    overallStatus = 'DRAFT';
                } else {
                    overallStatus = pos[0]?.status || 'WEEKLY_SCHEDULED';
                }

                const firstPO = pos[0];
                return {
                    id: `group-${baseId}`,
                    type: 'weekly-group',
                    baseId,
                    orderDate: firstPO.orderDate,
                    weekStart: firstPO.weekStartDate,
                    weekEnd: firstPO.weekEndDate,
                    status: overallStatus,
                    children: pos,
                    primaryPO: firstPO,
                };
            });

            // Build standalone direct PO entries (not weekly plan)
            const directMapped = standalonePOs.map((po: any) => {
                const isCompleted = po.status?.toUpperCase() === 'COMPLETED' || 
                    (Number(po.producedQty || 0) >= Number(po.targetQty || 0) && Number(po.targetQty || 0) > 0);
                const effectiveStatus = isCompleted ? 'COMPLETED' : po.status;
                return {
                    id: `direct-${po.productionOrderId}`,
                    type: 'standalone',
                    orderNo: po.productionOrderId,
                    orderDate: po.orderDate,
                    expectedCompletionDate: po.dueDate,
                    status: effectiveStatus,
                    productionOrders: [po],
                    primaryPO: po,
                };
            });

            // Combine all entries
            let combinedList = [...weeklyGroupEntries, ...directMapped];

            // Apply status filter
            if (appliedFilters.status) {
                combinedList = combinedList.filter(item => item.status?.toUpperCase() === appliedFilters.status.toUpperCase());
            }

            // Apply machine filter
            if (appliedFilters.machineId) {
                const target = String(appliedFilters.machineId).toLowerCase();
                combinedList = combinedList.filter((item: any) => {
                    const pos = item.children || item.productionOrders || (item.primaryPO ? [item.primaryPO] : []);
                    return pos.some((po: any) => {
                        const mId = String(po.machineMachineId || po.machineId || po.Machine?.id || po.Machine?.machineId || "").toLowerCase();
                        const mName = String(po.Machine?.machineName || "").toLowerCase();
                        return mId === target || mName === target;
                    });
                });
            }

            // Apply date filters (Order Date)
            if (appliedFilters.fromDate) {
                combinedList = combinedList.filter((item: any) => {
                    const dateStr = item.orderDate ? String(item.orderDate).split("T")[0] : "";
                    return dateStr ? dateStr >= appliedFilters.fromDate : true;
                });
            }
            if (appliedFilters.toDate) {
                combinedList = combinedList.filter((item: any) => {
                    const dateStr = item.orderDate ? String(item.orderDate).split("T")[0] : "";
                    return dateStr ? dateStr <= appliedFilters.toDate : true;
                });
            }

            // Apply search filter (PO No, product name)
            if (searchTerm.trim()) {
                const q = searchTerm.trim().toLowerCase();
                combinedList = combinedList.filter((item: any) => {
                    const poNo = (item.primaryPO?.productionOrderId || item.orderNo || item.baseId || "").toLowerCase();
                    const products = (item.productionOrders || item.children || [])
                        .map((p: any) => (p.productItem?.productName || p.product?.productName || "").toLowerCase())
                        .join(" ");
                    return poNo.includes(q) || products.includes(q);
                });
            }

            // Apply sort by orderDate
            if (sortOrder === "asc") {
                combinedList.sort((a, b) => new Date(a.orderDate || 0).getTime() - new Date(b.orderDate || 0).getTime());
            } else if (sortOrder === "desc") {
                combinedList.sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime());
            }

            setTotalItems(combinedList.length);

            // Paginate
            const start = (currentPage - 1) * ITEMS_PER_PAGE;
            setCombinedData(combinedList.slice(start, start + ITEMS_PER_PAGE));
        } catch {
            toast.error("Failed to load production orders");
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, appliedFilters, sortOrder]);

    useEffect(() => {
        fetchCombinedData();
    }, [fetchCombinedData]);

    useSocketSync("productionOrder", undefined, fetchCombinedData);

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const tableRef = useRef<HTMLDivElement>(null);

    const handleOpenWeeklyPlan = useCallback((item: any) => {
        if (!can("production_orders.view")) return;
        navigate(
            `/production-orders/weekly-plan/${item.baseId}`,
            {
                state: {
                    baseId: item.baseId,
                    weekStart: item.weekStart,
                    weekEnd: item.weekEnd,
                    children: item.children,
                }
            }
        );
    }, [can, navigate]);

    const handleEditWeeklyPlan = useCallback((item: any) => {
        if (!can("production_orders.edit")) return;
        navigate(
            '/production-orders/create',
            {
                state: {
                    editWeeklyPlan: true,
                    baseId: item.baseId,
                    children: item.children,
                    weekStart: item.weekStart,
                    weekEnd: item.weekEnd,
                }
            }
        );
    }, [can, navigate]);

    const handleOpenEdit = useCallback((po: any) => {
        if (!can("production_orders.edit")) return;
        navigate(`/production-orders/edit/${po.productionOrderId}`);
    }, [can, navigate]);

    const handleOpenViewItem = useCallback((item: any) => {
        if (!can("production_orders.view")) return;
        if (item.type === 'weekly-group') {
            handleOpenWeeklyPlan(item);
            return;
        }
        if (!item.primaryPO) return;
        const poId = item.primaryPO.productionOrderId || item.primaryPO.id;
        navigate(`/production-orders/history/view/${poId}`, { state: { order: item.primaryPO } });
    }, [can, navigate, handleOpenWeeklyPlan]);

    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: combinedData.length,
        onEnter: (i) => {
            const item = combinedData[i];
            if (!item) return;
            if (item.type === 'weekly-group') {
                handleOpenWeeklyPlan(item);
            } else {
                handleOpenViewItem(item);
            }
        },
        onEdit: (i) => {
            const item = combinedData[i];
            if (!item) return;
            if (item.type === 'weekly-group') {
                const isWeeklyEditable = can('production_orders.edit') && !['IN_PRODUCTION', 'POST_PRODUCTION', 'COMPLETED', 'CLOSED', 'DISPATCHED'].includes(item.status?.toUpperCase());
                if (isWeeklyEditable) handleEditWeeklyPlan(item);
            } else if (item.primaryPO && can('production_orders.edit')) {
                const isStandaloneEditable = !['IN_PRODUCTION', 'POST_PRODUCTION', 'COMPLETED', 'CLOSED', 'DISPATCHED'].includes(item.primaryPO.status?.toUpperCase());
                if (isStandaloneEditable) handleOpenEdit(item.primaryPO);
            }
        },
        containerRef: tableRef,
    });

    const handleDeleteConfirm = async () => {
        if (!itemToDelete || itemToDelete.length === 0 || isDeleting) return;
        if (!can("production_orders.delete")) return;
        setIsDeleting(true);
        try {
            for (const id of itemToDelete) {
                await productionOrderService.delete(id);
            }
            toast.success("Production order(s) deleted successfully!");
            setShowDeleteModal(false);
            if (combinedData.length <= itemToDelete.length && currentPage > 1) {
                setCurrentPage(prev => Math.max(1, prev - 1));
            }
            setItemToDelete([]);
            fetchCombinedData();
            setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to delete order(s)");
        } finally {
            setIsDeleting(false);
        }
    };

    const triggerDelete = useCallback((ids: string[]) => {
        setItemToDelete(ids);
        setShowDeleteModal(true);
    }, []);

    const columns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "#",
            width: "50px",
            align: "center",
            render: (_item, idx) => (
                <span className="text-ink-subtle text-xs">
                    {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                </span>
            ),
        },
        {
            header: "PO NO",
            width: "160px",
            render: (item) => {
                if (item.type === "weekly-group") {
                    return <span className="font-bold text-ink text-xs">{item.baseId}</span>;
                }
                return (
                    <span className="font-semibold text-ink text-xs">
                        {item.primaryPO ? item.primaryPO.productionOrderId : item.orderNo}
                    </span>
                );
            },
        },
        {
            header: "ORDER DATE",
            width: "160px",
            headerNode: (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleSortOrder();
                    }}
                    title={`Sort by Date: ${
                        sortOrder === "default"
                            ? "Default Order"
                            : sortOrder === "asc"
                            ? "Oldest First (Ascending)"
                            : "Newest First (Descending)"
                    } (Click or press F6)`}
                    className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-wider outline-none hover:opacity-90 transition-opacity"
                >
                    <span className={sortOrder !== "default" ? "text-primary font-bold" : "group-hover/sort:text-ink transition-colors"}>
                        Order Date
                    </span>
                    <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded transition-all duration-200 ${
                            sortOrder === "asc" || sortOrder === "desc"
                                ? "bg-primary/20 text-primary scale-110"
                                : "text-ink-subtle/60 group-hover/sort:text-ink group-hover/sort:bg-card-2"
                        }`}
                    >
                        {sortOrder === "asc" ? (
                            <FaArrowUp size={10} />
                        ) : sortOrder === "desc" ? (
                            <FaArrowDown size={10} />
                        ) : (
                            <FaSort size={10} />
                        )}
                    </span>
                    {sortOrder !== "default" && (
                        <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-primary text-white tracking-tighter shadow-xs">
                            {sortOrder === "asc" ? "OLD-NEW" : "NEW-OLD"}
                        </span>
                    )}
                </button>
            ),
            render: (item) => <span className="text-ink-muted text-xs">{formatDate(item.orderDate)}</span>,
        },
        {
            header: "DUE / WEEK DATE",
            width: "200px",
            render: (item) => {
                if (item.type === "weekly-group") {
                    return (
                        <span className="text-ink-muted text-xs">
                            {item.weekStart && item.weekEnd
                                ? `${formatDate(item.weekStart)} – ${formatDate(item.weekEnd)}`
                                : "—"}
                        </span>
                    );
                }
                return (
                    <span className="text-ink-muted text-xs">
                        {item.expectedCompletionDate ? formatDate(item.expectedCompletionDate) : "—"}
                    </span>
                );
            },
        },
        {
            header: "MACHINES / PRODUCTS",
            render: (item) => {
                if (item.type === "weekly-group") {
                    const machinesList = [...new Set(
                        item.children
                            ?.map((po: any) => po.Machine?.machineName || po.machineMachineId || "")
                            ?.filter(Boolean) || []
                    )].join(", ");
                    return <span className="text-ink-muted text-xs">{machinesList || "—"}</span>;
                }
                const productsList = item.productionOrders && item.productionOrders.length > 0
                    ? item.productionOrders.map((po: any) => po.productItem?.productName || "Unknown").join(", ")
                    : "—";
                return <span className="text-ink-muted text-xs">{productsList}</span>;
            },
        },
        {
            header: "STATUS",
            width: "180px",
            render: (item) => <StatusBadge status={item.status} />,
        },
        {
            header: "ACTIONS",
            width: "140px",
            align: "center",
            render: (item) => {
                if (item.type === "weekly-group") {
                    const isWeeklyEditable = can("production_orders.edit") && !["IN_PRODUCTION", "POST_PRODUCTION", "COMPLETED", "CLOSED", "DISPATCHED"].includes(item.status?.toUpperCase());
                    return (
                        <div className="flex items-center gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
                            {can("production_orders.view") && (
                                <ViewButton onClick={() => handleOpenWeeklyPlan(item)} />
                            )}
                            {isWeeklyEditable && (
                                <EditButton onClick={() => handleEditWeeklyPlan(item)} />
                            )}
                            {can("production_orders.delete") && (
                                <DeleteButton
                                    onClick={() => triggerDelete(item.children.map((po: any) => po.productionOrderId))}
                                    disabled={item.children?.some((po: any) => po._editRestrictions?.canDelete === false)}
                                    disabledMessage="Cannot delete: one or more orders have active Daily Production Plans. Cancel them in Daily Machine Planning first."
                                />
                            )}
                        </div>
                    );
                }

                const isStandaloneEditable = item.primaryPO && can("production_orders.edit") && !["IN_PRODUCTION", "POST_PRODUCTION", "COMPLETED", "CLOSED", "DISPATCHED"].includes(item.primaryPO.status?.toUpperCase());
                return (
                    <div className="flex items-center gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
                        {item.primaryPO && can("production_orders.view") && (
                            <ViewButton
                                onClick={() => handleOpenViewItem(item)}
                            />
                        )}
                        {isStandaloneEditable && (
                            <EditButton onClick={() => handleOpenEdit(item.primaryPO)} />
                        )}
                        {item.primaryPO && can("production_orders.delete") && (
                            <DeleteButton
                                onClick={() => triggerDelete(item.productionOrders ? item.productionOrders.map((po: any) => po.productionOrderId) : [item.primaryPO.productionOrderId])}
                                disabled={item.primaryPO._editRestrictions?.canDelete === false}
                                disabledMessage="Cannot delete: this order has active Daily Production Plans. Cancel them in Daily Machine Planning first."
                            />
                        )}
                    </div>
                );
            },
        },
    ], [
        currentPage,
        sortOrder,
        toggleSortOrder,
        can,
        handleOpenWeeklyPlan,
        handleEditWeeklyPlan,
        triggerDelete,
        handleOpenEdit,
        handleOpenViewItem,
    ]);

    const handleDeleteCurrentRow = useCallback(() => {
        const item = combinedData[focusedIndex];
        if (!item) return;
        if (item.type === 'weekly-group') {
            if (can('production_orders.delete')) {
                const canDeleteAll = !item.children?.some((po: any) => po._editRestrictions?.canDelete === false);
                if (canDeleteAll) {
                    triggerDelete(item.children.map((po: any) => po.productionOrderId));
                } else {
                    toast.error("Cannot delete: one or more orders have active Daily Production Plans. Cancel them in Daily Machine Planning first.");
                }
            }
        } else if (item.primaryPO && can('production_orders.delete')) {
            if (item.primaryPO._editRestrictions?.canDelete === false) {
                toast.error("Cannot delete: this order has active Daily Production Plans. Cancel them in Daily Machine Planning first.");
            } else {
                triggerDelete(item.productionOrders ? item.productionOrders.map((po: any) => po.productionOrderId) : [item.primaryPO.productionOrderId]);
            }
        }
    }, [combinedData, focusedIndex, can, triggerDelete]);

    usePageShortcuts({
        onRefresh: () => fetchCombinedData(),
        onSort: () => toggleSortOrder(),
        onDelete: handleDeleteCurrentRow,
        onNew: () => can("production_orders.create") && navigate("/production-orders/create"),
    });

    return (
        <div className="w-full flex-1 flex flex-col min-h-0">
            <div className="w-full flex-1 flex flex-col bg-card rounded-2xl shadow-sm border border-line overflow-hidden min-h-[calc(100vh-140px)]">
                {/* Page Header */}
                <div className="shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
                    <div>
                        <h2 className="text-base font-bold text-ink">Production Order Management</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 relative">
                        <SearchInput
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Search PO / product... ( / )"
                        />
                        <FilterPopover
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            onOpen={handleFilterOpen}
                            onApply={handleApplyFilters}
                            onClear={handleClearFilters}
                        >
                            <div className="space-y-3">
                                {/* Status */}
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Status
                                    </label>
                                    <SelectInput
                                        name="filterStatus"
                                        value={draftFilters.status}
                                        options={statusOptions}
                                        defaultOptionLabel="All Statuses"
                                        searchable={false}
                                        noMargin
                                        onChange={(e) =>
                                            setDraftFilters((p) => ({ ...p, status: e.target.value }))
                                        }
                                    />
                                </div>

                                {/* Machine */}
                                {machineOptions.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                            Machine
                                        </label>
                                        <SelectInput
                                            name="filterMachine"
                                            value={draftFilters.machineId}
                                            options={machineOptions}
                                            defaultOptionLabel="All Machines"
                                            searchable={false}
                                            noMargin
                                            onChange={(e) =>
                                                setDraftFilters((p) => ({ ...p, machineId: e.target.value }))
                                            }
                                        />
                                    </div>
                                )}

                                {/* Date Range */}
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Order Date
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="block text-[11px] text-ink-subtle mb-1">From</span>
                                            <TextInput
                                                name="filterFromDate"
                                                type="date"
                                                value={draftFilters.fromDate}
                                                max={draftFilters.toDate || undefined}
                                                onChange={(e) =>
                                                    setDraftFilters((p) => ({ ...p, fromDate: e.target.value }))
                                                }
                                                inputClassName="!py-1.5 !text-xs"
                                            />
                                        </div>
                                        <div>
                                            <span className="block text-[11px] text-ink-subtle mb-1">To</span>
                                            <TextInput
                                                name="filterToDate"
                                                type="date"
                                                value={draftFilters.toDate}
                                                min={draftFilters.fromDate || undefined}
                                                onChange={(e) =>
                                                    setDraftFilters((p) => ({ ...p, toDate: e.target.value }))
                                                }
                                                inputClassName="!py-1.5 !text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </FilterPopover>
                        {can("production_orders.create") && (
                            <CustomButton
                                text="Add Production Order"
                                icon={FaPlus}
                                onClick={() => navigate("/production-orders/create")}
                            />
                        )}
                    </div>
                </div>

                {/* Active filter chips */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2 px-5 py-2 border-b border-line flex-wrap bg-head/20 shrink-0">
                        <span className="text-xs text-ink-subtle">Active filters:</span>

                        {appliedFilters.status && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                                Status: {statusOptions.find(s => s.value === appliedFilters.status)?.label || appliedFilters.status}
                                <FaTimes
                                    className="cursor-pointer hover:opacity-75 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, status: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {appliedFilters.machineId && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                                Machine: {machineOptions.find(m => String(m.value) === String(appliedFilters.machineId))?.label || appliedFilters.machineId}
                                <FaTimes
                                    className="cursor-pointer hover:opacity-75 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, machineId: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {appliedFilters.fromDate && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                                From: {formatDate(appliedFilters.fromDate)}
                                <FaTimes
                                    className="cursor-pointer hover:opacity-75 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, fromDate: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {appliedFilters.toDate && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                                To: {formatDate(appliedFilters.toDate)}
                                <FaTimes
                                    className="cursor-pointer hover:opacity-75 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, toDate: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        <CustomButton
                            text="Clear all"
                            variant="secondary"
                            size="sm"
                            onClick={handleClearFilters}
                            className="!h-6 !px-2.5 !text-xs !rounded-full !font-medium hover:!text-danger ml-1"
                        />
                    </div>
                )}

                {/* Table */}
                <div ref={tableRef} tabIndex={0} data-table-nav className="flex-1 min-h-0 flex flex-col outline-none">
                    <DataTable
                        columns={columns}
                        data={combinedData}
                        rowKey={(item) => item.id}
                        loading={loading}
                        emptyMessage="No production orders found."
                        className="border-0 rounded-none shadow-none flex-1 flex flex-col min-h-0"
                        minHeightClassName="min-h-0 flex-1"
                        rowClassName={(_, idx) => (idx === focusedIndex ? "bg-primary/8 font-medium ring-1 ring-inset ring-primary/30" : "")}
                        onRowClick={(item, idx) => {
                            setFocusedIndex(idx);
                            tableRef.current?.focus({ preventScroll: true });
                            if (item.type === "weekly-group") {
                                handleOpenWeeklyPlan(item);
                            } else {
                                handleOpenViewItem(item);
                            }
                        }}
                        pagination={
                            totalPages > 1
                                ? {
                                      currentPage,
                                      totalPages,
                                      onPageChange: (page) => setCurrentPage(page),
                                  }
                                : undefined
                        }
                    />
                </div>

            </div>

            {/* DELETE PO MODAL */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => { setShowDeleteModal(false); setTimeout(() => tableRef.current?.focus(), 100); }}
                onConfirm={handleDeleteConfirm}
                title="Delete Production Order"
                isDangerous={true}
                message={
                    <>
                        Are you sure you want to delete the production plan for this order?<br />
                        This will remove {itemToDelete.length} Production Order(s) permanently.
                    </>
                }
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default ProductionOrderList;
