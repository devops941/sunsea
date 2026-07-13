import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
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
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={4} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Weekly Machine Schedules</h2>
                                
                            </div>
                        </Col>
                        <Col lg={8} md={12}>
                            <div className="page-header-actions weekely-list d-flex gap-2 align-items-center flex-wrap">
                                <div style={{ width: '150px' }}>
                                    <TextInput
                                        label=""
                                        name="filterWeek"
                                        type="date"
                                        value={filterWeekStartDate}
                                        onChange={handleDateChange}
                                    />
                                </div>
                                <div style={{ width: '250px' }}>
                                    <TextInput
                                        label=""
                                        name="search"
                                        type="text"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Schedule"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "40px" }}></th>
                                    <th>WEEK PERIOD</th>
                                    <th>TOTAL PRODUCTION ORDERS</th>
                                    <th>TOTAL WEEKLY QUANTITY</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="text-center p-4">
                                            <Spinner animation="border" variant="primary" />
                                        </td>
                                    </tr>
                                ) : paginatedGroups.length > 0 ? (
                                    paginatedGroups.map((group: any) => (
                                        <React.Fragment key={group.weekKey}>
                                            {/* Parent Row (Week) */}
                                            <tr 
                                                className={`master-data-row cursor-pointer ${expandedGroups[group.weekKey] ? 'bg-light' : ''}`}
                                                onClick={() => toggleGroup(group.weekKey)}
                                                style={{ transition: "background-color 0.2s" }}
                                            >
                                                <td className="master-data-cell text-center text-secondary" style={{ width: "40px" }}>
                                                    {expandedGroups[group.weekKey] ? <FaChevronDown /> : <FaCaretRight />}
                                                </td>
                                                <td className="master-data-cell fw-bold text-dark">
                                                    {getFormattedWeekLabel(group.weekStartDate, group.weekEndDate)}
                                                </td>
                                                <td className="master-data-cell">
                                                    <StatusBadge 
                                                        status="UNKNOWN" 
                                                        customText={`${group.totalOrders} Production Order(s)`} 
                                                        customColor={{ bg: '#e9ecef', text: '#0f766e' }}
                                                    />
                                                </td>
                                                <td className="master-data-cell fw-bold text-success">
                                                    {group.totalPlannedQty} <span className="fw-normal text-muted small">{group.uom?.toLowerCase() === 'ea' ? 'pcs' : group.uom}</span>
                                                </td>
                                            </tr>

                                            {/* Expanded Sub-table Details */}
                                            {expandedGroups[group.weekKey] && (
                                                <tr>
                                                    <td></td>
                                                    <td colSpan={3} className="p-3 bg-light rounded" style={{ borderLeft: "3px solid var(--color-primary, #0f766e)" }}>
                                                        <div className="table-responsive">
                                                            <table className="master-data-table mb-0 shadow-sm" style={{ width: "100%", background: "#fff", borderRadius: "8px", overflow: "hidden" }}>
                                                                 <thead>
                                                                    <tr style={{ background: "#f1f5f9" }}>
                                                                        <th className="master-data-cell fw-bold text-uppercase text-secondary" style={{ fontSize: "11px" }}>Production Order</th>
                                                                        <th className="master-data-cell fw-bold text-uppercase text-secondary" style={{ fontSize: "11px" }}>Product Name</th>
                                                                        <th className="master-data-cell fw-bold text-uppercase text-secondary" style={{ fontSize: "11px" }}>Planned Qty</th>
                                                                        <th className="master-data-cell fw-bold text-uppercase text-secondary" style={{ fontSize: "11px" }}>Status</th>
                                                                        <th className="master-data-cell fw-bold text-uppercase text-secondary text-end" style={{ fontSize: "11px", width: "120px" }}>Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {group.ordersList.map((order: any) => (
                                                                        <tr key={order.productionOrderId} className="master-data-row">
                                                                            <td className="master-data-cell fw-bold text-dark">{order.productionOrderId}</td>
                                                                            <td className="master-data-cell fw-semibold">{order.productName}</td>
                                                                            <td className="master-data-cell fw-bold text-success">{order.plannedQty} {order.uom?.toLowerCase() === 'ea' ? 'pcs' : order.uom}</td>
                                                                            <td className="master-data-cell">
                                                                                <StatusBadge status={order.status} />
                                                                            </td>
                                                                            <td className="master-data-cell text-end">
                                                                                {["IN_PROGRESS", "IN_PRODUCTION", "COMPLETED", "ON_HOLD", "FG_RECEIVED", "READY_FOR_DISPATCH", "DISPATCHED"].includes(order.status) ? (
                                                                                    <span className="text-secondary small fw-medium fst-italic">Started</span>
                                                                                ) : (
                                                                                    <div className="d-flex justify-content-end gap-2">
                                                                                        <DeleteButton onClick={(e) => { e.stopPropagation(); triggerGroupDelete(order); }} />
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center p-4">No schedules found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className="pagination-wrap">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">Page {currentPage} of {totalPages}</div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Weekly Schedule Allocation"
                    message={
                        <>
                            Are you sure you want to delete this weekly schedule allocation?<br/>
                            This will clear all shift run slots allocated to this order for the week.
                        </>
                    }
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default WeeklyMachineScheduleList;
