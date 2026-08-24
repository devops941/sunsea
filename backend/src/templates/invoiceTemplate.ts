export const generateInvoiceHtml = (invoice: any, company: any): string => {
    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatMoney = (amount: number | null | undefined) => {
        if (amount == null) return "0.00";
        return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const numberToWords = (num: number): string => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        if (num === 0) return 'Zero';
        if (num < 0) return 'Minus ' + numberToWords(Math.abs(num));

        let str = '';
        if (num >= 10000000) {
            str += numberToWords(Math.floor(num / 10000000)) + 'Crore ';
            num %= 10000000;
        }
        if (num >= 100000) {
            str += numberToWords(Math.floor(num / 100000)) + 'Lakh ';
            num %= 100000;
        }
        if (num >= 1000) {
            str += numberToWords(Math.floor(num / 1000)) + 'Thousand ';
            num %= 1000;
        }
        if (num >= 100) {
            str += numberToWords(Math.floor(num / 100)) + 'Hundred ';
            num %= 100;
        }
        if (num > 0) {
            if (str !== '') str += 'and ';
            if (num < 20) {
                str += a[num];
            } else {
                str += b[Math.floor(num / 10)] + ' ';
                if (num % 10 > 0) {
                    str += a[num % 10];
                }
            }
        }
        return str.trim() + ' Only';
    };

    const customerState: string = invoice.customer?.addresses?.[0]?.address?.state || '';
    const isInterState = customerState && company?.state && customerState !== company.state;

    // ── Parse additional charges from narration ───────────────────────────────
    const CHARGE_META: Record<string, { label: string; sign: 1 | -1 }> = {
        LORRY_FREIGHT:       { label: 'Lorry Freight',               sign:  1 },
        LORRY_FREIGHT_MINUS: { label: 'Lorry Freight',               sign: -1 },
        OTHERS_PLUS:         { label: 'Others',                      sign:  1 },
        OTHERS_MINUS:        { label: 'Others',                      sign: -1 },
        ROUND_OFF_PLUS:      { label: 'Round Off',                   sign:  1 },
        ROUND_OFF_MINUS:     { label: 'Round Off',                   sign: -1 },
        TDS:                 { label: 'TDS on Pymt./Purc. of Goods', sign: -1 },
    };

    let chargeRows: { label: string; sign: 1 | -1; amount: number }[] = [];
    try {
        const raw = invoice.narration || '';
        if (raw.startsWith('{')) {
            const parsed = JSON.parse(raw);
            if (parsed?.__chargeRows__) {
                chargeRows = (parsed.__chargeRows__ as { type: string; amount: number }[])
                    .filter(r => Number(r.amount) > 0)
                    .map(r => ({
                        label: CHARGE_META[r.type]?.label || r.type,
                        sign:  CHARGE_META[r.type]?.sign  ?? 1,
                        amount: Number(r.amount),
                    }));
            }
        }
    } catch { /* ignore bad JSON */ }

    const itemsWithTax = (invoice.items || []).map((item: any) => {
        const qty = item.dispatchedQuantity || item.quantity || 0;
        const rate = item.unitPrice || 0;
        const amount = qty * rate;

        const cgstRate = Number(item.cgstRate || (item.gstRate || 0) / 2) || 0;
        const sgstRate = Number(item.sgstRate || (item.gstRate || 0) / 2) || 0;
        const igstRate = Number(item.igstRate || item.gstRate) || 0;

        const cgstAmount = Number(item.cgstAmount || (amount * cgstRate) / 100) || 0;
        const sgstAmount = Number(item.sgstAmount || (amount * sgstRate) / 100) || 0;
        const igstAmount = Number(item.igstAmount || (amount * igstRate) / 100) || 0;
        const totalAmount = amount + cgstAmount + sgstAmount + igstAmount;

        return {
            ...item,
            qty,
            rate,
            amount,
            hsnCode: item.product?.hsnCode || item.hsnCode || "-",
            unit: item.product?.uom?.uomName || item.unit || "Pcs.",
            cgstRate,
            sgstRate,
            igstRate,
            cgstAmount,
            sgstAmount,
            igstAmount,
            totalAmount,
        };
    });

    const totalCgst = itemsWithTax.reduce((s: number, i: any) => s + i.cgstAmount, 0);
    const totalSgst = itemsWithTax.reduce((s: number, i: any) => s + i.sgstAmount, 0);
    const totalIgst = itemsWithTax.reduce((s: number, i: any) => s + i.igstAmount, 0);
    const totalTaxable = itemsWithTax.reduce((s: number, i: any) => s + i.amount, 0);
    const itemsSubTotal = totalTaxable + totalCgst + totalSgst + totalIgst;
    const grandTotal = Number(invoice.grandTotal ?? itemsSubTotal);

    const map = new Map<number, { taxRate: number; taxableAmt: number; cgstAmt: number; sgstAmt: number; igstAmt: number; totalTax: number }>();
    itemsWithTax.forEach((item: any) => {
        const rate = item.cgstRate + item.sgstRate + item.igstRate;
        const existing = map.get(rate) || { taxRate: rate, taxableAmt: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, totalTax: 0 };
        existing.taxableAmt += item.amount;
        existing.cgstAmt += item.cgstAmount;
        existing.sgstAmt += item.sgstAmount;
        existing.igstAmt += item.igstAmount;
        existing.totalTax += item.cgstAmount + item.sgstAmount + item.igstAmount;
        map.set(rate, existing);
    });
    const taxSummary = Array.from(map.values());

    const amountInWords = numberToWords(Math.round(grandTotal));

    const getTransportStation = (customer: any, transportName: string | undefined) => {
        if (!transportName) return "—";
        return customer?.shippingCity || customer?.billingCity || "—";
    };

    let itemsHtml = '';
    itemsWithTax.forEach((item: any, idx: number) => {
        let taxHtml = '';
        if (isInterState) {
            taxHtml = `
                <td class="border border-black px-2 py-1 align-middle text-center">${item.igstRate}%</td>
                <td class="border border-black px-2 py-1 align-middle text-right">${item.igstAmount.toFixed(2)}</td>
            `;
        } else {
            taxHtml = `
                <td class="border border-black px-2 py-1 align-middle text-center">${item.cgstRate}%</td>
                <td class="border border-black px-2 py-1 align-middle text-right">${item.cgstAmount.toFixed(2)}</td>
                <td class="border border-black px-2 py-1 align-middle text-center">${item.sgstRate}%</td>
                <td class="border border-black px-2 py-1 align-middle text-right">${item.sgstAmount.toFixed(2)}</td>
            `;
        }
        itemsHtml += `
            <tr>
                <td class="border border-black px-2 py-1 align-middle text-center">${idx + 1}.</td>
                <td class="border border-black px-2 py-1 align-middle text-left">${item.description || item.product?.productName || "N/A"}</td>
                <td class="border border-black px-2 py-1 align-middle text-center">${item.hsnCode}</td>
                <td class="border border-black px-2 py-1 align-middle text-right">${item.qty}</td>
                <td class="border border-black px-2 py-1 align-middle text-center">${item.unit}</td>
                <td class="border border-black px-2 py-1 align-middle text-right">${item.rate.toFixed(2)}</td>
                ${taxHtml}
                <td class="border border-black px-2 py-1 align-middle text-right">${item.amount.toFixed(2)}</td>
            </tr>
        `;
    });

    if (itemsWithTax.length === 0) {
        itemsHtml += `
            <tr>
                <td colspan="${isInterState ? 8 : 10}" class="border border-black px-2 py-4 text-center text-slate-500">
                    No items found for this invoice.
                </td>
            </tr>
        `;
    }

    let taxSummaryHtml = '';
    if (taxSummary.length > 0) {
        taxSummaryHtml += `
            <table class="w-full border-collapse text-[13px] mt-2">
                <thead>
                    <tr>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-left" style="width: 60px;">Tax Rate</th>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">Taxable Amt.</th>
                        ${isInterState ? 
                            `<th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">IGST Amt.</th>` :
                            `<th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">CGST Amt.</th>
                             <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">SGST Amt.</th>`
                        }
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">Total Tax</th>
                    </tr>
                </thead>
                <tbody>
        `;
        taxSummary.forEach(row => {
            taxSummaryHtml += `
                <tr>
                    <td class="border border-black px-2 py-1 align-middle text-center">${row.taxRate}%</td>
                    <td class="border border-black px-2 py-1 align-middle text-right">${row.taxableAmt.toFixed(2)}</td>
                    ${isInterState ? 
                        `<td class="border border-black px-2 py-1 align-middle text-right">${row.igstAmt.toFixed(2)}</td>` :
                        `<td class="border border-black px-2 py-1 align-middle text-right">${row.cgstAmt.toFixed(2)}</td>
                         <td class="border border-black px-2 py-1 align-middle text-right">${row.sgstAmt.toFixed(2)}</td>`
                    }
                    <td class="border border-black px-2 py-1 align-middle text-right">${row.totalTax.toFixed(2)}</td>
                </tr>
            `;
        });
        taxSummaryHtml += `
                </tbody>
            </table>
        `;
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .border-collapse { border-collapse: collapse; }
        </style>
    </head>
    <body class="bg-white text-black p-8">
        <div class="max-w-[800px] mx-auto font-[Arial,sans-serif] border-[1.5px] border-black box-border text-[14px] font-medium">
            <!-- Top bar -->
            <div class="flex justify-between items-center px-3 pt-2 text-[13px] font-semibold">
                <div>GSTIN : ${company?.gstin || "-"}</div>
                <div class="italic">Triplicate Copy</div>
            </div>

            <!-- Header -->
            <div class="text-center border-b-[1.5px] border-black px-3 pb-2">
                <div class="text-sm uppercase font-bold tracking-[2px]">Tax Invoice</div>
                <h1 class="text-2xl font-extrabold m-0 tracking-[1px] mt-1">
                    ${company?.legalName || company?.companyName || "Company Name"}
                </h1>
                <div class="text-[13px] mt-1">
                    ${company?.addressLine1 || ''}
                    ${company?.city ? `, ${company.city}` : ''}
                    ${company?.state ? `, ${company.state}` : ''}
                    ${company?.pincode ? ` - ${company.pincode}` : ''}
                </div>
            </div>

            <!-- Invoice meta block -->
            <div class="flex border-b-[1.5px] border-black">
                <div class="flex-1 border-r-[1.5px] border-black p-2 space-y-1">
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Invoice No.</span><span>: ${invoice.invoiceNo}</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Dated</span><span>: ${formatDate(invoice.invoiceDate)}</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Place of Supply</span><span>: ${customerState || "-"}</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Due Date</span><span>: ${formatDate(invoice.dueDate)}</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Reverse Charge</span><span>: N</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">GR/RR No</span><span>: </span></div>
                </div>
                <div class="flex-1 p-2 space-y-1">
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Transport</span><span>: ${invoice.salesOrder?.transportName || "—"}</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Vehicle No</span><span>: —</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Station</span><span>: ${getTransportStation(invoice.customer, invoice.salesOrder?.transportName)}</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">E-way Bill no</span><span>: —</span></div>
                    ${invoice.salesOrder?.orderNo ? `<div class="flex text-[13px]"><span class="w-[110px] font-bold">Ref. Order No.</span><span>: ${invoice.salesOrder.orderNo}</span></div>` : ''}
                </div>
            </div>

            <!-- Billed To / Shipped To -->
            <div class="flex border-b-[1.5px] border-black">
                <div class="flex-1 border-r-[1.5px] border-black p-2">
                    <div class="font-bold mb-1">Billed to :</div>
                    <div class="font-semibold">${invoice.customer?.displayName || invoice.customer?.firmName || "N/A"}</div>
                    <div class="font-semibold">
                        ${invoice.customer?.addresses?.[0]?.address?.addressLine1 || ''}<br />
                        ${invoice.customer?.addresses?.[0]?.address?.city || ''}, ${invoice.customer?.addresses?.[0]?.address?.state || ''} - ${invoice.customer?.addresses?.[0]?.address?.pincode || ''}
                    </div>
                    ${invoice.customer?.gstin ? `<div class="mt-1">GSTIN / UIN : ${invoice.customer.gstin}</div>` : ''}
                </div>
                <div class="flex-1 p-2">
                    <div class="font-bold mb-1">Shipped to :</div>
                    <div class="font-semibold">${invoice.customer?.displayName || invoice.customer?.firmName || "N/A"}</div>
                    <div class="font-semibold">
                        ${invoice.salesOrder?.shippingAddressLine1 || invoice.customer?.addresses?.[0]?.address?.addressLine1 || ''}<br />
                        ${invoice.salesOrder?.shippingCity || invoice.customer?.addresses?.[0]?.address?.city || ''}, ${invoice.salesOrder?.shippingState || invoice.customer?.addresses?.[0]?.address?.state || ''} - ${invoice.salesOrder?.shippingPincode || invoice.customer?.addresses?.[0]?.address?.pincode || ''}
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <table class="w-full border-collapse text-[13px]">
                <thead>
                    <tr>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-left" style="width: 35px;">S.N.</th>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-left">Description of Goods</th>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-left" style="width: 60px;">HSN/SAC</th>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right" style="width: 55px;">Qty.</th>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-left" style="width: 45px;">Unit</th>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right" style="width: 60px;">Price</th>
                        ${isInterState ? 
                            `<th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-left" style="width: 50px;">IGST Rate</th>
                             <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right" style="width: 65px;">IGST Amt</th>` :
                            `<th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-left" style="width: 50px;">CGST Rate</th>
                             <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right" style="width: 65px;">CGST Amt</th>
                             <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-left" style="width: 50px;">SGST Rate</th>
                             <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right" style="width: 65px;">SGST Amt</th>`
                        }
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right" style="width: 70px;">Amount(Rs.)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
                <tfoot>
                    ${chargeRows.length > 0 ? `
                    <tr>
                        <td colspan="${isInterState ? 8 : 10}" class="border border-black px-2 py-1 text-right font-bold">Sub Total</td>
                        <td class="border border-black px-2 py-1 text-right font-bold">${formatMoney(itemsSubTotal)}</td>
                    </tr>
                    ${chargeRows.map(cr => `
                    <tr>
                        <td colspan="${isInterState ? 8 : 10}" class="border border-black px-2 py-1 text-right text-[13px]">
                            ${cr.label} ${cr.sign === 1 ? '(+)' : '(-)'}
                        </td>
                        <td class="border border-black px-2 py-1 text-right text-[13px]">
                            ${cr.sign === 1 ? '+' : '-'}&nbsp;${formatMoney(cr.amount)}
                        </td>
                    </tr>`).join('')}
                    ` : ''}
                    <tr>
                        <td colspan="${isInterState ? 8 : 10}" class="border border-black px-2 py-1 text-right font-bold">Grand Total</td>
                        <td class="border border-black px-2 py-1 text-right font-bold">${formatMoney(grandTotal)}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Tax Summary -->
            ${taxSummaryHtml}

            <!-- Amount in words -->
            <div class="px-2 py-2 border-t border-black text-[14px] font-medium">
                Rupees ${amountInWords}
            </div>

            <!-- Bank details -->
            <div class="px-2 py-2 border-t border-black text-[13px]">
                <span class="font-bold">Bank Details :</span> BANK NAME : ${company?.bankName || "BANK OF BARODA"}
                &nbsp;&nbsp; BRANCH : ${company?.bankBranch || "PALGHAR BRANCH"} <br />
                A/c No : ${company?.bankAccountNo || "123456789012"} &nbsp;&nbsp; IFSC CODE : ${company?.bankIfsc || "BARB0PALGHA"}
            </div>

            <!-- Notes -->
            ${invoice.notes ? `<div class="px-2 py-2 border-t border-black text-[13px]"><span class="font-bold">Notes :</span> ${invoice.notes}</div>` : ''}

            <!-- Footer: Terms + Signature -->
            <div class="flex border-t-[1.5px] border-black text-[13px]">
                <div class="flex-1 border-r border-black p-2">
                    <div class="font-bold mb-1">Terms &amp; Conditions</div>
                    <div>E &amp; O.E.</div>
                    <div>1. Goods once sold will not be taken back.</div>
                    <div>2. Interest @ 18% p.a. will be charged if the payment is not made within the stipulated time.</div>
                </div>
                <div class="flex-1 p-2 flex flex-col justify-between">
                    <div class="font-bold">Receiver's Signature :</div>
                    <div class="text-right font-bold mt-6">
                        For ${company?.legalName || company?.companyName || "Company"}
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};
