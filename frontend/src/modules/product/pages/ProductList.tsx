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
        { header: "Category", render: (product) => product.category?.name || product.category?.categoryName || "N/A" },
        {
            header: "Weight",
            render: (product) => product.weightPerPiece != null
                ? (Number(product.weightPerPiece) < 1 ? `${Number(product.weightPerPiece) * 1000} g` : `${product.weightPerPiece} kg`)
                : "-"
        },
        {
            header: "Stock (Min)",
            render: (product) => {
                const totalStock = product.finishedGoodsStocks?.reduce((acc: number, stock: any) => acc + (Number(stock.onHandQty) || 0), 0) || 0;
                const minQty = product.minimumQty || 0;
                return (
                    <div className="flex flex-col items-center">
                        <span className="font-semibold text-slate-800">{totalStock}</span>
                        <span className="text-xs text-slate-500">Min: {minQty}</span>
                    </div>
                );
            }
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
            align: "left"
        }
    ];

    return (
        <div>
            <div>
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
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search product..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <CustomButton text="Add Product" icon={FaPlus} onClick={() => navigate("/products/create")} />
                        </div>
                    </div>

                    {/* View Table */}
                    <div className="p-0">
                        <DataTable
                            columns={columns}
                            data={paginatedProducts}
                            rowKey={(row) => row.id}
                            loading={loading}
                            emptyMessage="No products found."
                            pagination={totalPages > 1 ? {
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage
                            } : undefined}
                        />
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
                                {
                                    label: "UOM", value: (() => {
                                        const code = selectedProduct.uom?.code || selectedProduct.uom?.uomCode;
                                        return code?.toLowerCase() === 'ea' ? 'pcs' : (code || "N/A");
                                    })()
                                },
                                { label: "Category", value: selectedProduct.category?.name || selectedProduct.category?.categoryName || "N/A" },
                                { label: "Class", value: selectedProduct.subCategory?.name || selectedProduct.subCategory?.subCategoryName || "N/A" },
                                { label: "MRP", value: selectedProduct.mrp != null ? `₹${selectedProduct.mrp}` : "N/A" },
                                { label: "B2B", value: selectedProduct.b2b != null ? `₹${selectedProduct.b2b}` : "N/A" },
                                { label: "B2C", value: selectedProduct.b2c != null ? `₹${selectedProduct.b2c}` : "N/A" },
                                { label: "Export Price", value: selectedProduct.exportPrice != null ? `₹${selectedProduct.exportPrice}` : "N/A" },
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