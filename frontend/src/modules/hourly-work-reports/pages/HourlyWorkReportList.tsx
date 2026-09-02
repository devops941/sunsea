import React, { useState, useMemo, useCallback, useEffect } from "react";
import { FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronUp } from "react-icons/fa";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchHourlyProductions, deleteHourlyProduction, hourlyProductionCreated, hourlyProductionUpdated, hourlyProductionDeleted } from "../../../features/hourly-productions/hourlyProductionSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import TextInput from "../../../components/form/TextInput/TextInput";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { hourlyProductionService } from "../../../services/hourlyProductionService";

import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 15;

const HourlyWorkReportList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { can } = usePermission();

    const { data, loading, error } = useAppSelector((state) => state.hourlyProductions);
    const { user } = useAppSelector((state) => state.auth);

    const [searchTerm, setSearchTerm] = useState("");
    const getTodayDateStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [filterDate, setFilterDate] = useState(getTodayDateStr());
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedViewGroup, setSelectedViewGroup] = useState<any>(null);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const params: any = {};
            if (filterDate) params.productionDate = filterDate;
            if (searchTerm) params.search = searchTerm;
            dispatch(fetchHourlyProductions(Object.keys(params).length ? params : undefined));
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [dispatch, filterDate, searchTerm]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useSocketSync("hourlyProduction", {
        created: hourlyProductionCreated,
        updated: hourlyProductionUpdated,
        deleted: hourlyProductionDeleted,
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const fetchHourlyForExport = useCallback(async () => {
        try {
            const res = await hourlyProductionService.getAll();
            const list = Array.isArray(res) ? res : (res?.data || []);
            if (Array.isArray(list) && list.length > 0) return list;
        } catch {
            // fallback
        }
        return Array.isArray(data) ? data : [];
    }, [data]);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Date", accessor: (item: any) => item.productionDate ? item.productionDate.split("T")[0] : "" },
            { header: "Hour", accessor: (item: any) => item.hourSlot || item.hourIndex || "" },
            { header: "PO Reference", accessor: (item: any) => item.productionOrderId || "" },
            { header: "Product", accessor: (item: any) => item.product?.productName || item.productName || "" },
            { header: "Machine", accessor: (item: any) => item.machine?.machineName || item.machineId || "" },
            { header: "Shift", accessor: (item: any) => item.shift?.shiftName || item.shiftId || "" },
            { header: "Produced Qty", accessor: (item: any) => item.qtyProduced || 0 },
            { header: "Reject Qty", accessor: (item: any) => item.rejectQty || 0 },
            { header: "Scrap Qty", accessor: (item: any) => item.scrapQty || 0 },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Hourly_Production_Logs_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    const groupedData = useMemo(() => {
        const safeData = Array.isArray(data) ? data : [];

        const filtered = safeData;

        // Group by Date + Machine + Shift
        const groups: { [key: string]: any } = {};

        filtered.forEach((item: any) => {
            const dateStr = item.productionDate ? item.productionDate.split("T")[0] : "";
            const key = `${dateStr}_${item.machineId}_${item.shiftId}`;

            if (!groups[key]) {
                let shiftTotalHours = 8;
                if (item.shift?.startTime && item.shift?.endTime) {
                    const [startH, startM] = item.shift.startTime.split(":").map(Number);
                    const [endH, endM] = item.shift.endTime.split(":").map(Number);
                    const startMin = startH * 60 + startM;
                    let endMin = endH * 60 + endM;
                    if (endMin <= startMin) endMin += 24 * 60;
                    shiftTotalHours = Math.floor((endMin - startMin) / 60);
                }

                groups[key] = {
                    key,
                    productionDate: dateStr,
                    machineId: item.machineId,
                    machineName: item.machine?.machineName || item.machineId,
                    shiftId: item.shiftId,
                    shiftName: item.shift?.shiftName || item.shiftId,
                    productionOrderId: item.productionOrderId,
                    productName: item.productionOrder?.productItem?.productName || "Unknown Product",
                    productCode: item.productionOrder?.productItem?.productCode || "",
                    uom: (item.productionOrder?.productItem?.uom?.uomCode?.toUpperCase() === "EA" ? "PCS" : item.productionOrder?.productItem?.uom?.uomCode?.toUpperCase()) || "PCS",
                    plannedQty: Number(item.shiftPlannedQty || item.productionOrder?.targetQty || 0),
                    dailyPlanId: item.dailyPlanId,
                    poTargetQty: Number(item.productionOrder?.targetQty || 0),
                    weeklyProgramStatus: item.weeklyProgramStatus || null,
                    weeklyProgramId: item.weeklyProgramId || null,
                    totalQtyProduced: 0,
                    totalRejectQty: 0,
                    totalScrapQty: 0,
                    totalDowntime: 0,
                    hours: [],
                    shiftTotalHours: shiftTotalHours
                };
            }

            if (Number(item.hourIndex) > 0) {
                groups[key].totalQtyProduced += Number(item.qtyProduced || 0);
                groups[key].totalRejectQty += Number(item.rejectQty || 0);
                groups[key].totalScrapQty += Number(item.scrapQty || 0);
                groups[key].totalDowntime += Number(item.downtime || 0);
                groups[key].hours.push(item);
            }
        });

        // Convert back to array and sort by Date desc, Machine asc, Shift asc
        const result = Object.values(groups).sort((a: any, b: any) => {
            const dateCompare = b.productionDate.localeCompare(a.productionDate);
            if (dateCompare !== 0) return dateCompare;
            const machineCompare = a.machineName.localeCompare(b.machineName);
            if (machineCompare !== 0) return machineCompare;
            return a.shiftName.localeCompare(b.shiftName);
        });

        // Sort the nested hours in each group by hourIndex asc
        result.forEach((group: any) => {
            group.hours.sort((x: any, y: any) => Number(x.hourIndex) - Number(y.hourIndex));
        });

        // Show a group if:
        // 1. It has real hourly entries (positive hourIndex)
        // 2. OR it's actively IN_PROGRESS (started but no entries yet) so user can log the first hour
        // We intentionally exclude PLANNED/COMPLETED groups with 0 entries to avoid ghost rows
        return result.filter((group: any) => {
            if (group.hours.length > 0) return true;
            // Show active sessions so user can add their first hourly entry
            return group.weeklyProgramStatus === "IN_PROGRESS";
        });
    }, [data]);

    const totalPages = Math.ceil(groupedData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = groupedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);



    const isGroupEditDisabled = useCallback((group: any) => {
        const isStoppedOrCompleted = ["COMPLETED", "STOPPED", "CANCELLED"].includes(group.weeklyProgramStatus);
        const hasLastHourLogged = group.hours.some((hr: any) => Number(hr.hourIndex) >= group.shiftTotalHours);
        return isStoppedOrCompleted || hasLastHourLogged;
    }, []);

    const handleOpenEdit = useCallback((group: any, item: any) => {
        const disabled = isGroupEditDisabled(group);
        navigate(`/hourly-work-reports/edit/${item.hourlyProductionId}`, { 
            state: { ...item, isEditDisabled: disabled } 
        });
    }, [navigate, isGroupEditDisabled]);

    const handleAddHourly = (group: any) => {
        const nextHourIndex = group.hours.length + 1;

        navigate("/hourly-work-reports/create", {
            state: {
                machineId: group.machineId,
                productionDate: group.productionDate,
                shiftId: group.shiftId,
                shiftName: group.shiftName,
                productionOrderId: group.productionOrderId,
                productName: group.productName,
                productCode: group.productCode,
                plannedQty: group.plannedQty,
                uom: group.uom,
                dailyPlanId: group.dailyPlanId,
                hourIndex: nextHourIndex
            }
        });
    };

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await dispatch(deleteHourlyProduction(itemToDelete)).unwrap();
                toast.success("Hourly entry deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete hourly entry");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const handleView = (group: any) => {
        setSelectedViewGroup(group);
        setShowViewModal(true);
    };

    const columns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "",
            width: "40px",
            align: "center",
            render: (group) => {
                const isExpanded = !!expandedGroups[group.key];
                return isExpanded ? <FaChevronUp className="text-ink-subtle" /> : <FaChevronDown className="text-ink-subtle" />;
            }
        },
        {
            header: "DATE",
            width: "90px",
            render: (group) => <span className="font-medium text-ink-subtle">{new Date(group.productionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        },
        {
            header: "MACHINE",
            width: "90px",
            render: (group) => <span className="font-bold">{group.machineName}</span>
        },
        {
            header: "SHIFT",
            width: "120px",
            render: (group) => <StatusBadge status="UNKNOWN" customText={group.shiftName} customColor={{ bg: '#f8f9fa', text: '#212529' }} />
        },
        {
            header: "PO ID",
            width: "100px",
            render: (group) => <span className="font-semibold">{group.productionOrderId}</span>
        },
        {
            header: "PRODUCT",
            width: "minmax(100px, 1fr)",
            render: (group) => <div className="truncate">{group.productName}</div>
        },
        {
            header: "HOURS LOGGED",
            width: "100px",
            render: (group) => {
                const isActiveNoEntry = group.weeklyProgramStatus === "IN_PROGRESS" && group.hours.length === 0;
                if (isActiveNoEntry) {
                    return <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "12px" }}>● Running</span>;
                }
                return <span className="font-bold text-teal-700">{group.hours.length} {group.hours.length === 1 ? "Hour" : "Hours"}</span>;
            }
        },
        {
            header: "TARGET",
            width: "90px",
            render: (group) => <span className="font-bold text-ink">{group.plannedQty} <span className="text-xs text-ink-subtle font-normal">{group.uom}</span></span>
        },
        {
            header: "TOTAL PRODUCED",
            width: "110px",
            render: (group) => {
                const isActiveNoEntry = group.weeklyProgramStatus === "IN_PROGRESS" && group.hours.length === 0;
                if (isActiveNoEntry) {
                    return <span className="text-ink-subtle">— PCS</span>;
                }
                return <span className="font-bold text-emerald-600">{group.totalQtyProduced} <span className="text-xs text-ink-subtle font-normal">{group.uom}</span></span>;
            }
        },
        {
            header: "REJECT / SCRAP",
            width: "105px",
            render: (group) => (
                <>
                    <span className="text-red-500 text-xs font-semibold">R: {group.totalRejectQty}</span> <span className="text-ink-subtle mx-1">|</span> <span className="text-amber-500 text-xs font-semibold">S: {group.totalScrapQty}</span>
                </>
            )
        },
        {
            header: "DOWNTIME",
            width: "90px",
            render: (group) => <span className="text-ink-subtle">{group.totalDowntime > 0 ? `${group.totalDowntime} Mins` : "-"}</span>
        },
        {
            header: "ACTIONS",
            align: "right",
            width: "150px",
            render: (group) => {
                return (
                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                        {group.hours.length >= group.shiftTotalHours || group.weeklyProgramStatus === 'COMPLETED' || group.weeklyProgramStatus === 'STOPPED' || group.weeklyProgramStatus === 'CANCELLED' ? (
                            <div className="flex flex-col items-end justify-center gap-1">
                                <div className="flex items-center justify-end gap-2">
                                    {group.totalQtyProduced >= group.plannedQty || group.hours.length >= group.shiftTotalHours || group.weeklyProgramStatus === 'COMPLETED' ? (
                                        <span className="font-bold text-xs text-green-600">
                                            Completed
                                        </span>
                                    ) : group.weeklyProgramStatus === 'STOPPED' ? (
                                        <span className="font-bold text-xs text-red-600">
                                            Stopped
                                        </span>
                                    ) : group.weeklyProgramStatus === 'CANCELLED' ? (
                                        <span className="font-bold text-xs text-red-600">
                                            Cancelled
                                        </span>
                                    ) : (
                                        <span className="font-bold text-xs text-amber-600">
                                            On Hold
                                        </span>
                                    )}
                                    {can("hourly_productions.view") && (
                                        <ViewButton onClick={() => handleView(group)} />
                                    )}
                                </div>
                                {group.totalQtyProduced < group.plannedQty ? (
                                    <span className="text-red-600 font-bold text-[10px]">
                                        Pending: {group.plannedQty - group.totalQtyProduced} {group.uom}
                                    </span>
                                ) : group.totalQtyProduced > group.plannedQty ? (
                                    <span className="text-green-600 font-bold text-[10px]">
                                        Extra: +{group.totalQtyProduced - group.plannedQty} {group.uom}
                                    </span>
                                ) : null}
                            </div>
                        ) : (
                            can("hourly_productions.create") && (
                                <CustomButton
                                    text="Add Hourly"
                                    size="sm"
                                    onClick={() => handleAddHourly(group)}
                                />
                            )
                        )}
                    </div>
                );
            }
        }
    ], [expandedGroups]);

    const renderSubRow = useCallback((group: any) => {
        const isExpanded = !!expandedGroups[group.key];
        if (!isExpanded) return null;

        return (
            <div className="bg-card-2 p-4 border-b border-line">
                <div className="rounded-2xl p-5 border border-line bg-card shadow-sm">
                    {/* SHIFT SUMMARY DASHBOARD */}
                    <div className="flex items-center justify-between mb-5">
                        <h6 className="font-bold mb-0 text-ink tracking-wide text-sm uppercase">
                            SHIFT SUMMARY DASHBOARD
                        </h6>
                       
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 rounded-xl border border-line-soft bg-card-2/50 text-center">
                            <div className="text-ink-subtle text-[11px] font-bold mb-1 uppercase tracking-wider">Efficiency (OEE)</div>
                            <h3 className="mb-0 font-bold text-ink text-2xl">
                                {group.plannedQty > 0 ? ((group.totalQtyProduced / group.plannedQty) * 100).toFixed(1) : 0}%
                            </h3>
                        </div>
                        <div className="p-4 rounded-xl border border-line-soft bg-card-2/50 text-center">
                            <div className="text-ink-subtle text-[11px] font-bold mb-1 uppercase tracking-wider">Total Produced</div>
                            <h3 className="mb-0 font-bold text-emerald-600 text-2xl">
                                {group.totalQtyProduced}
                            </h3>
                        </div>
                        <div className="p-4 rounded-xl border border-line-soft bg-card-2/50 text-center">
                            <div className="text-ink-subtle text-[11px] font-bold mb-1 uppercase tracking-wider">Scrap Rate</div>
                            <h3 className="mb-0 font-bold text-amber-500 text-2xl">
                                {group.totalQtyProduced > 0 ? ((group.totalScrapQty / group.totalQtyProduced) * 100).toFixed(1) : 0}%
                            </h3>
                        </div>
                        <div className="p-4 rounded-xl border border-line-soft bg-card-2/50 text-center">
                            <div className="text-ink-subtle text-[11px] font-bold mb-1 uppercase tracking-wider">Total Downtime</div>
                            <h3 className="mb-0 font-bold text-red-500 text-2xl">
                                {group.totalDowntime > 0 ? `${group.totalDowntime} min` : "0 min"}
                            </h3>
                        </div>
                    </div>

                    {/* TIMELINE */}
                    <h6 className="font-bold mb-4 text-ink-subtle uppercase tracking-wide text-xs">Hourly Timeline</h6>
                    {group.hours.length === 0 ? (
                        <div className="text-center text-ink-subtle p-6 border border-dashed border-line rounded-xl bg-card-2">
                            No hours logged yet for this shift. Click "Log Next Hour" to start.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {group.hours.map((h: any) => {
                                const hasIssues = h.scrapQty > 0 || h.downtime > 0 || h.rejectQty > 0;
                                return (
                                    <div key={h.hourlyProductionId} className={`flex items-center p-4 rounded-xl border relative ${hasIssues ? "bg-red-500/5 border-red-500/30" : "bg-card-2 border-line-soft"}`}>
                                        {hasIssues && <div className="absolute left-0 top-0 bottom-0 rounded-l-xl w-1.5 bg-red-500"></div>}
                                        {!hasIssues && <div className="absolute left-0 top-0 bottom-0 rounded-l-xl w-1.5 bg-emerald-500"></div>}
                                        <div className="mr-6 text-center ml-3 min-w-[60px]">
                                            <div className="font-bold text-ink-subtle text-[10px] uppercase mb-1 tracking-wider">Hour</div>
                                            <h4 className="mb-0 font-bold font-mono text-ink text-2xl">{h.hourIndex}</h4>
                                        </div>
                                        <div className="flex-grow grid grid-cols-5 items-center gap-4">
                                            <div>
                                                <div className="text-[11px] font-bold tracking-wide uppercase text-ink-subtle mb-1">Produced</div>
                                                <div className="font-bold text-emerald-600 text-xl">{h.qtyProduced} <span className="text-xs text-ink-subtle">{group.uom}</span></div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold tracking-wide uppercase text-ink-subtle mb-1">Reject</div>
                                                <div className={h.rejectQty > 0 ? "font-bold text-red-500 text-lg" : "text-ink-subtle text-lg"}>{h.rejectQty || 0}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold tracking-wide uppercase text-ink-subtle mb-1">Scrap</div>
                                                <div className={h.scrapQty > 0 ? "font-bold text-amber-500 text-lg" : "text-ink-subtle text-lg"}>{h.scrapQty || 0}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold tracking-wide uppercase text-ink-subtle mb-1">Downtime</div>
                                                <div className={h.downtime > 0 ? "font-bold text-red-500 text-lg" : "text-ink-subtle text-lg"}>
                                                    {h.downtime > 0 ? `${h.downtime} min` : "—"}
                                                    {h.downtimeReason && <div className="text-[10px] font-normal text-ink-subtle leading-tight mt-0.5">{h.downtimeReason}</div>}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold tracking-wide uppercase text-ink-subtle mb-1">Operator</div>
                                                <div className="text-ink text-sm font-medium truncate max-w-[120px]" title={h.operatorName || h.operatorId}>{h.operatorName || h.operatorId || "—"}</div>
                                            </div>
                                        </div>
                                        <div className="ml-4 flex gap-2">
                                            {!isGroupEditDisabled(group) ? (
                                                <>
                                                    {can("hourly_productions.edit") && (
                                                        <EditButton onClick={() => handleOpenEdit(group, h)} />
                                                    )}
                                                    {(can("hourly_productions.delete") || user?.roleId === "ROLE_ADMIN") && (
                                                        <DeleteButton onClick={() => triggerDelete(h.hourlyProductionId?.toString())} />
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-ink-subtle text-xs font-semibold select-none flex items-center bg-card-2 border border-line rounded px-2.5 py-1">Locked</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }, [expandedGroups, handleAddHourly, handleOpenEdit, triggerDelete, user?.roleId]);

    return (
        <div>
            <div className="max-w-[1400px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Hourly Production Logs</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search by PO, Product, Machine..."
                        />
                        <div className="w-[160px]">
                            <DatePickerCalendar
                                name="dateFilter"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                            />
                        </div>
                        <ExportCSVButton
                            fetchData={fetchHourlyForExport}
                            columns={csvColumns}
                            filename={csvFilename}
                            text="Export"
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={paginatedData}
                    rowKey={(group) => group.key}
                    loading={loading}
                    emptyMessage="No hourly reports found."
                    onRowClick={(group) => toggleGroup(group.key)}
                    renderSubRow={renderSubRow}
                    getRowStyle={(group) => {
                        const isActiveNoEntry = group.weeklyProgramStatus === "IN_PROGRESS" && group.hours.length === 0;
                        if (isActiveNoEntry) {
                            return {
                                background: "linear-gradient(90deg, #f0fdf4 0%, #fff 100%)",
                                borderLeft: "4px solid #16a34a"
                            };
                        }
                        return {};
                    }}
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: setCurrentPage
                    }}
                />
            </div>

            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Hourly Entry"
                message="Are you sure you want to delete this hourly production log? This action cannot be undone."
                confirmText="Delete"
                confirmVariant="danger"
            />

            {/* View Modal for Completed Shifts */}
            {selectedViewGroup && (
                <CommonModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    title={
                        <span className="text-indigo-700 font-bold tracking-wide uppercase text-sm">
                            Hourly Entries — {selectedViewGroup.shiftName}
                        </span>
                    }
                    maxWidth="5xl"
                >
                    {/* Summary info strip */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5 p-4 bg-card-2 rounded-xl border border-line">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle mb-0.5">Date</div>
                            <div className="text-sm font-semibold text-ink-muted">
                                {new Date(selectedViewGroup.productionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle mb-0.5">Machine</div>
                            <div className="text-sm font-semibold text-ink-muted">{selectedViewGroup.machineName}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle mb-0.5">Product</div>
                            <div className="text-sm font-semibold text-ink-muted">{selectedViewGroup.productName}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle mb-0.5">PO ID</div>
                            <div className="text-sm font-semibold text-indigo-600">{selectedViewGroup.productionOrderId}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle mb-0.5">Operator(s)</div>
                            <div className="text-sm font-semibold text-ink-muted">
                                {selectedViewGroup.hours && selectedViewGroup.hours.length > 0
                                    ? [...new Set(selectedViewGroup.hours.map((h: any) => h.operatorName || h.operatorId).filter(Boolean))].join(", ")
                                    : "N/A"}
                            </div>
                        </div>
                    </div>

                    {/* Hourly entries table */}
                    <div className="overflow-x-auto rounded-xl border border-line">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-card-2 border-b border-line">
                                    <th className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Hour</th>
                                    <th className="py-3 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Produced</th>
                                    <th className="py-3 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Reject</th>
                                    <th className="py-3 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Scrap</th>
                                    <th className="py-3 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Downtime</th>
                                    <th className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Operator</th>
                                    <th className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedViewGroup.hours.map((hour: any, idx: number) => {
                                    const hasIssues = hour.rejectQty > 0 || hour.scrapQty > 0 || hour.downtime > 0;
                                    return (
                                        <tr key={hour.hourlyProductionId || idx} className={`border-b border-line-soft ${hasIssues ? "bg-red-50" : "bg-card"}`}>
                                            <td className="py-3 px-4 font-bold text-ink-muted">Hour {hour.hourIndex}</td>
                                            <td className="py-3 px-4 text-center font-bold text-emerald-600">{hour.qtyProduced} <span className="text-xs text-ink-subtle font-normal">{selectedViewGroup.uom}</span></td>
                                            <td className="py-3 px-4 text-center font-semibold text-red-500">{hour.rejectQty || 0}</td>
                                            <td className="py-3 px-4 text-center font-semibold text-amber-500">{hour.scrapQty || 0}</td>
                                            <td className="py-3 px-4 text-center text-ink-subtle">{hour.downtime > 0 ? `${hour.downtime} min` : "—"}</td>
                                            <td className="py-3 px-4 text-ink-muted">{hour.operatorName || hour.operatorId || "—"}</td>
                                            <td className="py-3 px-4 text-ink-subtle text-xs">{hour.remarks || "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-card-2 border-t-2 border-line">
                                    <td className="py-3 px-4 font-bold text-ink-muted uppercase text-xs tracking-wide">Total</td>
                                    <td className={`py-3 px-4 text-center font-bold text-lg ${selectedViewGroup.totalQtyProduced >= selectedViewGroup.plannedQty ? "text-emerald-600" : "text-red-500"}`}>
                                        {selectedViewGroup.totalQtyProduced}
                                        <span className="text-xs font-normal text-ink-subtle ml-1">{selectedViewGroup.uom}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center font-bold text-red-500">{selectedViewGroup.totalRejectQty}</td>
                                    <td className="py-3 px-4 text-center font-bold text-amber-500">{selectedViewGroup.totalScrapQty}</td>
                                    <td className="py-3 px-4 text-center text-ink-subtle font-semibold">
                                        {selectedViewGroup.totalDowntime > 0 ? `${selectedViewGroup.totalDowntime} min` : "—"}
                                    </td>
                                    <td colSpan={2} className="py-3 px-4 text-ink-subtle text-xs">
                                        <span className="font-semibold text-ink-muted">Planned:</span> {selectedViewGroup.plannedQty} {selectedViewGroup.uom}
                                        {selectedViewGroup.totalQtyProduced < selectedViewGroup.plannedQty && (
                                            <span className="ml-3 text-red-500 font-bold">
                                                ↓ {selectedViewGroup.plannedQty - selectedViewGroup.totalQtyProduced} {selectedViewGroup.uom} short
                                            </span>
                                        )}
                                        {selectedViewGroup.totalQtyProduced > selectedViewGroup.plannedQty && (
                                            <span className="ml-3 text-emerald-600 font-bold">
                                                ↑ +{selectedViewGroup.totalQtyProduced - selectedViewGroup.plannedQty} {selectedViewGroup.uom} extra
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CommonModal>
            )}
        </div>
    );
};

export default HourlyWorkReportList;
