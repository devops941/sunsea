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

    const extractAddress = () => {
        const isValid = (val?: any) => val && typeof val === "string" && val.trim() !== "" && val.trim() !== "-";
        const cust = estimateOrder.customer as any;

        let line1 = estimateOrder.billingAddressLine1 || cust?.billingAddressLine1 || "";
        let city = estimateOrder.billingCity || cust?.billingCity || "";
        let state = estimateOrder.billingState || cust?.billingState || "";
        let pincode = estimateOrder.billingPincode || cust?.billingPincode || "";

        if (!isValid(line1) && Array.isArray(cust?.addresses) && cust.addresses.length > 0) {
            const billingObj = cust.addresses.find((a: any) => a.addressType === "BILLING" || a.type === "BILLING") || cust.addresses[0];
            const addr = billingObj?.address || billingObj;
            if (addr) {
                if (!isValid(line1)) line1 = addr.addressLine1 || addr.addressLine || addr.street || "";
                if (!isValid(city)) city = addr.city || "";
                if (!isValid(state)) state = addr.state || "";
                if (!isValid(pincode)) pincode = addr.pincode || addr.zipCode || "";
            }
        }

        const cleanLine1 = isValid(line1) ? String(line1) : "";
        const cleanCity = isValid(city) ? String(city) : "";
        const cleanState = isValid(state) ? String(state) : "";
        const cleanPincode = isValid(pincode) ? String(pincode) : "";
        const cityStatePin = [cleanCity, cleanState].filter(Boolean).join(", ") + (cleanPincode ? ` - ${cleanPincode}` : "");

        return { cleanLine1, cityStatePin };
    };

    const { cleanLine1, cityStatePin } = extractAddress();

    return (
        <div className="flex-1 flex flex-col justify-between">
            <div>
                {/* details-box */}
                <div className="flex border-b border-black">
                    {/* party-details */}
                    <div className="flex-[1.2] border-r border-black p-3 text-[14px] leading-[1.5]">
                        <div className="font-bold mb-1">Party Details :</div>
                        <div className="font-semibold text-slate-800">
                            {estimateOrder.customer?.displayName || estimateOrder.customer?.firmName || "N/A"}
                        </div>
                        <div className="text-slate-600 mt-1">
                            {cleanLine1 && <div>{cleanLine1}</div>}
                            {cityStatePin && <div>{cityStatePin}</div>}
                            {!cleanLine1 && !cityStatePin && <div className="text-slate-400 italic">Address not specified</div>}
                        </div>
                    </div>
                    {/* order-details */}
                    <div className="flex-[0.8] p-3 text-[14px] leading-[1.6]">
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
                <div className="px-3 py-2.5 text-[14px] border-b border-black text-slate-700">
                    We are pleased to receive the order for the following items :
                </div>

                {/* items-table */}
                <table className="w-full border-collapse text-[14px]">
                    <thead>
                        <tr style={{ height: "32px" }}>
                            <th
                                className="text-center border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]"
                                style={{ width: "50px" }}
                            >
                                S.N.
                            </th>
                            <th className="text-left border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]">
                                Description of Goods
                            </th>
                            <th
                                className="text-right border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]"
                                style={{ width: "90px" }}
                            >
                                Qty.
                            </th>
                            <th
                                className="text-center border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]"
                                style={{ width: "90px" }}
                            >
                                Unit
                            </th>
                            <th className="text-left border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]">
                                Remarks
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {estimateOrder.items?.map((item, idx) => (
                            <tr key={item.id} style={{ height: "28px" }}>
                                <td
                                    className="text-center border border-black px-2.5 py-0 align-middle"
                                    style={{ width: "50px" }}
                                >
                                    {idx + 1}.
                                </td>
                                <td className="border border-black px-2.5 py-0 align-middle font-medium text-slate-800">
                                    {item.product?.productName || "N/A"}
                                </td>
                                <td
                                    className="text-right border border-black px-2.5 py-0 align-middle font-bold"
                                    style={{ width: "90px" }}
                                >
                                    {item.quantity}
                                </td>
                                <td
                                    className="text-center border border-black px-2.5 py-0 align-middle text-slate-600"
                                    style={{ width: "90px" }}
                                >
                                    {item.product?.uom?.uomName || "Pcs."}
                                </td>
                                <td
                                    className="border border-black px-2.5 py-0 align-middle text-slate-500"
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
                        {/* Clean empty rows filling out A4 sheet — always 25 total rows on a single page */}
                        {Array.from({ length: Math.max(0, 25 - (estimateOrder.items?.length || 0)) }).map((_, idx) => (
                            <tr key={`empty-${idx}`} style={{ height: "28px" }}>
                                <td className="border border-black px-2.5 py-0 align-middle text-center"></td>
                                <td className="border border-black px-2.5 py-0 align-middle"></td>
                                <td className="border border-black px-2.5 py-0 align-middle"></td>
                                <td className="border border-black px-2.5 py-0 align-middle"></td>
                                <td className="border border-black px-2.5 py-0 align-middle"></td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold bg-[#f7f7f7] border-t border-black" style={{ height: "32px" }}>
                            <td colSpan={2} className="text-right border border-black px-4 py-0 align-middle font-bold text-[14px]">
                                Grand Total
                            </td>
                            <td className="text-right border border-black px-2.5 py-0 align-middle font-bold text-[14px]">
                                {(estimateOrder.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)}{" "}
                                {estimateOrder.items?.[0]?.product?.uom?.uomName || "Pcs."}
                            </td>
                            <td className="border border-black px-2.5 py-0 align-middle"></td>
                            <td className="border border-black px-2.5 py-0 align-middle"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Authorised Signatory Block */}
            <div className="mt-4 mb-3 flex justify-end px-4">
                <div className="text-right pt-2 min-w-[200px]">
                    <div className="text-[14px] font-semibold text-slate-700 mb-6">for ESTIMATE</div>
                    <div className="font-bold text-[14px] text-slate-900 border-t border-black pt-1">
                        Authorised Signatory
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesOrderEstimateContent;