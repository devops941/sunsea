import React, { useEffect, useMemo } from "react";
import type { PurchaseOrder } from "../../../../features/purchaseOrder/types";
import { useSelector, useDispatch } from "react-redux";
import { fetchRawMaterials } from "../../../../features/raw-materials/rawMaterialSlice";
import type { AppDispatch } from "../../../../app/store";
import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";
import { useUsers } from "../../../../hooks/useUsers";

import { getUomMultiplier } from "../utils/uomUtils";

interface PurchaseOrderViewModalProps {
  show: boolean;
  onHide: () => void;
  purchaseOrder: PurchaseOrder | null;
}

const safeDate = (date?: string | null) => {
  if (!date) return "-";
  const d = new Date(date);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
};

const safeNumber = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const PurchaseOrderViewModal: React.FC<PurchaseOrderViewModalProps> = ({
  show,
  onHide,
  purchaseOrder,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const rawMaterials = useSelector((state: any) => state.rawMaterials?.data || []);
  const user = useSelector((state: any) => state?.auth?.user);
  const { users, loadUsers } = useUsers();
  const company = useSelector((state: any) => state.company?.data);
  const companyState = company?.state;

  useEffect(() => {
    if (show) {
      if (rawMaterials.length === 0) {
        dispatch(fetchRawMaterials(undefined));
      }
      loadUsers();
    }
  }, [show, dispatch, rawMaterials.length, loadUsers]);

  if (!purchaseOrder) return null;

  const createdByUser = users.find((u: any) => u.userId === purchaseOrder.createdBy || u.id === purchaseOrder.createdBy);
  const createdByName = createdByUser?.username || (purchaseOrder.createdBy?.startsWith("admin_") ? "admin" : (purchaseOrder.createdBy || "NA"));

  const isInterState = companyState && purchaseOrder.billingState
    ? companyState.toLowerCase().trim() !== purchaseOrder.billingState.toLowerCase().trim()
    : (Number(purchaseOrder.totalIgst) > 0);

  const sections = [
    {
      title: "Order Information",
      fields: [
        { label: "PO Date", value: safeDate(purchaseOrder.poDate) },
        { label: "Expected Delivery", value: safeDate(purchaseOrder.expectedDeliveryDate) },
        { label: "Supplier", value: purchaseOrder.supplier?.supplierName || "N/A" },
        { label: "Supplier Code", value: purchaseOrder.supplier?.supplierCode || "N/A" },
      ],
    },
    {
      title: "Addresses",
      fields: [
        {
          label: "Billing Address",
          value: (
            <>
              {purchaseOrder.billingAddressLine1 || "-"} <br />
              {purchaseOrder.billingCity || "-"}, {purchaseOrder.billingState || "-"} <br />
              {purchaseOrder.billingPincode || "-"}
            </>
          ),
        },
        {
          label: "Shipping Address",
          value: (
            <>
              {purchaseOrder.shippingAddressLine1 || "-"} <br />
              {purchaseOrder.shippingCity || "-"}, {purchaseOrder.shippingState || "-"} <br />
              {purchaseOrder.shippingPincode || "-"}
              {purchaseOrder.sameAsBilling && (
                <div className="mt-1">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Same as billing
                  </span>
                </div>
              )}
            </>
          ),
        },
      ],
    }
  ];

  if (purchaseOrder.remarks) {
    sections.push({
      title: "Remarks",
      fields: [{ label: "Notes", value: purchaseOrder.remarks }],
    });
  }

  if (purchaseOrder.status === "REJECTED" && purchaseOrder.rejectReason) {
    sections.push({
      title: "Rejection Reason",
      fields: [{ label: "Reason", value: <span className="text-rose-600 dark:text-rose-400 font-semibold">{purchaseOrder.rejectReason}</span> }],
    });
  }

  sections.push({
    title: "Timestamps",
    fields: [
      { label: "Created By", value: createdByName },
      { label: "Created At", value: safeDate(purchaseOrder.createdAt) },
    ],
  });

  const customContent = (
    <div className="bg-card-2/40 rounded-xl border border-line shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-card-2 border-b border-line flex items-center justify-between">
        <h6 className="text-xs font-bold text-ink uppercase tracking-wider">Items</h6>
        <span className="text-xs text-ink-subtle font-medium">
          {(purchaseOrder.items || []).length} {(purchaseOrder.items || []).length === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="p-0 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-card-2/70 border-b border-line text-[11px] uppercase tracking-wider text-ink-subtle font-semibold">
              <th className="py-3 px-4">S.No</th>
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4 text-right">Qty</th>
              <th className="py-3 px-4 text-right">Unit Price</th>
              <th className="py-3 px-4 text-right">Tax %</th>
              {isInterState ? (
                <th className="py-3 px-4 text-right">IGST</th>
              ) : (
                <>
                  <th className="py-3 px-4 text-right">CGST</th>
                  <th className="py-3 px-4 text-right">SGST</th>
                </>
              )}
              <th className="py-3 px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft text-sm text-ink-muted">
            {(purchaseOrder.items || []).length > 0 ? (
              purchaseOrder.items.map((item, index) => {
                const qty = safeNumber(item.quantity);
                const price = safeNumber(item.unitPrice);
                const tax = safeNumber(item.tax);

                const base = qty * price;
                const taxAmt = (base * tax) / 100;
                const total = item.lineTotal ? safeNumber(item.lineTotal) : base + taxAmt;

                const cgstAmt = item.cgstAmount !== undefined
                  ? safeNumber(item.cgstAmount)
                  : taxAmt / 2;
                const sgstAmt = item.sgstAmount !== undefined
                  ? safeNumber(item.sgstAmount)
                  : taxAmt / 2;
                const igstAmt = item.igstAmount !== undefined
                  ? safeNumber(item.igstAmount)
                  : taxAmt;

                const matchedMaterial = rawMaterials.find(
                  (rm: any) => String(rm.rawMaterialId) === String(item.productId)
                );
                const productName = matchedMaterial?.materialName || `Product #${item.productId || "-"}`;

                return (
                  <tr key={item.id || index} className="hover:bg-card-2/60 transition-colors">
                    <td className="py-3.5 px-4 text-ink-subtle font-mono text-xs">{index + 1}</td>
                    <td className="py-3.5 px-4 font-medium text-ink">{productName}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-ink">{qty}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-ink-muted">₹{price.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-ink-subtle">{tax}%</td>
                    {isInterState ? (
                      <td className="py-3.5 px-4 text-right font-mono text-blue-600 dark:text-blue-400">₹{igstAmt.toFixed(2)}</td>
                    ) : (
                      <>
                        <td className="py-3.5 px-4 text-right font-mono text-blue-600 dark:text-blue-400">₹{cgstAmt.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-purple-600 dark:text-purple-400">₹{sgstAmt.toFixed(2)}</td>
                      </>
                    )}
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-ink">₹{total.toFixed(2)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={isInterState ? 7 : 8} className="p-8 text-center text-ink-subtle">
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-5 bg-card-2/50 border-t border-line flex justify-end">
        <div className="w-full sm:w-1/2 lg:w-1/3 space-y-2 text-sm">
          <div className="flex justify-between text-ink-muted">
            <span>Subtotal:</span>
            <span className="font-mono font-medium text-ink">₹{safeNumber(purchaseOrder.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-rose-600 dark:text-rose-400">
            <span>Discount:</span>
            <span className="font-mono font-medium">-₹{safeNumber(purchaseOrder.totalDiscount).toFixed(2)}</span>
          </div>
          {isInterState ? (
            <div className="flex justify-between text-blue-600 dark:text-blue-400">
              <span>IGST:</span>
              <span className="font-mono font-medium">+₹{safeNumber(purchaseOrder.totalIgst).toFixed(2)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span>CGST:</span>
                <span className="font-mono font-medium">+₹{safeNumber(purchaseOrder.totalCgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-purple-600 dark:text-purple-400">
                <span>SGST:</span>
                <span className="font-mono font-medium">+₹{safeNumber(purchaseOrder.totalSgst).toFixed(2)}</span>
              </div>
            </>
          )}
          {Number((purchaseOrder as any).roundingAdjust || 0) !== 0 && (
            <div className="flex justify-between text-ink-muted">
              <span>Round Off:</span>
              <span className="font-mono font-medium">{Number((purchaseOrder as any).roundingAdjust) > 0 ? "+" : ""}₹{safeNumber((purchaseOrder as any).roundingAdjust).toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-line pt-2.5 mt-2 flex justify-between font-bold text-ink text-base">
            <span>Net Amount:</span>
            <span className="font-mono text-primary font-bold text-lg">₹{safeNumber(purchaseOrder.netAmount).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <CommonViewModal
      show={show}
      onHide={onHide}
      size="lg"
      modalTitle="Purchase Order Details"
      avatarText="PO"
      headerTitle={purchaseOrder.poNumber}
      headerSubtitle={purchaseOrder.supplier?.supplierName || "No Supplier"}
      statusNode={<StatusBadge status={purchaseOrder.status} />}
      sections={sections}
      customContent={customContent}
    />
  );
};

export default PurchaseOrderViewModal;