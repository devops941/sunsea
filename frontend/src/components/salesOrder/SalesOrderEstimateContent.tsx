import React from "react";
import "./SalesOrderEstimateContent.css";

interface SalesOrderEstimateContentProps {
    estimateOrder: {
        customer?: {
            displayName?: string;
            firmName?: string;
        };
        billingAddressLine1?: string;
        billingCity?: string;
        billingState?: string;
        billingPincode?: string;
        orderNo?: string;
        orderDate?: string | Date;
        items?: Array<{
            id: string | number;
            product?: {
                productName?: string;
                uom?: {
                    uomName?: string;
                };
            };
            quantity: number | string;
            remarks?: string;
            notes?: string;
        }>;
    };
    formatDate: (dateStr: any) => string;
}

export const SalesOrderEstimateContent: React.FC<SalesOrderEstimateContentProps> = ({
    estimateOrder,
    formatDate,
}) => {
    return (
        <>
            <div className="details-box">
                <div className="party-details">
                    <div className="font-bold mb-1">Party Details :</div>
                    <div className="font-semibold text-slate-800">
                        {estimateOrder.customer?.displayName || estimateOrder.customer?.firmName || "N/A"}
                    </div>
                    <div className="text-slate-600 mt-1">
                        {estimateOrder.billingAddressLine1}<br />
                        {estimateOrder.billingCity}, {estimateOrder.billingState} - {estimateOrder.billingPincode}
                    </div>
                </div>
                <div className="order-details border-l border-slate-200">
                    <div className="order-row">
                        <span className="label">Order No.</span>
                        <span className="value">: {estimateOrder.orderNo}</span>
                    </div>
                    <div className="order-row">
                        <span className="label">Dated</span>
                        <span className="value">: {formatDate(estimateOrder.orderDate)}</span>
                    </div>
                </div>
            </div>
            <div className="intro-text text-slate-700">
                We are pleased to receive the order for the following items :
            </div>
            <table className="items-table">
                <thead>
                    <tr>
                        <th className="text-center" style={{ width: "50px" }}>S.N.</th>
                        <th>Description of Goods</th>
                        <th className="text-right" style={{ width: "90px" }}>Qty.</th>
                        <th className="text-center" style={{ width: "90px" }}>Unit</th>
                        <th>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {estimateOrder.items?.map((item, idx) => (
                        <tr key={item.id}>
                            <td className="sn-col text-center">{idx + 1}.</td>
                            <td className="font-medium text-slate-800">
                                {item.product?.productName || "N/A"}
                            </td>
                            <td className="qty-col text-right font-bold">
                                {item.quantity}
                            </td>
                            <td className="unit-col text-center text-slate-600">
                                {item.product?.uom?.uomName || "Pcs."}
                            </td>
                            <td className="remarks-col text-slate-500">
                                {item.remarks || item.notes || ""}
                            </td>
                        </tr>
                    ))}
                    {/* Classic invoice empty pad rows to match user image */}
                    {Array.from({ length: Math.max(0, 10 - (estimateOrder.items?.length || 0)) }).map((_, idx) => (
                        <tr key={`empty-${idx}`} style={{ height: "35px" }}>
                            <td className="sn-col text-center text-slate-300">
                                {(estimateOrder.items?.length || 0) + idx + 1}.
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
};

export default SalesOrderEstimateContent;
