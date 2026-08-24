import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EstimateItem {
    id: string | number;
    productId?: string | number;
    product?: {
        id?: string | number;
        productName?: string;
        productCode?: string;
    };
    quantity: number | string;
    unitPrice?: number | string | null;
    lineTotal?: number | string | null;
}

interface EstimateCustomer {
    id?: string | number;
    displayName?: string;
    firmName?: string;
    customerCode?: string;
    openingBalance?: number | string | null;
    openingBalanceType?: string | null; // "CREDIT" | "DEBIT"
}

interface SalesOrderEstimateContentProps {
    estimateOrder: {
        id?: number;
        orderNo?: string;
        orderDate?: string | Date;
        customer?: EstimateCustomer;
        items?: EstimateItem[];
        subtotal?: number | string | null;
        totalDiscount?: number | string | null;
        orderDiscountValue?: number | string | null;
        orderDiscountType?: string | null;
        netAmount?: number | string | null;
        // kept for backwards compat — unused in new layout
        billingAddressLine1?: string;
        billingCity?: string;
        billingState?: string;
        billingPincode?: string;
    };
    formatDate: (dateStr: any) => string;
    /** unused in new layout — kept for interface compatibility */
    onItemRemarksChange?: (itemId: string | number, remarks: string) => void;
    isEditable?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (val: any, decimals = 2) =>
    Number(val ?? 0).toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

const SEPARATOR = "─".repeat(70);
const SHORT_SEP = "─".repeat(18);

// ─── Component ────────────────────────────────────────────────────────────────

export const SalesOrderEstimateContent: React.FC<SalesOrderEstimateContentProps> = ({
    estimateOrder,
    formatDate,
}) => {
    const cust = estimateOrder.customer as any;
    const customerName = cust?.displayName || cust?.firmName || "—";
    const customerCode = cust?.customerCode || cust?.id || "—";
    const openingBalance = Number(cust?.openingBalance ?? 0);
    const openingBalanceType = (cust?.openingBalanceType || "CREDIT").toUpperCase();

    const orderNo = estimateOrder.orderNo || "—";
    const orderDate = formatDate(estimateOrder.orderDate);

    const items: EstimateItem[] = estimateOrder.items || [];
    const subtotal = Number(estimateOrder.subtotal ?? 0);
    const totalDiscount = Number(estimateOrder.totalDiscount ?? 0);
    const discountPct = Number(estimateOrder.orderDiscountValue ?? 0);
    const netAmount = Number(estimateOrder.netAmount ?? 0);

    const isInterState = Boolean((estimateOrder as any).isInterState);

    let totalCgst = Number((estimateOrder as any).totalCgst ?? 0);
    let totalSgst = Number((estimateOrder as any).totalSgst ?? 0);
    let totalIgst = Number((estimateOrder as any).totalIgst ?? 0);

    if (totalCgst === 0 && totalSgst === 0 && totalIgst === 0) {
        items.forEach((it: any) => {
            const itemCgst = Number(it.cgstAmount ?? 0);
            const itemSgst = Number(it.sgstAmount ?? 0);
            const itemIgst = Number(it.igstAmount ?? 0);
            const itemGst = Number(it.gstAmount ?? 0);

            if (itemCgst > 0 || itemSgst > 0 || itemIgst > 0) {
                totalCgst += itemCgst;
                totalSgst += itemSgst;
                totalIgst += itemIgst;
            } else if (itemGst > 0) {
                if (isInterState) {
                    totalIgst += itemGst;
                } else {
                    totalCgst += itemGst / 2;
                    totalSgst += itemGst / 2;
                }
            }
        });
    }

    const taxDiff = netAmount - (subtotal - totalDiscount);
    if (totalCgst === 0 && totalSgst === 0 && totalIgst === 0 && taxDiff > 0.009) {
        if (isInterState) {
            totalIgst = taxDiff;
        } else {
            totalCgst = taxDiff / 2;
            totalSgst = taxDiff / 2;
        }
    }

    const totalTax = totalCgst + totalSgst + totalIgst;
    const hasTax = totalTax > 0.009;

    const totalCess = Number((estimateOrder as any).totalCess ?? items.reduce((acc: number, it: any) => acc + Number(it.cessAmount || 0), 0));

    const taxableBase = Math.max(0, subtotal - totalDiscount);

    const cgstRates = Array.from(new Set(items.map((it: any) => Number(it.cgstRate || (Number(it.gstRate || 0) / 2) || 0)).filter((r: number) => r > 0)));
    const cgstRateDisplay = cgstRates.length === 1 ? cgstRates[0] : (totalCgst > 0 && taxableBase > 0 ? (totalCgst / taxableBase) * 100 : null);

    const sgstRates = Array.from(new Set(items.map((it: any) => Number(it.sgstRate || (Number(it.gstRate || 0) / 2) || 0)).filter((r: number) => r > 0)));
    const sgstRateDisplay = sgstRates.length === 1 ? sgstRates[0] : (totalSgst > 0 && taxableBase > 0 ? (totalSgst / taxableBase) * 100 : null);

    const igstRates = Array.from(new Set(items.map((it: any) => Number(it.igstRate || it.gstRate || 0)).filter((r: number) => r > 0)));
    const igstRateDisplay = igstRates.length === 1 ? igstRates[0] : (totalIgst > 0 && taxableBase > 0 ? (totalIgst / taxableBase) * 100 : null);

    const isOpBalDebit = openingBalanceType === "DEBIT" || openingBalanceType === "DR";
    const signedOpBalance = isOpBalDebit ? openingBalance : -openingBalance;
    const signedClosing = signedOpBalance + netAmount;
    const closingBalance = Math.abs(signedClosing);
    const closingBalanceType = signedClosing >= 0 ? "Dr" : "Cr";

    const bundleCount = items.length;

    // ─── Styles ───────────────────────────────────────────────────────────
    const wrap: React.CSSProperties = {
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "13px",
        lineHeight: "1.7",
        color: "#000",
        background: "#fff",
        padding: "28px 32px",
        width: "100%",
        boxSizing: "border-box",
    };
    const row: React.CSSProperties = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
    };
    const sep: React.CSSProperties = {
        borderTop: "1px dashed #000",
        margin: "4px 0",
    };
    const th: React.CSSProperties = {
        fontWeight: "bold",
        paddingBottom: "2px",
    };
    const rightAlign: React.CSSProperties = { textAlign: "right" };

