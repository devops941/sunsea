import React, { useEffect, useState } from "react";
import {
  FaBoxes, FaEdit,
  FaInfoCircle,
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
import { usePermission } from "../../../hooks/usePermission";
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

const formatUomStr = (raw: string): string => {
  if (!raw) return "";
  const first = String(raw).split(",")[0].trim().toLowerCase();
  if (first === "ea" || first === "each") return "pcs";
  return first;
};

const getItemUom = (item: any): string => {
  if (!item) return "pcs";
  if (item.uom) {
    const raw = typeof item.uom === "object" ? (item.uom.uomCode || item.uom.uomName || item.uom.code || item.uom.name) : String(item.uom);
    if (raw) return formatUomStr(raw);
  }
  const isProduct = item.itemType === "PRODUCT" || item.itemType === "FINISHED_GOODS" || !!item.product || !!item.productItemId;
  if (isProduct) {
    const pUom = item.product?.uom;
    const prodUom = typeof pUom === "object"
      ? (pUom.uomCode || pUom.uomName || pUom.code || pUom.name)
      : (pUom || item.product?.baseUom || item.product?.unit);
    if (prodUom) return formatUomStr(prodUom);
    return "pcs";
  }
  const rmUom = item.rawMaterial?.baseUom || item.rawMaterial?.uom;
  if (rmUom) return formatUomStr(rmUom);
  return "kg";
};

const InfoField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-bold mb-1">{label}</p>
    <div className="text-sm font-extrabold text-ink">{value || "—"}</div>
  </div>
);

