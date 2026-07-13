import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner, Button, Card, Badge } from "react-bootstrap";
import { FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchHourlyProductions, deleteHourlyProduction } from "../../../features/hourly-productions/hourlyProductionSlice";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import TextInput from "../../../components/form/TextInput/TextInput";

const ITEMS_PER_PAGE = 20;

const HourlyWorkReportList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

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
                    let startMin = startH * 60 + startM;
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
                    uom: (item.productionOrder?.productItem?.uom?.uomCode?.toLowerCase() === "ea" ? "pcs" : item.productionOrder?.productItem?.uom?.uomCode) || "pcs",
                    plannedQty: Number(item.shiftPlannedQty || item.productionOrder?.targetQty || 0),
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



    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/hourly-work-reports/edit/${item.hourlyProductionId}`, { state: item });
    }, [navigate]);

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

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={4} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title mb-1">Hourly Production Logs</h2>
                                
                            </div>
                        </Col>
                        <Col lg={8} md={12}>
                                <div className="page-header-actions weekely-list d-flex gap-3 justify-content-lg-end align-items-center flex-wrap">
                                    <div className="d-flex gap-3 align-items-center">
                                        <TextInput
                                            name="search"
                                            value={searchTerm}
                                            onChange={handleSearch}
                                            placeholder="Search by PO, Product, Machine..."
                                        />
                                        <TextInput
                                            name="dateFilter"
                                            type="date"
                                            value={filterDate}
                                            onChange={(e) => setFilterDate(e.target.value)}
                                        />
                                    </div>
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
                                    <th>DATE</th>
                                    <th>MACHINE</th>
                                    <th>SHIFT</th>
                                    <th>PO ID</th>
                                    <th>PRODUCT</th>
                                    <th>HOURS LOGGED</th>
                                    <th>TARGET</th>
                                    <th>TOTAL PRODUCED</th>
                                    <th>REJECT / SCRAP</th>
                                    <th>DOWNTIME</th>
                                    <th style={{ width: "135px", textAlign: "right" }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={12} className="text-center p-4">
                                            <Spinner animation="border" variant="primary" />
                                        </td>
                                    </tr>
                                ) : paginatedData.length > 0 ? (
                                    paginatedData.map((group) => {
                                        const isExpanded = !!expandedGroups[group.key];
                                        const isActiveNoEntry = group.weeklyProgramStatus === "IN_PROGRESS" && group.hours.length === 0;
                                        return (
                                            <React.Fragment key={group.key}>
                                                <tr
                                                    className="master-data-row"
                                                    style={{
                                                        cursor: "pointer",
                                                        ...(isActiveNoEntry ? {
                                                            background: "linear-gradient(90deg, #f0fdf4 0%, #fff 100%)",
                                                            borderLeft: "4px solid #16a34a"
                                                        } : {})
                                                    }}
                                                    onClick={() => toggleGroup(group.key)}
                                                >
                                                    <td className="master-data-cell text-center">
                                                        {isExpanded ? <FaChevronUp className="text-muted" /> : <FaChevronDown className="text-muted" />}
                                                    </td>
                                                    <td className="master-data-cell fw-medium text-secondary">
                                                        {new Date(group.productionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                    </td>
                                                    <td className="master-data-cell fw-bold">
                                                        {group.machineName}
                                                    </td>
                                                    <td className="master-data-cell">
                                                        <StatusBadge status="UNKNOWN" customText={group.shiftName} customColor={{ bg: '#f8f9fa', text: '#212529' }} />
                                                    </td>
                                                    <td className="master-data-cell fw-semibold">
                                                        {group.productionOrderId}
                                                    </td>
                                                    <td className="master-data-cell" style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {group.productName}
                                                    </td>
                                                    <td className="master-data-cell fw-bold" style={{ color: "var(--color-primary)" }}>
                                                        {isActiveNoEntry ? (
                                                            <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "12px" }}>
                                                                ● Running
                                                            </span>
                                                        ) : (
                                                            <>{group.hours.length} {group.hours.length === 1 ? "Hour" : "Hours"}</>
                                                        )}
                                                    </td>
                                                    <td className="master-data-cell fw-bold text-dark">
                                                        {group.plannedQty} <span className="small text-muted">{group.uom}</span>
                                                    </td>
                                                    <td className="master-data-cell fw-bold text-success">
                                                        {isActiveNoEntry ? (
                                                            <span className="text-muted">— pcs</span>
                                                        ) : (
                                                            <>{group.totalQtyProduced} <span className="small text-muted">{group.uom}</span></>
                                                        )}
                                                    </td>
                                                    <td className="master-data-cell">
                                                        <span className="text-danger small fw-semibold">R: {group.totalRejectQty}</span> | <span className="text-warning small fw-semibold">S: {group.totalScrapQty}</span>
                                                    </td>
                                                    <td className="master-data-cell text-muted">
                                                        {group.totalDowntime > 0 ? `${group.totalDowntime} Mins` : "-"}
                                                    </td>
                                                    <td className="master-data-cell text-end" onClick={(e) => e.stopPropagation()}>
                                                        {group.hours.length >= group.shiftTotalHours ? (
                                                            <div className="d-flex flex-column align-items-end justify-content-center gap-1">
                                                                <div className="d-flex align-items-center justify-content-end gap-2">
                                                                    {group.totalQtyProduced >= group.plannedQty || group.hours.length >= group.shiftTotalHours || group.weeklyProgramStatus === 'COMPLETED' ? (
                                                                        <span className="fw-bold small text-success">
                                                                            Completed
                                                                        </span>
                                                                    ) : (
                                                                        <span className="fw-bold small text-danger">
                                                                            On Hold
                                                                        </span>
                                                                    )}
                                                                    <ViewButton onClick={() => handleView(group)} />
                                                                </div>
                                                                {group.totalQtyProduced < group.plannedQty ? (
                                                                    <span className="text-danger fw-bold" style={{ fontSize: '10px' }}>
                                                                        Pending: {group.plannedQty - group.totalQtyProduced} {group.uom}
                                                                    </span>
                                                                ) : group.totalQtyProduced > group.plannedQty ? (
                                                                    <span className="text-success fw-bold" style={{ fontSize: '10px' }}>
                                                                        Extra: +{group.totalQtyProduced - group.plannedQty} {group.uom}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        ) : (
                                                            <CustomButton
                                                                text="Add Hourly"
                                                                size="sm"
                                                                onClick={() => handleAddHourly(group)}
                                                            />
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={12} className="bg-light p-3" onClick={(e) => e.stopPropagation()}>
                                                            <div className="rounded-3 p-4 border bg-white shadow-sm">
                                                                {/* SHIFT SUMMARY DASHBOARD */}
                                                                <div className="d-flex align-items-center justify-content-between mb-4">
                                                                    <h6 className="fw-bold mb-0" style={{ color: "var(--color-primary)", letterSpacing: "0.5px" }}>
                                                                        SHIFT SUMMARY DASHBOARD
                                                                    </h6>
                                                                    {group.hours.length < group.shiftTotalHours && (
                                                                      <Button variant="primary" size="sm" onClick={() => handleAddHourly(group)} className="fw-bold rounded-pill px-4 shadow-sm" style={{ background: "linear-gradient(45deg, var(--color-primary), #005f4b)", border: "none" }}>
                                                                          + Log Next Hour (H{group.hours.length + 1})
                                                                      </Button>
                                                                    )}
                                                                </div>
                                                                <div className="row g-3 mb-4">
                                                                    <div className="col-md-3">
                                                                        <div className="p-3 rounded-3 border bg-light text-center">
                                                                            <div className="text-muted small fw-bold mb-1 text-uppercase">Efficiency (OEE)</div>
                                                                            <h3 className="mb-0 fw-bold" style={{ color: "var(--color-primary)" }}>
                                                                                {group.plannedQty > 0 ? ((group.totalQtyProduced / group.plannedQty) * 100).toFixed(1) : 0}%
                                                                            </h3>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-md-3">
                                                                        <div className="p-3 rounded-3 border bg-light text-center">
                                                                            <div className="text-muted small fw-bold mb-1 text-uppercase">Total Produced</div>
                                                                            <h3 className="mb-0 fw-bold text-success">
                                                                                {group.totalQtyProduced}
                                                                            </h3>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-md-3">
                                                                        <div className="p-3 rounded-3 border bg-light text-center">
                                                                            <div className="text-muted small fw-bold mb-1 text-uppercase">Scrap Rate</div>
                                                                            <h3 className="mb-0 fw-bold text-warning">
                                                                                {group.totalQtyProduced > 0 ? ((group.totalScrapQty / group.totalQtyProduced) * 100).toFixed(1) : 0}%
                                                                            </h3>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-md-3">
                                                                        <div className="p-3 rounded-3 border bg-light text-center">
                                                                            <div className="text-muted small fw-bold mb-1 text-uppercase">Total Downtime</div>
                                                                            <h3 className="mb-0 fw-bold text-danger">
                                                                                {group.totalDowntime > 0 ? `${group.totalDowntime} min` : "0 min"}
                                                                            </h3>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* TIMELINE */}
                                                                <h6 className="fw-bold mb-3 text-secondary text-uppercase" style={{ fontSize: "12px", letterSpacing: "0.5px" }}>Hourly Timeline</h6>
                                                                {group.hours.length === 0 ? (
                                                                    <div className="text-center text-muted p-4 border rounded-3 bg-light" style={{ borderStyle: "dashed !important" }}>
                                                                        No hours logged yet for this shift. Click "Log Next Hour" to start.
                                                                    </div>
                                                                ) : (
                                                                    <div className="d-flex flex-column gap-2">
                                                                        {group.hours.map((h: any) => {
                                                                            const hasIssues = h.scrapQty > 0 || h.downtime > 0 || h.rejectQty > 0;
                                                                            return (
                                                                                <div key={h.hourlyProductionId} className="d-flex align-items-center p-3 rounded-3 border position-relative" style={{ background: hasIssues ? "#fff5f5" : "#f8f9fa", borderColor: hasIssues ? "#ffc9c9" : "#dee2e6" }}>
                                                                                    {hasIssues && <div className="position-absolute start-0 top-0 bottom-0 rounded-start" style={{ width: "4px", background: "#ef4444" }}></div>}
                                                                                    {!hasIssues && <div className="position-absolute start-0 top-0 bottom-0 rounded-start" style={{ width: "4px", background: "#10b981" }}></div>}
                                                                                    <div className="me-4 text-center ms-2" style={{ minWidth: "60px" }}>
                                                                                        <div className="fw-bold text-muted small text-uppercase mb-1">Hour</div>
                                                                                        <h4 className="mb-0 fw-bold font-monospace" style={{ color: "var(--color-primary)" }}>{h.hourIndex}</h4>
                                                                                    </div>
                                                                                    <div className="flex-grow-1 row align-items-center">
                                                                                        <div className="col-3">
                                                                                            <div className="small text-muted mb-1">Produced</div>
                                                                                            <div className="fw-bold text-success fs-5">{h.qtyProduced} <span className="small fs-6 text-muted">{group.uom}</span></div>
                                                                                        </div>
                                                                                        <div className="col-2">
                                                                                            <div className="small text-muted mb-1">Reject</div>
                                                                                            <div className={h.rejectQty > 0 ? "fw-bold text-danger" : "text-muted"}>{h.rejectQty || 0}</div>
                                                                                        </div>
                                                                                        <div className="col-2">
                                                                                            <div className="small text-muted mb-1">Scrap</div>
                                                                                            <div className={h.scrapQty > 0 ? "fw-bold text-warning" : "text-muted"}>{h.scrapQty || 0}</div>
                                                                                        </div>
                                                                                        <div className="col-3">
                                                                                            <div className="small text-muted mb-1">Downtime</div>
                                                                                            <div className={h.downtime > 0 ? "fw-bold text-danger" : "text-muted"}>
                                                                                                {h.downtime > 0 ? `${h.downtime} min` : "—"}
                                                                                                {h.downtimeReason && <div className="small fw-normal text-muted" style={{fontSize: "10px", lineHeight: 1.1}}>{h.downtimeReason}</div>}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="col-2">
                                                                                            <div className="small text-muted mb-1">Operator</div>
                                                                                            <div className="text-dark small text-truncate" title={h.operatorId}>{h.operatorId || "—"}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="ms-3 d-flex gap-2">
                                                                                        <EditButton onClick={() => handleOpenEdit(h)} />
                                                                                        {user?.roleId === "ROLE_ADMIN" && (
                                                                                            <DeleteButton onClick={() => triggerDelete(h.hourlyProductionId?.toString())} />
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="text-center p-4">No hourly reports found.</td>
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
                    title="Delete Hourly Entry"
                    message="Are you sure you want to delete this hourly production log? This action cannot be undone."
                    confirmText="Delete"
                    confirmVariant="danger"
                />

                {/* View Modal for Completed Shifts */}
                {showViewModal && selectedViewGroup && (
                    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-xl modal-dialog-centered">
                            <div className="modal-content">
                                <div className="modal-header border-bottom-0 pb-0">
                                    <h5 className="modal-title fw-bold" style={{ color: "var(--color-primary)" }}>
                                        HOURLY ENTRIES DETAILS - {selectedViewGroup.shiftName}
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setShowViewModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="d-flex gap-4 mb-4 pb-3 border-bottom text-muted small">
                                        <div><strong>Date:</strong> {new Date(selectedViewGroup.productionDate).toLocaleDateString()}</div>
                                        <div><strong>Machine:</strong> {selectedViewGroup.machineName}</div>
                                        <div><strong>Product:</strong> {selectedViewGroup.productName}</div>
                                        <div><strong>PO:</strong> {selectedViewGroup.productionOrderId}</div>
                                        <div><strong>Operator:</strong> {selectedViewGroup.hours[0]?.operator?.name || selectedViewGroup.hours[0]?.operatorId || "N/A"}</div>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="master-data-table text-center align-middle mb-0" style={{ minWidth: '800px' }}>
                                            <thead>
                                                <tr>
                                                    <th className="py-3 px-3 text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Hour Index</th>
                                                    <th className="py-3 px-3 text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Produced Qty</th>
                                                    <th className="py-3 px-3 text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Reject Qty</th>
                                                    <th className="py-3 px-3 text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Scrap Qty</th>
                                                    <th className="py-3 px-3 text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Downtime</th>
                                                    <th className="py-3 px-3 text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Operator</th>
                                                    <th className="py-3 px-3 text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedViewGroup.hours.map((hour: any, idx: number) => (
                                                    <tr key={hour.hourlyProductionId || idx} className="bg-white border-bottom">
                                                        <td className="fw-bold py-3">{hour.hourIndex}</td>
                                                        <td className="text-success fw-bold py-3">{hour.qtyProduced}</td>
                                                        <td className="text-danger fw-semibold py-3">{hour.rejectQty}</td>
                                                        <td className="text-warning fw-semibold py-3">{hour.scrapQty}</td>
                                                        <td className="text-muted py-3">{hour.downtime > 0 ? `${hour.downtime} m` : "-"}</td>
                                                        <td className="py-3">{hour.operator?.name || hour.operatorId || "-"}</td>
                                                        <td className="py-3">{hour.remarks || "-"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-light">
                                                    <td className="fw-bold text-end py-3">TOTAL</td>
                                                    <td className={`fw-bold fs-6 py-3 ${selectedViewGroup.totalQtyProduced >= selectedViewGroup.plannedQty ? 'text-success' : 'text-danger'}`}>
                                                        {selectedViewGroup.totalQtyProduced}
                                                    </td>
                                                    <td className="text-danger fw-bold fs-6 py-3">{selectedViewGroup.totalRejectQty}</td>
                                                    <td className="text-warning fw-bold fs-6 py-3">{selectedViewGroup.totalScrapQty}</td>
                                                    <td colSpan={3} className="text-muted fw-bold py-3 text-start ps-4">
                                                        Planned Qty: <span className="text-dark fs-6 ms-2">{selectedViewGroup.plannedQty}</span>
                                                        {selectedViewGroup.totalQtyProduced < selectedViewGroup.plannedQty && (
                                                            <span className="ms-3 text-danger fw-bold" style={{ fontSize: '12px' }}>
                                                                Target Not Reached ({selectedViewGroup.plannedQty - selectedViewGroup.totalQtyProduced} Short)
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Container>
        </div>
    );
};

export default HourlyWorkReportList;
