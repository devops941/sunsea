import React, { useState } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useUOM } from "../../../hooks/useUOM";

const ITEMS_PER_PAGE = 10;

const UOMList: React.FC = () => {
    const { units, loading, error } = useUOM();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reset to first page on search
    };

    // Filter units based on the search term
    const filteredUnits = units.filter(u => {
        const searchLower = searchTerm.toLowerCase();
        return (u.code || '').toLowerCase().includes(searchLower) || 
               (u.label || '').toLowerCase().includes(searchLower) ||
               (u.category || '').toLowerCase().includes(searchLower);
    });

    const totalPages = Math.ceil(filteredUnits.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedUOMs = filteredUnits.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">UOM Management</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions justify-content-end">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search by code, name, or category..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* UOMs Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body mt-4">
                        {loading ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : error ? (
                            <div className="text-center p-5 text-danger">
                                {error}
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Category</th>
                                        <th>Code</th>
                                        <th>Label / Name</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUOMs.length > 0 ? (
                                        paginatedUOMs.map((uom, index) => (
                                            <tr key={`${uom.category}-${uom.code}`} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell" style={{ textTransform: 'capitalize' }}>{uom.category}</td>
                                                <td className="master-data-cell">{uom.code}</td>
                                                <td className="master-data-cell">{uom.label}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="text-center p-4">No UOMs found.</td>
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
            </Container>
        </div>
    );
};

export default UOMList;
