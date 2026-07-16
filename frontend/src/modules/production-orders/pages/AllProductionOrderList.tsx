import React, { useState, useCallback, useEffect, useMemo } from "react";
import { FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

import ProductionOrderViewModal from "../components/ProductionOrderViewModal";
import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";

const ITEMS_PER_PAGE = 10;

const AllProductionOrderList: React.FC = () => {
    const [data, setData] = useState<ProductionOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ProductionOrder | null>(null);

    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());

    const fetchRawMaterials = useCallback(async () => {
        try {
            const data = await rawMaterialService.fetchAll();
            const arr = Array.isArray(data) ? data : (data as any)?.data || [];
            const map = new Map<string, any>();
            arr.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
            setRawMaterialsMap(map);
        } catch (error) {
            console.error("Failed to fetch raw materials", error);
        }
    }, []);

    useEffect(() => {
        fetchRawMaterials();
    }, [fetchRawMaterials]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await productionOrderService.fetchAll({
                page: 1,
                pageSize: 1000,
                search: searchTerm || undefined,
                status: statusFilter || undefined,
            });

            setData(response.data || []);
            // We use groupedData length for pagination total now
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);

    const groupedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const groupedPOs = data.reduce((acc: any, po: any) => {
            const parts = po.productionOrderId.split('-');
            const baseId = parts.length > 2 ? `${parts[0]}-${parts[1]}` : po.productionOrderId;

            if (!acc[baseId]) {
                acc[baseId] = {
                    ...po,
                    productionOrderId: baseId,
                    items: [],
                    totalProducts: 0,
                    totalProductionQuantity: 0,
                    productNames: new Set()
                };
            }
            acc[baseId].items.push(po);
            acc[baseId].totalProducts += 1;
            acc[baseId].totalProductionQuantity += Number(po.targetQty) || 0;
            if (po.productItem?.productName) acc[baseId].productNames.add(po.productItem.productName);
            return acc;
        }, {});

        return Object.values(groupedPOs).map((group: any) => {
            const hasPending = group.items.some((po: any) => po.status === "RM_PENDING");
            return {
                ...group,
                status: hasPending && group.status !== "DRAFT" ? "RM_PENDING" : group.status,
                productNames: Array.from(group.productNames).join(", ")
            };
        });
    }, [data]);

    const handleOpenView = useCallback((item: ProductionOrder) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const totalPages = Math.max(1, Math.ceil(groupedData.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedGroups = groupedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const columns = [
        {
            header: "#",
            render: (_: any, index: number) => <span className="text-slate-500">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>
        },
        {
            header: "PO NO",
            render: (item: any) => <span className="font-semibold text-slate-800">{item.productionOrderId}</span>
        },
        {
            header: "SO NO",
            render: (item: any) => (
                item.salesOrderDetails?.orderNo || item.sourceSalesOrderId ? (
                    <span className="font-medium text-slate-700">{item.salesOrderDetails?.orderNo || item.sourceSalesOrderId}</span>
                ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Direct Order</span>
                )
            )
        },
        {
            header: "CUSTOMER",
            render: (item: any) => item.salesOrderDetails?.customerName || <span className="text-slate-400 italic text-xs">N/A (Direct)</span>
        },
        {
            header: "TOTAL PRODUCTS",
            render: (item: any) => <span className="text-slate-700">{item.totalProducts ?? 1}</span>
        },
        {
            header: "TOTAL QTY",
            render: (item: any) => <span className="text-slate-700">{item.totalProductionQuantity ?? item.targetQty}</span>
        },
        {
            header: "RAW MATERIALS",
            render: (item: any) => {
                if (!item.items || item.items.length === 0) return <span className="text-slate-500">N/A</span>;
                const rawMaterials = item.items.flatMap((po: any) => po.draftRawMaterials || []);
                const visibleRMs = rawMaterials.slice(0, 2);
                const hiddenRMs = rawMaterials.slice(2);

                return (
                    <div className="flex flex-wrap gap-1 items-center">
                        {visibleRMs.map((rm: any, rmIdx: number) => {
                            const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                            const name = stockRm?.materialName || rm.rawMaterialId;
                            const availableStock = stockRm ? Number(stockRm.onHandQty || 0) : 0;
                            const reqQty = Number(rm.requiredQty || 0);
                            const isAvailable = availableStock >= reqQty;
                            return (
                                <StatusBadge
                                    key={`${item.productionOrderId}-${rmIdx}`}
                                    status={isAvailable ? "AVAILABLE" : "INSUFFICIENT"}
                                    customText={name}
                                    title={`Req: ${reqQty.toFixed(2)}, Avail: ${availableStock.toFixed(2)}`}
                                    className="fw-normal"
                                />
                            );
                        })}
                        {hiddenRMs.length > 0 && (
                            <StatusBadge
                                status=""
                                customText={`+${hiddenRMs.length} more`}
                                customColor={{ bg: '#e9ecef', text: '#495057' }}
                                className="fw-normal"
                                title={hiddenRMs.map((rm: any) => {
                                    const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                                    return stockRm?.materialName || rm.rawMaterialId;
                                }).join(', ')}
                                style={{ cursor: 'help' }}
                            />
                        )}
                    </div>
                );
            }
        },
        {
            header: "COLOR",
            render: (item: any) => item.colorType ? (
                <StatusBadge
                    status={item.colorType === 'mc' ? 'MULTI COLOR' : 'SINGLE COLOR'}
                    customColor={item.colorType === 'mc' ? { bg: '#e0e7ff', text: '#3730a3' } : { bg: '#fef3c7', text: '#92400e' }}
                />
            ) : <span className="text-slate-500">-</span>
        },
        {
            header: "STATUS",
            render: (item: any) => <StatusBadge status={item.status === 'CANCELLED' ? 'DELETED' : (item.status || 'PLANNED')} />
        },
        {
            header: "CREATED DATE",
            render: (item: any) => <span className="text-slate-600">{formatDate(item.createdAt)}</span>
        },
        {
            header: "ACTIONS",
            render: (item: any) => (
                <div className="flex items-center gap-2">
                    <ViewButton onClick={() => handleOpenView(item)} />
                </div>
            )
        }
    ];

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Production Order History</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div style={{ minWidth: '180px' }}>
                            <SelectInput
                                label=""
                                hideLabel
                                name="statusFilter"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                options={[
                                    { label: "All Statuses", value: "" },
                                    { label: "Draft", value: "DRAFT" },
                                    { label: "Planned", value: "PLANNED" },
                                    { label: "RM Pending", value: "RM_PENDING" },
                                    { label: "RM Available", value: "RM_AVAILABLE" },
                                    { label: "Scheduled", value: "SCHEDULED" },
                                    { label: "Schedule Deleted", value: "SCHEDULE_DELETED" },
                                    { label: "In Progress", value: "IN_PROGRESS" },
                                    { label: "Completed", value: "COMPLETED" },
                                ]}
                            />
                        </div>
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search orders..."
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={paginatedGroups}
                    rowKey={(item) => item.productionOrderId}
                    loading={loading}
                    emptyMessage="No production orders found."
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => setCurrentPage(page)
                    }}
                />
            </div>

            <ProductionOrderViewModal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
                order={selectedItem}
                onSuccess={fetchOrders}
            />
        </div>
    );
};

export default AllProductionOrderList;
