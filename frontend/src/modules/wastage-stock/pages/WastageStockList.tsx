import React, { useState, useCallback, useEffect } from "react";

import { toast } from "react-toastify";

import { useListCache } from "../../../hooks/useListCache";
import { rawMaterialStockService } from "../../../services/rawMaterialStockService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import DataTable from "../../../components/ui/table/DataTable";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { Search } from "lucide-react";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import { formatLocationAddress } from "../../../utils/addressUtils";

import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { categoryService } from "../../../services/categoryService";

const ITEMS_PER_PAGE = 20;

const parseBaseUom = (uomStr?: string) => {
    if (!uomStr) return { primary: "N/A", secondary: "None", list: [] };
    const list = uomStr.split(',').map(u => u.trim()).filter(Boolean);
    if (list.length === 0) return { primary: "N/A", secondary: "None", list: [] };
    const primary = list[0];
    const secondaryList = list.slice(1);
    const secondary = secondaryList.length > 0 ? secondaryList.join(', ') : "None";
    return { primary, secondary, list };
};

const WastageStockList: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showView, setShowView] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const [categoryFilter, setCategoryFilter] = useState("");
    const [appliedCategory, setAppliedCategory] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [appliedStatus, setAppliedStatus] = useState("");
    const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);

    const fetchCategoriesData = useCallback(async () => {
        try {
            const res = await categoryService.fetchAll({ type: "WASTAGE", isActive: true });
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

    const cacheKey = `wastageStock:${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}:${appliedCategory}:${appliedStatus}`;

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const res = await rawMaterialStockService.fetchAll({
            search: debouncedSearch || undefined,
            storeCategory: "WASTAGE",
            itemType: "WASTAGE",
            categoryId: appliedCategory || undefined,
            status: appliedStatus || undefined,
            page: currentPage,
            limit: ITEMS_PER_PAGE,
        });
        return { data: res.data || [], total: res.total || 0 };
    }, [debouncedSearch, appliedCategory, appliedStatus, currentPage]);

    const { data, total, loading } = useListCache({
        cacheKey,
        socketModule: "rawMaterialStock",
        fetcher,
    });

    const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE) || 1;

    // Re-fetch category options on category changes
    useSocketSync("category", undefined, fetchCategoriesData);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const hasActiveFilters = !!(appliedCategory || appliedStatus);
    const activeFilterCount = (appliedCategory ? 1 : 0) + (appliedStatus ? 1 : 0);

    const handleApplyFilters = useCallback(() => {
        setAppliedCategory(categoryFilter);
        setAppliedStatus(statusFilter);
        setCurrentPage(1);
    }, [categoryFilter, statusFilter]);

    const handleClearFilters = useCallback(() => {
        setCategoryFilter("");
        setAppliedCategory("");
        setStatusFilter("");
        setAppliedStatus("");
        setCurrentPage(1);
    }, []);

    const handleOpenView = useCallback((item: any) => {
        setSelectedItem(item);
        setShowView(true);
    }, []);

    const formatExportQty = (qty: any, uom: string) => {
        const num = Number(qty) || 0;
        let primaryUom = uom ? uom.split(',')[0] : "";
        if (primaryUom.toLowerCase() === "ea") primaryUom = "PCS";
        const displayNum = Number(num.toFixed(3)).toString();
        return `${displayNum} ${primaryUom}`;
    };

    const formatDisplayQty = (qty: any, uom: string, prefix = "") => {
        const num = Number(qty) || 0;
        let primaryUom = uom ? uom.split(',')[0] : "";
        if (primaryUom.toLowerCase() === "ea") primaryUom = "PCS";
        const displayNum = Number(num.toFixed(3)).toString();
        return (
            <>
                {prefix}{displayNum} {primaryUom}
            </>
        );
    };

    const exportColumns = [
        { header: "NAME", accessor: (item: any) => item.materialName || "-" },
        { header: "ID", accessor: (item: any) => item.rawMaterialId || "-" },
        { header: "CATEGORY", accessor: (item: any) => item.category?.name || item.category?.categoryName || "-" },
        { header: "STORE", accessor: (item: any) => item.store?.storeName || item.storeId || "-" },
        { header: "LOCATION", accessor: (item: any) => item.storeLocation?.locationCode || item.locationId || "-" },
        { header: "PHYSICAL STOCK", accessor: (item: any) => formatExportQty(item.onHandQty ?? 0, item.baseUom || "") },
        { header: "RESERVED", accessor: (item: any) => formatExportQty(item.reservedQty ?? 0, item.baseUom || "") },
        { header: "AVAILABLE", accessor: (item: any) => formatExportQty(Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0), item.baseUom || "") },
        { header: "STATUS", accessor: (item: any) => item.status || "Active" },
    ];

    return (
        <div>
            <div className="max-w-[1300px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-visible">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
                    <div>
                        <h2 className="text-base font-bold text-ink">Wastage Stock Ledger</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={15} />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 bg-card-2 border border-line-soft rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                placeholder="Search wastage stock..."
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
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Status
                                    </label>
                                    <SelectInput
                                        name="statusFilter"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        options={[
                                            { value: "Active", label: "Active" },
                                            { value: "Inactive", label: "Inactive" }
                                        ]}
                                        defaultOptionLabel="All Statuses"
                                        noMargin
                                    />
                                </div>
                            </div>
                        </FilterPopover>
                        <ExportCSVButton
                            data={data || []}
                            columns={exportColumns}
                            filename="wastage_stock_ledger.csv"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="p-0 overflow-hidden rounded-b-2xl">
                <DataTable
                    data={data || []}
                    rowKey={(item) => item.rawMaterialId || item.id}
                    loading={loading}
                    emptyMessage="No wastage stock records found."
                    pagination={
                        totalPages > 1
                            ? { currentPage, totalPages, onPageChange: setCurrentPage }
                            : undefined
                    }
                    columns={[
                        {
                            header: "#",
                            render: (_, index) => <span className="text-ink-subtle">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>
                        },
                        {
                            header: "NAME",
                            render: (item) => (
                                <div className="flex flex-col">
                                    <span className="font-semibold text-ink">{item.materialName || "-"}</span>
                                    <span className="text-xs text-ink-subtle">ID: {item.rawMaterialId}</span>
                                </div>
                            )
                        },
                        {
                            header: "CATEGORY",
                            render: (item) => (
                                <span className="text-ink-muted">{(item as any).category?.name || (item as any).category?.categoryName || "-"}</span>
                            )
                        },
                        {
                            header: "STORE",
                            render: (item) => (
                                <span className="font-medium text-ink-muted">{item.store?.storeName || item.storeId || "-"}</span>
                            )
                        },
                        {
                            header: "PHYSICAL STOCK",
                            render: (item) => {
                                const baseUom = item.baseUom || "";
                                const minStock = Number((item as any).minimumStock || 0);
                                return (
                                    <div className="flex flex-col">
                                        <span className="text-ink">{formatDisplayQty(item.onHandQty, baseUom)}</span>
                                        <span className="text-xs text-ink-subtle">{formatDisplayQty(minStock, baseUom, "Min: ")}</span>
                                    </div>
                                );
                            }
                        },
                        {
                            header: "RESERVED",
                            render: (item) => (
                                <span className="text-ink-muted">{formatDisplayQty(item.reservedQty, item.baseUom || "")}</span>
                            )
                        },
                        {
                            header: "AVAILABLE",
                            render: (item) => {
                                const baseUom = item.baseUom || "";
                                const available = Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0);
                                const minStock = Number((item as any).minimumStock || 0);
                                const reorderLevel = Number((item as any).reorderLevel || 0);

                                let availColorClass = "text-green-600";
                                if (available <= minStock) availColorClass = "text-red-600";
                                else if (available <= reorderLevel) availColorClass = "text-amber-600";

                                return <span className={`font-semibold ${availColorClass}`}>{formatDisplayQty(available, baseUom)}</span>;
                            }
                        },
                        {
                            header: "STATUS",
                            render: (item) => <StatusBadge status={item.status || "Active"} />
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
            </div>

            <CommonViewModal
                show={showView}
                onHide={() => setShowView(false)}
                modalTitle="Wastage Stock Details"
                avatarText={selectedItem ? (selectedItem.materialName || "W").charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? (selectedItem.materialName || selectedItem.rawMaterialId) : ""}
                headerSubtitle={selectedItem ? `ID: ${selectedItem.rawMaterialId}` : ""}
                sections={selectedItem ? [
                    {
                        fields: [
                            { label: "Material ID", value: selectedItem.rawMaterialId },
                            { label: "Material Name", value: selectedItem.materialName || "N/A" },
                            { label: "Category", value: selectedItem.category?.name || selectedItem.category?.categoryName || "N/A" },
                            { label: "Primary UOM", value: parseBaseUom(selectedItem.baseUom).primary },
                            { label: "Secondary UOM(s)", value: parseBaseUom(selectedItem.baseUom).secondary },
                            { label: "Store", value: selectedItem.store?.storeName || selectedItem.storeId || "N/A" },
                            { label: "Store Location", value: formatLocationAddress(selectedItem.storeLocation?.locationCode || selectedItem.locationId) || "N/A" },
                            { label: "Physical Stock", value: formatExportQty(selectedItem.onHandQty ?? 0, selectedItem.baseUom || "") },
                            { label: "Reserved Stock", value: formatExportQty(selectedItem.reservedQty ?? 0, selectedItem.baseUom || "") },
                            { label: "Available Stock", value: formatExportQty(Number(selectedItem.onHandQty ?? 0) - Number(selectedItem.reservedQty ?? 0), selectedItem.baseUom || "") },
                            { label: "Batch No", value: selectedItem.batchNo || "N/A" },
                            { label: "Narration", value: selectedItem.narration || "N/A" },
                            { label: "Status", value: selectedItem.status || "Active" },
                            {
                                label: "Created Date",
                                value: (() => {
                                    const d = selectedItem?.createdAt || selectedItem?.rawMaterial?.createdAt;
                                    return d ? new Date(d).toLocaleString() : "N/A";
                                })()
                            },
                            {
                                label: "Updated Date",
                                value: (() => {
                                    const d = selectedItem?.updatedAt || selectedItem?.rawMaterial?.updatedAt;
                                    return d ? new Date(d).toLocaleString() : "N/A";
                                })()
                            }
                        ]
                    }
                ] : []}
            />
        </div>
    );
};

export default WastageStockList;
