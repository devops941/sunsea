import React, { useEffect } from "react";
import type { PurchaseOrder } from "../../../../features/purchaseOrder/types";
import { useSelector, useDispatch } from "react-redux";
import { fetchRawMaterials } from "../../../../features/raw-materials/rawMaterialSlice";
import type { AppDispatch } from "../../../../app/store";
import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";

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

  useEffect(() => {
    if (show && rawMaterials.length === 0) {
      dispatch(fetchRawMaterials(undefined));
    }
  }, [show, dispatch, rawMaterials.length]);

  if (!purchaseOrder) return null;

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
                <div className="mt-1"><span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Same as billing</span></div>
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
      fields: [{ label: "Reason", value: <span className="text-red-600 font-semibold">{purchaseOrder.rejectReason}</span> }],
    });
  }

  sections.push({
    title: "Timestamps",
    fields: [
      { label: "Created By", value: user?.username || "NA" },
      { label: "Created At", value: safeDate(purchaseOrder.createdAt) },
    ],
  });

  const customContent = (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
        <h6 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Items</h6>
      </div>
      <div className="p-0 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
              <th className="p-4">S.No</th>
              <th className="p-4">Product</th>
              <th className="p-4 text-right">Qty</th>
              <th className="p-4 text-right">Unit Price</th>
              <th className="p-4 text-right">Tax %</th>
              <th className="p-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {(purchaseOrder.items || []).length > 0 ? (
              purchaseOrder.items.map((item, index) => {
                const qty = safeNumber(item.quantity);
                const price = safeNumber(item.unitPrice);
                const tax = safeNumber(item.tax);

                const base = qty * price;
                const taxAmt = (base * tax) / 100;
                const total = item.lineTotal ? safeNumber(item.lineTotal) : base + taxAmt;

                const matchedMaterial = rawMaterials.find(
                  (rm: any) => String(rm.rawMaterialId) === String(item.productId)
                );
                const productName = matchedMaterial?.materialName || `Product #${item.productId || "-"}`;

                return (
                  <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">{index + 1}</td>
                    <td className="p-4 font-medium text-slate-900">{productName}</td>
                    <td className="p-4 text-right">{qty}</td>
                    <td className="p-4 text-right">₹{price.toFixed(2)}</td>
                    <td className="p-4 text-right">{tax}%</td>
                    <td className="p-4 text-right font-medium">₹{total.toFixed(2)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end">
        <div className="w-full sm:w-1/2 lg:w-1/3 space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span>₹{safeNumber(purchaseOrder.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Discount:</span>
            <span>-₹{safeNumber(purchaseOrder.totalDiscount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Tax:</span>
            <span>+₹{safeNumber(purchaseOrder.totalTax).toFixed(2)}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold text-slate-900 text-base">
            <span>Net Amount:</span>
            <span>₹{safeNumber(purchaseOrder.netAmount).toFixed(2)}</span>
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