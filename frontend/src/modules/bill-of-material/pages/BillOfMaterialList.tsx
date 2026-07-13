import React, { useState, useEffect } from "react";
import { Container, Row, Col, Modal, Table } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import { billOfMaterialService } from "../../../services/billOfMaterialService";
import { toast } from "react-toastify";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";

const ITEMS_PER_PAGE = 10;

const BillOfMaterialList: React.FC = () => {
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [billOfMaterials, setBillOfMaterials] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // View Modal State
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedBom, setSelectedBom] = useState<any>(null);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const loadData = async (searchStr: string = "") => {
        try {
            setIsLoading(true);
            const data = await billOfMaterialService.fetchAll(searchStr);
            setBillOfMaterials(data || []);
        } catch (error) {
            console.error("Failed to fetch bill of materials", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            loadData(searchTerm);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleView = (bom: any) => {
        setSelectedBom(bom);
        setShowViewModal(true);
    };

    const handleEdit = (bom: any) => {
        navigate(`/bill-of-materials/edit/${bom.id}`, { state: bom });
    };

    const triggerDelete = (id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await billOfMaterialService.delete(itemToDelete);
                setBillOfMaterials(billOfMaterials.filter(b => b.id !== itemToDelete));
                toast.success("Bill of Material deleted successfully!");
            } catch (error: any) {
                console.error("Failed to delete bill of material", error);
                if (error.response?.data?.message) {
                    toast.error("Server Error: " + error.response.data.message);
                } else {
                    toast.error("Failed to delete Bill of Material. Please try again.");
                }
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const filteredBOMs = billOfMaterials;

    const totalPages = Math.ceil(filteredBOMs.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedBOMs = filteredBOMs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="inner-container">
            <Container fluid>
                {/* page header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        {/* Left Section */}
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">
                                    Bill Of Materials
                                </h2>
                                
                            </div>
                        </Col>

                        {/* Right Section */}
                        <Col lg={6} md={12}>
                            <div className="page-header-actions justify-content-end">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search product..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <CustomButton
                                    text="Add BOM"
                                    icon={FaPlus}
                                    onClick={() => navigate("/bill-of-materials/create")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* view table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th>BOM ID</th>
                                    <th>PRODUCT CODE</th>
                                    <th>PRODUCT NAME</th>
                                    <th>REMARKS</th>
                                    <th>ITEMS COUNT</th>
                                    <th>CREATED AT</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>

                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center p-3">Loading...</td>
                                    </tr>
                                ) : paginatedBOMs.length > 0 ? (
                                    paginatedBOMs.map((bom) => (
                                        <tr key={bom.id} className="master-data-row">
                                            <td className="master-data-cell">{bom.id}</td>
                                            <td className="master-data-cell">{bom.product?.productCode || "-"}</td>
                                            <td className="master-data-cell">{bom.product?.productName || "-"}</td>
                                            <td className="master-data-cell">{bom.remarks || "-"}</td>
                                            <td className="master-data-cell">{bom.items?.length || 0}</td>
                                            <td className="master-data-cell">
                                                {bom.createdAt ? new Date(bom.createdAt).toLocaleDateString() : "-"}
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleView(bom)} />
                                                    <EditButton onClick={() => handleEdit(bom)} />
                                                    <DeleteButton onClick={() => triggerDelete(bom.id)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center p-3">No Bill of Materials found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* pagenation */}
                        {totalPages > 1 && (
                            <div className="pagination-wrap">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </Container>

            {/* Delete Confirmation Modal */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message="Are you sure you want to delete this Bill of Material?"
                confirmText="Delete"
                confirmVariant="danger"
            />

            {/* View BOM Modal */}
            <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>Bill Of Material Details</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedBom && (
                        <div>
                            <Row className="mb-4">
                                <Col md={6}>
                                    <p><strong>BOM ID:</strong> {selectedBom.id}</p>
                                    <p><strong>Product Name:</strong> {selectedBom.product?.productName || "-"}</p>
                                    <p><strong>Product Code:</strong> {selectedBom.product?.productCode || "-"}</p>
                                </Col>
                                <Col md={6}>
                                    <p><strong>Created At:</strong> {selectedBom.createdAt ? new Date(selectedBom.createdAt).toLocaleDateString() : "-"}</p>
                                    <p><strong>Remarks:</strong> {selectedBom.remarks || "-"}</p>
                                </Col>
                            </Row>
                            <h5 className="mb-3">Raw Materials</h5>
                            <Table bordered hover responsive>
                                <thead>
                                    <tr>
                                        <th>Raw Material ID</th>
                                        <th>Raw Material Name</th>
                                        <th>Required Quantity</th>
                                        <th>UOM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedBom.items && selectedBom.items.length > 0 ? (
                                        selectedBom.items.map((item: any, index: number) => (
                                            <tr key={index}>
                                                <td>{item.rawMaterialId}</td>
                                                <td>{item.rawMaterial?.materialName || "-"}</td>
                                                <td>{item.requiredQuantity}</td>
                                                <td>{item.uom}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="text-center">No raw materials found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default BillOfMaterialList;