    return (
        <div style={wrap}>
            {/* ── Title ── */}
            <div style={{ textAlign: "center", letterSpacing: "8px", fontWeight: "bold", fontSize: "15px", marginBottom: "14px" }}>
                E s t i m a t e
            </div>

            {/* ── D.No. / Op.Balance ── */}
            <div style={row}>
                <span>D. No.&nbsp;&nbsp;: {customerCode}</span>
                <span>
                    Op. Balance :&nbsp;&nbsp;
                    <strong>{n(openingBalance)}</strong>&nbsp;{openingBalanceType === "DEBIT" ? "Dr" : "Cr"}
                </span>
            </div>

            <div style={sep} />

            {/* ── To / No. / Date ── */}
            <div style={row}>
                <span>To :</span>
                <span>No.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {orderNo}</span>
            </div>
            <div style={row}>
                <strong>{customerName}</strong>
                <span>Date&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {orderDate}</span>
            </div>

            <div style={sep} />

            {/* ── Column Headers ── */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "4px" }}>
                <colgroup>
                    <col style={{ width: "40px" }} />
                    <col />
                    <col style={{ width: "68px" }} />
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "100px" }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={{ ...th, textAlign: "left" }}>S.N.</th>
                        <th style={{ ...th, textAlign: "left" }}>Particulars</th>
                        <th style={{ ...th, textAlign: "right" }}>Pcs.</th>
                        <th style={{ ...th, textAlign: "right" }}>Rate</th>
                        <th style={{ ...th, textAlign: "right" }}>Amount</th>
                    </tr>
                    <tr>
                        <td colSpan={5} style={{ padding: 0 }}><div style={sep} /></td>
                    </tr>
                </thead>

                <tbody>
                    {/* empty spacer row */}
                    <tr><td colSpan={5} style={{ height: "6px" }} /></tr>

                    {items.map((item, idx) => {
                        const qty = Number(item.quantity ?? 0);
                        const rate = Number(item.unitPrice ?? 0);
                        const amount = Number(item.lineTotal ?? qty * rate);
                        const name = item.product?.productName || `Product #${item.productId}`;

                        return (
                            <tr key={item.id}>
                                <td style={{ verticalAlign: "top" }}>{idx + 1}.</td>
                                <td style={{ paddingLeft: "2px" }}>{name}</td>
                                <td style={{ ...rightAlign }}>{qty}</td>
                                <td style={{ ...rightAlign }}>{n(rate)}</td>
                                <td style={{ ...rightAlign }}>{n(amount)}</td>
                            </tr>
                        );
                    })}

                    {/* empty spacer row */}
                    <tr><td colSpan={5} style={{ height: "6px" }} /></tr>

                    {/* ── Sub Total ── */}
                    <tr>
                        <td colSpan={4} style={{ ...rightAlign, paddingRight: "4px" }}>
                            <span style={{ paddingRight: "8px" }}>Sub Total</span>
                        </td>
                        <td style={{ borderTop: "1px solid #000", ...rightAlign, fontWeight: "bold" }}>
                            {n(subtotal)}
                        </td>
                    </tr>

                    {/* ── Discount ── */}
                    {totalDiscount > 0 && (
                        <tr>
                            <td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>
                                <span>Less : DISCOUNT (-)</span>
                                {discountPct > 0 && (
                                    <span>&nbsp;&nbsp;@&nbsp;&nbsp;{n(discountPct, 2)}&nbsp;&nbsp;%</span>
                                )}
                            </td>
                            <td style={{ ...rightAlign }}>{n(totalDiscount)}</td>
                        </tr>
                    )}

                    {/* ── GST Calculations (Only shown if GST > 0) ── */}
                    {hasTax && (
                        isInterState ? (
                            totalIgst > 0 && (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>
                                        <span>Add : IGST (+)</span>
                                        {igstRateDisplay != null && igstRateDisplay > 0 && (
                                            <span>&nbsp;&nbsp;@&nbsp;&nbsp;{n(igstRateDisplay, 2)}&nbsp;&nbsp;%</span>
                                        )}
                                    </td>
                                    <td style={{ ...rightAlign }}>{n(totalIgst)}</td>
                                </tr>
                            )
                        ) : (
                            <>
                                {totalCgst > 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>
                                            <span>Add : CGST (+)</span>
                                            {cgstRateDisplay != null && cgstRateDisplay > 0 && (
                                                <span>&nbsp;&nbsp;@&nbsp;&nbsp;{n(cgstRateDisplay, 2)}&nbsp;&nbsp;%</span>
                                            )}
                                        </td>
                                        <td style={{ ...rightAlign }}>{n(totalCgst)}</td>
                                    </tr>
                                )}
                                {totalSgst > 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>
                                            <span>Add : SGST (+)</span>
                                            {sgstRateDisplay != null && sgstRateDisplay > 0 && (
                                                <span>&nbsp;&nbsp;@&nbsp;&nbsp;{n(sgstRateDisplay, 2)}&nbsp;&nbsp;%</span>
                                            )}
                                        </td>
                                        <td style={{ ...rightAlign }}>{n(totalSgst)}</td>
                                    </tr>
                                )}
                            </>
                        )
                    )}

                    {/* ── CESS (if any) ── */}
                    {totalCess > 0 && (
                        <tr>
                            <td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>
                                <span>Add : CESS (+)</span>
                            </td>
                            <td style={{ ...rightAlign }}>{n(totalCess)}</td>
                        </tr>
                    )}

                    {/* ── Additional Charges / Deductions ── */}
                    {(() => {
                        const ch = (estimateOrder as any).__charges__ || {};
                        const lf  = Number(ch.lorryFreight  || 0);
                        const op  = Number(ch.othersPlus    || 0);
                        const om  = Number(ch.othersMinus   || 0);
                        const rop = Number(ch.roundOffPlus  || 0);
                        const rom = Number(ch.roundOffMinus || 0);
                        const td  = Number(ch.tds           || 0);
                        return (
                            <>
                                {lf  > 0 && <tr><td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>Add : Lorry Freight (+)</td><td style={{ ...rightAlign }}>{n(lf)}</td></tr>}
                                {op  > 0 && <tr><td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>Add : Others (+)</td><td style={{ ...rightAlign }}>{n(op)}</td></tr>}
                                {om  > 0 && <tr><td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>Less : Others (-)</td><td style={{ ...rightAlign }}>({n(om)})</td></tr>}
                                {rop > 0 && <tr><td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>Add : Round Off (+)</td><td style={{ ...rightAlign }}>{n(rop)}</td></tr>}
                                {rom > 0 && <tr><td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>Less : Round Off (-)</td><td style={{ ...rightAlign }}>({n(rom)})</td></tr>}
                                {td  > 0 && <tr><td colSpan={4} style={{ textAlign: "right", paddingRight: "4px" }}>Less : TDS on Pymt./Purc. (-)</td><td style={{ ...rightAlign }}>({n(td)})</td></tr>}
                            </>
                        );
                    })()}

                    {/* ── Grand Total ── */}
                    <tr>
                        <td colSpan={4} style={{ ...rightAlign, paddingRight: "4px", paddingTop: "2px" }}>
                            <strong>Grand Total</strong>
                        </td>
                        <td style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", ...rightAlign, fontWeight: "bold" }}>
                            {n(netAmount)}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div style={{ ...sep, marginTop: "10px" }} />

            {/* ── Footer ── */}
            <div style={row}>
                <span>No. Of Bundles : {bundleCount}</span>
                <span>
                    Closing Balance :&nbsp;&nbsp;
                    <strong>{n(closingBalance)}</strong>&nbsp;{closingBalanceType}
                </span>
            </div>
        </div>
    );
};

export default SalesOrderEstimateContent;
