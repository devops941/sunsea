import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { productionOrderService } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import BackButton from "../../../components/ui/BackButton/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { MaterialIssueModal } from "../components/MaterialIssueModal";

const ProductionOrderHistoryView: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    
    // We get the passed order from navigation state
    const [passedOrder] = useState<any>(location.state?.order || null);

    const [fullOrder, setFullOrder] = useState<any>(null);
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [selectedProdForIssue, setSelectedProdForIssue] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());

    useEffect(() => {
        rawMaterialService.fetchAll()
            .then(data => {
                const arr = Array.isArray(data) ? data : (data as any)?.data || [];
                const map = new Map<string, any>();
                arr.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
                setRawMaterialsMap(map);
            })
            .catch(err => console.error("Failed to fetch raw materials", err));
    }, []);

    const fetchOrderDetails = (orderToFetch: any) => {
        setLoading(true);
        const fetchIds = (orderToFetch.items && Array.isArray(orderToFetch.items) && orderToFetch.items.length > 0)
            ? orderToFetch.items.map((i: any) => i.productionOrderId || i.id)
            : [orderToFetch.productionOrderId || orderToFetch.id || id];

        Promise.all(fetchIds.map((fetchId: string) => productionOrderService.getById(fetchId)))
            .then((dataArray) => {
                if (dataArray.length > 0) {
                    const mergedOrder = { ...dataArray[0] };
                    mergedOrder.products = dataArray.map((d: any) => ({
                        productName: d.productItem?.productName || "Unknown",
                        productCode: d.productItem?.productCode || "Unknown",
                        quantity: d.targetQty || 0,
                        uom: d.uom || d.productItem?.uom || "pcs",
                        weightPerPieceUsed: d.productItem?.weightPerPiece || 0,
                        rawMaterials: d.draftRawMaterials || d.rawMaterials || [],
                        productionOrderId: d.productionOrderId,
                        status: d.status
                    }));
                    mergedOrder.productionOrderId = orderToFetch.productionOrderId || orderToFetch.id || id;
                    setFullOrder(mergedOrder);
                } else {
                    setFullOrder(null);
                }
            })
            .catch((err) => {
                console.error("❌ Failed to fetch PO details:", err);
                toast.error("Failed to load production order details");
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (passedOrder) {
            fetchOrderDetails(passedOrder);
        } else if (id) {
            // Fallback if accessed directly via URL without state
            fetchOrderDetails({ id });
        }
    }, [passedOrder, id]);

    const formatDate = (dateString?: string) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

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

    const displayOrder = fullOrder || passedOrder || {};

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800 m-0">Production Order Details: {id}</h2>
                <BackButton />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex-1 overflow-auto">
                {hasInsufficientStock && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 mb-6 text-sm font-medium">
                        One or more required raw materials have insufficient stock. Please create a Raw Material Order before proceeding to Weekly Machine Assignment.
                    </div>
                )}
                
                {loading ? (
                    <div className="text-center p-8 flex flex-col items-center justify-center text-slate-500">
                        <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-8 w-8 mb-4"></div> 
                        Loading details...
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* General Details Grid */}
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-y-6 gap-x-6">
                                <div>
                                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Order No</div>
                                    <div className="font-semibold text-slate-800 text-base">{displayOrder?.productionOrderId}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Sales Order No</div>
                                    <div className="font-semibold text-slate-800 text-base">
                                        {displayOrder?.salesOrderDetails?.orderNo || displayOrder?.sourceSalesOrderId ? (
                                            displayOrder?.salesOrderDetails?.orderNo || displayOrder?.sourceSalesOrderId
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">Direct Order</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Customer</div>
                                    <div className="font-semibold text-slate-800 text-base">
                                        {displayOrder?.salesOrderDetails?.customerName ? (
                                            displayOrder?.salesOrderDetails?.customerName
                                        ) : (
                                            <span className="text-slate-400 italic text-sm">N/A (Direct)</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Order Date</div>
                                    <div className="font-semibold text-slate-800 text-base">{formatDate(displayOrder?.orderDate)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Due Date</div>
                                    <div className="font-semibold text-slate-800 text-base">{formatDate(displayOrder?.dueDate)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Priority</div>
                                    <div className="font-semibold text-slate-800 text-base">{displayOrder?.priority || "-"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Order Type</div>
                                    <div className="font-semibold text-slate-800 text-base">{displayOrder?.orderType || "-"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Status</div>
                                    <div className="flex flex-col gap-1">
                                        <div>
                                            <StatusBadge status={displayOrder?.status} />
                                        </div>
                                        {fullOrder?.productionOrderHistories?.some((h: any) => h.toStatus === "COMPLETED_WITH_SHORTFALL") && (
                                            <span className="text-[10px] text-red-600 font-bold uppercase leading-none mt-0.5 whitespace-nowrap">
                                                Force Stopped / Short-Closed
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Products List */}
                        {fullOrder?.products?.map((prod: any, idx: number) => (
                            <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-white border-b border-slate-200 p-5">
                                    <h4 className="text-lg font-bold text-slate-800">
                                        Product {idx + 1}: <span className="text-primary">{prod.productName}</span> <span className="text-slate-500 text-sm font-normal">({prod.productCode})</span>
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5">
                                        <div>
                                            <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Production Qty</div>
                                            <div className="font-semibold text-slate-800 text-base">{prod.quantity} {prod.uom?.toLowerCase() === 'ea' || prod.uom?.toLowerCase() === 'each' ? 'pcs' : prod.uom}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Weight Used</div>
                                            <div className="font-semibold text-slate-800 text-base">{Number(prod.weightPerPieceUsed || 0).toFixed(3)} KG</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Unit (UOM)</div>
                                            <div className="font-semibold text-slate-800 text-base">{prod.uom?.toLowerCase() === 'ea' || prod.uom?.toLowerCase() === 'each' ? 'pcs' : prod.uom}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 bg-slate-50">
                                    <div className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Required Raw Materials</div>
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-left text-sm text-slate-600">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase">
                                                <tr>
                                                    <th className="px-5 py-3.5">Raw Material Code</th>
                                                    <th className="px-5 py-3.5">Raw Material Name</th>
                                                    <th className="px-5 py-3.5">Required Qty</th>
                                                    <th className="px-5 py-3.5">Available Stock</th>
                                                    <th className="px-5 py-3.5">Stock Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
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
                                                    
                                                    let displayUom = stockRm?.baseUom?.split(',')[0] || rm.uom || stockRm?.uom || "KG";
                                                    if (displayUom.toLowerCase() === 'ea' || displayUom.toLowerCase() === 'each') {
                                                        displayUom = 'pcs';
                                                    }

                                                    return (
                                                        <tr key={rm.rawMaterialId} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-5 py-4 font-medium text-slate-800">{rm.rawMaterialId}</td>
                                                            <td className="px-5 py-4 text-slate-700">{materialName}</td>
                                                            <td className="px-5 py-4 font-medium">{required.toFixed(2)} {displayUom}</td>
                                                            <td className="px-5 py-4">{available.toFixed(2)} {displayUom}</td>
                                                            <td className="px-5 py-4">
                                                                <StatusBadge status={isAvailable ? "AVAILABLE" : "INSUFFICIENT"} />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {(!prod.rawMaterials || prod.rawMaterials.length === 0) && (
                                                    <tr>
                                                        <td colSpan={5} className="text-center text-slate-500 p-8 italic">
                                                            No raw materials defined for this product.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* {["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED"].includes(prod.status || fullOrder?.status) && (
                                        <div className="flex justify-end mt-5">
                                            <button 
                                                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
                                                onClick={() => {
                                                    setSelectedProdForIssue(prod);
                                                    setShowIssueModal(true);
                                                }}
                                            >
                                                Issue Raw Materials
                                            </button>
                                        </div>
                                    )} */}
                                </div>
                            </div>
                        ))}

                        {/* Shift / Daily Execution & Dispatch History */}
                        {(() => {
                            const plans: any[] = [];
                            
                            if (fullOrder?.dailyProductionPlans && fullOrder.dailyProductionPlans.length > 0) {
                                fullOrder.dailyProductionPlans.forEach((plan: any) => {
                                    const hourlySum = plan.hourlyProductions?.reduce((acc: number, curr: any) => acc + Number(curr.qtyProduced || 0), 0) || 0;
                                    const producedForPlan = hourlySum > 0 ? hourlySum : (plan.status === 'COMPLETED' ? Number(plan.plannedQty || 0) : 0);
                                    plans.push({
                                        id: plan.dailyPlanId,
                                        date: plan.productionDate ? new Date(plan.productionDate).toLocaleDateString() : '-',
                                        shiftName: plan.shift?.shiftName || plan.shiftId || '-',
                                        machineName: plan.machine?.machineName || plan.machineId || fullOrder?.Machine?.machineName || (displayOrder as any)?.machineName || '-',
                                        plannedQty: Number(plan.plannedQty || 0),
                                        producedQty: producedForPlan,
                                        status: plan.status || 'PLANNED'
                                    });
                                });
                            }

                            const totalDispatchedQty = fullOrder?.goodsDispatchItems
                                ? fullOrder.goodsDispatchItems.reduce((sum: number, item: any) => sum + Number(item.dispatchQty || 0), 0)
                                : 0;
                            let cumulativeProduced = 0;

                            return (
                                <>
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-8">
                                    <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center flex-wrap gap-4">
                                        <h4 className="text-lg font-bold text-slate-800">
                                            Shift-wise Production & Dispatch Details
                                        </h4>
                                        {(() => {
                                            const targetVal = Number(fullOrder?.targetQty || displayOrder?.targetQty || 0);
                                            const producedVal = Number(fullOrder?.producedQty || displayOrder?.producedQty || 0);
                                            const hasShortfallStop = fullOrder?.productionOrderHistories?.some((h: any) => h.toStatus === "COMPLETED_WITH_SHORTFALL");
                                            
                                            return (
                                                <div className="flex items-center gap-3 flex-wrap text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                                    <span>Target: <span className="text-slate-800 font-bold text-base">{targetVal}</span></span>
                                                    <span>|</span>
                                                    <span>Produced: <span className="text-green-600 font-bold text-base">{producedVal}</span></span>
                                                    {hasShortfallStop && (
                                                        <>
                                                            <span>|</span>
                                                            <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded text-xs font-bold uppercase whitespace-nowrap ">
                                                                Permanently Stopped (Shortfall: {Math.max(0, targetVal - producedVal)} pcs)
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="p-5 bg-slate-50 overflow-x-auto">
                                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden min-w-[750px]">
                                            <table className="w-full text-left text-sm text-slate-600">
                                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase">
                                                    <tr>
                                                        <th className="px-5 py-3.5">Date</th>
                                                        <th className="px-5 py-3.5">Shift</th>
                                                        <th className="px-5 py-3.5">Machine</th>
                                                        <th className="px-5 py-3.5">Planned Qty</th>
                                                        <th className="px-5 py-3.5">Produced Qty</th>
                                                        <th className="px-5 py-3.5 whitespace-nowrap">Production Status</th>
                                                        <th className="px-5 py-3.5 whitespace-nowrap text-center">Dispatch Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {plans.length > 0 ? (
                                                        plans.map((plan: any, idx: number) => {
                                                            cumulativeProduced += plan.producedQty;
                                                            const isPlanDispatched = totalDispatchedQty > 0 && cumulativeProduced <= totalDispatchedQty + 0.001;
                                                            const isReadyForDispatch = plan.status === 'COMPLETED' || fullOrder?.status === 'READY_FOR_DISPATCH' || fullOrder?.status === 'COMPLETED';

                                                            let dispatchBadge = <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold whitespace-nowrap">Not Dispatched</span>;
                                                            if (isPlanDispatched) {
                                                                dispatchBadge = <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 border border-green-200 rounded-full text-xs font-semibold whitespace-nowrap">Dispatched</span>;
                                                            } else if (isReadyForDispatch) {
                                                                dispatchBadge = <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-xs font-semibold whitespace-nowrap">Ready for Dispatch</span>;
                                                            }

                                                            return (
                                                                <tr key={plan.id || idx} className="hover:bg-slate-50 transition-colors">
                                                                    <td className="px-5 py-4 font-medium text-slate-800">{plan.date}</td>
                                                                    <td className="px-5 py-4 text-slate-700">{plan.shiftName}</td>
                                                                    <td className="px-5 py-4 text-slate-700">{plan.machineName}</td>
                                                                    <td className="px-5 py-4 font-semibold text-slate-700">{Number(plan.plannedQty || 0).toFixed(2)}</td>
                                                                    <td className="px-5 py-4 font-bold text-green-600">{Number(plan.producedQty || 0).toFixed(2)}</td>
                                                                    <td className="px-5 py-4">
                                                                        <StatusBadge status={plan.status} />
                                                                    </td>
                                                                    <td className="px-5 py-4 text-center">
                                                                        {dispatchBadge}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        <tr className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-5 py-4 font-medium text-slate-800">{new Date(displayOrder?.orderDate).toLocaleDateString()}</td>
                                                            <td className="px-5 py-4 text-slate-700">General Shift</td>
                                                            <td className="px-5 py-4 text-slate-700">{fullOrder?.Machine?.machineName || fullOrder?.machineMachineId || (displayOrder as any)?.machineName || (displayOrder as any)?.machineMachineId || '-'}</td>
                                                            <td className="px-5 py-4 font-semibold text-slate-700">{Number(displayOrder?.targetQty || 0).toFixed(2)}</td>
                                                            <td className="px-5 py-4 font-bold text-green-600">{Number(displayOrder?.producedQty || 0).toFixed(2)}</td>
                                                            <td className="px-5 py-4">
                                                                <StatusBadge status={displayOrder?.status} />
                                                            </td>
                                                            <td className="px-5 py-4 text-center">
                                                                {displayOrder?.status === 'DISPATCHED' ? (
                                                                    <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 border border-green-200 rounded-full text-xs font-semibold whitespace-nowrap">Dispatched</span>
                                                                ) : (displayOrder?.status === 'READY_FOR_DISPATCH' || displayOrder?.status === 'COMPLETED') ? (
                                                                    <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-xs font-semibold whitespace-nowrap">Ready for Dispatch</span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold whitespace-nowrap">Not Dispatched</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Dispatch History Section */}
                                {fullOrder?.goodsDispatchItems && fullOrder.goodsDispatchItems.length > 0 && (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-8">
                                        <div className="bg-white border-b border-slate-200 p-5">
                                            <h4 className="text-lg font-bold text-slate-800">Dispatch History</h4>
                                        </div>
                                        <div className="p-5 bg-slate-50 overflow-x-auto">
                                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden min-w-[700px]">
                                                <table className="w-full text-left text-sm text-slate-600">
                                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase">
                                                        <tr>
                                                            <th className="px-5 py-3.5">Dispatch No</th>
                                                            <th className="px-5 py-3.5">Date</th>
                                                            <th className="px-5 py-3.5">Vehicle</th>
                                                            <th className="px-5 py-3.5">Driver</th>
                                                            <th className="px-5 py-3.5">Dispatch Qty</th>
                                                            <th className="px-5 py-3.5">Received Qty</th>
                                                            <th className="px-5 py-3.5">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {fullOrder.goodsDispatchItems?.map((item: any) => {
                                                            const dispatch = item?.dispatch || {};
                                                            const status = dispatch?.status || "PENDING_GATE_APPROVAL";
                                                            const dispatchDate = dispatch.dispatchDate
                                                                ? new Date(dispatch.dispatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
                                                                : "-";
                                                            return (
                                                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                                    <td className="px-5 py-4 font-semibold text-slate-800">{dispatch.dispatchNumber || "-"}</td>
                                                                    <td className="px-5 py-4 text-slate-600">{dispatchDate}</td>
                                                                    <td className="px-5 py-4 text-slate-700">{dispatch.vehicleNumber || "-"}</td>
                                                                    <td className="px-5 py-4 text-slate-700">{dispatch.driverName || "-"}</td>
                                                                    <td className="px-5 py-4 font-semibold text-slate-700">{Number(item.dispatchQty || 0).toFixed(2)}</td>
                                                                    <td className="px-5 py-4 font-semibold text-blue-600">
                                                                        {item.receivedQty !== null && item.receivedQty !== undefined ? Number(item.receivedQty).toFixed(2) : "-"}
                                                                    </td>
                                                                    <td className="px-5 py-4"><StatusBadge status={status} /></td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {selectedProdForIssue && (
                <MaterialIssueModal
                    show={showIssueModal}
                    onHide={() => {
                        setShowIssueModal(false);
                        setSelectedProdForIssue(null);
                    }}
                    productionOrderId={selectedProdForIssue.productionOrderId}
                    rawMaterials={selectedProdForIssue.rawMaterials || []}
                    rawMaterialsMap={rawMaterialsMap}
                    defaultStoreId={fullOrder?.sourceStoreId}
                    onSuccess={() => {
                        fetchOrderDetails(passedOrder || { id });
                    }}
                />
            )}
        </div>
    );
};

export default ProductionOrderHistoryView;
