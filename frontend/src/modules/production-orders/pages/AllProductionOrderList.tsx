import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { useNavigate } from "react-router-dom";

import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 15;

const AllProductionOrderList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const [data, setData] = useState<ProductionOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [_rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());

    const fetchRawMaterials = useCallback(async () => {
        try {
            const data = await rawMaterialService.fetchAll();
            const arr = Array.isArray(data) ? data : ((data as any)?.rawMaterials ?? []);
            const map = new Map<string, any>();
            arr.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
            setRawMaterialsMap(map);
        } catch (error) {
            console.error("Failed to fetch raw materials", error);
        }
    }, []);

    useEffect(() => {
        fetchRawMaterials();
    }, [fetchRawMaterials]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await productionOrderService.fetchAll({
                page: 1,
                pageSize: 1000,
                search: searchTerm || undefined,
                status: statusFilter || undefined,
            });

            setData(response.data || []);
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    useSocketSync("productionOrder", undefined, fetchOrders);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);

    const groupedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const groupedPOs = data.reduce((acc: any, po: any) => {
            const parts = po.productionOrderId.split('-');
            const baseId = parts.length > 2 ? `${parts[0]}-${parts[1]}` : po.productionOrderId;

            if (!acc[baseId]) {
                acc[baseId] = {
                    ...po,
                    productionOrderId: baseId,
                    items: [],
                    totalProducts: 0,
                    totalProductionQuantity: 0,
                    productNames: new Set()
                };
            }
            acc[baseId].items.push(po);
            acc[baseId].totalProducts += 1;
            acc[baseId].totalProductionQuantity += Number(po.targetQty) || 0;
            if (po.productItem?.productName) acc[baseId].productNames.add(po.productItem.productName);
            return acc;
        }, {});

        return Object.values(groupedPOs).map((group: any) => {
            const hasPending = group.items.some((po: any) => po.status === "RM_PENDING");
            return {
                ...group,
                status: hasPending && group.status !== "DRAFT" ? "RM_PENDING" : group.status,
                productNames: Array.from(group.productNames).join(", ")
            };
        });
    }, [data]);

    const handleOpenView = useCallback((item: any) => {
        if (!item?.productionOrderId) return;
        navigate(`/production-orders/history/view/${item.productionOrderId}`, { state: { order: item } });
    }, [navigate]);

    const fetchOrdersForExport = useCallback(async () => {
        const response = await productionOrderService.fetchAll({
            page: 1,
            pageSize: 100000,
        });
        const list = response?.data || (Array.isArray(response) ? response : []);
        const groupedPOs = list.reduce((acc: any, po: any) => {
            const parts = po.productionOrderId.split('-');
            const baseId = parts.length > 2 ? `${parts[0]}-${parts[1]}` : po.productionOrderId;

            if (!acc[baseId]) {
                acc[baseId] = {
                    ...po,
                    productionOrderId: baseId,
                    totalProducts: 0,
                    totalProductionQuantity: 0,
                };
            }
            acc[baseId].totalProducts += 1;
            acc[baseId].totalProductionQuantity += Number(po.targetQty) || 0;
            return acc;
        }, {});

        return Object.values(groupedPOs);
    }, []);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "PO No", accessor: (item: any) => item.productionOrderId || "" },
            { header: "Total Products", accessor: (item: any) => item.totalProducts ?? 1 },
            { header: "Total Qty", accessor: (item: any) => item.totalProductionQuantity ?? item.targetQty ?? 0 },
            { header: "Status", accessor: (item: any) => item.status === "DISPATCHED" ? "COMPLETED" : (item.status || "CREATED") },
            { header: "Created Date", accessor: (item: any) => item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN") : "" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Production_Order_History_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    const handleExportCSV = useCallback(async () => {
        if (!can("production_orders.export")) return;
        try {
            toast.info("Preparing CSV export...");
            const items = await fetchOrdersForExport();
            if (!items || items.length === 0) {
                toast.info("No data available to export.");
                return;
            }
            const escapeCSV = (value: any) => {
                if (value === null || value === undefined) return '""';
                const s = String(value);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return `"${s.replace(/"/g, '""')}"`;
                }
                return s;
            };
            const headers = csvColumns.map((col) => escapeCSV(col.header)).join(',');
            const rows = items.map((item: any) => csvColumns.map((col) => escapeCSV(col.accessor(item))).join(','));
            const BOM = '\uFEFF';
            const csvContent = BOM + [headers, ...rows].join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', csvFilename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast.success("Production Order History exported successfully!");
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error(err?.message || "Failed to export CSV");
        }
    }, [can, fetchOrdersForExport, csvColumns, csvFilename]);

    usePageShortcuts({
        onRefresh: () => fetchOrders(),
        onExport: () => handleExportCSV(),
    });

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const totalPages = Math.max(1, Math.ceil(groupedData.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedGroups = groupedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const tableRef = useRef<HTMLDivElement>(null);
    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: paginatedGroups.length,
        onEnter: (i) => {
            const item = paginatedGroups[i];
            if (item) handleOpenView(item);
        },
        containerRef: tableRef,
    });

    // Custom window keyboard navigation and shortcuts handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement as HTMLElement | null;
            const inField =
                active instanceof HTMLInputElement ||
                active instanceof HTMLTextAreaElement ||
                active instanceof HTMLSelectElement ||
                active?.isContentEditable;

            const isCtrl = e.ctrlKey && !e.altKey && !e.shiftKey;
            const isAlt = e.altKey && !e.ctrlKey && !e.shiftKey;
            const isCtrlShift = e.ctrlKey && !e.altKey && e.shiftKey;
            const key = e.key;
            const lowerKey = key ? key.toLowerCase() : "";

            // Escape key: Clear search or exit input focus back to table
            if (key === "Escape") {
                if (inField) {
                    e.preventDefault();
                    if (searchTerm && active instanceof HTMLInputElement) {
                        setSearchTerm("");
                        setCurrentPage(1);
                    }
                    active?.blur();
                    tableRef.current?.focus({ preventScroll: true });
                }
                return;
            }

            // Search shortcut: '/' (when outside input) or 'Alt+S'
            if ((key === "/" && !inField) || (isAlt && lowerKey === "s")) {
                e.preventDefault();
                e.stopPropagation();
                const searchEl = document.querySelector<HTMLInputElement>("[data-search-input]");
                if (searchEl) {
                    searchEl.focus();
                    searchEl.select();
                }
                return;
            }

            // Filter shortcut: 'Alt+F'
            if (isAlt && lowerKey === "f") {
                e.preventDefault();
                e.stopPropagation();
                const filterEl = document.querySelector<HTMLElement>("[name='statusFilter'], [data-select-trigger]");
                if (filterEl) {
                    filterEl.focus();
                    filterEl.click();
                }
                return;
            }

            // Export shortcut: 'Alt+E' or 'Ctrl+Shift+E'
            if ((isAlt && lowerKey === "e") || (isCtrlShift && lowerKey === "e")) {
                e.preventDefault();
                e.stopPropagation();
                handleExportCSV();
                return;
            }

            // If typing in any input/textarea, do not intercept page arrows or home/end
            if (inField) return;

            // If focus is in table, on body, or within page container
            const isTableFocused =
                active === tableRef.current ||
                (tableRef.current && tableRef.current.contains(active)) ||
                active === document.body;

            if (isTableFocused) {
                if (key === "ArrowLeft" || key === "PageUp") {
                    if (currentPage > 1) {
                        e.preventDefault();
                        setCurrentPage((prev) => Math.max(1, prev - 1));
                        setFocusedIndex(0);
                    }
                } else if (key === "ArrowRight" || key === "PageDown") {
                    if (currentPage < totalPages) {
                        e.preventDefault();
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                        setFocusedIndex(0);
                    }
                } else if (key === "Home") {
                    e.preventDefault();
                    setFocusedIndex(0);
                } else if (key === "End") {
                    e.preventDefault();
                    setFocusedIndex(Math.max(0, paginatedGroups.length - 1));
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [searchTerm, currentPage, totalPages, paginatedGroups.length, handleExportCSV, setFocusedIndex]);

    const columns = [
        {
            header: "#",
            width: "65px",
            align: "center" as const,
            render: (_: any, index: number) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
        },
        {
            header: "PO NO",
            width: "minmax(130px, 1fr)",
            render: (item: any) => <span className="font-semibold text-ink">{item.productionOrderId}</span>
        },
        {
            header: "TOTAL PRODUCTS",
            width: "120px",
            render: (item: any) => <span className="text-ink-muted">{item.totalProducts ?? 1}</span>
        },
        {
            header: "TOTAL QTY",
            width: "110px",
            render: (item: any) => <span className="text-ink-muted">{item.totalProductionQuantity ?? item.targetQty}</span>
        },
        {
            header: "STATUS",
            width: "190px",
            render: (item: any) => {
                const s = item.status || 'CREATED';
                if (s === 'DISPATCHED') {
                    return <StatusBadge status="COMPLETED" customText="Completed" />;
                }
                return <StatusBadge status={s} />;
            }
        },
        {
            header: "CREATED DATE",
            width: "130px",
            render: (item: any) => <span className="text-ink-muted">{formatDate(item.createdAt)}</span>
        },
        {
            header: "ACTIONS",
            width: "80px",
            render: (item: any) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <ViewButton onClick={() => handleOpenView(item)} />
                </div>
            )
        }
    ];

    return (
        <div>
            <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Production Order History</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div style={{ minWidth: '180px' }} title="Filter by Status (Alt+F)">
                            <SelectInput
                                label=""
                                hideLabel
                                name="statusFilter"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                options={[
                                    { label: "All Statuses", value: "" },
                                    { label: "Draft", value: "DRAFT" },
                                    { label: "Created", value: "CREATED" },
                                    { label: "Waiting For Material", value: "WAITING_FOR_MATERIAL" },
                                    { label: "Ready For Planning", value: "READY_FOR_PLANNING" },
                                    { label: "Weekly Scheduled", value: "WEEKLY_SCHEDULED" },
                                    { label: "Daily Planned", value: "DAILY_PLANNED" },
                                    { label: "In Progress", value: "IN_PROGRESS" },
                                    { label: "In Production", value: "IN_PRODUCTION" },
                                    { label: "Post Production", value: "POST_PRODUCTION" },
                                    { label: "Ready For Dispatch", value: "READY_FOR_DISPATCH" },
                                    { label: "Partially Dispatched", value: "PARTIAL_COMPLETED" },
                                    { label: "Completed With Shortfall", value: "COMPLETED_WITH_SHORTFALL" },
                                    { label: "Closed", value: "CLOSED" },
                                    { label: "Completed", value: "DISPATCHED" },
                                    { label: "Cancelled", value: "CANCELLED" },
                                ]}
                            />
                        </div>
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search orders... ( / )"
                        />
                        {can("production_orders.export") && (
                            <ExportCSVButton
                                fetchData={fetchOrdersForExport}
                                columns={csvColumns}
                                filename={csvFilename}
                                text="Export"
                            />
                        )}
                    </div>
                </div>

                {/* Table Container with Keyboard Navigation */}
                <div
                    ref={tableRef}
                    tabIndex={0}
                    data-table-nav
                    className="outline-none focus:outline-none"
                    aria-label="Production order history table navigation"
                >
                    <DataTable
                        columns={columns}
                        data={paginatedGroups}
                        rowKey={(item) => item.productionOrderId}
                        loading={loading}
                        emptyMessage="No production orders found."
                        rowClassName={(_, i) =>
                            i === focusedIndex ? "bg-primary/8" : ""
                        }
                        onRowClick={(item, i) => {
                            setFocusedIndex(i);
                            tableRef.current?.focus({ preventScroll: true });
                            handleOpenView(item);
                        }}
                        pagination={{
                            currentPage,
                            totalPages,
                            onPageChange: (page) => {
                                setCurrentPage(page);
                                setFocusedIndex(0);
                            }
                        }}
                    />
                </div>

                {/* Keyboard Shortcuts Legend Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 bg-head/70 border-t border-line-soft text-xs text-ink-muted select-none">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">↑</kbd>
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">↓</kbd>
                            <span className="text-[11px]">Navigate</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">↵ Enter</kbd>
                            <span className="text-[11px]">View Order</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">←</kbd>
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">→</kbd>
                            <span className="text-[11px]">Page</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">/</kbd>
                            <span className="text-[11px]">Search</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">Alt+F</kbd>
                            <span className="text-[11px]">Filter</span>
                        </span>
                        {can("production_orders.export") && (
                            <span className="inline-flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">Alt+E</kbd>
                                <span className="text-[11px]">Export</span>
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">F5</kbd>
                            <span className="text-[11px]">Refresh</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-card border border-line-soft rounded text-ink shadow-2xs">Esc</kbd>
                            <span className="text-[11px]">Exit Search</span>
                        </span>
                    </div>
                    {groupedData.length > 0 && (
                        <div className="text-[11px] font-medium text-ink-subtle hidden sm:block">
                            Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, groupedData.length)} of {groupedData.length} Orders
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AllProductionOrderList;

