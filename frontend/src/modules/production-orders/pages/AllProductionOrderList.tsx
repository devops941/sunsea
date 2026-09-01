import React, { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import { useNavigate } from "react-router-dom";

import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { useSocketSync } from "../../../hooks/useSocketSync";

const ITEMS_PER_PAGE = 15;

const AllProductionOrderList: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<ProductionOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());

    const fetchRawMaterials = useCallback(async () => {
        try {
            const data = await rawMaterialService.fetchAll();
            const arr = Array.isArray(data) ? data : ((data as any)?.rawMaterials ?? []);
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

    useSocketSync("productionOrder", undefined, fetchOrders);

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

    const handleOpenView = useCallback((item: any) => {
        navigate(`/production-orders/history/view/${item.productionOrderId}`, { state: { order: item } });
    }, [navigate]);

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
            width: "50px",
            render: (_: any, index: number) => <span className="text-ink-subtle">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>
        },
        {
            header: "PO NO",
            width: "minmax(130px, 1fr)",
            render: (item: any) => <span className="font-semibold text-ink">{item.productionOrderId}</span>
        },
        {
            header: "TOTAL PRODUCTS",
            width: "120px",
            render: (item: any) => <span className="text-ink-muted">{item.totalProducts ?? 1}</span>
        },
        {
            header: "TOTAL QTY",
            width: "110px",
            render: (item: any) => <span className="text-ink-muted">{item.totalProductionQuantity ?? item.targetQty}</span>
        },
        // {
        //     header: "COLOR",
        //     render: (item: any) => item.colorType ? (
        //         <StatusBadge
        //             status={item.colorType === 'mc' ? 'MULTI COLOR' : 'SINGLE COLOR'}
        //             customColor={item.colorType === 'mc' ? { bg: '#e0e7ff', text: '#3730a3' } : { bg: '#fef3c7', text: '#92400e' }}
        //         />
        //     ) : <span className="text-ink-subtle">-</span>
        // },
        {
            header: "STATUS",
            width: "190px",
            render: (item: any) => {
                const s = item.status || 'CREATED';
                if (s === 'DISPATCHED') {
                    return <StatusBadge status="COMPLETED" customText="Completed" />;
                }
                return <StatusBadge status={s} />;
            }
        },
        {
            header: "CREATED DATE",
            width: "130px",
            render: (item: any) => <span className="text-ink-muted">{formatDate(item.createdAt)}</span>
        },
        {
            header: "ACTIONS",
            width: "80px",
            render: (item: any) => (
                <div className="flex items-center gap-2">
                    <ViewButton onClick={() => handleOpenView(item)} />
                </div>
            )
        }
    ];

    return (
        <div>
            <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Production Order History</h2>
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
                                    { label: "Created", value: "CREATED" },
                                    { label: "Waiting For Material", value: "WAITING_FOR_MATERIAL" },
                                    { label: "Ready For Planning", value: "READY_FOR_PLANNING" },
                                    { label: "Weekly Scheduled", value: "WEEKLY_SCHEDULED" },
                                    { label: "Daily Planned", value: "DAILY_PLANNED" },
                                    { label: "In Progress", value: "IN_PROGRESS" },
                                    { label: "In Production", value: "IN_PRODUCTION" },
                                    { label: "Post Production", value: "POST_PRODUCTION" },
                                    { label: "Ready For Dispatch", value: "READY_FOR_DISPATCH" },
                                    { label: "Partially Dispatched", value: "PARTIAL_COMPLETED" },
                                    { label: "Completed With Shortfall", value: "COMPLETED_WITH_SHORTFALL" },
                                    { label: "Closed", value: "CLOSED" },
                                    { label: "Completed", value: "DISPATCHED" },
                                    { label: "Cancelled", value: "CANCELLED" },
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
        </div>
    );
};

export default AllProductionOrderList;
