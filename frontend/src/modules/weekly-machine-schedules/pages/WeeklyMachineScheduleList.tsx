import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { FaChevronDown, FaChevronRight as FaCaretRight, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
    fetchWeeklyPrograms, deleteWeeklyProgram,
    weeklyProgramCreated, weeklyProgramUpdated, weeklyProgramDeleted,
} from "../../../features/weekly-programs/weeklyProgramSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import CustomButton from "../../../components/ui/Button/Button";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import DataTable from "../../../components/ui/table/DataTable";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 20;

const WeeklyMachineScheduleList: React.FC = () => {
    const navigate   = useNavigate();
    const dispatch   = useAppDispatch();
    const { can }    = usePermission();
    const tableRef   = useRef<HTMLDivElement>(null);

    const { data, loading, error } = useAppSelector((state) => state.weeklyPrograms);

    // ── State ──────────────────────────────────────────────────────────────────
    const [searchTerm,         setSearchTerm]         = useState("");
    const [debouncedSearch,    setDebouncedSearch]    = useState("");
    const [currentPage,        setCurrentPage]        = useState(1);
    const [expandedGroups,     setExpandedGroups]     = useState<Record<string, boolean>>({});
    const [showDeleteModal,    setShowDeleteModal]    = useState(false);
    const [itemToDelete,       setItemToDelete]       = useState<any>(null);
    const [isGroupDelete,      setIsGroupDelete]      = useState(false);

    const getMondayStr = () => {
        const d = new Date();
        const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
        const m = new Date(d.setDate(diff));
        return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
    };
    const [filterWeek, setFilterWeek] = useState<string>(getMondayStr());

    // ── Helpers ────────────────────────────────────────────────────────────────
    const getWeekLabel = (s: string, e: string) => {
        try {
            const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
            return `${new Date(s).toLocaleDateString("en-US", opt)} – ${new Date(e).toLocaleDateString("en-US", opt)}`;
        } catch { return `${s} – ${e}`; }
    };

    const canDelete = (schedule: any, orderStatus: string) => {
        if (!can("weekly_programs.delete")) return false;
        const locked = ["DAILY_PLANNED","IN_PROGRESS","IN_PRODUCTION","POST_PRODUCTION","READY_FOR_DISPATCH","DISPATCHED","COMPLETED","ON_HOLD","FG_RECEIVED"];
        return !locked.includes((schedule.status || "").toUpperCase()) && !locked.includes((orderStatus || "").toUpperCase());
    };

    const toggleGroup = useCallback((key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // ── Group data ─────────────────────────────────────────────────────────────
    const groupedData = useMemo(() => {
        const groups: Record<string, any> = {};
        (Array.isArray(data) ? data : []).forEach((item: any) => {
            if (item.machineId === "MAC-001") return;
            const s = item.weekStartDate.split("T")[0];
            const e = item.weekEndDate.split("T")[0];
            const key = `${s}_${e}`;
            if (!groups[key]) groups[key] = { weekKey: key, weekStartDate: s, weekEndDate: e, orders: {} };

            const poId = item.productionOrderId || "Unassigned";
            if (!groups[key].orders[poId]) {
                groups[key].orders[poId] = {
                    productionOrderId: poId,
                    productName: item.productionOrder?.productItem?.productName || "Unknown Product",
                    plannedQty: 0,
                    uom: item.productionOrder?.uom || item.uom || "",
                    status: item.productionOrder?.status || item.status || "PLANNED",
                    schedules: [],
                };
            }
            groups[key].orders[poId].plannedQty += Number(item.plannedQty) || 0;
            groups[key].orders[poId].schedules.push(item);
        });

        return Object.values(groups).map((g: any) => {
            const ordersList: any[] = Object.values(g.orders);
            return {
                ...g, ordersList,
                totalOrders:     ordersList.length,
                totalPlannedQty: ordersList.reduce((sum: number, o: any) => sum + o.plannedQty, 0),
                uom: ordersList[0]?.uom || "",
            };
        });
    }, [data]);

    const totalPages      = Math.max(1, Math.ceil(groupedData.length / ITEMS_PER_PAGE));
    const startIndex      = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedGroups = groupedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // ── Effects ────────────────────────────────────────────────────────────────
    useEffect(() => { dispatch(fetchMachines()); }, [dispatch]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => {
        dispatch(fetchWeeklyPrograms({ weekStartDate: filterWeek || undefined, search: debouncedSearch || undefined }));
    }, [dispatch, filterWeek, debouncedSearch]);

    useEffect(() => { if (error) toast.error(error); }, [error]);

    useSocketSync("weeklyProgram", { created: weeklyProgramCreated, updated: weeklyProgramUpdated, deleted: weeklyProgramDeleted });

    // ── Keyboard nav ───────────────────────────────────────────────────────────
    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count:        paginatedGroups.length,
        onEnter:      (i) => { const row = paginatedGroups[i]; if (row) toggleGroup(row.weekKey); },
        containerRef: tableRef,
    });

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const active  = document.activeElement as HTMLElement | null;
            const inField = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || active?.isContentEditable;
            const isAlt   = e.altKey && !e.ctrlKey && !e.shiftKey;

            if (e.key === "Escape") {
                if (inField) {
                    e.preventDefault();
                    if (searchTerm && active instanceof HTMLInputElement) setSearchTerm("");
                    active?.blur();
                    tableRef.current?.focus({ preventScroll: true });
                }
                return;
            }
            if ((e.key === "/" && !inField) || (isAlt && e.key.toLowerCase() === "s")) {
                e.preventDefault();
                document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
                return;
            }
            if (inField) return;

            const isTableFocused = active === tableRef.current || tableRef.current?.contains(active) || active === document.body;
            if (isTableFocused) {
                if (e.key === "ArrowLeft" || e.key === "PageUp") {
                    if (currentPage > 1) { e.preventDefault(); setCurrentPage(p => p - 1); }
                } else if (e.key === "ArrowRight" || e.key === "PageDown") {
                    if (currentPage < totalPages) { e.preventDefault(); setCurrentPage(p => p + 1); }
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [searchTerm, currentPage, totalPages]);

    // ── Export ─────────────────────────────────────────────────────────────────
    const fetchForExport = useCallback(async () => {
        const res  = await weeklyProgramService.getAll({ page: 1, limit: 100000 });
        const list = Array.isArray(res) ? res : (res?.data || []);
        return Array.isArray(list) ? list : [];
    }, []);

    const csvColumns = useMemo(() => [
        { header: "Schedule No",  accessor: (i: any) => i.programCode || i.weeklyProgramId || "" },
        { header: "PO Reference", accessor: (i: any) => i.productionOrderId || "" },
        { header: "Product",      accessor: (i: any) => i.product?.productName || i.productName || "" },
        { header: "Machine",      accessor: (i: any) => i.machine?.machineName || i.machineName || "" },
        { header: "Week Range",   accessor: (i: any) => i.startDate && i.endDate ? `${i.startDate.split("T")[0]} to ${i.endDate.split("T")[0]}` : "" },
        { header: "Target Qty",   accessor: (i: any) => i.plannedQty || i.targetQty || 0 },
        { header: "Status",       accessor: (i: any) => i.status || "" },
    ], []);

    const csvFilename = `Weekly_Machine_Schedules_${new Date().toISOString().split("T")[0]}.csv`;

    // ── Page shortcuts ─────────────────────────────────────────────────────────
    usePageShortcuts({
        onRefresh: () => dispatch(fetchWeeklyPrograms({ weekStartDate: filterWeek || undefined, search: debouncedSearch || undefined })),
        onDelete:  () => setShowDeleteModal(true),
        onNew:     () => can("weekly_programs.create") && navigate("/weekly-machine-schedules/create"),
        onExport:  () => document.querySelector<HTMLButtonElement>("[data-export-btn]")?.click(),
    });

    // ── Date filter ────────────────────────────────────────────────────────────
    const handleDateChange = (e: React.ChangeEvent<any>) => {
        const val = e.target.value;
        if (val) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
                const m = new Date(d.setDate(diff));
                setFilterWeek(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`);
            }
        } else {
            setFilterWeek("");
        }
        setCurrentPage(1);
    };

    // ── Delete ─────────────────────────────────────────────────────────────────
    const triggerSingleDelete = useCallback((schedule: any) => {
        setItemToDelete(schedule.weeklyProgramId);
        setIsGroupDelete(false);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;
        try {
            if (isGroupDelete) {
                for (const s of itemToDelete.schedules) await dispatch(deleteWeeklyProgram(s.weeklyProgramId)).unwrap();
                toast.success("Schedule group deleted!");
            } else {
                await dispatch(deleteWeeklyProgram(itemToDelete)).unwrap();
                toast.success("Schedule deleted!");
            }
        } catch (err: any) {
            toast.error(err || "Failed to delete schedule");
        } finally {
            setShowDeleteModal(false);
            setItemToDelete(null);
            setTimeout(() => tableRef.current?.focus(), 100);
        }
    };

    // ── Columns ────────────────────────────────────────────────────────────────
    const columns: DataTableColumn<any>[] = [
        { header: "#", width: "52px", align: "center", render: (_, i) => startIndex + i + 1 },
        {
            header: "", width: "32px", align: "center",
            render: (row) => (
                <span className="text-ink-subtle">
                    {expandedGroups[row.weekKey] ? <FaChevronDown size={11} /> : <FaCaretRight size={11} />}
                </span>
            ),
        },
        {
            header: "WEEK PERIOD",
            render: (row) => <span className="font-bold text-ink">{getWeekLabel(row.weekStartDate, row.weekEndDate)}</span>,
        },
        {
            header: "TOTAL PRODUCTION ORDERS", width: "200px", align: "center",
            render: (row) => (
                <StatusBadge status="UNKNOWN"
                    customText={`${row.totalOrders} Order${row.totalOrders !== 1 ? "s" : ""}`}
                    customColor={{ bg: "#e0f2f1", text: "#0f766e" }}
                />
            ),
        },
        {
            header: "TOTAL WEEKLY QTY", width: "160px", align: "right",
            render: (row) => (
                <span className="font-bold text-emerald-600">
                    {row.totalPlannedQty} {row.uom?.toLowerCase() === "ea" || row.uom?.toLowerCase() === "each" ? "pcs" : row.uom}
                </span>
            ),
        },
    ];

    // ── Sub-row ────────────────────────────────────────────────────────────────
    const renderSubRow = (row: any) => {
        if (!expandedGroups[row.weekKey]) return null;
        return (
            <div className="bg-card-2/60 px-5 py-4 border-t border-line-soft">
                <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-widest mb-3">Production Orders Scheduled</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {row.ordersList.map((order: any) => (
                        <div key={order.productionOrderId} className="bg-card rounded-xl p-4 border border-line shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-ink text-sm">{order.productionOrderId}</h4>
                                    <p className="text-xs text-ink-subtle mt-0.5">{order.productName}</p>
                                </div>
                                <StatusBadge status={order.status} />
                            </div>
                            <div className="flex justify-between text-xs mt-2">
                                <span className="text-ink-subtle">Planned Qty</span>
                                <span className="font-semibold text-ink">
                                    {order.plannedQty} {order.uom?.toLowerCase() === "ea" || order.uom?.toLowerCase() === "each" ? "pcs" : order.uom}
                                </span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-line-soft space-y-2">
                                <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Machines</p>
                                {order.schedules
                                    .filter((s: any) => Number(s.plannedQty) > 0)
                                    .map((schedule: any) => {
                                        const linkedPlan = schedule.productionOrder?.dailyProductionPlans?.find(
                                            (dp: any) => dp.weeklyProgramId === schedule.weeklyProgramId
                                        ) || schedule.productionOrder?.dailyProductionPlans?.[0];
                                        const machine = schedule.machine || schedule.Machine || linkedPlan?.machine;
                                        const shift   = schedule.shift   || schedule.Shift   || linkedPlan?.shift;
                                        return (
                                            <div key={schedule.weeklyProgramId} className="flex items-center justify-between bg-card-2 px-3 py-2 rounded-lg border border-line-soft">
                                                <div>
                                                    <p className="text-xs font-semibold text-primary">
                                                        {machine?.machineName || (schedule.machineId ? `Machine ${schedule.machineId}` : "Not Assigned")}
                                                    </p>
                                                    {shift?.shiftName && <p className="text-[10px] text-ink-subtle mt-0.5">Shift: {shift.shiftName}</p>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-emerald-600">{schedule.plannedQty} {schedule.uom}</span>
                                                    {canDelete(schedule, order.status) && (
                                                        <DeleteButton onClick={(e: any) => { e.stopPropagation(); triggerSingleDelete(schedule); }} />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div>
            <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">

                {/* Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 px-6 py-4 border-b border-line">
                    <h2 className="text-xl font-bold text-ink">Weekly Machine Schedules</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="w-[150px]">
                            <DatePickerCalendar name="filterWeek" value={filterWeek} onChange={(e) => handleDateChange(e as any)} />
                        </div>
                        <SearchInput
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Search... ( / )"
                        />
                        {can("weekly_programs.export") && (
                            <ExportCSVButton fetchData={fetchForExport} columns={csvColumns} filename={csvFilename} text="Export" />
                        )}
                        {can("weekly_programs.create") && (
                            <CustomButton text="Add Schedule" icon={FaPlus} onClick={() => navigate("/weekly-machine-schedules/create")} />
                        )}
                    </div>
                </div>

                {/* Table */}
                <div ref={tableRef} tabIndex={0} data-table-nav className="outline-none focus:outline-none">
                    <DataTable
                        columns={columns}
                        data={paginatedGroups}
                        rowKey={(row) => row.weekKey}
                        loading={loading}
                        emptyMessage="No weekly schedules found."
                        rowClassName={(_, i) => i === focusedIndex ? "bg-primary/8" : ""}
                        onRowClick={(row, i) => { setFocusedIndex(i); tableRef.current?.focus({ preventScroll: true }); toggleGroup(row.weekKey); }}
                        renderSubRow={renderSubRow}
                        pagination={totalPages > 1 ? { currentPage, totalPages, onPageChange: (p) => { setCurrentPage(p); setFocusedIndex(0); } } : undefined}
                    />
                </div>

            </div>

            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => { setShowDeleteModal(false); setTimeout(() => tableRef.current?.focus(), 100); }}
                onConfirm={handleDeleteConfirm}
                title="Delete Weekly Schedule"
                message="Are you sure you want to delete this schedule? This will clear all shift slots allocated for this order."
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default WeeklyMachineScheduleList;
