import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { toast } from "react-toastify";
import CustomButton from "../../components/ui/Button/Button";
import StatusBadge from "../../components/ui/StatusBadge/Badge";
import EditButton from "../../components/ui/EditButton/EditButton";
import GstTaxModal, { type GstTaxFormValues } from "./GstModal";
import type { GstTax } from "../../services/gstTaxService";
import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import { createGstTax, fetchGstTaxes, updateGstTax } from "../../features/gst/gstSlice";

const ITEMS_PER_PAGE = 10;

const GstTaxList: React.FC = () => {
    const dispatch = useAppDispatch();
    const { data, loading, totalPages } = useAppSelector((state) => state.gst);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    // ─── Modal state (Add / Edit) ──────────────────────────────
    const [showModal, setShowModal] = useState(false);
    const [editingTax, setEditingTax] = useState<GstTaxFormValues | null>(null);

    // ─── Fetch list (debounced) ──────────────────────────────
    const loadGstTaxes = useCallback(() => {
        dispatch(
            fetchGstTaxes({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
            })
        );
    }, [dispatch, currentPage, searchTerm]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadGstTaxes();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadGstTaxes]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    // ─── Add / Edit handlers ──────────────────────────────
    const handleAddClick = () => {
        setEditingTax(null); // null => modal treats this as create mode
        setShowModal(true);
    };

    const handleEditClick = (tax: GstTax) => {
        const formValues: GstTaxFormValues = {
            id: tax.id,
            taxName: tax.taxName,
            taxType: tax.taxType,
            taxRate: String(tax.taxRate),
            status: tax.status,
        };
        setEditingTax(formValues);
        setShowModal(true);
    };

    const handleClose = () => {
        setShowModal(false);
        setEditingTax(null);
    };

    const handleSave = async (formData: GstTaxFormValues) => {
        try {
            const payload = {
                taxName: formData.taxName,
                taxType: formData.taxType,
                taxRate: Number(formData.taxRate),
                status: formData.status,
            };

            if (formData.id) {
                await dispatch(updateGstTax({ id: formData.id, data: payload })).unwrap();
                toast.success("GST tax rate updated successfully");
            } else {
                await dispatch(createGstTax(payload)).unwrap();
                toast.success("GST tax rate created successfully");
            }

            loadGstTaxes();
        } catch (err: any) {
            console.error(err);
            toast.error(err || "Failed to save GST tax rate");
            throw err; // keeps modal open on failure — see GstTaxModal's submit handler
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
                                <h2 className="page-title">GST Tax Management</h2>
                                <div className="page-breadcrumb">Home / Settings / GST Tax Rates</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions" style={{ position: "relative" }}>
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search tax name..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>

                                <CustomButton
                                    text="Add GST"
                                    icon={FaPlus}
                                    onClick={handleAddClick}
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
                                    <th>TAX NAME</th>
                                    <th>RATE (%)</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center p-4">
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Loading GST tax rates...
                                        </td>
                                    </tr>
                                ) : data.length > 0 ? (
                                    data.map((item, index) => (
                                        <tr key={item.id} className="master-data-row">
                                            <td className="master-data-cell">
                                                {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                            </td>
                                            <td className="master-data-cell">{item.taxName}</td>
                                            <td className="master-data-cell">{item.taxRate}</td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.status} />
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <EditButton onClick={() => handleEditClick(item)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="text-center p-4">
                                            No GST tax rates found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className="pagination-wrap">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((prev) => prev - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">Page {currentPage} of {totalPages}</div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((prev) => prev + 1)}
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </Container>

            <GstTaxModal
                show={showModal}
                onClose={handleClose}
                onSave={handleSave}
                initialData={editingTax}
            />
        </div>
    );
};

export default GstTaxList;