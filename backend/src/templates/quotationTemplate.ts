export const generateQuotationHtml = (order: any, _company: any): string => {

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const num = (v: any, decimals = 2): string => {
        const x = Number(v ?? 0);
        return x.toLocaleString("en-IN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    };

    const fmtDate = (d: any): string => {
        if (!d) return "—";
        const dt = new Date(d);
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yyyy = dt.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    };

    // ─── Data ─────────────────────────────────────────────────────────────────

    const cust            = order.customer || {};
    const customerName    = (cust.displayName || cust.firmName || "—").toUpperCase();
    const customerCode    = cust.customerCode || cust.id || "—";
    const openingBalance  = Number(cust.openingBalance ?? 0);
    const opBalType       = (cust.openingBalanceType || "CREDIT").toUpperCase() === "DEBIT" ? "Dr" : "Cr";

    const orderNo         = order.orderNo   || "—";
    const orderDate       = fmtDate(order.orderDate);

    const subtotal        = Number(order.subtotal    ?? 0);
    const totalDiscount   = Number(order.totalDiscount ?? 0);
    const discountPct     = Number(order.orderDiscountValue ?? 0);
    const netAmount       = Number(order.netAmount   ?? 0);

    const items: any[]    = order.items   || [];
    const bundleCount     = items.length;

    const isInterState    = Boolean(order.isInterState);

    let totalCgst = Number(order.totalCgst ?? 0);
    let totalSgst = Number(order.totalSgst ?? 0);
    let totalIgst = Number(order.totalIgst ?? 0);

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

    const totalCess = Number(order.totalCess ?? items.reduce((acc: number, it: any) => acc + Number(it.cessAmount || 0), 0));

    const taxableBase = Math.max(0, subtotal - totalDiscount);

    const cgstRates = Array.from(new Set(items.map((it: any) => Number(it.cgstRate || (Number(it.gstRate || 0) / 2) || 0)).filter((r: number) => r > 0)));
    const cgstRateDisplay = cgstRates.length === 1 ? cgstRates[0] : (totalCgst > 0 && taxableBase > 0 ? (totalCgst / taxableBase) * 100 : null);

    const sgstRates = Array.from(new Set(items.map((it: any) => Number(it.sgstRate || (Number(it.gstRate || 0) / 2) || 0)).filter((r: number) => r > 0)));
    const sgstRateDisplay = sgstRates.length === 1 ? sgstRates[0] : (totalSgst > 0 && taxableBase > 0 ? (totalSgst / taxableBase) * 100 : null);

    const igstRates = Array.from(new Set(items.map((it: any) => Number(it.igstRate || it.gstRate || 0)).filter((r: number) => r > 0)));
    const igstRateDisplay = igstRates.length === 1 ? igstRates[0] : (totalIgst > 0 && taxableBase > 0 ? (totalIgst / taxableBase) * 100 : null);

    const isOpBalDebit = opBalType === "Dr";
    const signedOpBalance = isOpBalDebit ? openingBalance : -openingBalance;
    const signedClosing   = signedOpBalance + netAmount;
    const closingRaw      = Math.abs(signedClosing);
    const closingType     = signedClosing >= 0 ? "Dr" : "Cr";

    // ─── Items rows ───────────────────────────────────────────────────────────

    const itemRows = items.map((item: any, idx: number) => {
        const name   = item.product?.productName || `Product #${item.productId}`;
        const qty    = Number(item.quantity  ?? 0);
        const rate   = Number(item.unitPrice ?? 0);
        const amount = Number(item.lineTotal ?? qty * rate);

        return `
            <tr>
                <td style="vertical-align:top;white-space:nowrap;padding-right:6px">${idx + 1}.</td>
                <td style="vertical-align:top;padding-right:8px">${name}</td>
                <td style="text-align:right;vertical-align:top;padding-right:8px">${qty}</td>
                <td style="text-align:right;vertical-align:top;padding-right:8px">${num(rate)}</td>
                <td style="text-align:right;vertical-align:top">${num(amount)}</td>
            </tr>`;
    }).join("");

    // ─── Discount row ─────────────────────────────────────────────────────────

    const discountRow = totalDiscount > 0 ? `
        <tr>
            <td colspan="4" style="text-align:right;padding-right:4px">
                Less : DISCOUNT (-)&nbsp;&nbsp;@&nbsp;&nbsp;${num(discountPct, 2)}&nbsp;&nbsp;%
            </td>
            <td style="text-align:right">${num(totalDiscount)}</td>
        </tr>` : "";

    // ─── GST rows ─────────────────────────────────────────────────────────────

    let gstRows = "";
    if (hasTax) {
        if (isInterState) {
            if (totalIgst > 0) {
                const rateText = igstRateDisplay != null && igstRateDisplay > 0
                    ? `&nbsp;&nbsp;@&nbsp;&nbsp;${num(igstRateDisplay, 2)}&nbsp;&nbsp;%`
                    : "";
                gstRows += `
                <tr>
                    <td colspan="4" style="text-align:right;padding-right:4px">
                        Add : IGST (+)${rateText}
                    </td>
                    <td style="text-align:right">${num(totalIgst)}</td>
                </tr>`;
            }
        } else {
            if (totalCgst > 0) {
                const cgstRateText = cgstRateDisplay != null && cgstRateDisplay > 0
                    ? `&nbsp;&nbsp;@&nbsp;&nbsp;${num(cgstRateDisplay, 2)}&nbsp;&nbsp;%`
                    : "";
                gstRows += `
                <tr>
                    <td colspan="4" style="text-align:right;padding-right:4px">
                        Add : CGST (+)${cgstRateText}
                    </td>
                    <td style="text-align:right">${num(totalCgst)}</td>
                </tr>`;
            }
            if (totalSgst > 0) {
                const sgstRateText = sgstRateDisplay != null && sgstRateDisplay > 0
                    ? `&nbsp;&nbsp;@&nbsp;&nbsp;${num(sgstRateDisplay, 2)}&nbsp;&nbsp;%`
                    : "";
                gstRows += `
                <tr>
                    <td colspan="4" style="text-align:right;padding-right:4px">
                        Add : SGST (+)${sgstRateText}
                    </td>
                    <td style="text-align:right">${num(totalSgst)}</td>
                </tr>`;
            }
        }
    }

    if (totalCess > 0) {
        gstRows += `
        <tr>
            <td colspan="4" style="text-align:right;padding-right:4px">
                Add : CESS (+)
            </td>
            <td style="text-align:right">${num(totalCess)}</td>
        </tr>`;
    }

    // ─── HTML ─────────────────────────────────────────────────────────────────

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    line-height: 1.75;
    color: #000;
    background: #fff;
    padding: 40px 48px;
  }
  .title {
    text-align: center;
    letter-spacing: 10px;
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 16px;
  }
  .sep {
    border: none;
    border-top: 1px dashed #000;
    margin: 5px 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.items col.sn         { width: 36px; }
  table.items col.particulars{ }
  table.items col.pcs        { width: 60px; }
  table.items col.rate       { width: 84px; }
  table.items col.amount     { width: 100px; }
  table.items th {
    font-weight: bold;
    padding-bottom: 2px;
  }
  .short-sep {
    border-top: 1px solid #000;
  }
</style>
</head>
<body>

  <!-- Title -->
  <div class="title">E s t i m a t e</div>

  <!-- D.No. / Op.Balance -->
  <div class="row">
    <span>D. No.&nbsp;&nbsp;: ${customerCode}</span>
    <span>Op. Balance :&nbsp;&nbsp;<strong>${num(openingBalance)}</strong>&nbsp;${opBalType}</span>
  </div>
  <hr class="sep">

  <!-- To / No. / Date -->
  <div class="row">
    <span>To :</span>
    <span>No.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${orderNo}</span>
  </div>
  <div class="row">
    <strong>${customerName}</strong>
    <span>Date&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${orderDate}</span>
  </div>
  <hr class="sep">

  <!-- Items table -->
  <table class="items">
    <colgroup>
      <col class="sn">
      <col class="particulars">
      <col class="pcs">
      <col class="rate">
      <col class="amount">
    </colgroup>
    <thead>
      <tr>
        <th style="text-align:left">S.N.</th>
        <th style="text-align:left">Particulars</th>
        <th style="text-align:right">Pcs.</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amount</th>
      </tr>
      <tr><td colspan="5" style="padding:0"><hr class="sep" style="margin:3px 0"></td></tr>
    </thead>
    <tbody>
      <tr><td colspan="5" style="height:8px"></td></tr>
      ${itemRows}
      <tr><td colspan="5" style="height:8px"></td></tr>
    </tbody>
    <tfoot>
      <!-- Sub Total -->
      <tr>
        <td colspan="4" style="text-align:right;padding-right:4px">Sub Total</td>
        <td class="short-sep" style="text-align:right;font-weight:bold">${num(subtotal)}</td>
      </tr>

      <!-- Discount -->
      ${discountRow}

      <!-- GST / Tax breakdown -->
      ${gstRows}

      <!-- Grand Total -->
      <tr>
        <td colspan="4" style="text-align:right;padding-right:4px;padding-top:2px">
          <strong>Grand Total</strong>
        </td>
        <td style="text-align:right;font-weight:bold;
                   border-top:1px solid #000;
                   border-bottom:1px solid #000">
          ${num(netAmount)}
        </td>
      </tr>
    </tfoot>
  </table>

  <hr class="sep" style="margin-top:10px">

  <!-- Footer -->
  <div class="row">
    <span>No. Of Bundles : ${bundleCount}</span>
    <span>Closing Balance :&nbsp;&nbsp;<strong>${num(closingRaw)}</strong>&nbsp;${closingType}</span>
  </div>

</body>
</html>`;
};
