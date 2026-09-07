import React from "react";
import type { Company } from "../../features/company/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeliveryItem {
    id: string | number;
    productId?: string | number;
    product?: { productName?: string; productCode?: string };
    quantity: number | string;
    unit?: string;
    remarks?: string;
}

interface DeliveryCustomer {
    displayName?: string;
    firmName?: string;
    phone?: string;
    mobile?: { label: string; number: string }[] | string;
    gstin?: string;
    billingAddressLine1?: string;
    billingAddressLine2?: string;
    billingCity?: string;
    billingState?: string;
    billingPincode?: string;
}

interface SalesOrderDeliveryEstimateProps {
    order: {
        orderNo?: string;
        orderDate?: string | Date;
        customer?: DeliveryCustomer;
        items?: DeliveryItem[];
        remarks?: string;
        internalNotes?: string;
        notes?: string;
        dispatchType?: string;
        salesPersonName?: string | null;
        referenceText?: string | null;
        shippingAddressLine1?: string;
        shippingCity?: string;
        shippingState?: string;
        shippingPincode?: string;
        billingAddressLine1?: string;
        billingCity?: string;
        billingState?: string;
        billingPincode?: string;
    };
    company?: Company | null;
    formatDate: (d: any) => string;
    /** When true, the Remarks column renders editable inputs */
    isEditable?: boolean;
    /** Controlled remarks values keyed by item id */
    itemRemarks?: Record<string | number, string>;
    /** Called when user edits a remark */
    onItemRemarksChange?: (itemId: string | number, value: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SalesOrderDeliveryEstimate: React.FC<SalesOrderDeliveryEstimateProps> = ({
    order,
    formatDate,
    isEditable = false,
    itemRemarks = {},
    onItemRemarksChange,
}) => {
    const cust = (order.customer || {}) as DeliveryCustomer;

    const customerName = cust.displayName || cust.firmName || "—";

    // Customer phone
    const customerPhone = (() => {
        if (Array.isArray(cust.mobile) && cust.mobile.length > 0) return cust.mobile[0].number;
        if (typeof cust.mobile === "string" && cust.mobile) return cust.mobile;
        return cust.phone || "";
    })();

    // Address parts
    const addrParts = [cust.billingAddressLine1, cust.billingAddressLine2].filter(
        Boolean
    ) as string[];
    const addrCity = [cust.billingCity, cust.billingState, cust.billingPincode]
        .filter(Boolean)
        .join(", ");

    const orderNo   = order.orderNo   || "—";
    const orderDate = formatDate(order.orderDate);

    const items: DeliveryItem[] = order.items || [];
    const totalPcs = items.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0);

    // Notes text
    const notesText = order.notes || order.remarks || order.internalNotes || "";

    // Enough filler rows to fill A4 height naturally without spilling over
    const MIN_ROWS    = 14;
    const fillerCount = Math.max(0, MIN_ROWS - items.length);

    // ─── Shared styles ────────────────────────────────────────────────────────
    const cell: React.CSSProperties = {
        border:        "1px solid #000",
        padding:       "3px 6px",
        verticalAlign: "middle",
        fontSize:      "12px",
        lineHeight:    "1.3",
    };

    const head: React.CSSProperties = {
        border:     "1px solid #000",
        padding:    "4px 6px",
        fontWeight: "bold",
        textAlign:  "center",
        background: "#fff",
        fontSize:   "11px",
    };

    return (
        /*
         * Outer wrapper: thin border, A4 single-page flow, flex column.
         * Padding (10px sides) gives clean inner margin.
         */
        <div
            style={{
                fontFamily:       "Arial, Helvetica, sans-serif",
                fontSize:         "12px",
                lineHeight:       "1.35",
                color:            "#000",
                background:       "#fff",
                border:           "1px solid #000",
                padding:          "0 10px",
                width:            "100%",
                boxSizing:        "border-box",
                display:          "flex",
                flexDirection:    "column",
                pageBreakInside:  "avoid",
                breakInside:      "avoid",
            }}
        >

            {/* ── Title ── */}
            <div
                style={{
                    textAlign:    "center",
                    padding:      "8px 0 6px",
                    borderBottom: "1px solid #000",
                }}
            >
                <div style={{ fontSize: "12px", fontWeight: "bold" }}>Sales Order</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", letterSpacing: "2px" }}>
                    ESTIMATE
                </div>
            </div>

            {/* ── Party Details + Order Meta ── */}
            <div style={{ display: "flex", borderBottom: "1px solid #000", minHeight: "85px" }}>

                {/* Left — customer */}
                <div style={{ flex: 1, padding: "8px 4px 8px 0" }}>
                    <div style={{ fontStyle: "italic", fontWeight: "bold", marginBottom: "2px", fontSize: "11px" }}>
                        Party Details :
                    </div>
                    <div style={{ fontWeight: "bold", fontSize: "13px" }}>
                        {customerName.toUpperCase()}
                    </div>
                    {addrParts.map((line, i) => (
                        <div key={i} style={{ fontSize: "11px" }}>{line}</div>
                    ))}
                    {addrCity && <div style={{ fontSize: "11px" }}>{addrCity}</div>}
                    {customerPhone && <div style={{ fontSize: "11px" }}>Ph: {customerPhone}</div>}
                    {cust.gstin    && <div style={{ fontSize: "11px" }}>GSTIN: {cust.gstin}</div>}
                </div>

                {/* Vertical divider */}
                <div style={{ width: "1px", background: "#000", flexShrink: 0 }} />

                {/* Right — order meta */}
                <div style={{ minWidth: "210px", padding: "8px 0 8px 12px" }}>
                    {(
                        [
                            ["Order No.", orderNo],
                            ["Dated",     orderDate],
                            ...(order.dispatchType    ? [["Dispatch", order.dispatchType]]    : []),
                            ...(order.salesPersonName ? [["Sales By", order.salesPersonName]] : []),
                            ...(order.referenceText   ? [["Ref.",     order.referenceText]]   : []),
                        ] as [string, string][]
                    ).map(([key, val], i) => (
                        <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "2px" }}>
                            <span style={{ minWidth: "68px", fontSize: "11px" }}>{key}</span>
                            <span>:</span>
                            <strong style={{ fontSize: "11px" }}>{val}</strong>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Intro line ── */}
            <div
                style={{
                    padding:      "4px 0",
                    fontSize:     "11px",
                    fontStyle:    "italic",
                    borderBottom: "1px solid #000",
                }}
            >
                We are pleased to receive the order for the following items :
            </div>

            {/* ── Table Section ── */}
            <div style={{ width: "100%" }}>
                <table
                    style={{
                        width:          "100%",
                        borderCollapse: "collapse",
                        tableLayout:    "fixed",
                    }}
                >
                    <colgroup>
                        <col style={{ width: "42px"  }} />
                        <col />
                        <col style={{ width: "65px"  }} />
                        <col style={{ width: "55px"  }} />
                        <col style={{ width: "150px" }} />
                    </colgroup>

                    <thead>
                        <tr>
                            <th style={{ ...head }}>S.N.</th>
                            <th style={{ ...head, textAlign: "left" }}>Description of Goods</th>
                            <th style={{ ...head }}>Qty.</th>
                            <th style={{ ...head }}>Unit</th>
                            <th style={{ ...head, textAlign: "left" }}>Remarks</th>
                        </tr>
                    </thead>

                    <tbody>
                        {/* Item rows */}
                        {items.map((item, idx) => {
                            const remarkValue =
                                itemRemarks[item.id] !== undefined
                                    ? itemRemarks[item.id]
                                    : item.remarks || "";
                            return (
                                <tr key={item.id} style={{ height: "24px" }}>
                                    <td style={{ ...cell, textAlign: "center" }}>{idx + 1}.</td>
                                    <td style={{ ...cell }}>
                                        {item.product?.productName || `Product #${item.productId}`}
                                    </td>
                                    <td style={{ ...cell, textAlign: "center" }}>
                                        {Number(item.quantity ?? 0)}
                                    </td>
                                    <td style={{ ...cell, textAlign: "center" }}>
                                        {item.unit || "Pcs."}
                                    </td>
                                    <td style={{ ...cell, padding: isEditable ? "0 4px" : "3px 6px" }}>
                                        {isEditable ? (
                                            <input
                                                type="text"
                                                value={remarkValue}
                                                onChange={(e) =>
                                                    onItemRemarksChange?.(item.id, e.target.value)
                                                }
                                                style={{
                                                    width:      "100%",
                                                    border:     "none",
                                                    outline:    "none",
                                                    background: "transparent",
                                                    fontSize:   "11px",
                                                    padding:    "2px 4px",
                                                    color:      "#000",
                                                    fontFamily: "Arial, Helvetica, sans-serif",
                                                }}
                                                placeholder="Type remark..."
                                            />
                                        ) : (
                                            remarkValue
                                        )}
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Filler rows — naturally fills clean single-page height */}
                        {Array.from({ length: fillerCount }).map((_, i) => (
                            <tr key={`pad-${i}`} style={{ height: "24px" }}>
                                <td style={{ ...cell }}>&nbsp;</td>
                                <td style={{ ...cell }}>&nbsp;</td>
                                <td style={{ ...cell }}>&nbsp;</td>
                                <td style={{ ...cell }}>&nbsp;</td>
                                <td style={{ ...cell }}>&nbsp;</td>
                            </tr>
                        ))}

                        {/* Notes row — always visible */}
                        <tr style={{ height: "28px" }}>
                            <td
                                colSpan={5}
                                style={{
                                    ...cell,
                                    padding:       "4px 6px",
                                    fontSize:      "11px",
                                    verticalAlign: "top",
                                }}
                            >
                                <span style={{ fontWeight: "bold" }}>Notes: </span>
                                {notesText}
                            </td>
                        </tr>
                    </tbody>

                    <tfoot>
                        <tr style={{ height: "26px" }}>
                            <td
                                colSpan={2}
                                style={{
                                    ...cell,
                                    textAlign:    "right",
                                    fontWeight:   "bold",
                                    paddingRight: "10px",
                                    fontSize:     "11px",
                                }}
                            >
                                Grand Total
                            </td>
                            <td style={{ ...cell, textAlign: "center", fontWeight: "bold", fontSize: "11px" }}>
                                {totalPcs}
                            </td>
                            <td style={{ ...cell, textAlign: "center", fontWeight: "bold", fontSize: "11px" }}>
                                Pcs.
                            </td>
                            <td style={{ ...cell }} />
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* ── Footer ── */}
            <div
                style={{
                    display:        "flex",
                    justifyContent: "space-between",
                    alignItems:     "flex-end",
                    padding:        "10px 0 8px",
                    borderTop:      "1px solid #000",
                    marginTop:      "auto",
                }}
            >
                <div style={{ fontSize: "10px", color: "#555" }}>
                    This is a computer-generated estimate.
                </div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "26px", fontSize: "11px" }}>for ESTIMATE</div>
                    <div
                        style={{
                            borderTop:  "1px solid #000",
                            paddingTop: "3px",
                            minWidth:   "150px",
                            textAlign:  "center",
                            fontWeight: "bold",
                            fontSize:   "11px",
                        }}
                    >
                        Authorised Signatory
                    </div>
                </div>
            </div>

        </div>
    );
};

export default SalesOrderDeliveryEstimate;
