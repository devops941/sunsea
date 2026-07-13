import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useRawMaterialCategories } from "../../../hooks/useRawMaterialCategories";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

const ITEMS_PER_PAGE = 10;

const RawMaterialCategoryList: React.FC = () => {
    const navigate = useNavigate();
    const {
        rawMaterialCategories,
        totalPages,
        loading,
        error,
        loadCategories,
        removeCategory,
    } = useRawMaterialCategories();;

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCategories({
                search: searchTerm,
                page: currentPage,
                limit: ITEMS_PER_PAGE,
              sortBy: "categoryCode",
                sortOrder: "asc",
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [loadCategories, searchTerm, currentPage]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };



    const handleOpenAdd = () => {
        navigate("/raw-material-categories/create");
    };

    const handleOpenEdit = useCallback((category: any) => {
        navigate(`/raw-material-categories/edit/${category.id}`, { state: category });
    }, [navigate]);

    const handleOpenView = useCallback((category: any) => {
        setSelectedCategory(category);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await removeCategory(itemToDelete);
                toast.success("Category deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete category");
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
                                <h2 className="page-title">Raw Material Category Management</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search by code or name..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Category"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Categories Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && rawMaterialCategories.length === 0 ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Status</th>
                                        <th>Created Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rawMaterialCategories.length > 0 ? (
                                        rawMaterialCategories.map((category: any, index: number) => (
                                            <tr key={category.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{category.code}</td>
                                                <td className="master-data-cell">{category.name}</td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={category.status} />
                                                </td>
                                                <td className="master-data-cell">{category.createdAt ? new Date(category.createdAt).toLocaleDateString() : "-"}</td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(category)} />
                                                        <EditButton onClick={() => handleOpenEdit(category)} />
                                                        <DeleteButton onClick={() => triggerDelete(category.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center p-4">No categories found.</td>
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

                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Category Details"
                    avatarText={selectedCategory ? selectedCategory.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedCategory ? selectedCategory.name : ""}
                    headerSubtitle={selectedCategory ? `Code: ${selectedCategory.code}` : ""}
                    sections={selectedCategory ? [
                        {
                            fields: [
                                { label: "Category Name", value: selectedCategory.name },
                                { label: "Category Code", value: selectedCategory.code },
                                { label: "Description", value: selectedCategory.description || "N/A", xs: 12 },
                                { label: "Status", value: selectedCategory.status },
                                { label: "Created Date", value: selectedCategory.createdAt ? new Date(selectedCategory.createdAt).toLocaleString() : "-" },
                                { label: "Updated Date", value: selectedCategory.updatedAt ? new Date(selectedCategory.updatedAt).toLocaleString() : "-" },
                            ]
                        }
                    ] : []}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this category?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default RawMaterialCategoryList;
