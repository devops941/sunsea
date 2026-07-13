import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

import { fetchShifts, deleteShift } from "../../../features/shifts/shiftSlice";
import type { RootState, AppDispatch } from "../../../app/store";
import type { Shift } from "../../../features/shifts/types";
import { hasPermission } from "../../../utils/permission";

const ITEMS_PER_PAGE = 10;

const formatTime12h = (time24: string): string => {
    if (!time24) return "N/A";
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
};

const calculateWorkingHours = (startTime: string, endTime: string, breakDuration: string | number | null | undefined): string => {
    if (!startTime || !endTime) return "N/A";
    try {
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);

        let startMinutes = sh * 60 + sm;
        let endMinutes = eh * 60 + em;

        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60; // Next day
        }

        let diffMinutes = endMinutes - startMinutes;

        if (breakDuration) {
            diffMinutes -= Number(breakDuration);
        }

        if (diffMinutes < 0) diffMinutes = 0;

        const hrs = diffMinutes / 60;
        return `${hrs.toFixed(1).replace(/\.0$/, "")} hrs`;
    } catch (e) {
        return "N/A";
    }
};

const ShiftList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();

    const { data, loading, error } = useSelector((state: RootState) => state.shifts);

    const canCreateShift = hasPermission("shifts.create");
    const canEditShift = hasPermission("shifts.edit");
    const canDeleteShift = hasPermission("shifts.delete");

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Shift | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    useEffect(() => {
        dispatch(fetchShifts());
    }, [dispatch]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.shiftCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.shiftName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const handleOpenView = useCallback((item: Shift) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = () => {
        navigate("/shifts/create");
    };

    const handleOpenEdit = useCallback((item: Shift) => {
        navigate(`/shifts/edit/${item.id}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await dispatch(deleteShift(itemToDelete)).unwrap();
                toast.success("Shift deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete shift");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Shift Management</h2>
                                <div className="page-breadcrumb">Home / HR & Operations / Shift Management</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search shifts..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                {canCreateShift && <CustomButton
                                    text="Add Shift"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />}
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && data.length === 0 ? (
                            <div className="text-center p-4">Loading shifts...</div>
                        ) : error ? (
                            <div className="text-center text-danger p-4">{error}</div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>SHIFT CODE</th>
                                        <th>SHIFT NAME</th>
                                        <th>START TIME</th>
                                        <th>END TIME</th>
                                        <th>BREAK DURATION</th>
                                        <th>WORKING HOURS</th>
                                        <th>STATUS</th>
                                        <th>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.length > 0 ? (
                                        paginatedData.map((item, index) => (
                                            <tr key={item.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{item.shiftCode}</td>
                                                <td className="master-data-cell">{item.shiftName}</td>
                                                <td className="master-data-cell">{formatTime12h(item.startTime)}</td>
                                                <td className="master-data-cell">{formatTime12h(item.endTime)}</td>
                                                <td className="master-data-cell">{item.breakDuration ? `${item.breakDuration} mins` : "N/A"}</td>
                                                <td className="master-data-cell">
                                                    {calculateWorkingHours(item.startTime, item.endTime, item.breakDuration)}
                                                </td>
                                                <td className="master-data-cell">
                                                <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                                                </td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(item)} />
                                                        {canEditShift && <EditButton onClick={() => handleOpenEdit(item)} />}
                                                        {canDeleteShift && !item.isAssigned && <DeleteButton onClick={() => triggerDelete(item.id)} />}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="text-center p-4">No shifts found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {totalPages > 1 && (
                            <div className="pagination-wrap">
                                <button className="pagination-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">Page {currentPage} of {totalPages}</div>
                                <button className="pagination-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Shift Details"
                    avatarText={selectedItem ? selectedItem.shiftName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.shiftName : ""}
                    headerSubtitle={selectedItem ? `Code: ${selectedItem.shiftCode}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Shift Code", value: selectedItem.shiftCode },
                                { label: "Shift Name", value: selectedItem.shiftName },
                                { label: "Start Time", value: formatTime12h(selectedItem.startTime) },
                                { label: "End Time", value: formatTime12h(selectedItem.endTime) },
                            ]
                        },
                        {
                            title: "Break & Grace",
                            fields: [
                                { label: "Break Duration", value: selectedItem.breakDuration ? `${selectedItem.breakDuration} mins` : "N/A" },
                                { label: "Grace Period", value: selectedItem.gracePeriod ? `${selectedItem.gracePeriod} mins` : "N/A" },
                                { label: "Working Hours", value: calculateWorkingHours(selectedItem.startTime, selectedItem.endTime, selectedItem.breakDuration) },
                                { label: "Status", value: selectedItem.isActive ? "Active" : "Inactive" },
                            ]
                        }
                    ] : []}
                />

                {/* Delete Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this shift?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default ShiftList;
