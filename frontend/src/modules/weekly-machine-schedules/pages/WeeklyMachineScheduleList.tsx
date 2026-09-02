import React, { useState, useMemo, useCallback, useEffect } from "react";
import { FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronRight as FaCaretRight, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchWeeklyPrograms, deleteWeeklyProgram, weeklyProgramCreated, weeklyProgramUpdated, weeklyProgramDeleted } from "../../../features/weekly-programs/weeklyProgramSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import CustomButton from "../../../components/ui/Button/Button";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { weeklyProgramService } from "../../../services/weeklyProgramService";

import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import TextInput from "../../../components/form/TextInput/TextInput";

import { fetchMachines } from "../../../features/machines/machineSlice";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import DataTable from "../../../components/ui/table/DataTable";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";

import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 20;

const WeeklyMachineScheduleList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { can } = usePermission();

    const getFormattedWeekLabel = (startDateStr: string, endDateStr: string) => {
        try {
            const start = new Date(startDateStr);
            const end = new Date(endDateStr);
            const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
            return `${start.toLocaleDateString("en-US", opt)} - ${end.toLocaleDateString("en-US", opt)}`;
        } catch {
            return `${startDateStr} - ${endDateStr}`;
        }
    };

    const canDeleteSchedule = (schedule: any, orderStatus: string) => {
        if (!can("weekly_programs.delete")) return false;
        const lockedStatuses = [
            "DAILY_PLANNED",
            "IN_PROGRESS",
            "IN_PRODUCTION",
            "POST_PRODUCTION",
            "READY_FOR_DISPATCH",
            "DISPATCHED",
            "COMPLETED",
            "ON_HOLD",
            "FG_RECEIVED"
        ];
        const schedStatus = (schedule.status || "").toUpperCase();
        const poStatus = (orderStatus || "").toUpperCase();

        if (lockedStatuses.includes(schedStatus) || lockedStatuses.includes(poStatus)) {
            return false;
        }
        return true;
    };

    const { data, loading, error } = useAppSelector((state) => state.weeklyPrograms);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);
    const [isGroupDelete, setIsGroupDelete] = useState<boolean>(false);


    const getMondayDateStr = () => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const year = monday.getFullYear();
        const month = String(monday.getMonth() + 1).padStart(2, '0');
        const date = String(monday.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
    };

    const [filterWeekStartDate, setFilterWeekStartDate] = useState<string>(getMondayDateStr());


    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

    // Keep track of which weeks are expanded
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (weekKey: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [weekKey]: !prev[weekKey]
        }));
    };

    const fetchSchedulesForExport = useCallback(async () => {
        const res = await weeklyProgramService.getAll({ page: 1, limit: 100000 });
        const list = Array.isArray(res) ? res : (res?.data || []);
        return Array.isArray(list) ? list : [];
    }, []);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Schedule No", accessor: (item: any) => item.programCode || item.weeklyProgramId || item.id || "" },
            { header: "PO Reference", accessor: (item: any) => item.productionOrderId || "" },
            { header: "Product", accessor: (item: any) => item.product?.productName || item.productName || item.salesProductName || "" },
            { header: "Machine", accessor: (item: any) => item.machine?.machineName || item.machineName || item.machineId || "" },
            { header: "Week Range", accessor: (item: any) => item.startDate && item.endDate ? `${item.startDate.split("T")[0]} to ${item.endDate.split("T")[0]}` : "" },
            { header: "Target Qty", accessor: (item: any) => item.plannedQty || item.targetQty || 0 },
            { header: "Status", accessor: (item: any) => item.status || "" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Weekly_Machine_Schedules_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    useEffect(() => {
        dispatch(fetchMachines());
    }, [dispatch]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        dispatch(fetchWeeklyPrograms({
            weekStartDate: filterWeekStartDate || undefined,
            search: debouncedSearchTerm || undefined
        }));
    }, [dispatch, filterWeekStartDate, debouncedSearchTerm]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useSocketSync("weeklyProgram", {
        created: weeklyProgramCreated,
        updated: weeklyProgramUpdated,
        deleted: weeklyProgramDeleted,
    });

    const handleSearch = (e: React.ChangeEvent<any>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleDateChange = (e: React.ChangeEvent<any>) => {
        const val = e.target.value;
        if (val) {
            const date = new Date(val);
            if (!isNaN(date.getTime())) {
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                const mondayDate = new Date(date.setDate(diff));

                const yyyy = mondayDate.getFullYear();
                const mm = String(mondayDate.getMonth() + 1).padStart(2, '0');
                const dd = String(mondayDate.getDate()).padStart(2, '0');

                setFilterWeekStartDate(`${yyyy}-${mm}-${dd}`);
            }
        } else {
            setFilterWeekStartDate("");
        }
        setCurrentPage(1);
    };

    // Group weekly programs by week period
    const groupedData = useMemo(() => {
        const safeData = Array.isArray(data) ? data : [];
        const groups: Record<string, any> = {};

        safeData.forEach((item: any) => {
            if (item.machineId === "MAC-001") return; // Exclude MAC-001

            const startStr = item.weekStartDate.split('T')[0];
            const endStr = item.weekEndDate.split('T')[0];
            const weekKey = `${startStr}_${endStr}`;

            if (!groups[weekKey]) {
                groups[weekKey] = {
                    weekKey,
                    weekStartDate: startStr,
                    weekEndDate: endStr,
                    orders: {}
                };
            }

            const poId = item.productionOrderId || "Unassigned";
            if (!groups[weekKey].orders[poId]) {
                groups[weekKey].orders[poId] = {
                    productionOrderId: poId,
                    productName: item.productionOrder?.productItem?.productName || "Unknown Product",
                    priority: item.priority || "MEDIUM",
                    machineName: item.machine?.machineName || item.Machine?.machineName || item.machineName || (item.machineId ? `Machine ${item.machineId}` : "Machine Not Assigned"),
                    plannedQty: 0,
                    uom: item.productionOrder?.uom || item.uom || "",
                    status: item.productionOrder?.status || item.status || "PLANNED",
                    schedules: []
                };
            }

            groups[weekKey].orders[poId].plannedQty += (Number(item.plannedQty) || 0);
            groups[weekKey].orders[poId].schedules.push(item);
        });

        // Convert to array of week objects
        return Object.values(groups).map((group: any) => {
            const ordersList: any[] = Object.values(group.orders);
            return {
                ...group,
                ordersList,
                totalOrders: ordersList.length,
                totalPlannedQty: ordersList.reduce((sum: number, o: any) => sum + o.plannedQty, 0),
                uom: ordersList[0]?.uom || ""
            };
        });
    }, [data]);

    const totalPages = Math.ceil(groupedData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedGroups = groupedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = () => {
        navigate("/weekly-machine-schedules/create");
    };



    const triggerGroupDelete = useCallback((group: any) => {
        setItemToDelete(group);
        setIsGroupDelete(true);
        setShowDeleteModal(true);
    }, []);

    const triggerSingleDelete = useCallback((schedule: any) => {
        setItemToDelete(schedule.weeklyProgramId);
        setIsGroupDelete(false);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                if (isGroupDelete) {
                    for (const schedule of itemToDelete.schedules) {
                        await dispatch(deleteWeeklyProgram(schedule.weeklyProgramId)).unwrap();
                    }
                    toast.success("Schedule group deleted successfully!");
                } else {
                    await dispatch(deleteWeeklyProgram(itemToDelete)).unwrap();
                    toast.success("Schedule deleted successfully!");
                }
                navigate("/production-orders");
            } catch (err: any) {
                toast.error(err || "Failed to delete schedule");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const columns: DataTableColumn<any>[] = [
        {
            header: "",
            accessor: "expand",
            align: "center",
            render: (row) => (
                <div className="text-ink-subtle">
                    {expandedGroups[row.weekKey] ? <FaChevronDown size={12} /> : <FaCaretRight size={12} />}
                </div>
            ),
        },
        {
            header: "WEEK PERIOD",
            accessor: "weekKey",
            render: (row) => (
                <span className="font-bold text-ink">
                    {getFormattedWeekLabel(row.weekStartDate, row.weekEndDate)}
                </span>
            )
        },
        {
            header: "TOTAL PRODUCTION ORDERS",
            accessor: "totalOrders",
            render: (row) => (
                <StatusBadge
                    status="UNKNOWN"
                    customText={`${row.totalOrders} Production Order(s)`}
                    customColor={{ bg: '#e9ecef', text: '#0f766e' }}
                />
            )
        },
        {
            header: "TOTAL WEEKLY QUANTITY",
            accessor: "totalPlannedQty",
            render: (row) => (
                <span className="font-bold text-emerald-600">
                    {row.totalPlannedQty} {row.uom?.toLowerCase() === 'ea' || row.uom?.toLowerCase() === 'each' ? 'pcs' : row.uom}
                </span>
            )
        }
    ];

    const renderSubRow = (row: any) => {
        if (!expandedGroups[row.weekKey]) return null;
        return (
            <div className="bg-card/80 px-6 py-5 shadow-inner">
                <div className="text-xs font-bold text-ink-subtle uppercase tracking-widest mb-4">
                    Production Orders Scheduled for this Week
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {row.ordersList.map((order: any) => (
                        <div key={order.productionOrderId} className="bg-card rounded-xl p-4 border border-line shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-ink text-sm">{order.productionOrderNumber}</h4>
                                    <p className="text-xs text-ink-subtle">{order.productName}</p>
                                </div>
                                <StatusBadge status={order.status} />
                            </div>
                            
                            <div className="mt-3 space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-ink-subtle">Planned Qty:</span>
                                    <span className="font-medium text-ink-muted">{order.plannedQty} {order.uom?.toLowerCase() === 'ea' || order.uom?.toLowerCase() === 'each' ? 'pcs' : order.uom}</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-line-soft">
                                <div className="text-[11px] font-semibold text-ink-subtle mb-2 uppercase">Scheduled Machines</div>
                                <div className="space-y-2">
                                    {order.schedules
                                        .filter((schedule: any) => Number(schedule.plannedQty) > 0)
                                        .map((schedule: any) => {
                                        const linkedDailyPlan = schedule.productionOrder?.dailyProductionPlans?.find(
                                            (dp: any) => dp.weeklyProgramId === schedule.weeklyProgramId
                                        ) || schedule.productionOrder?.dailyProductionPlans?.[0];
                                        const assignedMachine = schedule.machine || schedule.Machine || linkedDailyPlan?.machine;
                                        const assignedShift = schedule.shift || schedule.Shift || linkedDailyPlan?.shift;
                                        const assignedMachineId = schedule.machineId || linkedDailyPlan?.machineId;
                                        const assignedShiftId = schedule.shiftId || linkedDailyPlan?.shiftId;
                                        
                                        return (
                                        <div key={schedule.weeklyProgramId} className="flex items-center justify-between bg-card-2 p-2 rounded-lg border border-line-soft">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-indigo-700">
                                                    {assignedMachine?.machineName || schedule.machineName || (assignedMachineId ? `Machine ${assignedMachineId}` : "Machine Not Assigned")}
                                                </span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {assignedMachineId && (
                                                        <span className="text-[10px] text-ink-subtle">ID: {assignedMachineId}</span>
                                                    )}
                                                    {(assignedShift?.shiftName || assignedShiftId) && (
                                                        <>
                                                            <span className="text-[10px] text-ink-subtle mx-1">|</span>
                                                            <span className="text-[10px] text-ink-subtle bg-line/60 px-1 rounded">Shift: {assignedShift?.shiftName || assignedShiftId}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-emerald-600">{schedule.plannedQty} {schedule.uom}</div>
                                                </div>
                                                {canDeleteSchedule(schedule, order.status) && (
                                                    <DeleteButton onClick={(e: any) => {
                                                        e.stopPropagation();
                                                        triggerSingleDelete(schedule);
                                                    }} />
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* <div className="mt-4 flex justify-end">
                    <button
                        className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline transition-colors flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); triggerGroupDelete(row); }}
                    >
                        Delete Entire Week Schedule
                    </button>
                </div> */}
            </div>
        );
    };

    return (
        <div>
            <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Weekly Machine Schedules</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-[160px]">
                            <DatePickerCalendar
                                name="filterWeek"
                                value={filterWeekStartDate}
                                onChange={(e) => handleDateChange(e as any)}
                            />
                        </div>
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search..."
                        />
                        <ExportCSVButton
                            fetchData={fetchSchedulesForExport}
                            columns={csvColumns}
                            filename={csvFilename}
                            text="Export"
                        />
                        {can("weekly_programs.create") && (
                            <CustomButton
                                text="Add Schedule"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="p-0">
                    <DataTable
                        columns={columns}
                        data={paginatedGroups}
                        rowKey={(row) => row.weekKey}
                        loading={loading}
                        onRowClick={(row) => toggleGroup(row.weekKey)}
                        renderSubRow={renderSubRow}
                        emptyMessage="No weekly schedules found."
                    />
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 py-4 border-t border-line">
                        <button className="p-2 rounded-lg border border-line hover:bg-card-2 disabled:opacity-40" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                            <svg className="w-4 h-4 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="text-sm text-ink-muted">Page {currentPage} of {totalPages}</span>
                        <button className="p-2 rounded-lg border border-line hover:bg-card-2 disabled:opacity-40" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                            <svg className="w-4 h-4 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                )}
            </div>
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Weekly Schedule Allocation"
                message={
                    <>
                        Are you sure you want to delete this weekly schedule allocation?<br />
                        This will clear all shift run slots allocated to this order for the week.
                    </>
                }
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default WeeklyMachineScheduleList;
