import React, { useState, useEffect } from "react";

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
    onItemRemarksChange?: (itemId: string | number, remarks: string) => void;
    /** Set explicitly to false when rendering for Print / PDF export so inputs collapse to plain text */
    isEditable?: boolean;
}

export const SalesOrderEstimateContent: React.FC<SalesOrderEstimateContentProps> = ({
    estimateOrder,
    formatDate,
    onItemRemarksChange,
    isEditable = true,
}) => {
    // Internal fallback state so the field is editable even if the parent
    // doesn't pass onItemRemarksChange. Keyed by item id.
    const [localRemarks, setLocalRemarks] = useState<Record<string | number, string>>({});

    useEffect(() => {
        // seed local state whenever the incoming items change (e.g. new order loaded)
        const seeded: Record<string | number, string> = {};
        estimateOrder.items?.forEach((item) => {
            seeded[item.id] = item.remarks !== undefined ? item.remarks : (item.notes || "");
        });
        setLocalRemarks(seeded);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estimateOrder.items?.map((i) => i.id).join(",")]);

    const getValue = (item: NonNullable<typeof estimateOrder.items>[number]) => {
        if (isEditable && localRemarks[item.id] !== undefined) return localRemarks[item.id];
        return item.remarks !== undefined ? item.remarks : (item.notes || "");
    };

    const handleChange = (itemId: string | number, value: string) => {
        setLocalRemarks((prev) => ({ ...prev, [itemId]: value }));
        onItemRemarksChange?.(itemId, value);
    };

    return (
        <div className="flex-1 flex flex-col justify-between">
            <div>
                {/* details-box */}
                <div className="flex border-b-[1.5px] border-black">
                    {/* party-details */}
                    <div className="flex-[1.2] border-r-[1.5px] border-black p-3 text-[13px] leading-[1.5]">
                        <div className="font-bold mb-1">Party Details :</div>
                        <div className="font-semibold text-slate-800">
                            {estimateOrder.customer?.displayName || estimateOrder.customer?.firmName || "N/A"}
                        </div>
                        <div className="text-slate-600 mt-1">
                            {estimateOrder.billingAddressLine1}<br />
                            {estimateOrder.billingCity}, {estimateOrder.billingState} - {estimateOrder.billingPincode}
                        </div>
                    </div>
                    {/* order-details */}
                    <div className="flex-[0.8] p-3 text-[13px] leading-[1.6] border-l border-slate-200">
                        <div className="flex mb-1.5">
                            <span className="w-[90px] font-bold">Order No.</span>
                            <span className="flex-1">: {estimateOrder.orderNo}</span>
                        </div>
                        <div className="flex mb-1.5">
                            <span className="w-[90px] font-bold">Dated</span>
                            <span className="flex-1">: {formatDate(estimateOrder.orderDate)}</span>
                        </div>
                    </div>
                </div>

                {/* intro-text */}
                <div className="px-3 py-2.5 text-[13px] border-b-[1.5px] border-black text-slate-700">
                    We are pleased to receive the order for the following items :
                </div>

                {/* items-table */}
                <table className="w-full border-collapse text-[13px]">
                    <thead>
                        <tr>
                            <th
                                className="text-center border border-black px-2.5 py-2 align-middle font-bold bg-[#f7f7f7]"
                                style={{ width: "50px" }}
                            >
                                S.N.
                            </th>
                            <th className="text-left border border-black px-2.5 py-2 align-middle font-bold bg-[#f7f7f7]">
                                Description of Goods
                            </th>
                            <th
                                className="text-right border border-black px-2.5 py-2 align-middle font-bold bg-[#f7f7f7]"
                                style={{ width: "90px" }}
                            >
                                Qty.
                            </th>
                            <th
                                className="text-center border border-black px-2.5 py-2 align-middle font-bold bg-[#f7f7f7]"
                                style={{ width: "90px" }}
                            >
                                Unit
                            </th>
                            <th className="text-left border border-black px-2.5 py-2 align-middle font-bold bg-[#f7f7f7]">
                                Remarks
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {estimateOrder.items?.map((item, idx) => (
                            <tr key={item.id} style={{ height: "38px" }}>
                                <td
                                    className="text-center border border-black px-2.5 py-2 align-middle"
                                    style={{ width: "50px" }}
                                >
                                    {idx + 1}.
                                </td>
                                <td className="border border-black px-2.5 py-2 align-middle font-medium text-slate-800">
                                    {item.product?.productName || "N/A"}
                                </td>
                                <td
                                    className="text-right border border-black px-2.5 py-2 align-middle font-bold"
                                    style={{ width: "90px" }}
                                >
                                    {item.quantity}
                                </td>
                                <td
                                    className="text-center border border-black px-2.5 py-2 align-middle text-slate-600"
                                    style={{ width: "90px" }}
                                >
                                    {item.product?.uom?.uomName || "Pcs."}
                                </td>
                                <td
                                    className="border border-black px-2.5 py-2 align-middle text-slate-500"
                                    style={{ width: "200px" }}
                                >
                                    {isEditable ? (
                                        <input
                                            type="text"
                                            value={getValue(item)}
                                            onChange={(e) => handleChange(item.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full bg-transparent border border-slate-300 rounded px-2 py-1 text-slate-700 text-sm focus:border-indigo-500 focus:outline-none"
                                            placeholder="Add remarks..."
                                        />
                                    ) : (
                                        getValue(item)
                                    )}
                                </td>
                            </tr>
                        ))}
                        {/* Clean empty rows filling out A4 sheet without dummy numbers */}
                        {Array.from({ length: Math.max(0, 18 - (estimateOrder.items?.length || 0)) }).map((_, idx) => (
                            <tr key={`empty-${idx}`} style={{ height: "36px" }}>
                                <td className="border border-black px-2.5 py-2 align-middle text-center"></td>
                                <td className="border border-black px-2.5 py-2 align-middle"></td>
                                <td className="border border-black px-2.5 py-2 align-middle"></td>
                                <td className="border border-black px-2.5 py-2 align-middle"></td>
                                <td className="border border-black px-2.5 py-2 align-middle"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SalesOrderEstimateContent;