import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { useProducts } from "../../../hooks/useProducts";

const ITEMS_PER_PAGE = 10;

const ProductList: React.FC = () => {
    const navigate = useNavigate();
    const { products, loading, error, loadProducts, removeProduct } = useProducts();
    console.log(products, "products")

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";

    const [searchTerm, setSearchTerm] = useState(initialSearch);

    // Custom confirm delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadProducts(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, loadProducts]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleView = useCallback((product: any) => {
        setSelectedProduct(product);
        setShowViewModal(true);
    }, []);

    const handleEdit = useCallback((product: any) => {
        navigate(`/products/edit/${product.id}`, {
            state: product,
        });
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setProductToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (productToDelete !== null) {
            try {
                await removeProduct(productToDelete);
                toast.success("Product deleted successfully!");
            } catch (err: any) {
                toast.error(err.message || "Failed to delete product");
            } finally {
                setShowDeleteModal(false);
                setProductToDelete(null);
            }
        }
    };

    const filteredProducts = products || [];

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    // console.log("sd", filteredProducts)
    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Product Catalog</h2>
                                <div className="page-breadcrumb">Home / Products</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search product..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Product"
                                    icon={FaPlus}
                                    onClick={() => navigate("/products/create")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* View Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && products.length === 0 ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Product Code</th>
                                        <th>Product Name</th>
                                        <th>UOM</th>
                                        <th>Category</th>
                                        {/* <th>Class</th> */}
                                        {/* <th>MRP</th>
                                        <th>Min Sale</th> */}
                                        <th>Size</th>
                                        <th>Weight</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.length > 0 ? (
                                        paginatedProducts.map((product: any, index) => (
                                            <tr key={product.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{product.productCode}</td>
                                                <td className="master-data-cell">{product.productName}</td>
                                                <td className="master-data-cell">
                                                    {(() => {
                                                        const code = product.uom?.code || product.uom?.uomCode;
                                                        return code?.toLowerCase() === 'ea' ? 'pcs' : (code || "N/A");
                                                    })()}
                                                </td>
                                                <td className="master-data-cell">{product.category?.name || product.category?.categoryName || "N/A"}</td>
                                                {/* <td className="master-data-cell">{product.subCategory?.name || product.subCategory?.subCategoryName || "N/A"}</td> */}
                                                {/* <td className="master-data-cell">
                                                    {product.pricing?.length > 0 && product.pricing[0].mrp != null ? `₹${product.pricing[0].mrp}` : "-"}
                                                </td>
                                                <td className="master-data-cell">
                                                    {product.pricing?.length > 0 && product.pricing[0].minSalePrice != null ? `₹${product.pricing[0].minSalePrice}` : "-"}
                                                </td> */}
                                                <td className="master-data-cell">
                                                    {product.size?.sizeCode ? product.size?.sizeCode : "-"}
                                                </td>
                                                <td className="master-data-cell">
                                                    {product.weightPerPiece != null ? (Number(product.weightPerPiece) < 1 ? `${Number(product.weightPerPiece) * 1000} g` : `${product.weightPerPiece} kg`) : "-"}
                                                </td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={product.isActive ? "ACTIVE" : "INACTIVE"} />
                                                </td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleView(product)} />
                                                        <EditButton onClick={() => handleEdit(product)} />
                                                        <DeleteButton onClick={() => triggerDelete(product.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="text-center p-4">No products found.</td>
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

                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Product Details"
                    avatarText={selectedProduct ? selectedProduct.productName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedProduct ? selectedProduct.productName : ""}
                    headerSubtitle={selectedProduct ? `Code: ${selectedProduct.productCode}` : ""}
                    sections={selectedProduct ? [
                        {
                            fields: [
                                { label: "Product Name", value: selectedProduct.productName },
                                { label: "Product Code", value: selectedProduct.productCode },
                                { label: "UOM", value: (() => {
                                    const code = selectedProduct.uom?.code || selectedProduct.uom?.uomCode;
                                    return code?.toLowerCase() === 'ea' ? 'pcs' : (code || "N/A");
                                })() },
                                { label: "Category", value: selectedProduct.category?.name || selectedProduct.category?.categoryName || "N/A" },
                                { label: "Class", value: selectedProduct.subCategory?.name || selectedProduct.subCategory?.subCategoryName || "N/A" },
                                { label: "MRP", value: selectedProduct.pricing?.length > 0 && selectedProduct.pricing[0].mrp != null ? `₹${selectedProduct.pricing[0].mrp}` : "N/A" },
                                { label: "Min Sale", value: selectedProduct.pricing?.length > 0 && selectedProduct.pricing[0].minSalePrice != null ? `₹${selectedProduct.pricing[0].minSalePrice}` : "N/A" },
                                { label: "Colour", value: selectedProduct.colors?.length > 0 ? selectedProduct.colors.map((c: any) => c.color?.colorName).join(", ") : "N/A" },
                                { label: "Weight", value: selectedProduct.weightPerPiece != null ? (Number(selectedProduct.weightPerPiece) < 1 ? `${Number(selectedProduct.weightPerPiece) * 1000} g` : `${selectedProduct.weightPerPiece} kg`) : "N/A" },
                                { label: "Status", value: selectedProduct.isActive ? "Active" : "Inactive" },
                            ]
                        }
                    ] : []}
                />

                {/* Custom Delete Confirm Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this product?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default ProductList;