import React, { useState, useMemo, useCallback, useEffect } from "react";
import { FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronRight as FaCaretRight, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchWeeklyPrograms, deleteWeeklyProgram } from "../../../features/weekly-programs/weeklyProgramSlice";
import CustomButton from "../../../components/ui/Button/Button";

import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import TextInput from "../../../components/form/TextInput/TextInput";

import { fetchMachines } from "../../../features/machines/machineSlice";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

const ITEMS_PER_PAGE = 20;

const WeeklyMachineScheduleList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

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
                    machineName: item.machine?.machineName || item.machineId || "Unknown Machine",
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

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Weekly Machine Schedules</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-[160px]">
                            <TextInput
                                label=""
                                name="filterWeek"
                                type="date"
                                value={filterWeekStartDate}
                                onChange={handleDateChange}
                            />
                        </div>
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search..."
                        />
                        <CustomButton
                            text="Add Schedule"
                            icon={FaPlus}
                            onClick={handleOpenAdd}
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-blue-50">
                            <tr>
                                <th className="px-4 py-3.5 font-semibold text-xs tracking-wide uppercase text-primary w-10"></th>
                                <th className="px-4 py-3.5 font-semibold text-xs tracking-wide uppercase text-primary">WEEK PERIOD</th>
                                <th className="px-4 py-3.5 font-semibold text-xs tracking-wide uppercase text-primary">TOTAL PRODUCTION ORDERS</th>
                                <th className="px-4 py-3.5 font-semibold text-xs tracking-wide uppercase text-primary">TOTAL WEEKLY QUANTITY</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-10 text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                            Loading schedules...
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedGroups.length > 0 ? (
                                paginatedGroups.map((group: any) => (
                                    <React.Fragment key={group.weekKey}>
                                        {/* Parent Row (Week) */}
                                        <tr
                                            className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedGroups[group.weekKey] ? 'bg-white' : ''}`}
                                            onClick={() => toggleGroup(group.weekKey)}
                                        >
                                            <td className="px-4 py-3 text-center text-slate-400">
                                                {expandedGroups[group.weekKey] ? <FaChevronDown size={12} /> : <FaCaretRight size={12} />}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-800">
                                                {getFormattedWeekLabel(group.weekStartDate, group.weekEndDate)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge
                                                    status="UNKNOWN"
                                                    customText={`${group.totalOrders} Production Order(s)`}
                                                    customColor={{ bg: '#e9ecef', text: '#0f766e' }}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-bold text-emerald-600">
                                                {group.totalPlannedQty} {group.uom?.toLowerCase() === 'ea' ? 'pcs' : group.uom}
                                            </td>
                                        </tr>

                                        {/* Expanded Sub-rows (Card Grid Layout) */}
                                        {expandedGroups[group.weekKey] && (
                                            <tr>
                                                <td colSpan={4} className="p-0 border-b border-slate-200">
                                                    <div className="bg-white/80 px-6 py-5 shadow-inner">
                                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                                                            Production Orders Scheduled for this Week
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                            {group.ordersList.map((order: any) => (
                                                                <div key={order.productionOrderId} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <span className="font-bold text-slate-800 text-sm">{order.productionOrderId}</span>
                                                                        <StatusBadge status={order.status} />
                                                                    </div>

                                                                    <div className="text-slate-700 font-medium text-sm mb-3 line-clamp-2" title={order.productName}>
                                                                        {order.productName}
                                                                    </div>

                                                                    <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-auto">
                                                                        <div className="font-bold text-emerald-600">
                                                                            {order.plannedQty} <span className="font-normal text-slate-400 text-xs">{order.uom?.toLowerCase() === 'ea' ? 'pcs' : order.uom}</span>
                                                                        </div>

                                                                        <div>
                                                                            {["IN_PROGRESS", "IN_PRODUCTION", "COMPLETED", "ON_HOLD", "FG_RECEIVED", "READY_FOR_DISPATCH", "DISPATCHED"].includes(order.status) ? (
                                                                                <span className="text-slate-400 text-xs italic bg-slate-100 px-2 py-1 rounded">Started</span>
                                                                            ) : (
                                                                                <DeleteButton onClick={(e) => { e.stopPropagation(); triggerGroupDelete(order); }} />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-10 text-slate-500">No schedules found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 py-4 border-t border-slate-200">
                        <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
                        <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