const StockAdjustmentView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { can } = usePermission();

  const { currentAdjustment, loading } = useAppSelector(
    (state) => state.stockAdjustments
  );
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchStockAdjustmentById(id));
    return () => { dispatch(clearCurrent()); };
  }, [dispatch, id]);

  const handleApprove = async (targetStatus: string) => {
    if (!id || isApproving) return;
    setIsApproving(true);
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
    } finally {
      setIsApproving(false);
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

  return (
    <div className="p-4 md:p-6 min-h-screen bg-card rounded-2xl border border-line-soft shadow-xs">
      <div className="w-full mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-ink tracking-tight">Stock Adjustment Details</h2>
            <p className="text-ink-subtle text-sm font-semibold mt-0.5">
              {currentAdjustment.adjustmentNumber} &middot; {ADJUSTMENT_TYPE_LABELS[currentAdjustment.adjustmentType] || currentAdjustment.adjustmentType}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentAdjustment.status === "DRAFT" && can("stock-adjustments.edit") && (
              <>
                <CustomButton
                  text={isApproving ? "Processing..." : "Approve (MD Approval)"}
                  icon={FaCheckCircle}
                  variant="primary"
                  onClick={() => handleApprove("APPROVED")}
                  disabled={isApproving}
                />
                <CustomButton
                  text="Reject"
                  icon={FaTimesCircle}
                  variant="danger"
                  onClick={() => handleApprove("REJECTED")}
                  disabled={isApproving}
                />
              </>
            )}
            {currentAdjustment.status === "DRAFT" && can("stock-adjustments.edit") && (
              <CustomButton
                text="Edit"
                icon={FaEdit}
                variant="secondary"
                onClick={() => navigate(`/inventory/stock-adjustments/edit/${currentAdjustment.id}`)}
              />
            )}
            <BackButton text="Back" to="/inventory/stock-adjustments" />
          </div>
        </div>

        {isApproved && isPMI && (
          <div className="mb-5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-4 flex items-start gap-3">
            <FaCheckCircle className="text-emerald-400 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-bold text-emerald-300 text-sm">Material Issue Approved</p>
              <p className="text-emerald-400/90 text-xs mt-0.5 font-medium">
                Production Order <strong>{currentAdjustment.productionOrderId}</strong> is now eligible to start production. Raw material stock has been deducted.
              </p>
            </div>
          </div>
        )}

        {currentAdjustment.status === "DRAFT" && isPMI && (
          <div className="mb-5 rounded-xl bg-amber-500/15 border border-amber-500/30 p-4 flex items-start gap-3">
            <FaInfoCircle className="text-amber-400 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-bold text-amber-300 text-sm">Draft — Pending Approval</p>
              <p className="text-amber-400/90 text-xs mt-0.5 font-medium">
                This Material Issue is in <strong>Draft</strong> status. Approve it to deduct stock and allow Production Start.
              </p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="mb-5 rounded-xl bg-red-500/15 border border-red-500/30 p-4 flex items-start gap-3">
            <FaTimesCircle className="text-red-400 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-bold text-red-300 text-sm">Adjustment Rejected</p>
              {currentAdjustment.approvedBy && (
                <p className="text-red-400/90 text-xs mt-0.5 font-medium">
                  Rejected by <strong>{currentAdjustment.approvedBy}</strong> on {formatDate(currentAdjustment.approvedAt)}.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-line-soft shadow-xs mb-5 overflow-hidden bg-card-2">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line-soft bg-card-2">
            <h3 className="font-extrabold text-ink text-base">Adjustment Information</h3>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            <InfoField label="Adjustment No." value={
              <span className="font-mono text-primary text-sm font-extrabold">{currentAdjustment.adjustmentNumber}</span>
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
                <InfoField label="Adjusted By" value={currentAdjustment.reason} />
              </div>
            )}
          </div>
          {!isPMI && (currentAdjustment.sourceDocument || currentAdjustment.sourceDocId) && (
            <div className="px-5 pb-5 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-5 border-t border-line-soft">
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
          <div className="rounded-2xl border border-line-soft shadow-xs mb-5 overflow-hidden bg-card-2">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-line-soft bg-card-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <FaBoxes className="text-blue-400" size={15} />
              </div>
              <h3 className="font-extrabold text-ink text-base">Production Order Information</h3>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
              <InfoField label="PO Number" value={
                <span className="font-mono text-primary text-sm font-extrabold">{po.productionOrderId}</span>
              } />
              <InfoField label="Product" value={
                <div>
                  <div className="font-extrabold text-ink text-sm">{po.productItem?.productName || "—"}</div>
                  {po.productItem?.productCode && (
                    <div className="text-xs text-ink-subtle font-mono mt-0.5 font-semibold">{po.productItem.productCode}</div>
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

        <div className="rounded-2xl border border-line-soft shadow-xs mb-5 overflow-hidden bg-card-2">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line-soft bg-card-2">
            <h3 className="font-extrabold text-ink text-base">
              {isPMI ? "Issued Materials" : "Adjustment Items"}
            </h3>
            <span className="ml-auto text-xs font-bold text-ink-subtle bg-card border border-line-soft px-3 py-1 rounded-full">
              {currentAdjustment.items?.length || 0} item{currentAdjustment.items?.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            {isPMI ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-card-2 border-b border-line-soft">
                    {["RM Code","Material Name","Store","Stock Before","Stock After","Issued Qty","Remarks"].map((h, i) => (
                      <th key={h} className={`text-[11px] uppercase tracking-wider text-ink-subtle font-extrabold px-4 py-3 ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {currentAdjustment.items?.map((item: any, idx: number) => {
                    const itemUom = getItemUom(item);

                    return (
                      <tr key={item.id || idx} className="hover:bg-card/60 transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-xs bg-card text-ink border border-line-soft px-2 py-0.5 rounded font-mono font-bold">{item.rawMaterialId}</code>
                        </td>
                        <td className="px-4 py-3 font-extrabold text-ink">{item.rawMaterial?.materialName || item.rawMaterialId}</td>
                        <td className="px-4 py-3 text-ink font-medium">{item.store?.storeName || item.storeId}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-ink font-semibold">{Number(item.currentQty).toFixed(3)} {itemUom}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-ink font-semibold">{Number(item.adjustedQty).toFixed(3)} {itemUom}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-extrabold text-red-400 font-mono text-xs">{Math.abs(Number(item.difference)).toFixed(3)} {itemUom}</span>
                        </td>
                        <td className="px-4 py-3">
                          {item.remarks ? (
                            <div className="bg-card border-l-2 border-primary text-ink text-xs px-2.5 py-1 rounded-r-md font-semibold inline-block max-w-xs leading-normal">
                              {item.remarks}
                            </div>
                          ) : (
                            <span className="text-ink-subtle text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(!currentAdjustment.items || currentAdjustment.items.length === 0) && (
                    <tr><td colSpan={7} className="text-center py-10 text-ink-subtle text-sm font-semibold">No items found</td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-card-2 border-b border-line-soft">
                    {["Item Type","Item Details","Store","Current Qty","Adjusted Qty","Difference","Remarks"].map((h, i) => (
                      <th key={h} className={`text-[11px] uppercase tracking-wider text-ink-subtle font-extrabold px-4 py-3 ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {currentAdjustment.items?.map((item: any, idx: number) => {
                    const diff = Number(item.difference);
                    const itemUom = getItemUom(item);

                    const isWastage = item.itemType === "WASTAGE" || item.rawMaterial?.itemType === "WASTAGE";
                    const isRM = (item.itemType === "RAW_MATERIAL" || !!item.rawMaterial) && !isWastage;
                    const typeLabel = isWastage ? "Wastage Product" : isRM ? "Raw Material" : "Finished Goods";

                    const itemName = item.rawMaterial?.materialName || item.product?.productName || item.rawMaterialId || item.productItemId || "—";
                    const itemCode = item.rawMaterial?.rawMaterialId || item.product?.productCode || "";

                    return (
                      <tr key={item.id || idx} className="hover:bg-card/60 transition-colors">
                        <td className="px-4 py-3">
                          <StatusBadge 
                            status={isWastage ? "WASTAGE" : (isRM ? "RAW_MATERIAL" : "FINISHED_GOODS")} 
                            customText={typeLabel} 
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-ink">{itemName}</div>
                          {itemCode && <div className="text-xs text-ink-subtle font-mono mt-0.5 font-semibold">{itemCode}</div>}
                        </td>
                        <td className="px-4 py-3 text-ink font-medium">{item.store?.storeName || "—"}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-ink font-semibold">{Number(item.currentQty).toFixed(3)} {itemUom}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-ink font-semibold">{Number(item.adjustedQty).toFixed(3)} {itemUom}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-extrabold font-mono text-xs ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-ink-subtle"}`}>
                            {diff > 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3)} {itemUom}
                          </span>
                        </td>
                         <td className="px-4 py-3">
                          {item.remarks ? (
                            <div className="bg-card border-l-2 border-primary text-ink text-xs px-2.5 py-1 rounded-r-md font-semibold inline-block max-w-xs leading-normal">
                              {item.remarks}
                            </div>
                          ) : (
                            <span className="text-ink-subtle text-xs">—</span>
                          )}
                         </td>
                      </tr>
                    );
                  })}
                  {(!currentAdjustment.items || currentAdjustment.items.length === 0) && (
                    <tr><td colSpan={9} className="text-center py-10 text-ink-subtle text-sm font-semibold">No items found</td></tr>
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
