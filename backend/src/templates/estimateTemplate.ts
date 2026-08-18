/**
 * Estimate template — matches the exact monospace/plain-text style PDF.
 * Layout: E s t i m a t e header, dashed separators, fixed-width columns.
 * D.No, Op.Balance, To, No., Date, Items, Sub Total, Discount, Grand Total, Closing Balance.
 */
export const generateEstimateHtml = (order: any, company: any): string => {
    // ── helpers ────────────────────────────────────────────────────────────────
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    /** Format a number with Indian grouping, 2 decimal places */
    const fmt = (n: number | undefined | null) =>
        (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    /** Right-pad a string to length (truncate if longer) */
    const rpad = (s: string, len: number) => {
        const str = String(s ?? "");
        return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
    };

    /** Left-pad (right-align) a string to length */
    const lpad = (s: string, len: number) => {
        const str = String(s ?? "");
        return str.length >= len ? str.slice(0, len) : " ".repeat(len - str.length) + str;
    };

    // ── data ───────────────────────────────────────────────────────────────────
    const customerName = order.customer?.displayName || order.customer?.firmName || "N/A";
    const opBalance    = Number(order.customer?.openingBalance ?? 0);
    const opBalType    = (order.customer?.openingBalanceType as string) || "Cr";

    let subTotal = 0;
    const itemLines: string[] = [];

    (order.items ?? []).forEach((item: any, idx: number) => {
        // Estimated orders store rate in `estimatedRate`; GST orders use `unitPrice`
        const rate      = Number(item.estimatedRate ?? item.unitPrice ?? 0);
        const qty       = Number(item.quantity ?? 0);
        // Use decrypted lineTotal when available, otherwise compute
        const amount    = item.lineTotal != null ? Number(item.lineTotal) : qty * rate;
        subTotal       += amount;

        // columns: sn(4), particulars(35), pcs(6), rate(7), amount(10)
        const sn      = rpad(`${idx + 1}.`, 4);
        const name    = rpad(item.product?.productName || "N/A", 35);
        const qtyStr  = lpad(String(qty), 6);
        const rateStr = lpad(fmt(rate), 7);
        const amtStr  = lpad(fmt(amount), 10);

        itemLines.push(`  ${sn}${name}${qtyStr}  ${rateStr}  ${amtStr}`);
    });

    // For estimated orders: subtotal comes from decrypted a9 (more accurate than recomputing)
    const orderSubTotal = order.subtotal != null ? Number(order.subtotal) : subTotal;
    const usedSubTotal  = orderSubTotal > 0 ? orderSubTotal : subTotal;

    const grandTotal    = order.netAmount != null ? Number(order.netAmount) : usedSubTotal;
    // discount = subtotal - grandTotal (estimated orders have no tax in the estimate view)
    const discountAmt   = Number(order.totalDiscount ?? Math.max(0, usedSubTotal - grandTotal));
    const discountPct   = usedSubTotal > 0 ? (discountAmt / usedSubTotal) * 100 : 0;

    // Reuse usedSubTotal as the displayed sub total
    subTotal = usedSubTotal;
    const closingBal = opBalType === "Cr"
        ? opBalance - grandTotal
        : opBalance + grandTotal;
    const closingType = opBalType; // keep same type label

    // ── date formatted as dd-mm-yyyy ───────────────────────────────────────────
    const dateStr = formatDate(order.orderDate);

    // ── line width ─────────────────────────────────────────────────────────────
    const DASH68 = "-".repeat(68);
    const DASH13 = "-".repeat(13);

    // ── discount line ──────────────────────────────────────────────────────────
    const discountLine = discountAmt > 0
        ? `           Less : DISCOUNT (-)    @   ${lpad(fmt(discountPct), 5)} %   ${lpad(fmt(discountAmt), 10)}`
        : "";

    // ── build rows ─────────────────────────────────────────────────────────────
    const opBalStr      = opBalance > 0 ? `${fmt(opBalance)} ${opBalType}` : "";
    const closingBalStr = opBalance > 0 ? `${fmt(Math.abs(closingBal))} ${closingType}` : "";

    const headerLine    = opBalance > 0
        ? `D. No.   : ${order.id}${" ".repeat(Math.max(1, 38 - String(order.id).length))}Op. Balance :   ${lpad(opBalStr, 14)}`
        : `D. No.   : ${order.id}`;

    const lines = [
        "",
        headerLine,
        DASH68,
        `To :${" ".repeat(24)}No.         : ${order.orderNo}`,
        `${customerName}${" ".repeat(Math.max(1, 28 - customerName.length))}Date        : ${dateStr}`,
        DASH68,
        `${"S.N.".padEnd(4)}  ${"Particulars".padEnd(35)}${"Pcs.".padStart(6)}  ${"Rate".padStart(7)}  ${"Amount".padStart(10)}`,
        DASH68,
        "",
        ...itemLines,
        "",
        `${" ".repeat(47)}${DASH13}`,
        `${" ".repeat(30)}Sub Total      ${lpad(fmt(subTotal), 13)}`,
        ...(discountAmt > 0 ? [discountLine] : []),
        `${" ".repeat(47)}${DASH13}`,
        `${" ".repeat(30)}Grand Total    ${lpad(fmt(grandTotal), 13)}`,
        DASH68,
        opBalance > 0
            ? `No. Of Bundles : 1${" ".repeat(16)}Closing Balance :   ${lpad(closingBalStr, 14)}`
            : `No. Of Bundles : 1`,
    ];

    const body = lines.join("\n");

    const companyBlock = company?.companyName ? `
<div style="text-align:center;margin-bottom:10px;font-size:13px;line-height:1.7;">
  <div style="font-size:16px;font-weight:bold;">${company.companyName}</div>
  ${[company.addressLine1, company.city, company.state, company.zipcode].filter(Boolean).join(", ")}
  ${company.phone ? `<br/>Ph: ${company.phone}` : ""}
  ${company.gstin ? `<br/>GSTIN: ${company.gstin}` : ""}
</div>` : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Courier New", Courier, monospace;
    font-size: 13px;
    color: #000;
    background: #fff;
    padding: 32px 36px;
  }
  .page { max-width: 750px; margin: auto; }
  .title {
    text-align: center;
    font-size: 17px;
    letter-spacing: 6px;
    font-weight: bold;
    margin-bottom: 12px;
  }
  pre {
    font-family: "Courier New", Courier, monospace;
    font-size: 13px;
    white-space: pre;
    color: #000;
    line-height: 1.55;
  }
  .grand {
    /* bold the Grand Total line via JS injection below */
  }
</style>
</head>
<body>
<div class="page">
  ${companyBlock}
  <div class="title">E s t i m a t e</div>
  <pre id="body"></pre>
</div>
<script>
  const raw = ${JSON.stringify(body)};
  const el  = document.getElementById("body");
  // Bold the Grand Total line
  const lines = raw.split("\\n").map(l => {
    if (l.includes("Grand Total")) {
      return "<strong>" + l.replace(/</g,"&lt;") + "</strong>";
    }
    return l.replace(/</g,"&lt;");
  });
  el.innerHTML = lines.join("\\n");
</script>
</body>
</html>`;
};
