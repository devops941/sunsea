import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner} from "react-bootstrap";
import {FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronRight as FaCaretRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchWeeklyPrograms, deleteWeeklyProgram } from "../../../features/weekly-programs/weeklyProgramSlice";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import { fetchMachines } from "../../../features/machines/machineSlice";

const ITEMS_PER_PAGE = 20;

const WeeklyMachineScheduleList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const getScheduleDateParts = (weekStartDateStr: string, dayOfWeek: number) => {
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const dayName = days[dayOfWeek - 1] || `Day ${dayOfWeek}`;
        if (!weekStartDateStr) return { dayName, dateStr: "" };
        
        try {
            const cleanDateStr = weekStartDateStr.split('T')[0];
            const [yyyy, mm, dd] = cleanDateStr.split('-').map(Number);
            const date = new Date(Date.UTC(yyyy, mm - 1, dd + (dayOfWeek - 1)));
            const formattedDate = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });
            return { dayName, dateStr: formattedDate };
        } catch {
            return { dayName, dateStr: "" };
        }
    };
    
    // const getScheduleDayAndDate = (weekStartDateStr: string, dayOfWeek: number) => {
    //     const parts = getScheduleDateParts(weekStartDateStr, dayOfWeek);
    //     return parts.dateStr ? `${parts.dayName} (${parts.dateStr})` : parts.dayName;
    // };
    
    const { data, loading, error } = useAppSelector((state) => state.weeklyPrograms);
    const { user } = useAppSelector((state) => state.auth);
    
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);
    const [isGroupDelete, setIsGroupDelete] = useState<boolean>(false);

    const [filterMachineId, setFilterMachineId] = useState<string>("");
    const [filterWeekStartDate, setFilterWeekStartDate] = useState<string>("");

    const { data: machines } = useAppSelector((state) => state.machines);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

    // Accordion state: keep track of which Production Orders are expanded
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (prodOrderId: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [prodOrderId]: !prev[prodOrderId]
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
            machineId: filterMachineId || undefined, 
            weekStartDate: filterWeekStartDate || undefined,
            search: debouncedSearchTerm || undefined
        }));
    }, [dispatch, filterMachineId, filterWeekStartDate, debouncedSearchTerm]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Group data by productionOrderId
    const groupedData = useMemo(() => {
        const safeData = Array.isArray(data) ? data : [];
        const groups: Record<string, any> = {};
        safeData.forEach((item: any) => {
            const poId = item.productionOrderId || "Unassigned";
            if (!groups[poId]) {
                groups[poId] = {
                    productionOrderId: poId,
                    productName: item.productionOrder?.productItem?.productName || "Unknown Product",
                    priority: item.priority || "MEDIUM",
                    totalPlannedQty: 0,
                    uom: item.productionOrder?.uom || item.uom || "",
                    schedules: [],
                    minDate: item.weekStartDate,
                    maxDate: item.weekEndDate,
                    status: item.productionOrder?.status || item.status || "UNKNOWN"
                };
            }
            groups[poId].schedules.push(item);
            groups[poId].totalPlannedQty += (Number(item.plannedQty) || 0);

            if (new Date(item.weekStartDate) < new Date(groups[poId].minDate)) {
                groups[poId].minDate = item.weekStartDate;
            }
            if (new Date(item.weekEndDate) > new Date(groups[poId].maxDate)) {
                groups[poId].maxDate = item.weekEndDate;
            }
        });
        return Object.values(groups);
    }, [data]);

    const totalPages = Math.ceil(groupedData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedGroups = groupedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
console.log("fd",paginatedGroups)

    // const handleOpenAdd = () => {
    //     navigate("/weekly-machine-schedules/create");
    // };

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/weekly-machine-schedules/edit/${item.weeklyProgramId}?po=${item.productionOrderId}`, { state: item });
    }, [navigate]);

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
                                <div className="page-breadcrumb">Home / Production / Weekly Schedules</div>
                            </div>
                        </Col>
                        <Col lg={8} md={12}>
                            <div className="page-header-actions weekely-list d-flex gap-2 align-items-center flex-wrap">
                                <div style={{ width: '250px' }}>
                                    <SelectInput
                                        label="Filter Machine"
                                        hideLabel
                                        name="filterMachine"
                                        options={[{ value: '', label: 'All Machines' }, ...(machines?.map((m: any) => ({ value: m.machineId, label: m.machineName })) || [])]}
                                        value={filterMachineId}
                                        onChange={(e) => { setFilterMachineId(e.target.value); setCurrentPage(1); }}
                                    />
                                </div>
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
                                {/* <CustomButton
                                    text="Add Schedule"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                /> */}
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
                                    <th>PRODUCTION ORDER</th>
                                    <th>PRODUCT</th>
                                    <th>PRIORITY</th>
                                    <th>MACHINE / SHIFT</th>
                                    <th>WEEK DATES</th>
                                    <th>PLANNED QTY</th>
                                    <th>STATUS</th>
                                    <th style={{ width: "100px", textAlign: "right" }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="text-center p-4">
                                            <Spinner animation="border" variant="primary" />
                                        </td>
                                    </tr>
                                ) : paginatedGroups.length > 0 ? (
                                    paginatedGroups.map((group: any) => (
                                        <React.Fragment key={group.productionOrderId}>
                                            {/* Parent Row */}
                                            <tr 
                                                className={`master-data-row cursor-pointer ${expandedGroups[group.productionOrderId] ? 'bg-light' : ''}`}
                                                onClick={() => toggleGroup(group.productionOrderId)}
                                                style={{ transition: "background-color 0.2s" }}
                                            >
                                                <td className="master-data-cell text-center text-secondary" style={{ width: "40px" }}>
                                                    {expandedGroups[group.productionOrderId] ? <FaChevronDown /> : <FaCaretRight />}
                                                </td>
                                                <td className="master-data-cell fw-bold text-dark">
                                                    {group.productionOrderId}
                                                </td>
                                                <td className="master-data-cell fw-bold">
                                                    {group.productName}
                                                </td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={group.priority} />
                                                </td>
                                                <td className="master-data-cell">
                                                    <StatusBadge 
                                                        status="UNKNOWN" 
                                                        customText={`${group.schedules.length} Schedule(s)`} 
                                                        customColor={{ bg: '#e9ecef', text: '#495057' }}
                                                    />
                                                </td>
                                                <td className="master-data-cell text-muted small">
                                                    {group.minDate && new Date(group.minDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                                                    {group.minDate !== group.maxDate && ` - ${new Date(group.maxDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                                </td>
                                                <td className="master-data-cell fw-bold text-success">
                                                    {group.totalPlannedQty} <span className="fw-normal text-muted small">{group.uom}</span>
                                                </td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={group.status} />
                                                </td>
                                                <td className="master-data-cell text-end">
                                                    {["IN_PROGRESS", "IN_PRODUCTION", "COMPLETED", "ON_HOLD", "FG_RECEIVED", "READY_FOR_DISPATCH", "DISPATCHED"].includes(group.status) ? (
                                                        <span className="text-secondary small fw-medium fst-italic">Production Started</span>
                                                    ) : (
                                                        <div className="table-action-group justify-content-end" style={{ gap: '0.5rem' }}>
                                                            <EditButton onClick={(e) => { e.stopPropagation(); handleOpenEdit(group.schedules[0]); }} />
                                                            {user?.roleId === "ROLE_ADMIN" && (
                                                                <DeleteButton onClick={(e) => { e.stopPropagation(); triggerGroupDelete(group); }} />
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Child Rows (Schedules) */}
                                            {expandedGroups[group.productionOrderId] && group.schedules.map((item: any) => (
                                                <tr key={item.weeklyProgramId} className="master-data-row" style={{ backgroundColor: "#fdfdfd" }}>
                                                    <td className="master-data-cell"></td>
                                                    <td className="master-data-cell" colSpan={3}>
                                                        <div className="d-flex align-items-center gap-2 ps-3 border-start border-3 border-secondary" style={{ height: "100%", opacity: 0.8 }}>
                                                            <span className="text-secondary fw-semibold small">↳ Schedule</span>
                                                        </div>
                                                    </td>
                                                    <td className="master-data-cell">
                                                        <div className="fw-bold text-dark">{item.machine?.machineName || item.machineId}</div>
                                                        <StatusBadge 
                                                            status="UNKNOWN"
                                                            customText={item.shift?.shiftName || item.shiftId} 
                                                            className="border mt-1 shadow-sm"
                                                            customColor={{ bg: '#f8f9fa', text: '#212529' }}
                                                        />
                                                    </td>
                                                    <td className="master-data-cell">
                                                        <div className="fw-bold text-dark">{getScheduleDateParts(item.weekStartDate, item.dayOfWeek).dayName}</div>
                                                        <div className="text-muted small">{getScheduleDateParts(item.weekStartDate, item.dayOfWeek).dateStr}</div>
                                                    </td>
                                                    <td className="master-data-cell fw-bold">
                                                        {item.plannedQty} <span className="fw-normal text-muted small">{item.productionOrder?.uom || group.uom}</span>
                                                    </td>
                                                    <td className="master-data-cell">
                                                        <StatusBadge status={item.status} />
                                                    </td>
                                                    <td className="master-data-cell text-end text-muted">
                                                        -
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="text-center p-4">No schedules found.</td>
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
                                <div className="pagination-info">
                                    Page {currentPage} of {totalPages}
                                </div>
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
                    title={isGroupDelete ? "Confirm Group Delete" : "Confirm Delete"}
                    message={isGroupDelete && itemToDelete ? `Are you sure you want to delete ALL scheduled shifts for Production Order ${itemToDelete.productionOrderId}?` : "Are you sure you want to delete this specific schedule?"}
                    confirmText={isGroupDelete ? "Delete Group" : "Delete"}
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default WeeklyMachineScheduleList;
