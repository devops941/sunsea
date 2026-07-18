import React, { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { MaterialIssueModal } from "./MaterialIssueModal";

interface ProductionOrderViewModalProps {
    show: boolean;
    onHide: () => void;
    order: ProductionOrder | null;
    onSuccess?: () => void;
}

export const ProductionOrderViewModal: React.FC<ProductionOrderViewModalProps> = ({ show, onHide, order, onSuccess }) => {
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

    useEffect(() => {
        if (show && order) {
            setLoading(true);
            const fetchIds = ((order as any).items && Array.isArray((order as any).items) && (order as any).items.length > 0)
                ? (order as any).items.map((i: any) => i.productionOrderId || i.id)
                : [order.productionOrderId || order.id];

            Promise.all(fetchIds.map((id: string) => productionOrderService.getById(id)))
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
                        mergedOrder.productionOrderId = order.productionOrderId || order.id;
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
        } else {
            setFullOrder(null);
        }
    }, [show, order]);

    if (!order) return null;

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

    if (!show) return null;
    return (
        <>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-xl font-bold text-gray-800 m-0">Production Order Details</h3>
                    <button
                        type="button"
                        onClick={onHide}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-md hover:bg-gray-200"
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {hasInsufficientStock && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 mb-4 text-sm font-medium">
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
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6">
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Order No</div>
                                        <div className="font-semibold text-slate-800">{fullOrder?.productionOrderId || order.productionOrderId}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Sales Order No</div>
                                        <div className="font-semibold text-slate-800">
                                            {fullOrder?.salesOrderDetails?.orderNo || order.salesOrderDetails?.orderNo || order.sourceSalesOrderId ? (
                                                fullOrder?.salesOrderDetails?.orderNo || order.salesOrderDetails?.orderNo || order.sourceSalesOrderId
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">Direct Order</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Customer</div>
                                        <div className="font-semibold text-slate-800">
                                            {fullOrder?.salesOrderDetails?.customerName || order.salesOrderDetails?.customerName ? (
                                                fullOrder?.salesOrderDetails?.customerName || order.salesOrderDetails?.customerName
                                            ) : (
                                                <span className="text-slate-400 italic text-sm">N/A (Direct)</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Order Date</div>
                                        <div className="font-semibold text-slate-800">{formatDate(fullOrder?.orderDate || order.orderDate)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Due Date</div>
                                        <div className="font-semibold text-slate-800">{formatDate(fullOrder?.dueDate || order.dueDate)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Priority</div>
                                        <div className="font-semibold text-slate-800">{fullOrder?.priority || order.priority || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Order Type</div>
                                        <div className="font-semibold text-slate-800">{fullOrder?.orderType || order.orderType || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Color Type</div>
                                        <div className="font-semibold text-slate-800">
                                            {(fullOrder?.colorType || order?.colorType) ? (
                                                <StatusBadge 
                                                    status={(fullOrder?.colorType || order?.colorType) === 'mc' ? 'MULTI COLOR' : 'SINGLE COLOR'} 
                                                    customColor={(fullOrder?.colorType || order?.colorType) === 'mc' ? { bg: '#e0e7ff', text: '#3730a3' } : { bg: '#fef3c7', text: '#92400e' }}
                                                />
                                            ) : "-"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Products List */}
                            {fullOrder?.products?.map((prod: any, idx: number) => (
                                <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-white border-b border-slate-200 p-4">
                                        <h4 className="text-lg font-bold text-slate-800">
                                            Product {idx + 1}: <span className="text-primary">{prod.productName}</span> <span className="text-slate-500 text-sm font-normal">({prod.productCode})</span>
                                        </h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                            <div>
                                                <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Production Qty</div>
                                                <div className="font-semibold text-slate-800">{prod.quantity} {prod.uom?.toLowerCase() === 'ea' ? 'pcs' : prod.uom}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Weight Used</div>
                                                <div className="font-semibold text-slate-800">{Number(prod.weightPerPieceUsed || 0).toFixed(3)} KG</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500 font-medium mb-1 uppercase">Unit (UOM)</div>
                                                <div className="font-semibold text-slate-800">{prod.uom?.toLowerCase() === 'ea' ? 'pcs' : prod.uom}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50">
                                        <div className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Required Raw Materials</div>
                                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-left text-sm text-slate-600">
                                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase">
                                                    <tr>
                                                        <th className="px-4 py-3">Raw Material Code</th>
                                                        <th className="px-4 py-3">Raw Material Name</th>
                                                        <th className="px-4 py-3">Required Qty</th>
                                                        <th className="px-4 py-3">Available Stock</th>
                                                        <th className="px-4 py-3">Stock Status</th>
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
                                                        
                                                        return (
                                                            <tr key={rm.rawMaterialId} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-4 py-3 font-medium text-slate-800">{rm.rawMaterialId}</td>
                                                                <td className="px-4 py-3 text-slate-700">{materialName}</td>
                                                                <td className="px-4 py-3 font-medium">{required.toFixed(2)} KG</td>
                                                                <td className="px-4 py-3">{available.toFixed(2)} KG</td>
                                                                <td className="px-4 py-3">
                                                                    <StatusBadge status={isAvailable ? "AVAILABLE" : "INSUFFICIENT"} />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {(!prod.rawMaterials || prod.rawMaterials.length === 0) && (
                                                        <tr>
                                                            <td colSpan={5} className="text-center text-slate-500 p-6 italic">
                                                                No raw materials defined for this product.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED"].includes(prod.status || fullOrder?.status) && (
                                            <div className="flex justify-end mt-4">
                                                <button 
                                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
                                                    onClick={() => {
                                                        setSelectedProdForIssue(prod);
                                                        setShowIssueModal(true);
                                                    }}
                                                >
                                                    Issue Raw Materials
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button
                        type="button"
                        onClick={onHide}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
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
                        // Reload details in modal
                        setLoading(true);
                        const fetchIds = ((order as any).items && Array.isArray((order as any).items) && (order as any).items.length > 0)
                            ? (order as any).items.map((i: any) => i.productionOrderId || i.id)
                            : [order.productionOrderId || order.id];
            
                        Promise.all(fetchIds.map((id: string) => productionOrderService.getById(id)))
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
                                    mergedOrder.productionOrderId = order.productionOrderId || order.id;
                                    setFullOrder(mergedOrder);
                                }
                            })
                            .catch(err => console.error("Failed to reload PO details after issue", err))
                            .finally(() => setLoading(false));

                        // Trigger parent refresh
                        onSuccess?.();
                    }}
                />
            )}
        </>
    );
};

export default ProductionOrderViewModal;
