import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchFinishedGoodsStocks } from "../../../features/finished-goods-stock/finishedGoodsStockSlice";


import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";

const formatUom = (uomCode: string | undefined) => {
    if (!uomCode) return "PCS";
    const code = uomCode.trim().toUpperCase();
    if (code === "EA" || code === "EACH") return "PCS";
    return code;
};

const ITEMS_PER_PAGE = 10;

interface FinishedStockListProps {
    storeId?: string;
}

const FinishedStockList: React.FC<FinishedStockListProps> = ({ storeId: propStoreId }) => {
    const dispatch = useAppDispatch();
    const { data, loading, error, total } = useAppSelector((state) => state.finishedGoodsStocks);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const activeStoreId = propStoreId || "";
    const [currentPage, setCurrentPage] = useState(1);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page to 1 when storeId changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeStoreId]);

    // Fetch stocks based on search, page, limit and storeId
    useEffect(() => {
        dispatch(fetchFinishedGoodsStocks({
            storeId: activeStoreId,
            search: debouncedSearch,
            page: currentPage,
            limit: ITEMS_PER_PAGE
        }));
    }, [dispatch, activeStoreId, debouncedSearch, currentPage]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenView = useCallback((item: any) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    // Pagination logic
    const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE) || 1;
    const paginatedData = data || [];

    const exportColumns = [
        { header: "Store / Location", accessor: (item: any) => item.store?.storeName },
        { header: "Product Code", accessor: (item: any) => item.product?.productCode },
        { header: "Product Name", accessor: (item: any) => item.product?.productName },
        { header: "Category", accessor: (item: any) => item.product?.category?.categoryName || "N/A" },
        { header: "Color", accessor: (item: any) => item.product?.colors?.map((c: any) => c.color?.colorName).join(", ") || "N/A" },
        { header: "Size", accessor: (item: any) => item.product?.size?.sizeName || "N/A" },
        { header: "Physical Stock", accessor: (item: any) => `${item.onHandQty} ${formatUom(item.product?.uom?.uomCode)}` },
    ];

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Finished Goods Stock</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search stock..."
                        />
                        <ExportCSVButton
                            data={data || []}
                            columns={exportColumns}
                            filename="finished_goods_stock.csv"
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={paginatedData || []}
                    rowKey={(item) => `${item.storeId}-${item.productItemId}`}
                    loading={loading}
                    emptyMessage="No finished goods stock found."
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => setCurrentPage(page)
                    }}
                    columns={[
                        {
                            header: "#",
                            render: (_, index) => <span className="text-slate-500">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>
                        },
                        {
                            header: "PRODUCT CODE",
                            render: (item) => <span className="font-mono text-slate-600">{item.product?.productCode || "N/A"}</span>
                        },
                        {
                            header: "PRODUCT NAME",
                            render: (item) => <span className="font-semibold text-slate-800">{item.product?.productName || "N/A"}</span>
                        },
                        {
                            header: "CATEGORY",
                            render: (item) => <span className="text-slate-600">{item.product?.category?.categoryName || "N/A"}</span>
                        },
                        // {
                        //     header: "COLOR",
                        //     render: (item) => <span className="text-slate-600">{item.product?.colors?.map((c: any) => c.color?.colorName).join(", ") || "N/A"}</span>
                        // },
                        // {
                        //     header: "SIZE",
                        //     render: (item) => <span className="text-slate-600">{item.product?.size?.sizeName ? `${item.product.size.sizeName} (${item.product.size.sizeCode})` : "N/A"}</span>
                        // },
                        {
                            header: "STORE / LOCATION",
                            render: (item) => <span className="font-medium text-slate-700">{item.store?.storeName || "N/A"}</span>
                        },
                        {
                            header: "PHYSICAL STOCK",
                            render: (item) => {
                                const onHand = Number(item.onHandQty) || 0;
                                const minQty = Number((item.product as any)?.minimumQty) || 0;
                                return (
                                    <div className="flex flex-col">
                                        <span className={`font-semibold ${onHand <= minQty || onHand <= 0 ? "text-red-600" : "text-slate-800"}`}>
                                            {item.onHandQty} {formatUom(item.product?.uom?.uomCode)}
                                        </span>
                                        <span className="text-xs text-slate-500 mt-1">Min: {minQty} | Max: {(item.product as any)?.maximumQty || "0"}</span>
                                    </div>
                                )
                            }
                        },
                        {
                            header: "ACTIONS",
                            render: (item) => (
                                <div className="flex items-center gap-2">
                                    <ViewButton onClick={() => handleOpenView(item)} />
                                </div>
                            )
                        }
                    ]}
                />

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Finished Goods Stock Details"
                    avatarText={selectedItem?.product?.productName ? selectedItem.product.productName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem?.product?.productName || "N/A"}
                    headerSubtitle={selectedItem?.product?.productCode ? `Code: ${selectedItem.product.productCode}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Product Code", value: selectedItem.product?.productCode || "N/A" },
                                { label: "Product Name", value: selectedItem.product?.productName || "N/A" },
                                { label: "Category", value: selectedItem.product?.category?.categoryName || "N/A" },
                                // { label: "Color", value: selectedItem.product?.colors?.map((c: any) => c.color?.colorName).join(", ") || "N/A" },
                                // { label: "Size", value: selectedItem.product?.size?.sizeName ? `${selectedItem.product.size.sizeName} (${selectedItem.product.size.sizeCode})` : "N/A" },
                                { label: "Store / Location", value: selectedItem.store?.storeName || "N/A" },
                                { label: "HSN Code", value: selectedItem.product?.hsnCode || "N/A" },
                            ]
                        },
                        {
                            title: "Stock Information",
                            fields: [
                                { label: "Physical Stock (On Hand)", value: `${selectedItem.onHandQty} ${formatUom(selectedItem.product?.uom?.uomCode)}` },
                                { label: "Minimum Quantity limit", value: `${(selectedItem.product as any)?.minimumQty || "0"} ${formatUom(selectedItem.product?.uom?.uomCode)}` },
                                { label: "Maximum Quantity limit", value: `${(selectedItem.product as any)?.maximumQty || "0"} ${formatUom(selectedItem.product?.uom?.uomCode)}` },
                                { label: "Weight Per Piece", value: selectedItem.product?.weightPerPiece != null ? `${selectedItem.product.weightPerPiece} kg` : "N/A" },
                                { label: "Dimensions (L×B×H)", value: selectedItem.product?.dimensions || "N/A" },
                                { label: "Last Updated", value: formatDate(selectedItem.updatedAt) },
                            ]
                        }
                    ] : []}
                />
            </div>
        </div>
    );
};

export default FinishedStockList;
