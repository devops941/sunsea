import React, { useState, useMemo, useCallback } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";

const ITEMS_PER_PAGE = 10;

interface WastageEntry {
    id: number;
    wastageCode: string;
    logDate: string;
    category: string;
    quantity: number;
    uom: string;
    department: string;
    cause: string;
    scrapUnitPrice: number;
    status: "Stored" | "Disposed" | "Recycled" | "Sold";
}

const INITIAL_DATA: WastageEntry[] = [
    { id: 1, wastageCode: "WST-2024-001", logDate: "2024-06-14", category: "Fabric Scraps", quantity: 45.2, uom: "KG", department: "Cutting Department", cause: "End-bit scrap cuts", scrapUnitPrice: 18.00, status: "Stored" },
    { id: 2, wastageCode: "WST-2024-002", logDate: "2024-06-15", category: "Yarn Waste", quantity: 12.5, uom: "KG", department: "Knitting Department", cause: "Thread trim sweepings", scrapUnitPrice: 8.50, status: "Sold" },
    { id: 3, wastageCode: "WST-2024-003", logDate: "2024-06-15", category: "Rejected Garments", quantity: 35, uom: "PCS", department: "Finishing & Packing", cause: "Measurement deviation failures", scrapUnitPrice: 50.00, status: "Recycled" },
    { id: 4, wastageCode: "WST-2024-004", logDate: "2024-06-16", category: "Chemical Waste", quantity: 80, uom: "KG", department: "Dye House", cause: "Effluent sludge discharge", scrapUnitPrice: 0, status: "Disposed" },
    { id: 5, wastageCode: "WST-2024-005", logDate: "2024-06-17", category: "Fabric Scraps", quantity: 50.0, uom: "KG", department: "Cutting Department", cause: "Edge trimmings", scrapUnitPrice: 18.00, status: "Stored" },
];

const WastageStockList: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<WastageEntry[]>(INITIAL_DATA);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<WastageEntry | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.wastageCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.status.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const handleOpenView = useCallback((item: WastageEntry) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = () => {
        navigate("/wastage-stock/create");
    };

    const handleOpenEdit = useCallback((item: WastageEntry) => {
        navigate(`/wastage-stock/edit/${item.id}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = () => {
        if (itemToDelete !== null) {
            setData(prev => prev.filter(item => item.id !== itemToDelete));
            toast.success("Wastage Stock entry deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
        }
    };

    const getStatusPillClass = (status: string) => {
        switch (status) {
            case "Sold":
            case "Recycled":
                return "active";
            case "Stored":
                return "active";
            default:
                return "inactive"; // Disposed
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
                                <h2 className="page-title">Wastage Stock Ledger</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search wastage logs..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Log Wastage"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "60px" }}>#</th>
                                    <th>WASTAGE CODE</th>
                                    <th>LOG DATE</th>
                                    <th>MATERIAL TYPE</th>
                                    <th>QTY / UOM</th>
                                    <th>SOURCE DEPT</th>
                                    <th>SCRAP UNIT VALUE</th>
                                    <th>TOTAL VALUATION</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length > 0 ? (
                                    paginatedData.map((item, index) => (
                                        <tr key={item.id} className="master-data-row">
                                            <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                            <td className="master-data-cell">{item.wastageCode}</td>
                                            <td className="master-data-cell">{formatDate(item.logDate)}</td>
                                            <td className="master-data-cell">{item.category}</td>
                                            <td className="master-data-cell">{item.quantity} {item.uom}</td>
                                            <td className="master-data-cell">{item.department}</td>
                                            <td className="master-data-cell">₹{item.scrapUnitPrice.toFixed(2)}</td>
                                            <td className="master-data-cell fw-semibold text-primary">
                                                ₹{(item.quantity * item.scrapUnitPrice).toFixed(2)}
                                            </td>
                                            <td className="master-data-cell">
                                                <span className={`status-pill status-pill--${getStatusPillClass(item.status)}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item)} />
                                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                                    <DeleteButton onClick={() => triggerDelete(item.id)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">No wastage records found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

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
                    modalTitle="Wastage Entry Details"
                    avatarText={selectedItem ? selectedItem.wastageCode.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.wastageCode : ""}
                    headerSubtitle={selectedItem ? `${selectedItem.category} (${selectedItem.department})` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Wastage Log Code", value: selectedItem.wastageCode },
                                { label: "Log Date", value: formatDate(selectedItem.logDate) },
                                { label: "Material Type", value: selectedItem.category },
                                { label: "Source Department", value: selectedItem.department },
                            ]
                        },
                        {
                            title: "Quantity & Valuation",
                            fields: [
                                { label: "Wastage Quantity", value: `${selectedItem.quantity} ${selectedItem.uom}` },
                                { label: "Scrap Price per Unit", value: `₹${selectedItem.scrapUnitPrice.toFixed(2)}` },
                                { label: "Total Estimated Value", value: `₹${(selectedItem.quantity * selectedItem.scrapUnitPrice).toFixed(2)}` },
                                { label: "Current Status", value: selectedItem.status },
                            ]
                        },
                        {
                            title: "Logs & Explanations",
                            fields: [
                                { label: "Wastage Cause", value: selectedItem.cause || "N/A", xs: 12 },
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
                    message="Are you sure you want to delete this wastage entry?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default WastageStockList;
