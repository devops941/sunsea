import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Modal } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { useProductPricing } from "../../../hooks/useProductPricing";
import { useProducts } from "../../../hooks/useProducts";

const ITEMS_PER_PAGE = 10;

const ProductPricing: React.FC = () => {
    const { productPricings, loading, error, loadProductPricings, addProductPricing, editProductPricing, removeProductPricing } = useProductPricing();
    const { products, loadProducts } = useProducts();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedPrice, setSelectedPrice] = useState<any>(null);
    const [formErrors, setFormErrors] = useState({
        hsnCode: "",
        gstRate: "",
        unitPrice: "",
    });

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        id: "",
        productId: "",
        hsnCode: "",
        gstRate: "",
        cess: "",
        unitPrice: "",
        mrp: "",
        minSalePrice: "",
        distributorPrice: "",
        wholesalePrice: "",
        directPrice: "",
    });

    useEffect(() => {
        loadProductPricings("");
        loadProducts();
    }, [loadProducts]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setCurrentPage(1);
        loadProductPricings(value);
    };


    const totalPages = Math.ceil(productPricings.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedPrices = productPricings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const productOptions = useMemo(() => {
        return products.map(p => ({
            value: String(p.id),
            label: `${p.productCode} - ${p.productName}`
        }));
    }, [products]);

    const resetForm = useCallback(() => {
        setFormData({
            id: "",
            productId: productOptions.length > 0 ? productOptions[0].value : "",
            hsnCode: "",
            gstRate: "",
            cess: "",
            unitPrice: "",
            mrp: "",
            minSalePrice: "",
            distributorPrice: "",
            wholesalePrice: "",
            directPrice: "",
        });
        setFormErrors({
            hsnCode: "",
            gstRate: "",
            unitPrice: "",
        })
    }, [productOptions]);

    const handleOpenAdd = () => {
        setEditMode(false);
        resetForm();
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((price: any) => {
        setEditMode(true);
        setFormData({
            id: String(price.id),
            productId: String(price.productId),
            hsnCode: price.hsnCode || "",
            gstRate: price.gstRate != null ? String(price.gstRate) : "",
            cess: price.cess != null ? String(price.cess) : "",
            unitPrice: price.unitPrice != null ? String(price.unitPrice) : "",
            mrp: price.mrp != null ? String(price.mrp) : "",
            minSalePrice: price.minSalePrice != null ? String(price.minSalePrice) : "",
            distributorPrice: price.distributorPrice != null ? String(price.distributorPrice) : "",
            wholesalePrice: price.wholesalePrice != null ? String(price.wholesalePrice) : "",
            directPrice: price.directPrice != null ? String(price.directPrice) : "",
        });
        setShowFormModal(true);
    }, []);

    const handleOpenView = useCallback((price: any) => {
        setSelectedPrice(price);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await removeProductPricing(itemToDelete);
                toast.success("Pricing entry deleted successfully!");
            } catch (err: any) {
                toast.error(err.message || "Failed to delete pricing entry");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errors = {
            hsnCode: "",
            gstRate: "",
            unitPrice: "",
        };

        let hasError = false;

        if (!formData.hsnCode.trim()) {
            errors.hsnCode = "HSN Code is required";
            hasError = true;
        }

        if (!formData.gstRate) {
            errors.gstRate = "GST Rate is required";
            hasError = true;
        }

        if (!formData.unitPrice) {
            errors.unitPrice = "Unit Price is required";
            hasError = true;
        }

        setFormErrors(errors);

        if (hasError) return;

        const payload: any = {
            productId: formData.productId,
            hsnCode: formData.hsnCode || undefined,
            gstRate: formData.gstRate ? Number(formData.gstRate) : undefined,
            cess: formData.cess ? Number(formData.cess) : undefined,
            unitPrice: formData.unitPrice ? Number(formData.unitPrice) : undefined,
            mrp: formData.mrp ? Number(formData.mrp) : undefined,
            minSalePrice: formData.minSalePrice ? Number(formData.minSalePrice) : undefined,
            distributorPrice: formData.distributorPrice ? Number(formData.distributorPrice) : undefined,
            wholesalePrice: formData.wholesalePrice ? Number(formData.wholesalePrice) : undefined,
            directPrice: formData.directPrice ? Number(formData.directPrice) : undefined,
        };

        try {
            if (editMode) {
                await editProductPricing(Number(formData.id), payload);
                toast.success("Pricing updated successfully!");
            } else {
                await addProductPricing(payload);
                toast.success("Pricing created successfully!");
            }
            setShowFormModal(false);
        } catch (err: any) {
            toast.error(err.message || "Operation failed");
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
                                <h2 className="page-title">Product Pricing Management</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search product code/name, HSN..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Pricing"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Prices Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && productPricings.length === 0 ? (
                            <div className="text-center p-5">
                                <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-8 w-8"></div>
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Product</th>
                                        <th>HSN Code</th>
                                        <th>GST %</th>
                                        <th>MRP</th>
                                        <th>Unit Price</th>
                                        <th>Wholesale</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedPrices.length > 0 ? (
                                        paginatedPrices.map((price, index) => (
                                            <tr key={price.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">
                                                    {price.product ? `${price.product.productCode} - ${price.product.productName}` : price.productId}
                                                </td>
                                                <td className="master-data-cell">{price.hsnCode || "-"}</td>
                                                <td className="master-data-cell">{price.gstRate != null ? `${price.gstRate}%` : "-"}</td>
                                                <td className="master-data-cell">{price.mrp != null ? `₹${price.mrp.toFixed(2)}` : "-"}</td>
                                                <td className="master-data-cell">{price.unitPrice != null ? `₹${price.unitPrice.toFixed(2)}` : "-"}</td>
                                                <td className="master-data-cell">{price.wholesalePrice != null ? `₹${price.wholesalePrice.toFixed(2)}` : "-"}</td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(price)} />
                                                        <EditButton onClick={() => handleOpenEdit(price)} />
                                                        <DeleteButton onClick={() => triggerDelete(price.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="text-center p-4">No pricing records found.</td>
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

                {/* Add/Edit Modal */}
                <Modal show={showFormModal} onHide={() => setShowFormModal(false)} centered size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>{editMode ? "Edit Product Pricing" : "Add Product Pricing"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <SelectInput
                                        label="PRODUCT"
                                        name="productId"
                                        value={formData.productId}
                                        options={productOptions}
                                        required
                                        onChange={handleChange}

                                    />
                                </Col>
                                <Col md={4}>
                                    <TextInput
                                        label="HSN CODE"
                                        name="hsnCode"
                                        value={formData.hsnCode}
                                        placeholder="e.g. 3924"
                                        onChange={handleChange}
                                        error={formErrors.hsnCode}
                                        required
                                    />
                                </Col>
                                <Col md={4}>
                                    <TextInput
                                        label="GST RATE (%)"
                                        name="gstRate"
                                        type="number"
                                        step="0.01"
                                        value={formData.gstRate}
                                        error={formErrors.gstRate}
                                        required
                                        placeholder="e.g. 18"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={4}>
                                    <TextInput
                                        label="CESS (%)"
                                        name="cess"
                                        type="number"
                                        step="0.01"
                                        value={formData.cess}
                                        placeholder="e.g. 0"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={4}>
                                    <TextInput
                                        label="UNIT PRICE (₹)"
                                        name="unitPrice"
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.unitPrice}
                                        error={formErrors.unitPrice}
                                        placeholder="0.00"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={4}>
                                    <TextInput
                                        label="MRP (₹)"
                                        name="mrp"
                                        type="number"
                                        step="0.01"
                                        value={formData.mrp}
                                        placeholder="0.00"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={4}>
                                    <TextInput
                                        label="MIN SELLING PRICE (₹)"
                                        name="minSalePrice"
                                        type="number"
                                        step="0.01"
                                        value={formData.minSalePrice}
                                        placeholder="0.00"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={4}>
                                    <TextInput
                                        label="WHOLESALE PRICE (₹)"
                                        name="wholesalePrice"
                                        type="number"
                                        step="0.01"
                                        value={formData.wholesalePrice}
                                        placeholder="0.00"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={4}>
                                    <TextInput
                                        label="DISTRIBUTOR PRICE (₹)"
                                        name="distributorPrice"
                                        type="number"
                                        step="0.01"
                                        value={formData.distributorPrice}
                                        placeholder="0.00"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={4}>
                                    <TextInput
                                        label="DIRECT PRICE (₹)"
                                        name="directPrice"
                                        type="number"
                                        step="0.01"
                                        value={formData.directPrice}
                                        placeholder="0.00"
                                        onChange={handleChange}
                                    />
                                </Col>
                            </Row>
                        </Modal.Body>
                        <Modal.Footer>
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                onClick={resetForm}
                            />
                            <div className="ms-2">
                                <CustomButton
                                    text={editMode ? "Update" : "Save"}
                                    icon={FaSave}
                                    type="submit"
                                    disabled={loading}
                                />
                            </div>
                        </Modal.Footer>
                    </form>
                </Modal>

                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Pricing Details"
                    size="lg"
                    avatarText={selectedPrice && selectedPrice.product ? selectedPrice.product.productName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedPrice && selectedPrice.product ? selectedPrice.product.productName : ""}
                    headerSubtitle={selectedPrice && selectedPrice.product ? `Code: ${selectedPrice.product.productCode}` : ""}
                    sections={selectedPrice ? [
                        {
                            fields: [
                                { label: "Product", value: selectedPrice.product ? `${selectedPrice.product.productCode} - ${selectedPrice.product.productName}` : selectedPrice.productId },
                                { label: "HSN Code", value: selectedPrice.hsnCode || "N/A" },
                                { label: "GST Rate", value: selectedPrice.gstRate != null ? `${selectedPrice.gstRate}%` : "N/A" },
                                { label: "Cess", value: selectedPrice.cess != null ? `${selectedPrice.cess}%` : "N/A" },
                                { label: "Unit Price", value: `₹${selectedPrice.unitPrice != null ? selectedPrice.unitPrice.toFixed(2) : "0.00"}` },
                                { label: "MRP", value: `₹${selectedPrice.mrp != null ? selectedPrice.mrp.toFixed(2) : "0.00"}` },
                                { label: "Min Selling Price", value: `₹${selectedPrice.minSalePrice != null ? selectedPrice.minSalePrice.toFixed(2) : "0.00"}` },
                                { label: "Wholesale Price", value: `₹${selectedPrice.wholesalePrice != null ? selectedPrice.wholesalePrice.toFixed(2) : "0.00"}` },
                                { label: "Distributor Price", value: `₹${selectedPrice.distributorPrice != null ? selectedPrice.distributorPrice.toFixed(2) : "0.00"}` },
                                { label: "Direct Price", value: `₹${selectedPrice.directPrice != null ? selectedPrice.directPrice.toFixed(2) : "0.00"}` },
                            ]
                        }
                    ] : []}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this pricing entry?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default ProductPricing;
