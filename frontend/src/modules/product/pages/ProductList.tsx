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
                toast.error(err?.message || err || "Failed to delete product");
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
        { header: "Product Name", accessor: "productName" },
        { header: "Category", render: (product) => product.category?.name || product.category?.categoryName || "N/A" },
        {
            header: "Price",
            render: (product) => (
                <div className="flex flex-col">
                    <span className="text-sm text-slate-800">MRP: {product.mrp ? `₹${product.mrp}` : '-'}</span>
                    <span className="text-xs text-slate-500">B2B: {product.b2b ? `₹${product.b2b}` : '-'}</span>
                </div>
            )
        },
        {
            header: "Stock (Min)",
            render: (product) => {
                const lastStock =
                    product.finishedGoodsStocks?.[product.finishedGoodsStocks.length - 1];
                const onHandQty = lastStock?.onHandQty || 0;
                ``
                const minQty = product.minimumQty || 0;
                return (
                    <div className="flex flex-col items-center">
                        <span className="font-semibold text-slate-800">{onHandQty}</span>
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
                                { label: "MRP", value: selectedProduct.mrp != null ? `₹${selectedProduct.mrp}` : "N/A" },
                                { label: "B2B", value: selectedProduct.b2b != null ? `₹${selectedProduct.b2b}` : "N/A" },
                                { label: "B2C", value: selectedProduct.b2c != null ? `₹${selectedProduct.b2c}` : "N/A" },
                                { label: "Export Price", value: selectedProduct.exportPrice != null ? `₹${selectedProduct.exportPrice}` : "N/A" },
                                { label: "Weight", value: selectedProduct.weightPerPiece != null ? (Number(selectedProduct.weightPerPiece) < 1 ? `${Number(selectedProduct.weightPerPiece) * 1000} g` : `${selectedProduct.weightPerPiece} kg`) : "N/A" },
                                { label: "Status", value: selectedProduct.isActive ? "Active" : "Inactive" },
                            ]
                        }
                    ] : []}
                    customContent={
                        selectedProduct?.billOfMaterials && selectedProduct.billOfMaterials.length > 0 ? (
                            <div className="mt-6 flex flex-col gap-6">
                                {/* BOM Section */}
                                {selectedProduct.billOfMaterials.some((rm: any) => Number(rm.percentage) > 0) && (
                                    <div>
                                        <h6 className="text-sm font-semibold text-slate-800 mb-2">Raw Materials Composition (BOM)</h6>
                                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-slate-50 text-slate-600">
                                                    <tr>
                                                        <th className="px-4 py-2 font-semibold border-b border-slate-200">Raw Material</th>
                                                        <th className="px-4 py-2 font-semibold border-b border-slate-200 text-right">Percentage (%)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {selectedProduct.billOfMaterials
                                                        .filter((rm: any) => Number(rm.percentage) > 0)
                                                        .map((rm: any, idx: number) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-4 py-2">{rm.rawMaterial?.materialName || rm.rawMaterialId}</td>
                                                                <td className="px-4 py-2 text-right">{rm.percentage} %</td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Accessories Section */}
                                {selectedProduct.billOfMaterials.some((rm: any) => Number(rm.requiredQuantity) > 0) && (
                                    <div>
                                        <h6 className="text-sm font-semibold text-slate-800 mb-2">Accessories / Additional Items</h6>
                                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-slate-50 text-slate-600">
                                                    <tr>
                                                        <th className="px-4 py-2 font-semibold border-b border-slate-200">Item</th>
                                                        <th className="px-4 py-2 font-semibold border-b border-slate-200 text-right">Quantity</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {selectedProduct.billOfMaterials
                                                        .filter((rm: any) => Number(rm.requiredQuantity) > 0)
                                                        .map((rm: any, idx: number) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-4 py-2">{rm.rawMaterial?.materialName || rm.rawMaterialId}</td>
                                                                <td className="px-4 py-2 text-right">{rm.requiredQuantity}</td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null
                    }
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