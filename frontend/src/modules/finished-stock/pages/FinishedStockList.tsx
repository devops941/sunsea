import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

import { useListCache } from "../../../hooks/useListCache";
import { finishedGoodsStockService } from "../../../services/finishedGoodsStockService";
import { useSocketSync } from "../../../hooks/useSocketSync";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import DataTable from "../../../components/ui/table/DataTable";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import { Search } from "lucide-react";

import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { categoryService } from "../../../services/categoryService";

const formatUom = (uomCode: string | undefined) => {
    if (!uomCode) return "PCS";
    const code = uomCode.trim().toUpperCase();
    if (code === "EA" || code === "EACH") return "PCS";
    return code;
};

const ITEMS_PER_PAGE = 15;

interface FinishedStockListProps {
    storeId?: string;
}

const FinishedStockList: React.FC<FinishedStockListProps> = ({ storeId: propStoreId }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const activeStoreId = propStoreId || "";
    const [currentPage, setCurrentPage] = useState(1);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const [categoryFilter, setCategoryFilter] = useState("");
    const [appliedCategory, setAppliedCategory] = useState("");
    const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);

    const fetchCategoriesData = useCallback(async () => {
        try {
            const res = await categoryService.fetchAll({ type: "PRODUCT", isActive: true });
            const list = res?.categories ?? (Array.isArray(res) ? res : []);
            setCategoryOptions(list.map((c: any) => ({ value: String(c.id), label: c.name || c.categoryName || c.code })));
        } catch {
            // silent
        }
    }, []);

    useEffect(() => {
        fetchCategoriesData();
    }, [fetchCategoriesData]);

    // Debounce search — 300 ms
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page to 1 when storeId changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeStoreId]);

    const cacheKey = `finishedGoodsStock:${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}:${activeStoreId}:${appliedCategory}`;

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const res = await finishedGoodsStockService.fetchAll({
            storeId: activeStoreId,
            search: debouncedSearch,
            categoryId: appliedCategory || undefined,
            page: currentPage,
            limit: ITEMS_PER_PAGE,
        });
        const list = Array.isArray(res) ? res : (res.data || []);
        const tot = Array.isArray(res) ? res.length : (res.total || list.length);
        return { data: list, total: tot };
    }, [activeStoreId, debouncedSearch, appliedCategory, currentPage]);

    const { data, total, loading } = useListCache({
        cacheKey,
        socketModule: "finishedGoodsStock",
        fetcher,
    });

    // Re-fetch category options on category changes
    useSocketSync("category", undefined, fetchCategoriesData);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleOpenView = useCallback((item: any) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const hasActiveFilters = !!appliedCategory;
    const activeFilterCount = appliedCategory ? 1 : 0;

    const handleApplyFilters = useCallback(() => {
        setAppliedCategory(categoryFilter);
        setCurrentPage(1);
    }, [categoryFilter]);

    const handleClearFilters = useCallback(() => {
        setCategoryFilter("");
        setAppliedCategory("");
        setCurrentPage(1);
    }, []);

    // Pagination logic
    const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE) || 1;
    const paginatedData = data || [];

    const exportColumns = [
        { header: "Store / Location", accessor: (item: any) => item.store?.storeName },
        { header: "Product Code", accessor: (item: any) => item.product?.productCode },
        { header: "Product Name", accessor: (item: any) => item.product?.productName },
        { header: "Category", accessor: (item: any) => item.product?.category?.name || item.product?.category?.categoryName || "N/A" },
        { header: "Color", accessor: (item: any) => item.product?.colors?.map((c: any) => c.color?.colorName).join(", ") || "N/A" },
        { header: "Size", accessor: (item: any) => item.product?.size?.sizeName || "N/A" },
        { header: "Physical Stock", accessor: (item: any) => `${item.onHandQty} ${formatUom(item.product?.uom?.uomCode)}` },
    ];

    return (
        <div>
            <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-visible">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
                    <div>
                        <h2 className="text-base font-bold text-ink">Finished Goods Stock</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={15} />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 bg-card-2 border border-line-soft rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                placeholder="Search stock..."
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                        </div>
                        <FilterPopover
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            onApply={handleApplyFilters}
                            onClear={handleClearFilters}
                        >
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Category
                                    </label>
                                    <SelectInput
                                        name="categoryFilter"
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        options={categoryOptions}
                                        defaultOptionLabel="All Categories"
                                        noMargin
                                    />
                                </div>
                            </div>
                        </FilterPopover>
                        <ExportCSVButton
                            data={data || []}
                            columns={exportColumns}
                            filename="finished_goods_stock.csv"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="p-0 overflow-hidden rounded-b-2xl">
                <DataTable
                    data={paginatedData || []}
                    rowKey={(item) => `${item.storeId}-${item.productItemId}`}
                    loading={loading}
                    emptyMessage="No finished goods stock found."
                    pagination={
                        totalPages > 1
                            ? { currentPage, totalPages, onPageChange: (page) => setCurrentPage(page) }
                            : undefined
                    }
                    columns={[
                        {
                            header: "#",
                            render: (_, index) => <span className="text-ink-subtle">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>
                        },
                        {
                            header: "PRODUCT CODE",
                            render: (item) => <span className="font-mono text-ink-muted">{item.product?.productCode || "N/A"}</span>
                        },
                        {
                            header: "PRODUCT NAME",
                            render: (item) => <span className="font-semibold text-ink">{item.product?.productName || "N/A"}</span>
                        },
                        {
                            header: "CATEGORY",
                            render: (item) => <span className="text-ink-muted">{(item.product?.category as any)?.name || item.product?.category?.categoryName || "N/A"}</span>
                        },
                        {
                            header: "STORE / LOCATION",
                            render: (item) => <span className="font-medium text-ink-muted">{item.store?.storeName || "N/A"}</span>
                        },
                        {
                            header: "PHYSICAL STOCK",
                            render: (item) => {
                                const onHand = Number(item.onHandQty) || 0;
                                const minQty = Number((item.product as any)?.minimumQty) || 0;
                                return (
                                    <div className="flex flex-col">
                                        <span className={`font-semibold ${onHand <= minQty || onHand <= 0 ? "text-red-600" : "text-ink"}`}>
                                            {item.onHandQty} {formatUom(item.product?.uom?.uomCode)}
                                        </span>
                                        <span className="text-xs text-ink-subtle mt-1">Min: {minQty} | Max: {(item.product as any)?.maximumQty || "0"}</span>
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
                </div>

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
                                { label: "Category", value: selectedItem.product?.category?.name || selectedItem.product?.category?.categoryName || "N/A" },
                                { label: "Store / Location", value: selectedItem.store?.storeName || "N/A" },
                                { label: "HSN Code", value: selectedItem.product?.hsnCode || "N/A" },
                            ]
                        },
                        {
                            title: "Stock Information",
                            fields: [
                                { label: "Physical Stock (On Hand)", value: `${selectedItem.onHandQty} ${formatUom(selectedItem.product?.uom?.uomCode)}` },
                                { label: "Minimum Quantity limit", value: `${(selectedItem.product as any)?.minimumQty || "0"} ${formatUom(selectedItem.product?.uom?.uomCode)}` },
                                { label: "Weight Per Piece", value: selectedItem.product?.weightPerPiece != null ? `${selectedItem.product.weightPerPiece} ${(selectedItem.product as any)?.weightUom || "kg"}` : "N/A" },
                            ]
                        }
                    ] : []}
                />
            </div>
        </div>
    );
};

export default FinishedStockList;
