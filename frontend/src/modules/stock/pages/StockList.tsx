import React, { useState, useEffect } from "react";

import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchRawMaterialStocks } from "../../../features/raw-materials/rawMaterialStockSlice";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { storeService } from "../../../services/storeService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";

const ITEMS_PER_PAGE = 10;

interface StockListProps {
    storeId?: string;
}

const StockList: React.FC<StockListProps> = ({ storeId: propStoreId }) => {
    const dispatch = useAppDispatch();

    const { data, loading, error } = useAppSelector((state) => state.rawMaterialStocks);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [internalStoreId] = useState("");
    const [stores, setStores] = useState<any[]>([]);

    const activeStoreId = propStoreId !== undefined ? propStoreId : internalStoreId;
    const [currentPage, setCurrentPage] = useState(1);
    const [showView, setShowView] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    // Fetch stores for dropdown
    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await storeService.fetchAll();
                setStores(res?.stores || res || []);
            } catch (err) {
                console.error(err);
            }
        };
        fetchStores();
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch stocks based on search and storeId
    useEffect(() => {
        dispatch(fetchRawMaterialStocks({ search: debouncedSearch, storeId: activeStoreId }));
    }, [dispatch, debouncedSearch, activeStoreId]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const totalPages = Math.ceil((data?.length || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = (data || []).slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const formatExportQty = (qty: any, uom: string) => {
        const num = Number(qty) || 0;
        const primaryUom = uom ? uom.split(',')[0] : "";
        return `${num} ${primaryUom}`;
    };

    const formatDisplayQty = (qty: any, uom: string, prefix = "") => {
        const num = Number(qty) || 0;
        const primaryUom = uom ? uom.split(',')[0] : "";
        return (
            <>
                {prefix}{num} {primaryUom}
            </>
        );
    };

    const exportColumns = [
        { header: "NAME", accessor: (item: any) => (item as any).materialName || item.rawMaterial?.materialName || "-" },
        { header: "ID", accessor: (item: any) => item.rawMaterialId || "-" },
        { header: "CATEGORY", accessor: (item: any) => (item as any).category?.categoryName || item.rawMaterial?.category?.name || (item as any).categoryId || "-" },
        { header: "STORE", accessor: (item: any) => item.store?.storeName || item.storeId || "-" },
        { header: "LOCATION", accessor: (item: any) => (item as any).storeLocation?.locationCode || item.locationId || "-" },
        { header: "PHYSICAL STOCK", accessor: (item: any) => formatExportQty(item.onHandQty ?? 0, (item as any).baseUom || item.rawMaterial?.baseUom || "") },
        { header: "MIN STOCK", accessor: (item: any) => formatExportQty(Number((item as any).minimumStock || item.rawMaterial?.minimumStock || 0), (item as any).baseUom || item.rawMaterial?.baseUom || "") },
        { header: "RESERVED", accessor: (item: any) => formatExportQty(item.reservedQty ?? 0, (item as any).baseUom || item.rawMaterial?.baseUom || "") },
        { header: "AVAILABLE", accessor: (item: any) => formatExportQty(Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0), (item as any).baseUom || item.rawMaterial?.baseUom || "") },
        { header: "STATUS", accessor: (item: any) => item.status || "Active" },
    ];

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">
                            {stores.find((s) => s.storeId === activeStoreId)?.storeName || "Stock Ledger Management"}
                        </h2>
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
                            filename="stock_ledger_balances.csv"
                        />
                        {/* <CustomButton
                            text="Add Raw Material"
                            icon={FaPlus}
                            onClick={() => navigate("/raw-materials/create")}
                        /> */}
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={paginatedData || []}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No stock records found."
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
                            header: "NAME",
                            render: (item) => {
                                const matName = (item as any).materialName || item.rawMaterial?.materialName || "-";
                                return (
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-800">{matName}</span>
                                        <span className="text-xs text-slate-500">ID: {item.rawMaterialId}</span>
                                    </div>
                                );
                            }
                        },
                        {
                            header: "CATEGORY",
                            render: (item) => {
                                const catName = (item as any).category?.categoryName || item.rawMaterial?.category?.name || (item as any).categoryId || "-";
                                return <span className="text-slate-600">{catName}</span>;
                            }
                        },
                        {
                            header: "STORE / LOCATION",
                            render: (item) => {
                                const locCode = (item as any).storeLocation?.locationCode || (item as any).store?.location?.locationCode || (item as any).store?.location?.locationName || (item as any).store?.locationDesc || item.locationId || "-";
                                return (
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-700">{item.store?.storeName || item.storeId || "-"}</span>
                                        <span className="text-xs text-slate-500">Loc: {locCode}</span>
                                    </div>
                                );
                            }
                        },
                        {
                            header: "PHYSICAL STOCK",
                            render: (item) => {
                                const baseUom = (item as any).baseUom || item.rawMaterial?.baseUom || "";
                                const minStock = Number((item as any).minimumStock || item.rawMaterial?.minimumStock || 0);
                                return (
                                    <div className="flex flex-col">
                                        <span className="text-slate-800">{formatDisplayQty(item.onHandQty, baseUom)}</span>
                                        <span className="text-xs text-slate-500">{formatDisplayQty(minStock, baseUom, "Min: ")}</span>
                                    </div>
                                );
                            }
                        },
                        {
                            header: "RESERVED",
                            render: (item) => {
                                const baseUom = (item as any).baseUom || item.rawMaterial?.baseUom || "";
                                return <span className="text-slate-600">{formatDisplayQty(item.reservedQty, baseUom)}</span>;
                            }
                        },
                        {
                            header: "AVAILABLE",
                            render: (item) => {
                                const baseUom = (item as any).baseUom || item.rawMaterial?.baseUom || "";
                                const minStock = Number((item as any).minimumStock || item.rawMaterial?.minimumStock || 0);
                                const reorderLevel = Number((item as any).reorderLevel || item.rawMaterial?.reorderLevel || 0);
                                const available = Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0);

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
                modalTitle="Stock Details"
                avatarText={selectedItem ? ((selectedItem as any).materialName || selectedItem.rawMaterial?.materialName || "S").charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? ((selectedItem as any).materialName || selectedItem.rawMaterial?.materialName || selectedItem.rawMaterialId) : ""}
                sections={selectedItem ? [
                    {
                        fields: [
                            { label: "Material ID", value: selectedItem.rawMaterialId },
                            { label: "Material Name", value: (selectedItem as any).materialName || selectedItem.rawMaterial?.materialName || "N/A" },
                            { label: "Category", value: (selectedItem as any).category?.categoryName || selectedItem.rawMaterial?.category?.name || "N/A" },
                            { label: "Base UOM", value: (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "N/A" },
                            { label: "Reorder Level", value: ((selectedItem as any).reorderLevel || selectedItem.rawMaterial?.reorderLevel) != null ? `${(selectedItem as any).reorderLevel || selectedItem.rawMaterial?.reorderLevel} ${(selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || ""}` : "N/A" },
                            { label: "Minimum Stock", value: ((selectedItem as any).minimumStock || selectedItem.rawMaterial?.minimumStock) != null ? formatExportQty((selectedItem as any).minimumStock || selectedItem.rawMaterial?.minimumStock, (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "") : "N/A" },
                            { label: "Store", value: selectedItem.store?.storeName || selectedItem.storeId || "N/A" },
                            { label: "Store Location", value: (selectedItem as any).storeLocation?.locationCode || (selectedItem as any).store?.location?.locationCode || (selectedItem as any).store?.location?.locationName || (selectedItem as any).store?.locationDesc || selectedItem.locationId || "N/A" },
                            { label: "Batch No", value: selectedItem.batchNo || "N/A" },
                            { label: "Physical Stock", value: formatExportQty(selectedItem.onHandQty ?? 0, (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "") },
                            { label: "Reserved Stock", value: formatExportQty(selectedItem.reservedQty ?? 0, (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "") },
                            { label: "Available Stock", value: formatExportQty(Number(selectedItem.onHandQty ?? 0) - Number(selectedItem.reservedQty ?? 0), (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "") },
                            { label: "Average Cost (₹)", value: selectedItem.avgCost != null ? String(selectedItem.avgCost) : "N/A" },
                            { label: "Status", value: selectedItem.status || "Active" },
                            { label: "Last Movement", value: selectedItem.lastMovementAt ? new Date(selectedItem.lastMovementAt).toLocaleString() : "-" }
                        ]
                    }
                ] : []}
            />
        </div>
    );
};

export default StockList;
