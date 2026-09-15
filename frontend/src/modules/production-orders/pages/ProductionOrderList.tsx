import { formatDate } from "../../../utils/dateUtils";
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { FaPlus, FaEye, FaTimes, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import IconButton from "../../../components/ui/IconButton/IconButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import { machineService } from "../../../services/machineService";
import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 20;
const SORT_STORAGE_KEY = "sunsea_production_order_sort";

type SortOrder = "default" | "asc" | "desc";

interface FilterState {
    status: string;
    orderType: string;
    machineId: string;
    fromDate: string;
    toDate: string;
}

const DEFAULT_FILTERS: FilterState = {
    status: "",
    orderType: "",
    machineId: "",
    fromDate: "",
    toDate: "",
};

const statusOptions = [
    { label: "Draft", value: "DRAFT" },
    { label: "Weekly Scheduled", value: "WEEKLY_SCHEDULED" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Completed", value: "COMPLETED" },
];

const orderTypeOptions = [
    { label: "Weekly Plan", value: "weekly-group" },
    { label: "Direct Order", value: "standalone" },
];

const ProductionOrderList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();

    // --- State ---
    const [combinedData, setCombinedData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
        try {
            const saved = localStorage.getItem(SORT_STORAGE_KEY);
            if (saved === "asc" || saved === "desc") return saved;
        } catch (_) {}
        return "default";
    });

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prev) => {
            let next: SortOrder = "default";
            if (prev === "default") next = "desc";
            else if (prev === "desc") next = "asc";
            else next = "default";
            try {
                localStorage.setItem(SORT_STORAGE_KEY, next);
            } catch (_) {}
            return next;
        });
    }, []);

    const [machines, setMachines] = useState<any[]>([]);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ProductionOrder | null>(null);
    const [fullOrder, setFullOrder] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());



    // Fetch raw materials map
    const fetchRawMaterials = useCallback(async () => {
        try {
            const data = await rawMaterialService.fetchAll();
            const arr = Array.isArray(data) ? data : ((data as any)?.rawMaterials ?? []);
            const map = new Map<string, any>();
            arr.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
            setRawMaterialsMap(map);
        } catch {
            // silently ignore
        }
    }, []);

    const fetchOrderDetails = useCallback(async (id: string) => {
        setLoadingDetails(true);
        try {
            const data = (await productionOrderService.getById(id)) as any;
            if (data && data.products) {
                data.products = data.products.map((p: any) => ({
                    ...p,
                    productionOrderId: data.productionOrderId,
                    status: data.status
                }));
            }
            setFullOrder(data);
        } catch {
            toast.error("Failed to load production order details");
        } finally {
            setLoadingDetails(false);
        }
    }, []);


    const fetchMachines = useCallback(async () => {
        try {
            const res = await machineService.getAll({ limit: 1000 });
            const list = Array.isArray(res) ? res : (res?.machines || res?.data || []);
            if (Array.isArray(list)) setMachines(list);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        fetchRawMaterials();
        fetchMachines();
    }, [fetchRawMaterials, fetchMachines]);

    const machineOptions = useMemo(() => {
        return machines.map((m: any) => {
            const id = m.machineId || m.id;
            const name = m.machineName ? `${m.machineName} (${id})` : String(id);
            return {
                label: name,
                value: String(id),
            };
        });
    }, [machines]);

    const activeFilterCount = useMemo(() => {
        return Object.values(appliedFilters).filter(Boolean).length;
    }, [appliedFilters]);

    const hasActiveFilters = activeFilterCount > 0;

    const handleFilterOpen = useCallback(() => {
        setDraftFilters(appliedFilters);
    }, [appliedFilters]);

    const handleApplyFilters = useCallback(() => {
        setAppliedFilters(draftFilters);
        setCurrentPage(1);
    }, [draftFilters]);

    const handleClearFilters = useCallback(() => {
        setDraftFilters(DEFAULT_FILTERS);
        setAppliedFilters(DEFAULT_FILTERS);
        setCurrentPage(1);
    }, []);

    const getBaseId = (poId: string): string | null => {
        const match = poId.match(/^(.+)-M\d+-\d+$/);
        return match ? match[1] : null;
    };

    // Fetch and combine Sales Orders and Production Orders
    const fetchCombinedData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Production Orders
            let poList: any[] = [];
            try {
                const poRes = await productionOrderService.fetchAll({
                    pageSize: 1000
                });
                const rawList = (poRes as any)?.data?.data || (poRes as any)?.data || (Array.isArray(poRes) ? poRes : []);
                poList = Array.isArray(rawList) ? rawList : [];
            } catch (err: any) {
                console.error("Failed to fetch production orders:", err);
                toast.error(err?.response?.data?.message || "Failed to load production orders");
            }

            // Group all POs — weekly plan POs by base ID, standalone as-is
            const directPOs = poList;

            // Group direct POs — weekly plan POs by base ID, standalone as-is
            const weeklyGroupMap = new Map<string, any[]>();
            const standalonePOs: any[] = [];

            directPOs.forEach((po: any) => {
                const baseId = getBaseId(po.productionOrderId);
                if (baseId) {
                    if (!weeklyGroupMap.has(baseId)) weeklyGroupMap.set(baseId, []);
                    weeklyGroupMap.get(baseId)!.push(po);
                } else {
                    standalonePOs.push(po);
                }
            });

            // Build weekly group entries
            const weeklyGroupEntries = Array.from(weeklyGroupMap.entries()).map(([baseId, pos]) => {
                const isAllCompleted = pos.length > 0 && pos.every((p: any) => {
                    return p.status?.toUpperCase() === 'COMPLETED' || 
                        (Number(p.producedQty || 0) >= Number(p.targetQty || 0) && Number(p.targetQty || 0) > 0);
                });
                const hasAnyInProgress = pos.some((p: any) => {
                    const st = p.status?.toUpperCase();
                    return st === 'IN_PROGRESS' || (Number(p.producedQty || 0) > 0 && Number(p.producedQty || 0) < Number(p.targetQty || 0));
                });
                const hasAnyDraft = pos.some((p: any) => p.status?.toUpperCase() === 'DRAFT');

                let overallStatus = 'WEEKLY_SCHEDULED';
                if (isAllCompleted) {
                    overallStatus = 'COMPLETED';
                } else if (hasAnyInProgress) {
                    overallStatus = 'IN_PROGRESS';
                } else if (hasAnyDraft) {
                    overallStatus = 'DRAFT';
                } else {
                    overallStatus = pos[0]?.status || 'WEEKLY_SCHEDULED';
                }

                const firstPO = pos[0];
                return {
                    id: `group-${baseId}`,
                    type: 'weekly-group',
                    baseId,
                    orderDate: firstPO.orderDate,
                    weekStart: firstPO.weekStartDate,
                    weekEnd: firstPO.weekEndDate,
                    status: overallStatus,
                    children: pos,
                    isDirect: true,
                    primaryPO: firstPO,
                };
            });

            // Build standalone direct PO entries (not weekly plan)
            const directMapped = standalonePOs.map((po: any) => {
                const isCompleted = po.status?.toUpperCase() === 'COMPLETED' || 
                    (Number(po.producedQty || 0) >= Number(po.targetQty || 0) && Number(po.targetQty || 0) > 0);
                const effectiveStatus = isCompleted ? 'COMPLETED' : po.status;
                return {
                    id: `direct-${po.productionOrderId}`,
                    type: 'standalone',
                    orderNo: po.productionOrderId,
                    orderDate: po.orderDate,
                    expectedCompletionDate: po.dueDate,
                    customer: { firmName: 'Direct Production Order' },
                    status: effectiveStatus,
                    productionOrders: [po],
                    primaryPO: po,
                    isDirect: true,
                    items: [{ product: po.productItem, quantity: po.targetQty }]
                };
            });

            // Combine all entries
            let combinedList = [...weeklyGroupEntries, ...directMapped];

            // Apply status filter
            if (appliedFilters.status) {
                combinedList = combinedList.filter(item => item.status?.toUpperCase() === appliedFilters.status.toUpperCase());
            }

            // Apply order type filter
            if (appliedFilters.orderType) {
                combinedList = combinedList.filter(item => item.type === appliedFilters.orderType);
            }

            // Apply machine filter
            if (appliedFilters.machineId) {
                const target = String(appliedFilters.machineId).toLowerCase();
                combinedList = combinedList.filter((item: any) => {
                    const pos = item.children || item.productionOrders || (item.primaryPO ? [item.primaryPO] : []);
                    return pos.some((po: any) => {
                        const mId = String(po.machineMachineId || po.machineId || po.Machine?.id || po.Machine?.machineId || "").toLowerCase();
                        const mName = String(po.Machine?.machineName || "").toLowerCase();
                        return mId === target || mName === target;
                    });
                });
            }

            // Apply date filters (Order Date)
            if (appliedFilters.fromDate) {
                combinedList = combinedList.filter((item: any) => {
                    const dateStr = item.orderDate ? String(item.orderDate).split("T")[0] : "";
                    return dateStr ? dateStr >= appliedFilters.fromDate : true;
                });
            }
            if (appliedFilters.toDate) {
                combinedList = combinedList.filter((item: any) => {
                    const dateStr = item.orderDate ? String(item.orderDate).split("T")[0] : "";
                    return dateStr ? dateStr <= appliedFilters.toDate : true;
                });
            }

            // Apply search filter (PO No, product name)
            if (searchTerm.trim()) {
                const q = searchTerm.trim().toLowerCase();
                combinedList = combinedList.filter((item: any) => {
                    const poNo = (item.primaryPO?.productionOrderId || item.orderNo || item.baseId || "").toLowerCase();
                    const products = (item.productionOrders || item.items || item.children || [])
                        .map((p: any) => (p.productItem?.productName || p.product?.productName || "").toLowerCase())
                        .join(" ");
                    return poNo.includes(q) || products.includes(q);
                });
            }

            // Apply sort by orderDate
            if (sortOrder === "asc") {
                combinedList.sort((a, b) => new Date(a.orderDate || 0).getTime() - new Date(b.orderDate || 0).getTime());
            } else if (sortOrder === "desc") {
                combinedList.sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime());
            }

            setTotalItems(combinedList.length);

            // Paginate
            const start = (currentPage - 1) * ITEMS_PER_PAGE;
            setCombinedData(combinedList.slice(start, start + ITEMS_PER_PAGE));
        } catch {
            toast.error("Failed to load production orders");
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, appliedFilters, sortOrder]);

    useEffect(() => {
        fetchCombinedData();
    }, [fetchCombinedData]);

    useSocketSync("productionOrder", undefined, fetchCombinedData);

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const tableRef = useRef<HTMLDivElement>(null);

    const handleOpenWeeklyPlan = useCallback((item: any) => {
        navigate(
            `/production-orders/weekly-plan/${item.baseId}`,
            {
                state: {
                    baseId: item.baseId,
                    weekStart: item.weekStart,
                    weekEnd: item.weekEnd,
                    children: item.children,
                }
            }
        );
    }, [navigate]);

    const handleEditWeeklyPlan = useCallback((item: any) => {
        navigate(
            '/production-orders/create',
            {
                state: {
                    editWeeklyPlan: true,
                    baseId: item.baseId,
                    children: item.children,
                    weekStart: item.weekStart,
                    weekEnd: item.weekEnd,
                }
            }
        );
    }, [navigate]);

    const handleOpenEdit = useCallback((po: any) => {
        navigate(`/production-orders/edit/${po.productionOrderId}`);
    }, [navigate]);

    const handleOpenViewItem = useCallback((item: any) => {
        if (item.type === 'weekly-group') {
            handleOpenWeeklyPlan(item);
            return;
        }
        if (!item.primaryPO) return;
        setSelectedItem(item.primaryPO);
        setFullOrder(null);
        setShowViewModal(true);
        fetchOrderDetails(item.primaryPO.productionOrderId || item.primaryPO.id);
    }, [fetchOrderDetails, handleOpenWeeklyPlan]);

    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: combinedData.length,
        onEnter: (i) => {
            const item = combinedData[i];
            if (!item) return;
            if (item.type === 'weekly-group') {
                handleOpenWeeklyPlan(item);
            } else {
                handleOpenViewItem(item);
            }
        },
        onEdit: (i) => {
            const item = combinedData[i];
            if (!item) return;
            if (item.type === 'weekly-group') {
                const isWeeklyEditable = can('production_orders.edit') && !['IN_PRODUCTION', 'POST_PRODUCTION', 'COMPLETED', 'CLOSED', 'DISPATCHED'].includes(item.status?.toUpperCase());
                if (isWeeklyEditable) handleEditWeeklyPlan(item);
            } else if (item.primaryPO && can('production_orders.edit')) {
                const isStandaloneEditable = !['IN_PRODUCTION', 'POST_PRODUCTION', 'COMPLETED', 'CLOSED', 'DISPATCHED'].includes(item.primaryPO.status?.toUpperCase());
                if (isStandaloneEditable) handleOpenEdit(item.primaryPO);
            }
        },
        containerRef: tableRef,
    });

    const handleDeleteConfirm = async () => {
        if (!itemToDelete || itemToDelete.length === 0 || isDeleting) return;
        setIsDeleting(true);
        try {
            for (const id of itemToDelete) {
                await productionOrderService.delete(id);
            }
            toast.success("Production order(s) deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete([]);
            fetchCombinedData();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to delete order(s)");
        } finally {
            setIsDeleting(false);
        }
    };

    const triggerDelete = useCallback((ids: string[]) => {
        setItemToDelete(ids);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteCurrentRow = useCallback(() => {
        const item = combinedData[focusedIndex];
        if (!item) return;
        if (item.type === 'weekly-group') {
            if (can('production_orders.delete')) {
                const canDeleteAll = !item.children?.some((po: any) => po._editRestrictions?.canDelete === false);
                if (canDeleteAll) {
                    triggerDelete(item.children.map((po: any) => po.productionOrderId));
                } else {
                    toast.error("Cannot delete: one or more orders have active Daily Production Plans. Cancel them in Daily Machine Planning first.");
                }
            }
        } else if (item.primaryPO && can('production_orders.delete')) {
            if (item.primaryPO._editRestrictions?.canDelete === false) {
                toast.error("Cannot delete: this order has active Daily Production Plans. Cancel them in Daily Machine Planning first.");
            } else {
                triggerDelete(item.productionOrders ? item.productionOrders.map((po: any) => po.productionOrderId) : [item.primaryPO.productionOrderId]);
            }
        }
    }, [combinedData, focusedIndex, can, triggerDelete]);

    usePageShortcuts({
        onRefresh: () => fetchCombinedData(),
        onSort: () => toggleSortOrder(),
        onDelete: handleDeleteCurrentRow,
        onNew: () => can("production_orders.create") && navigate("/production-orders/create"),
    });

    const hasInsufficientStock = fullOrder?.products?.some((p: any) =>
        p.rawMaterials?.some((rm: any) => {
            const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
            const required = Number(rm.requiredQty || 0);
            let available = stockRm 
                ? Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0) 
                : Number(rm.availableStock || 0);
            const isReservedStatus = ["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED", "IN_PROGRESS", "IN PROGRESS"].includes(fullOrder?.status);
            if (isReservedStatus && stockRm) {
                available += required;
            }
            return rm.status ? rm.status === "INSUFFICIENT" : available < required;
        })
    );

    const modalSections = selectedItem
        ? [
            {
                title: "Order Information",
                fields: [
                    { label: "Order No", value: fullOrder?.productionOrderId || selectedItem.productionOrderId },
                ],
            },
            {
                title: "Schedule & Additional Details",
                fields: [
                    { label: "Order Date", value: formatDate(fullOrder?.orderDate || selectedItem.orderDate) },
                    { label: "Due Date", value: formatDate(fullOrder?.dueDate || selectedItem.dueDate) },
                    { label: "Remarks", value: fullOrder?.remarks || selectedItem.remarks || "N/A" },
                ],
            },
        ]
        : [];

    const modalCustomContent = (
        <div>
            {hasInsufficientStock && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 fw-medium" role="alert" style={{ borderRadius: '8px', fontSize: '14px' }}>
                    <span>One or more required raw materials have insufficient stock. Please create a Raw Material Order before proceeding to Weekly Machine Assignment.</span>
                </div>
            )}

            {loadingDetails ? (
                <div className="text-center p-4">
                    <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-6 w-6 inline-block mr-2"></div> Loading details...
                </div>
            ) : (
                fullOrder?.products?.map((prod: any, idx: number) => (
                    <div key={idx} className="mt-4 border-t border-line pt-4">
                        <h6 className="text-base font-bold text-ink mb-3">Product {idx + 1}: {prod.productName} ({prod.productCode})</h6>
                        
                        <div className="grid grid-cols-3 gap-4 mb-4 bg-card-2 p-4 rounded-xl border border-line-soft">
                            <div>
                                <div className="text-xs font-semibold text-ink-subtle uppercase tracking-wide">Production Qty</div>
                                <div className="text-sm font-bold text-ink mt-1">{prod.quantity} {prod.uom?.toLowerCase() === 'ea' || prod.uom?.toLowerCase() === 'each' ? 'pcs' : prod.uom}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-ink-subtle uppercase tracking-wide">Weight Used</div>
                                <div className="text-sm font-bold text-ink mt-1">{Number(prod.weightPerPieceUsed || 0).toFixed(3)} KG</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-ink-subtle uppercase tracking-wide">Unit (UOM)</div>
                                <div className="text-sm font-bold text-ink mt-1">{prod.uom?.toLowerCase() === 'ea' || prod.uom?.toLowerCase() === 'each' ? 'pcs' : prod.uom}</div>
                            </div>
                        </div>

                        <div className="text-sm font-semibold text-ink-muted mb-2 mt-4">Required Raw Materials</div>
                        <div className="w-full border border-line rounded-lg overflow-hidden mb-3">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-card-2 border-b border-line text-ink-muted">
                                    <tr>
                                        <th className="p-2 font-semibold">RAW MATERIAL CODE</th>
                                        <th className="p-2 font-semibold">RAW MATERIAL NAME</th>
                                        <th className="p-2 font-semibold text-right">REQUIRED QTY</th>
                                        <th className="p-2 font-semibold text-right">AVAILABLE STOCK</th>
                                        <th className="p-2 font-semibold text-center">STOCK STATUS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line bg-card">
                                    {prod.rawMaterials?.map((rm: any) => {
                                        const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                                        const required = Number(rm.requiredQty || 0);
                                        let available = stockRm 
                                            ? Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0) 
                                            : Number(rm.availableStock || 0);
                                        const isReservedStatus = ["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED", "IN_PROGRESS", "IN PROGRESS"].includes(fullOrder?.status);
                                        if (isReservedStatus && stockRm) {
                                            available += required;
                                        }
                                        const materialName = rm.materialName || stockRm?.materialName || rm.rawMaterialId;
                                        const isAvailable = rm.status ? rm.status === "AVAILABLE" : available >= required;
                                        
                                        // Get correct UOM
                                        let displayUom = stockRm?.baseUom?.split(',')[0] || rm.uom || stockRm?.uom || "KG";
                                        if (displayUom.toLowerCase() === 'ea' || displayUom.toLowerCase() === 'each') {
                                            displayUom = 'pcs';
                                        }

                                        return (
                                            <tr key={rm.rawMaterialId} className="hover:bg-card-2 transition-colors">
                                                <td className="p-2 font-semibold text-ink-muted">{rm.rawMaterialId}</td>
                                                <td className="p-2 text-ink-muted">{materialName}</td>
                                                <td className="p-2 text-right text-ink-muted">{required.toFixed(2)} {displayUom}</td>
                                                <td className="p-2 text-right text-ink-muted">{available.toFixed(2)} {displayUom}</td>
                                                <td className="p-2 text-center">
                                                    <StatusBadge status={isAvailable ? "AVAILABLE" : "INSUFFICIENT"} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {(!prod.rawMaterials || prod.rawMaterials.length === 0) && (
                                        <tr>
                                            <td colSpan={5} className="text-center text-ink-subtle p-4">
                                                No raw materials defined for this product.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="w-full flex-1 flex flex-col min-h-0">
            <div className="w-full flex-1 flex flex-col bg-card rounded-2xl shadow-sm border border-line overflow-hidden min-h-[calc(100vh-140px)]">
                {/* Page Header */}
                <div className="shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
                    <div>
                        <h2 className="text-base font-bold text-ink">Production Order Management</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 relative">
                        <SearchInput
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Search PO / product... ( / )"
                        />
                        <FilterPopover
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            onOpen={handleFilterOpen}
                            onApply={handleApplyFilters}
                            onClear={handleClearFilters}
                        >
                            <div className="space-y-3">
                                {/* Status */}
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Status
                                    </label>
                                    <SelectInput
                                        name="filterStatus"
                                        value={draftFilters.status}
                                        options={statusOptions}
                                        defaultOptionLabel="All Statuses"
                                        searchable={false}
                                        noMargin
                                        onChange={(e) =>
                                            setDraftFilters((p) => ({ ...p, status: e.target.value }))
                                        }
                                    />
                                </div>

                                {/* Order Type */}
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Order Type
                                    </label>
                                    <SelectInput
                                        name="filterOrderType"
                                        value={draftFilters.orderType}
                                        options={orderTypeOptions}
                                        defaultOptionLabel="All Types"
                                        searchable={false}
                                        noMargin
                                        onChange={(e) =>
                                            setDraftFilters((p) => ({ ...p, orderType: e.target.value }))
                                        }
                                    />
                                </div>

                                {/* Machine */}
                                {machineOptions.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                            Machine
                                        </label>
                                        <SelectInput
                                            name="filterMachine"
                                            value={draftFilters.machineId}
                                            options={machineOptions}
                                            defaultOptionLabel="All Machines"
                                            searchable={false}
                                            noMargin
                                            onChange={(e) =>
                                                setDraftFilters((p) => ({ ...p, machineId: e.target.value }))
                                            }
                                        />
                                    </div>
                                )}

                                {/* Date Range */}
                                <div>
                                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                                        Order Date
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="block text-[11px] text-ink-subtle mb-1">From</span>
                                            <TextInput
                                                name="filterFromDate"
                                                type="date"
                                                value={draftFilters.fromDate}
                                                max={draftFilters.toDate || undefined}
                                                onChange={(e) =>
                                                    setDraftFilters((p) => ({ ...p, fromDate: e.target.value }))
                                                }
                                                inputClassName="!py-1.5 !text-xs"
                                            />
                                        </div>
                                        <div>
                                            <span className="block text-[11px] text-ink-subtle mb-1">To</span>
                                            <TextInput
                                                name="filterToDate"
                                                type="date"
                                                value={draftFilters.toDate}
                                                min={draftFilters.fromDate || undefined}
                                                onChange={(e) =>
                                                    setDraftFilters((p) => ({ ...p, toDate: e.target.value }))
                                                }
                                                inputClassName="!py-1.5 !text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </FilterPopover>
                        {can("production_orders.create") && (
                            <CustomButton
                                text="Add Production Order"
                                icon={FaPlus}
                                onClick={() => navigate("/production-orders/create")}
                            />
                        )}
                    </div>
                </div>

                {/* Active filter chips */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2 px-5 py-2 border-b border-line flex-wrap bg-head/20 shrink-0">
                        <span className="text-xs text-ink-subtle">Active filters:</span>

                        {appliedFilters.status && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                                Status: {statusOptions.find(s => s.value === appliedFilters.status)?.label || appliedFilters.status}
                                <FaTimes
                                    className="cursor-pointer hover:opacity-75 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, status: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {appliedFilters.orderType && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                                Type: {orderTypeOptions.find(t => t.value === appliedFilters.orderType)?.label || appliedFilters.orderType}
                                <FaTimes
                                    className="cursor-pointer hover:opacity-75 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, orderType: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {appliedFilters.machineId && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                                Machine: {machineOptions.find(m => String(m.value) === String(appliedFilters.machineId))?.label || appliedFilters.machineId}
                                <FaTimes
                                    className="cursor-pointer hover:opacity-75 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, machineId: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {appliedFilters.fromDate && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                                From: {formatDate(appliedFilters.fromDate)}
                                <FaTimes
                                    className="cursor-pointer hover:opacity-75 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, fromDate: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {appliedFilters.toDate && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                                To: {formatDate(appliedFilters.toDate)}
                                <FaTimes
                                    className="cursor-pointer hover:opacity-75 ml-0.5"
                                    onClick={() => { setAppliedFilters((p) => ({ ...p, toDate: "" })); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="text-xs text-ink-subtle hover:text-danger underline ml-1 cursor-pointer bg-transparent border-none p-0"
                        >
                            Clear all
                        </button>
                    </div>
                )}

                {/* Table */}
                <div ref={tableRef} tabIndex={0} data-table-nav className="flex-1 min-h-0 flex flex-col outline-none">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center py-16 text-ink-subtle text-sm">
                            <div className="animate-spin rounded-full border-b-2 border-primary h-5 w-5 mr-2" /> Loading...
                        </div>
                    ) : combinedData.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center py-16 text-ink-subtle text-sm">No orders found.</div>
                    ) : (
                        <div className="w-full flex-1 min-h-0 overflow-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="sticky top-0 z-10 bg-head border-b border-line shadow-[0_1px_0_rgba(0,0,0,0.06)]">
                                    <tr role="row">
                                        <th className="sticky top-0 z-10 bg-head px-4 py-2.5 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider w-10">#</th>
                                        <th className="sticky top-0 z-10 bg-head px-4 py-2.5 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider w-[160px]">PO No</th>
                                        <th className="sticky top-0 z-10 bg-head px-4 py-2.5 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider w-[150px]">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSortOrder();
                                                }}
                                                title={`Sort by Date: ${
                                                    sortOrder === "default"
                                                        ? "Default Order"
                                                        : sortOrder === "asc"
                                                        ? "Oldest First (Ascending)"
                                                        : "Newest First (Descending)"
                                                } (Click or press F6)`}
                                                className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-wider outline-none hover:opacity-90 transition-opacity"
                                            >
                                                <span className={sortOrder !== "default" ? "text-primary font-bold" : "group-hover/sort:text-ink transition-colors"}>
                                                    Order Date
                                                </span>
                                                <span
                                                    className={`inline-flex items-center justify-center w-4 h-4 rounded transition-all duration-200 ${
                                                        sortOrder === "asc" || sortOrder === "desc"
                                                            ? "bg-primary/20 text-primary scale-110"
                                                            : "text-ink-subtle/60 group-hover/sort:text-ink group-hover/sort:bg-card-2"
                                                    }`}
                                                >
                                                    {sortOrder === "asc" ? (
                                                        <FaArrowUp size={10} />
                                                    ) : sortOrder === "desc" ? (
                                                        <FaArrowDown size={10} />
                                                    ) : (
                                                        <FaSort size={10} />
                                                    )}
                                                </span>
                                                {sortOrder !== "default" && (
                                                    <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-primary text-white tracking-tighter shadow-xs">
                                                        {sortOrder === "asc" ? "OLD-NEW" : "NEW-OLD"}
                                                    </span>
                                                )}
                                            </button>
                                        </th>
                                        <th className="sticky top-0 z-10 bg-head px-4 py-2.5 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider w-[200px]">Due / Week Date</th>
                                        <th className="sticky top-0 z-10 bg-head px-4 py-2.5 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider">Machines / Products</th>
                                        <th className="sticky top-0 z-10 bg-head px-4 py-2.5 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider w-[180px]">Status</th>
                                        <th className="sticky top-0 z-10 bg-head px-4 py-2.5 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider w-[120px] text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {combinedData.map((item: any, idx: number) => {
                                        if (item.type === 'weekly-group') {
                                            const isWeeklyEditable = can('production_orders.edit') && !['IN_PRODUCTION', 'POST_PRODUCTION', 'COMPLETED', 'CLOSED', 'DISPATCHED'].includes(item.status?.toUpperCase());
                                            return (
                                                <tr
                                                    key={item.id}
                                                    role="row"
                                                    className={`cursor-pointer select-none transition-colors ${
                                                        idx === focusedIndex
                                                            ? "bg-primary/15 ring-1 ring-inset ring-primary/40 shadow-xs"
                                                            : "bg-head/40 hover:bg-head/70"
                                                    }`}
                                                    onClick={() => {
                                                        setFocusedIndex(idx);
                                                        tableRef.current?.focus({ preventScroll: true });
                                                        handleOpenWeeklyPlan(item);
                                                    }}
                                                >
                                                    <td className="px-4 py-2.5 text-ink-subtle text-[13px]">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className="font-bold text-ink text-[13px]">{item.baseId}</span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-ink-muted text-[13px]">{formatDate(item.orderDate)}</td>
                                                    <td className="px-4 py-2.5 text-ink-muted text-[13px]">
                                                        {item.weekStart && item.weekEnd
                                                            ? `${formatDate(item.weekStart)} – ${formatDate(item.weekEnd)}`
                                                            : '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-ink-muted text-[13px]">
                                                        {[...new Set(
                                                            item.children
                                                                .map((po: any) => po.Machine?.machineName || po.machineMachineId || '')
                                                                .filter(Boolean)
                                                        )].join(', ') || '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                                                    <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center gap-2 justify-end">
                                                            {can('production_orders.view') && (
                                                                <IconButton variant="info" title="View Weekly Plan" icon={FaEye} onClick={() => handleOpenWeeklyPlan(item)} />
                                                            )}
                                                            {isWeeklyEditable && (
                                                                <EditButton onClick={() => handleEditWeeklyPlan(item)} />
                                                            )}
                                                            {can('production_orders.delete') && (
                                                                <DeleteButton
                                                                    onClick={() => triggerDelete(item.children.map((po: any) => po.productionOrderId))}
                                                                    disabled={item.children.some((po: any) => po._editRestrictions?.canDelete === false)}
                                                                    disabledMessage="Cannot delete: one or more orders have active Daily Production Plans. Cancel them in Daily Machine Planning first."
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        // Standalone / sales-order-linked row
                                        const isStandaloneEditable = item.primaryPO && can('production_orders.edit') && !['IN_PRODUCTION', 'POST_PRODUCTION', 'COMPLETED', 'CLOSED', 'DISPATCHED'].includes(item.primaryPO.status?.toUpperCase());
                                        return (
                                            <tr
                                                key={item.id}
                                                role="row"
                                                className={`cursor-pointer transition-colors ${
                                                    idx === focusedIndex
                                                        ? "bg-primary/10 ring-1 ring-inset ring-primary/40 shadow-xs"
                                                        : "bg-card hover:bg-card-2"
                                                }`}
                                                onClick={() => {
                                                    setFocusedIndex(idx);
                                                    tableRef.current?.focus({ preventScroll: true });
                                                    handleOpenViewItem(item);
                                                }}
                                            >
                                                <td className="px-4 py-2.5 text-ink-subtle text-[13px]">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                                <td className="px-4 py-2.5 font-semibold text-ink text-[13px]">{item.primaryPO ? item.primaryPO.productionOrderId : item.orderNo}</td>
                                                <td className="px-4 py-2.5 text-ink-muted text-[13px]">{formatDate(item.orderDate)}</td>
                                                <td className="px-4 py-2.5 text-ink-muted text-[13px]">{item.expectedCompletionDate ? formatDate(item.expectedCompletionDate) : '—'}</td>
                                                <td className="px-4 py-2.5 text-ink-muted text-[13px]">
                                                    {item.productionOrders && item.productionOrders.length > 0
                                                        ? item.productionOrders.map((po: any) => po.productItem?.productName || 'Unknown').join(', ')
                                                        : item.items?.map((it: any) => it.product?.productName || 'Unknown').join(', ') || '—'}
                                                </td>
                                                <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                                                <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2 justify-end">
                                                        {item.primaryPO && can('production_orders.view') && (
                                                            <IconButton variant="info" title="View" icon={FaEye}
                                                                onClick={() => { setSelectedItem(item.primaryPO); setFullOrder(null); setShowViewModal(true); fetchOrderDetails(item.primaryPO.productionOrderId || item.primaryPO.id); }}
                                                            />
                                                        )}
                                                        {isStandaloneEditable && (
                                                            <EditButton onClick={() => handleOpenEdit(item.primaryPO)} />
                                                        )}
                                                        {item.primaryPO && can('production_orders.delete') && (
                                                            <DeleteButton
                                                                onClick={() => triggerDelete(item.productionOrders ? item.productionOrders.map((po: any) => po.productionOrderId) : [item.primaryPO.productionOrderId])}
                                                                disabled={item.primaryPO._editRestrictions?.canDelete === false}
                                                                disabledMessage="Cannot delete: this order has active Daily Production Plans. Cancel them in Daily Machine Planning first."
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-auto shrink-0 flex items-center justify-between px-5 py-3 border-t border-line text-sm bg-head/20">
                            <span className="text-ink-subtle text-[13px]">{totalItems} order{totalItems !== 1 ? 's' : ''}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded border border-line text-ink-subtle hover:bg-card-2 disabled:opacity-40 text-[13px]"
                                >Prev</button>
                                <span className="px-3 py-1.5 text-ink text-[13px]">{currentPage} / {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded border border-line text-ink-subtle hover:bg-card-2 disabled:opacity-40 text-[13px]"
                                >Next</button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* VIEW PO MODAL */}
            <CommonViewModal
                show={showViewModal}
                onHide={() => {
                    setShowViewModal(false);
                    setSelectedItem(null);
                    setFullOrder(null);
                    setTimeout(() => tableRef.current?.focus(), 100);
                }}
                modalTitle="Production Order Details"
                avatarText={selectedItem ? "PO" : ""}
                headerTitle={selectedItem ? (fullOrder?.productionOrderId || selectedItem.productionOrderId) : ""}
                headerSubtitle={selectedItem ? `Customer: ${fullOrder?.salesOrderDetails?.customerName || selectedItem.salesOrderDetails?.customerName || "Direct"}` : ""}
                statusNode={selectedItem ? <StatusBadge status={fullOrder?.status || selectedItem.status} /> : undefined}
                sections={modalSections}
                customContent={modalCustomContent}
            />

            {/* DELETE PO MODAL */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => { setShowDeleteModal(false); setTimeout(() => tableRef.current?.focus(), 100); }}
                onConfirm={handleDeleteConfirm}
                title="Delete Production Order"
                isDangerous={true}
                message={
                    <>
                        Are you sure you want to delete the production plan for this order?<br />
                        This will remove {itemToDelete.length} Production Order(s) permanently.
                    </>
                }
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default ProductionOrderList;
