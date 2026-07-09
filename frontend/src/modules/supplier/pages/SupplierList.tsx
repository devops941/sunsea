import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaTags } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import SupplierViewModal from "../components/SupplierViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useSuppliers } from "../../../hooks/useSuppliers";
import { hasPermission } from "../../../utils/permission";

const ITEMS_PER_PAGE = 10;

const SupplierList: React.FC = () => {
    const navigate = useNavigate();
    const { suppliers, loading, error, loadSuppliers, removeSupplier } = useSuppliers();

    const canCreateSupplier = hasPermission("supplier.create");
    const canEditSupplier = hasPermission("supplier.edit");
    const canDeleteSupplier = hasPermission("supplier.delete");
    const canViewPricing = hasPermission("supplierpricelist.view");

    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [currentPage, setCurrentPage] = useState(1);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);

    // Custom confirm delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadSuppliers(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, loadSuppliers]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredSuppliers = suppliers || [];

    const totalPages = Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedSuppliers = filteredSuppliers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenView = useCallback((sup: any) => {
        setSelectedSupplier(sup);
        setShowViewModal(true);
    }, []);

    const handleEdit = useCallback((sup: any) => {
        navigate(`/suppliers/edit/${sup.id}`, {
            state: sup,
        });
    }, [navigate]);

    // IMPORTANT: always interpolate the real supplier id here - never pass
    // the literal route pattern string like "/suppliers/:supplierId/...".
    const handleViewPricing = useCallback((sup: any) => {
        navigate(`/suppliers/${sup.id}/material-prices`);
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setSupplierToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (supplierToDelete !== null) {
            try {
                await removeSupplier(supplierToDelete);
                toast.success("Supplier deleted successfully!");
            } catch (err: any) {
                toast.error(err.message || "Failed to delete supplier");
            } finally {
                setShowDeleteModal(false);
                setSupplierToDelete(null);
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
                                <h2 className="page-title">Supplier Master</h2>
                                <div className="page-breadcrumb">Home / Supplier</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search Supplier..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                {canCreateSupplier && <CustomButton
                                    text="Add supplier"
                                    icon={FaPlus}
                                    onClick={() => navigate("/suppliers/create")}
                                />}
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* View Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && suppliers.length === 0 ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>CODE</th>
                                        <th>NAME</th>
                                        <th>CITY</th>
                                        <th>GSTIN</th>
                                        <th>WHATSAPP</th>
                                        {/* <th>RAW MATERIAL CATEGORIES</th>
                                        <th>RAW MATERIALS</th> */}
                                        <th>PAYMENT</th>
                                        <th>LEAD TIME</th>
                                        <th>ON TIME</th>
                                        <th>STATUS</th>
                                        <th>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSuppliers.length > 0 ? (
                                        paginatedSuppliers.map((sup, index) => (
                                            <tr key={sup.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{sup.supplierCode}</td>
                                                <td className="master-data-cell">{sup.legalName}</td>
                                                <td className="master-data-cell">{sup.billingCity || "N/A"}</td>
                                                <td className="master-data-cell">{sup.gstin || "N/A"}</td>
                                                <td className="master-data-cell">{sup.whatsapp || "N/A"}</td>
                                                {/* <td className="master-data-cell">{sup.rawMaterialCategories || "N/A"}</td>
                                                <td className="master-data-cell">{sup.category}</td> */}
                                                <td className="master-data-cell">{sup.paymentTerms}</td>
                                                <td className="master-data-cell">{sup.leadTimeDays !== null ? `${sup.leadTimeDays} days` : "N/A"}</td>
                                                <td className="master-data-cell">{sup.onTimePct !== null ? `${sup.onTimePct} %` : "N/A"}</td>
                                                <td className="master-data-cell">
                                                    <span className={`status-pill status-pill--${sup.status.toLowerCase()}`}>
                                                        {sup.status}
                                                    </span>
                                                </td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(sup)} />
                                                        {canEditSupplier && <EditButton onClick={() => handleEdit(sup)} />}
                                                        {canViewPricing && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-primary"
                                                                title="View / revise raw material pricing"
                                                                onClick={() => handleViewPricing(sup)}
                                                            >
                                                                <FaTags />
                                                            </button>
                                                        )}
                                                        {canDeleteSupplier && <DeleteButton onClick={() => triggerDelete(String(sup.id))} />}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={13} className="text-center p-4">No suppliers found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {/* Pagination */}
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

                <SupplierViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    supplier={selectedSupplier}
                />

                {/* Custom Delete Confirm Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this supplier?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default SupplierList;