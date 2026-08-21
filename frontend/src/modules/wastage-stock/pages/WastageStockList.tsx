import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchRawMaterialStocks, rawMaterialStockCreated, rawMaterialStockUpdated, rawMaterialStockDeleted } from "../../../features/raw-materials/rawMaterialStockSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";

const ITEMS_PER_PAGE = 10;

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
    const dispatch = useAppDispatch();

    const { data, loading, error } = useAppSelector((state) => state.rawMaterialStocks);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showView, setShowView] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch only wastage-store items
    useEffect(() => {
        dispatch(fetchRawMaterialStocks({ search: debouncedSearch, storeCategory: "WASTAGE" }));
    }, [dispatch, debouncedSearch]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useSocketSync("rawMaterialStock", {
        created: rawMaterialStockCreated,
        updated: rawMaterialStockUpdated,
        deleted: rawMaterialStockDeleted,
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const totalPages = Math.ceil((data?.length || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = (data || []).slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
        { header: "CATEGORY", accessor: (item: any) => item.category?.categoryName || item.categoryId || "-" },
        { header: "STORE", accessor: (item: any) => item.store?.storeName || item.storeId || "-" },
        { header: "LOCATION", accessor: (item: any) => item.storeLocation?.locationCode || item.locationId || "-" },
        { header: "PHYSICAL STOCK", accessor: (item: any) => formatExportQty(item.onHandQty ?? 0, item.baseUom || "") },
        { header: "RESERVED", accessor: (item: any) => formatExportQty(item.reservedQty ?? 0, item.baseUom || "") },
        { header: "AVAILABLE", accessor: (item: any) => formatExportQty(Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0), item.baseUom || "") },
        { header: "STATUS", accessor: (item: any) => item.status || "Active" },
    ];

    return (
        <div className="p-4 md:p-6">
            <div className="rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Wastage Stock Ledger</h2>
                        <p className="text-sm text-ink-subtle mt-1">Materials stored in Wastage stores</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search wastage stock..."
                        />
                        <ExportCSVButton
                            data={data || []}
                            columns={exportColumns}
                            filename="wastage_stock_ledger.csv"
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={paginatedData || []}
                    rowKey={(item) => item.rawMaterialId}
                    loading={loading}
                    emptyMessage="No wastage stock records found."
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => setCurrentPage(page)
                    }}
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
                                <span className="text-ink-muted">{item.category?.categoryName || item.categoryId || "-"}</span>
                            )
                        },
                        {
                            header: "STORE / LOCATION",
                            render: (item) => {
                                const locCode = item.storeLocation?.locationCode || item.store?.location?.locationCode || item.store?.location?.locationName || item.locationId || "-";
                                return (
                                    <div className="flex flex-col">
                                        <span className="font-medium text-ink-muted">{item.store?.storeName || item.storeId || "-"}</span>
                                        <span className="text-xs text-ink-subtle">Loc: {locCode}</span>
                                    </div>
                                );
                            }
                        },
                        {
                            header: "PHYSICAL STOCK",
                            render: (item) => {
                                const baseUom = item.baseUom || "";
                                const minStock = Number(item.minimumStock || 0);
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
                                const minStock = Number(item.minimumStock || 0);
                                const reorderLevel = Number(item.reorderLevel || 0);

                                let availColorClass = "text-green-600";
                                if (available <= minStock) {
                                    availColorClass = "text-red-600";
                                } else if (available <= reorderLevel) {
                                    availColorClass = "text-amber-600";
                                }

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
                                    <ViewButton
                                        onClick={() => {
                                            setSelectedItem(item);
                                            setShowView(true);
                                        }}
                                    />
                                </div>
                            )
                        }
                    ]}
                />
            </div>

            <CommonViewModal
                show={showView}
                onHide={() => setShowView(false)}
                modalTitle="Wastage Stock Details"
                avatarText={selectedItem ? (selectedItem.materialName || "W").charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? (selectedItem.materialName || selectedItem.rawMaterialId) : ""}
                sections={selectedItem ? [
                    {
                        fields: [
                            { label: "Material ID", value: selectedItem.rawMaterialId },
                            { label: "Material Name", value: selectedItem.materialName || "N/A" },
                            { label: "Category", value: selectedItem.category?.categoryName || "N/A" },
                            { label: "Primary UOM", value: parseBaseUom(selectedItem.baseUom).primary },
                            { label: "Secondary UOM(s)", value: parseBaseUom(selectedItem.baseUom).secondary },
                            { label: "Store", value: selectedItem.store?.storeName || selectedItem.storeId || "N/A" },
                            { label: "Store Location", value: selectedItem.storeLocation?.locationCode || selectedItem.store?.location?.locationCode || selectedItem.locationId || "N/A" },
                            { label: "Physical Stock", value: formatExportQty(selectedItem.onHandQty ?? 0, selectedItem.baseUom || "") },
                            { label: "Reserved Stock", value: formatExportQty(selectedItem.reservedQty ?? 0, selectedItem.baseUom || "") },
                            { label: "Available Stock", value: formatExportQty(Number(selectedItem.onHandQty ?? 0) - Number(selectedItem.reservedQty ?? 0), selectedItem.baseUom || "") },
                            { label: "Batch No", value: selectedItem.batchNo || "N/A" },
                            { label: "Narration", value: selectedItem.narration || "N/A" },
                            { label: "Status", value: selectedItem.status || "Active" }
                        ]
                    }
                ] : []}
            />
        </div>
    );
};

export default WastageStockList;
