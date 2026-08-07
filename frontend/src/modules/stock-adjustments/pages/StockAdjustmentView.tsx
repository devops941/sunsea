import React, { useEffect, useState } from "react";
import {
  FaCheck, FaTimes, FaBoxes, FaEdit,
  FaClipboardList, FaInfoCircle, FaExclamationTriangle,
  FaCheckCircle, FaTimesCircle,
} from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  fetchStockAdjustmentById,
  approveStockAdjustment,
  clearCurrent,
} from "../../../features/stock-adjustments/stockAdjustmentSlice";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { formatDate } from "../../../utils/dateUtils";

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  PRODUCTION_MATERIAL_ISSUE: "Production Material Issue",
  PRODUCTION_MATERIAL_RETURN: "Production Material Return",
  STOCK_INCREASE: "Stock Increase",
  STOCK_DECREASE: "Stock Decrease",
  DAMAGE: "Damage",
  SCRAP: "Scrap",
  OPENING_STOCK: "Opening Stock",
  MANUAL_CORRECTION: "Manual Correction",
  OTHER: "Other",
};

const InfoField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">{label}</p>
    <div className="text-sm font-semibold text-slate-700">{value || "—"}</div>
  </div>
);

const StockAdjustmentView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentAdjustment, loading } = useAppSelector(
    (state) => state.stockAdjustments
  );

  useEffect(() => {
    if (id) dispatch(fetchStockAdjustmentById(id));
    return () => { dispatch(clearCurrent()); };
  }, [dispatch, id]);

  const handleApprove = async (targetStatus: string) => {
    if (!id) return;
    try {
      await dispatch(approveStockAdjustment({ id, status: targetStatus })).unwrap();
      if (targetStatus === "APPROVED") {
        toast.success("Stock Adjustment approved by MD/Management! Inventory stock has been updated.");
      } else {
        toast.info("Stock Adjustment rejected.");
      }
      dispatch(fetchStockAdjustmentById(id));
    } catch (err: any) {
      toast.error(err || "Failed to process approval");
    }
  };

  if (loading || !currentAdjustment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  const isPMI = currentAdjustment.adjustmentType === "PRODUCTION_MATERIAL_ISSUE";
  const po = currentAdjustment.productionOrder;
  const isApproved = currentAdjustment.status === "APPROVED";
  const isRejected = currentAdjustment.status === "REJECTED";
  const isPending = !isApproved && !isRejected;

  return (
    <div className="p-4 md:p-6 min-h-screen bg-white">
      <div className="w-full mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Stock Adjustment Details</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {currentAdjustment.adjustmentNumber} &middot; {ADJUSTMENT_TYPE_LABELS[currentAdjustment.adjustmentType] || currentAdjustment.adjustmentType}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentAdjustment.status === "DRAFT" && (
              <>
                <CustomButton
                  text="Approve (MD Approval)"
                  icon={FaCheckCircle}
                  variant="primary"
                  onClick={() => handleApprove("APPROVED")}
                />
                <CustomButton
                  text="Reject"
                  icon={FaTimesCircle}
                  variant="danger"
                  onClick={() => handleApprove("REJECTED")}
                />
                <CustomButton
                  text="Edit"
                  icon={FaEdit}
                  variant="secondary"
                  onClick={() => navigate(`/inventory/stock-adjustments/edit/${currentAdjustment.id}`)}
                />
              </>
            )}
            <BackButton text="Back" to="/inventory/stock-adjustments" />
          </div>
        </div>

        {isApproved && isPMI && (
          <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
            <FaCheckCircle className="text-emerald-500 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold text-emerald-800 text-sm">Material Issue Approved</p>
              <p className="text-emerald-700 text-xs mt-0.5">
                Production Order <strong>{currentAdjustment.productionOrderId}</strong> is now eligible to start production. Raw material stock has been deducted.
              </p>
            </div>
          </div>
        )}

        {currentAdjustment.status === "DRAFT" && isPMI && (
          <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <FaInfoCircle className="text-amber-500 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Draft — Pending Approval</p>
              <p className="text-amber-700 text-xs mt-0.5">
                This Material Issue is in <strong>Draft</strong> status. Approve it to deduct stock and allow Production Start.
              </p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="mb-5 rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <FaTimesCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold text-red-800 text-sm">Adjustment Rejected</p>
              {currentAdjustment.approvedBy && (
                <p className="text-red-700 text-xs mt-0.5">
                  Rejected by <strong>{currentAdjustment.approvedBy}</strong> on {formatDate(currentAdjustment.approvedAt)}.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 shadow-sm mb-5 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
           
            <h3 className="font-bold text-slate-700 text-base">Adjustment Information</h3>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            <InfoField label="Adjustment No." value={
              <span className="font-mono text-primary text-sm">{currentAdjustment.adjustmentNumber}</span>
            } />
            <InfoField label="Date" value={formatDate(currentAdjustment.adjustmentDate)} />
            <InfoField label="Type" value={
              <StatusBadge status={currentAdjustment.adjustmentType}
                customText={ADJUSTMENT_TYPE_LABELS[currentAdjustment.adjustmentType] || currentAdjustment.adjustmentType} />
            } />
            <InfoField label="Status" value={<StatusBadge status={currentAdjustment.status} />} />
            <InfoField label="Created By" value={currentAdjustment.createdByUser?.fullName || currentAdjustment.createdBy} />
            {currentAdjustment.reason && (
              <div className="col-span-2 sm:col-span-3 lg:col-span-6">
                <InfoField label="Reason / Notes" value={currentAdjustment.reason} />
              </div>
            )}
          </div>
          {!isPMI && (currentAdjustment.sourceDocument || currentAdjustment.sourceDocId) && (
            <div className="px-5 pb-5 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-5 border-t border-slate-100">
              <InfoField label="Source Document" value={currentAdjustment.sourceDocument} />
              <InfoField label="Source Doc Reference" value={currentAdjustment.sourceDocId} />
              <InfoField label="Auto Generated" value={
                currentAdjustment.autoGenerated
                  ? <StatusBadge status="ACTIVE" customText="Auto-generated" />
                  : "No"
              } />
            </div>
          )}
        </div>

        {isPMI && po && (
          <div className="rounded-2xl border border-slate-200 shadow-sm mb-5 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <FaBoxes className="text-blue-600" size={15} />
              </div>
              <h3 className="font-bold text-slate-700 text-base">Production Order Information</h3>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
              <InfoField label="PO Number" value={
                <span className="font-mono text-primary text-sm">{po.productionOrderId}</span>
              } />
              <InfoField label="Product" value={
                <div>
                  <div className="font-semibold text-slate-700 text-sm">{po.productItem?.productName || "—"}</div>
                  {po.productItem?.productCode && (
                    <div className="text-xs text-slate-400 font-mono">{po.productItem.productCode}</div>
                  )}
                </div>
              } />
              <InfoField label="Planned Qty" value={
                po.targetQty ? `${Number(po.targetQty).toLocaleString()} ${po.uom || ""}` : "—"
              } />
              <InfoField label="Due Date" value={formatDate(po.dueDate)} />
              <InfoField label="Machine" value={po.Machine?.machineName || po.machineMachineId} />
              <InfoField label="PO Status" value={<StatusBadge status={po.status} />} />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 shadow-sm mb-5 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
         
            <h3 className="font-bold text-slate-700 text-base">
              {isPMI ? "Issued Materials" : "Adjustment Items"}
            </h3>
            <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {currentAdjustment.items?.length || 0} item{currentAdjustment.items?.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            {isPMI ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["RM Code","Material Name","Store","Stock Before","Stock After","Issued Qty","Remarks"].map((h, i) => (
                      <th key={h} className={`text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-4 py-3 ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentAdjustment.items?.map((item: any, idx: number) => {
                    const rawUom = item.uom ||
                      (item.itemType === "PRODUCT"
                        ? item.product?.uom || item.product?.baseUom
                        : (item.rawMaterial?.baseUom || item.rawMaterial?.uom)
                      ) || "kg";
                    const uomLower = rawUom.split(",")[0].trim().toLowerCase();
                    const itemUom = (uomLower === "ea" || uomLower === "each") ? "pcs" : uomLower;

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{item.rawMaterialId}</code>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{item.rawMaterial?.materialName || item.rawMaterialId}</td>
                        <td className="px-4 py-3 text-slate-600">{item.store?.storeName || item.storeId}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">{Number(item.currentQty).toFixed(3)} {itemUom}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">{Number(item.adjustedQty).toFixed(3)} {itemUom}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-red-600 font-mono text-xs">{Math.abs(Number(item.difference)).toFixed(3)} {itemUom}</span>
                        </td>
                        <td className="px-4 py-3">
                          {item.remarks ? (
                            <div className="bg-slate-50 border-l-2 border-slate-400 text-slate-700 text-xs px-2.5 py-1 rounded-r-md font-medium inline-block max-w-xs leading-normal">
                              {item.remarks}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(!currentAdjustment.items || currentAdjustment.items.length === 0) && (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">No items found</td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["Item Type","Item Details","Store","Current Qty","Adjusted Qty","Difference","Remarks"].map((h, i) => (
                      <th key={h} className={`text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-4 py-3 ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentAdjustment.items?.map((item: any, idx: number) => {
                    const diff = Number(item.difference);
                    const rawUom = item.uom ||
                      (item.itemType === "PRODUCT"
                        ? item.product?.uom || item.product?.baseUom
                        : (item.rawMaterial?.baseUom || item.rawMaterial?.uom)
                      ) || "kg";
                    const uomLower = rawUom.split(",")[0].trim().toLowerCase();
                    const itemUom = (uomLower === "ea" || uomLower === "each") ? "pcs" : uomLower;

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <StatusBadge status={item.itemType} customText={item.itemType === "RAW_MATERIAL" ? "Raw Material" : "Product"} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-700">{item.itemType === "RAW_MATERIAL" ? item.rawMaterial?.materialName : item.product?.productName}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{item.itemType === "RAW_MATERIAL" ? item.rawMaterialId : item.product?.productCode}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.store?.storeName || "—"}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">{Number(item.currentQty).toFixed(3)} {itemUom}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">{Number(item.adjustedQty).toFixed(3)} {itemUom}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold font-mono text-xs ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-slate-500"}`}>
                            {diff > 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3)} {itemUom}
                          </span>
                        </td>
                         <td className="px-4 py-3">
                          {item.remarks ? (
                            <div className="bg-slate-50 border-l-2 border-slate-400 text-slate-700 text-xs px-2.5 py-1 rounded-r-md font-medium inline-block max-w-xs leading-normal">
                              {item.remarks}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                         </td>
                      </tr>
                    );
                  })}
                  {(!currentAdjustment.items || currentAdjustment.items.length === 0) && (
                    <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">No items found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>      </div>
    </div>
  );
};

export default StockAdjustmentView;
