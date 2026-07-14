import React, { useState, useEffect, useCallback } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import { useProducts } from "../../../hooks/useProducts";

const ITEMS_PER_PAGE = 10;

const ProductList: React.FC = () => {
    const navigate = useNavigate();
    const { products, loading, error, loadProducts, removeProduct } = useProducts();
    console.log(products, "products");

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

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        { header: "Product Code", accessor: "productCode" },
        { header: "Product Name", accessor: "productName" },
        { 
            header: "UOM", 
            render: (product) => {
                const code = product.uom?.code || product.uom?.uomCode;
                return code?.toLowerCase() === 'ea' ? 'pcs' : (code || "N/A");
            }
        },
        { header: "Category", render: (product) => product.category?.name || product.category?.categoryName || "N/A" },
        { header: "Size", render: (product) => product.size?.sizeCode ? product.size?.sizeCode : "-" },
        { 
            header: "Weight", 
            render: (product) => product.weightPerPiece != null 
                ? (Number(product.weightPerPiece) < 1 ? `${Number(product.weightPerPiece) * 1000} g` : `${product.weightPerPiece} kg`) 
                : "-"
        },
        { header: "Status", render: (product) => <StatusBadge status={product.isActive ? "ACTIVE" : "INACTIVE"} />, align: "center" },
        {
            header: "Actions",
            render: (product) => (
                <div className="flex items-center gap-2 justify-end">
                    <ViewButton onClick={() => handleView(product)} />
                    <EditButton onClick={() => handleEdit(product)} />
                    <DeleteButton onClick={() => triggerDelete(product.id)} />
                </div>
            ),
            align: "right"
        }
    ];

    return (
        <div className="p-4 md:p-6 min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Product Catalog</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search product..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <CustomButton text="Add Product" icon={FaPlus} onClick={() => navigate("/products/create")} />
                        </div>
                    </div>

                    {/* View Table */}
                    {loading && products.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={paginatedProducts}
                            rowKey={(row) => row.id}
                            emptyMessage="No products found."
                            pagination={totalPages > 1 ? {
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage
                            } : undefined}
                        />
                    )}
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
            </div>
        </div>
    );
};

export default ProductList;