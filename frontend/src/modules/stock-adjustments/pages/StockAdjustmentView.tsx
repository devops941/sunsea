import React, { useEffect, useMemo, useState } from "react";
import {
  FaBoxes,
  FaEdit,
  FaCheckCircle,
  FaTimesCircle,
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
import DetailBox from "../../../components/ui/DetailBox/DetailBox";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
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

  const isPMI = currentAdjustment?.adjustmentType === "PRODUCTION_MATERIAL_ISSUE";
  const po = currentAdjustment?.productionOrder;

  const pmiColumns: DataTableColumn<any>[] = useMemo(
    () => [
      {
        header: "RM Code",
        width: "140px",
        render: (item) => (
          <code className="text-xs bg-card text-ink border border-line-soft px-2 py-0.5 rounded font-mono font-bold">
            {item.rawMaterialId}
          </code>
        ),
      },
      {
        header: "Material Name",
        render: (item) => (
          <span className="font-extrabold text-ink">
            {item.rawMaterial?.materialName || item.rawMaterialId}
          </span>
        ),
      },
      {
        header: "Store",
        render: (item) => (
          <span className="text-ink font-medium">
            {item.store?.storeName || item.storeId || "—"}
          </span>
        ),
      },
      {
        header: "Stock Before",
        align: "right",
        render: (item) => {
          const uom = getItemUom(item);
          return (
            <span className="font-mono text-xs text-ink font-semibold">
              {Number(item.currentQty).toFixed(3)} {uom}
            </span>
          );
        },
      },
      {
        header: "Stock After",
        align: "right",
        render: (item) => {
          const uom = getItemUom(item);
          return (
            <span className="font-mono text-xs text-ink font-semibold">
              {Number(item.adjustedQty).toFixed(3)} {uom}
            </span>
          );
        },
      },
      {
        header: "Issued Qty",
        align: "right",
        render: (item) => {
          const uom = getItemUom(item);
          return (
            <span className="font-extrabold text-red-400 font-mono text-xs">
              {Math.abs(Number(item.difference)).toFixed(3)} {uom}
            </span>
          );
        },
      },
      {
        header: "Remarks",
        width: "minmax(280px, 2fr)",
        render: (item) => (
          <span className="text-ink text-sm font-medium whitespace-nowrap">
            {item.remarks || "—"}
          </span>
        ),
      },
    ],
    []
  );

  const generalColumns: DataTableColumn<any>[] = useMemo(
    () => [
      {
        header: "Item Type",
        width: "180px",
        render: (item) => {
          const isWastage = Boolean(
            item.itemType === "WASTAGE" ||
            item.rawMaterial?.itemType === "WASTAGE" ||
            (item.rawMaterial?.materialName || "").toLowerCase().includes("wastage") ||
            (item.rawMaterial?.materialName || "").toLowerCase().includes("scrap")
          );
          const isRM = (item.itemType === "RAW_MATERIAL" || !!item.rawMaterial || !!item.rawMaterialId) && !isWastage;
          const typeLabel = isWastage ? "Production Wastage" : isRM ? "Raw Material Return" : "Finished Goods";
          return (
            <StatusBadge
              status={isWastage ? "WASTAGE" : isRM ? "RAW_MATERIAL" : "FINISHED_GOODS"}
              customText={typeLabel}
            />
          );
        },
      },
      {
        header: "Item Details",
        width: "200px",
        render: (item) => {
          const itemName = item.rawMaterial?.materialName || item.product?.productName || item.rawMaterialId || item.productItemId || "—";
          return (
            <span className="font-extrabold text-ink">{itemName}</span>
          );
        },
      },
      {
        header: "Store",
        width: "160px",
        render: (item) => (
          <span className="text-ink font-medium">
            {item.store?.storeName || "—"}
          </span>
        ),
      },
      {
        header: "Current Qty",
        width: "130px",
        align: "right",
        render: (item) => {
          const uom = getItemUom(item);
          return (
            <span className="font-mono text-xs text-ink font-semibold">
              {Number(item.currentQty).toFixed(3)} {uom}
            </span>
          );
        },
      },
      {
        header: "Adjusted Qty",
        width: "130px",
        align: "right",
        render: (item) => {
          const uom = getItemUom(item);
          return (
            <span className="font-mono text-xs text-ink font-semibold">
              {Number(item.adjustedQty).toFixed(3)} {uom}
            </span>
          );
        },
      },
      {
        header: "Difference",
        width: "130px",
        align: "right",
        render: (item) => {
          const diff = Number(item.difference);
          const uom = getItemUom(item);
          return (
            <span
              className={`font-extrabold font-mono text-xs ${
                diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-ink-subtle"
              }`}
            >
              {diff > 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3)} {uom}
            </span>
          );
        },
      },
      {
        header: "Remarks",
        width: "minmax(320px, 2.5fr)",
        render: (item) => (
          <span className="text-ink text-sm font-medium whitespace-nowrap">
            {item.remarks || "—"}
          </span>
        ),
      },
    ],
    []
  );

  if (loading || !currentAdjustment) {
    return (
      <CommonLoader text="Loading stock adjustment details..." fullScreen={false} />
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col pb-6">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden flex-1 flex flex-col">
        {/* Top Header inside the Card */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-xl font-extrabold text-ink tracking-tight flex items-center flex-wrap gap-1">
              <span>Stock Adjustment Details</span>
              <span className="text-purple-400 text-sm ml-1.5 mt-0.5 leading-none font-mono font-bold">
                *{currentAdjustment.adjustmentNumber}
              </span>
            </h2>
            <p className="text-ink-subtle text-xs font-semibold mt-0.5">
              {ADJUSTMENT_TYPE_LABELS[currentAdjustment.adjustmentType] || currentAdjustment.adjustmentType}
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

        {/* Card Body Content */}
        <div className="p-6 flex-1 flex flex-col gap-6">
          {/* Adjustment Information Section */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-x-6 gap-y-4">
            <DetailBox
              label="Date"
              value={<span className="font-bold text-ink">{formatDate(currentAdjustment.adjustmentDate)}</span>}
            />
            <DetailBox
              label="Type"
              value={
                <StatusBadge
                  status={currentAdjustment.adjustmentType}
                  customText={ADJUSTMENT_TYPE_LABELS[currentAdjustment.adjustmentType] || currentAdjustment.adjustmentType}
                />
              }
            />
            <DetailBox
              label="Status"
              value={<StatusBadge status={currentAdjustment.status} />}
            />
            <DetailBox
              label="Created By"
              value={<span className="font-bold text-ink">{currentAdjustment.createdByUser?.fullName || currentAdjustment.createdBy}</span>}
            />
            {!isPMI && currentAdjustment.sourceDocument && (
              <DetailBox
                label="Source Document"
                value={<span className="font-bold text-ink">{currentAdjustment.sourceDocument}</span>}
              />
            )}
            {!isPMI && currentAdjustment.sourceDocId && (
              <DetailBox
                label="Source Doc Ref"
                value={<span className="font-mono font-bold text-ink text-xs">{currentAdjustment.sourceDocId}</span>}
              />
            )}
            {!isPMI && currentAdjustment.autoGenerated != null && (
              <DetailBox
                label="Auto Generated"
                value={
                  currentAdjustment.autoGenerated ? (
                    <StatusBadge status="ACTIVE" customText="Auto-generated" />
                  ) : (
                    <span className="font-bold text-ink">No</span>
                  )
                }
              />
            )}
            {currentAdjustment.reason && (
              <div className="col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-7">
                <DetailBox
                  label="Adjusted By / Reason"
                  value={<span className="font-bold text-ink">{currentAdjustment.reason}</span>}
                />
              </div>
            )}
          </div>

          {/* Production Order Information (if PMI) */}
          {isPMI && po && (
            <div className="pt-5 border-t border-line-soft space-y-3">
              <div className="flex items-center gap-2">
                <FaBoxes className="text-blue-400" size={14} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                  Production Order Information
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                <DetailBox
                  label="PO Number"
                  value={
                    <span className="font-mono text-primary text-sm font-extrabold">
                      {po.productionOrderId}
                    </span>
                  }
                />
                <DetailBox
                  label="Product"
                  value={<span className="font-extrabold text-ink text-sm">{po.productItem?.productName || "—"}</span>}
                />
                <DetailBox
                  label="Planned Qty"
                  value={
                    <span className="font-bold text-ink">
                      {po.targetQty ? `${Number(po.targetQty).toLocaleString()} ${po.uom || ""}` : "—"}
                    </span>
                  }
                />
                <DetailBox
                  label="Due Date"
                  value={<span className="font-bold text-ink">{formatDate(po.dueDate)}</span>}
                />
                <DetailBox
                  label="Machine"
                  value={<span className="font-bold text-ink">{po.Machine?.machineName || po.machineMachineId || "—"}</span>}
                />
                <DetailBox
                  label="PO Status"
                  value={<StatusBadge status={po.status} />}
                />
              </div>
            </div>
          )}

          {/* Items Table Section */}
          <div className="pt-5 border-t border-line-soft space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                {isPMI ? "Issued Materials" : "Adjustment Items"}
              </h3>
              <span className="text-xs font-bold text-ink-subtle bg-card-2 border border-line-soft px-2.5 py-0.5 rounded-full">
                {currentAdjustment.items?.length || 0} item{currentAdjustment.items?.length !== 1 ? "s" : ""}
              </span>
            </div>
            <DataTable
              columns={isPMI ? pmiColumns : generalColumns}
              data={currentAdjustment.items || []}
              rowKey={(row) => row.id || `${row.rawMaterialId || row.productItemId}-${Math.random()}`}
              density="compact"
              emptyMessage="No items found"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockAdjustmentView;

