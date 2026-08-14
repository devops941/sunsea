export const generatePoInvoiceHtml = (po: any, company: any, supplier: any, store?: any): string => {
    const formatMoney = (val: string | number | null | undefined) => {
        const n = Number(val ?? 0);
        return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (val: string | null | undefined) => {
        if (!val) return "—";
        return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const numberToWords = (num: number): string => {
        const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
            "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
        const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

        const inWords = (n: number): string => {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
            if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
            if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
            if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
            return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
        };

        const rounded = Math.round(num);
        if (rounded === 0) return "Zero Only";
        return inWords(rounded) + " Only";
    };

    const companyState = company?.state;
    const isInterState = companyState && po?.billingState ? companyState.toLowerCase().trim() !== po.billingState.toLowerCase().trim() : false;

    let itemsWithTax: any[] = [];
    if (po?.items) {
        itemsWithTax = po.items.map((item: any) => {
            const qty = Number(item.quantity ?? 0);
            const rate = Number(item.unitPrice ?? 0);
            const amount = Number(item.taxableAmount ?? qty * rate);
            const taxPercent = Number(item.tax ?? 0);

            const cgstRate = isInterState ? 0 : taxPercent / 2;
            const sgstRate = isInterState ? 0 : taxPercent / 2;
            const igstRate = isInterState ? taxPercent : 0;

            const cgstAmount = Number(item.cgstAmount ?? (amount * cgstRate) / 100);
            const sgstAmount = Number(item.sgstAmount ?? (amount * sgstRate) / 100);
            const igstAmount = Number(item.igstAmount ?? (amount * igstRate) / 100);

            const totalAmount = amount + cgstAmount + sgstAmount + igstAmount;

            const description = item.description || item.product?.productName || item.product?.materialName || item.rawMaterial?.materialName || item.productId || "N/A";
            const hsnCode = item.hsnCode || item.product?.hsnCode || item.rawMaterial?.hsnCode || "—";

            return {
                ...item,
                description,
                hsnCode,
                qty,
                rate,
                amount,
                unit: item.uom || "Pcs.",
                cgstRate,
                sgstRate,
                igstRate,
                cgstAmount,
                sgstAmount,
                igstAmount,
                totalAmount,
            };
        });
    }

    const totalCgst = itemsWithTax.reduce((s: number, i: any) => s + i.cgstAmount, 0);
    const totalSgst = itemsWithTax.reduce((s: number, i: any) => s + i.sgstAmount, 0);
    const totalIgst = itemsWithTax.reduce((s: number, i: any) => s + i.igstAmount, 0);
    const totalTaxable = itemsWithTax.reduce((s: number, i: any) => s + i.amount, 0);
    const grandTotal = Number(po?.netAmount ?? (totalTaxable + totalCgst + totalSgst + totalIgst));

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
    const amountInWords = numberToWords(grandTotal);

    let itemsHtml = '';
    if (itemsWithTax.length === 0) {
        itemsHtml = `<tr>
            <td colspan="${isInterState ? 8 : 9}" class="border border-black px-2 py-4 text-center text-slate-500">
                No items found.
            </td>
        </tr>`;
    } else {
        itemsWithTax.forEach((item, idx) => {
            let taxHtml = '';
            if (isInterState) {
                taxHtml = `
                    <td class="border border-black px-2 py-1 align-middle text-center">${item.igstRate}%</td>
                    <td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(item.igstAmount)}</td>
                `;
            } else {
                taxHtml = `
                    <td class="border border-black px-2 py-1 align-middle text-center">${item.cgstRate}%</td>
                    <td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(item.cgstAmount)}</td>
                    <td class="border border-black px-2 py-1 align-middle text-center">${item.sgstRate}%</td>
                    <td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(item.sgstAmount)}</td>
                `;
            }
            itemsHtml += `
            <tr>
                <td class="border border-black px-2 py-1 align-middle text-center">${idx + 1}.</td>
                <td class="border border-black px-2 py-1 align-middle text-left">${item.description}</td>
                <td class="border border-black px-2 py-1 align-middle text-center">${item.hsnCode}</td>
                <td class="border border-black px-2 py-1 align-middle text-right">${item.qty}</td>
                <td class="border border-black px-2 py-1 align-middle text-center">${item.unit}</td>
                <td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(item.rate)}</td>
                ${taxHtml}
                <td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(item.amount)}</td>
            </tr>
            `;
        });
    }

    let taxSummaryHtml = '';
    if (taxSummary.length > 0) {
        let taxSumRows = '';
        taxSummary.forEach(row => {
            let taxCols = '';
            if (isInterState) {
                taxCols = `<td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(row.igstAmt)}</td>`;
            } else {
                taxCols = `
                    <td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(row.cgstAmt)}</td>
                    <td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(row.sgstAmt)}</td>
                `;
            }
            taxSumRows += `
                <tr>
                    <td class="border border-black px-2 py-1 align-middle text-center">${row.taxRate}%</td>
                    <td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(row.taxableAmt)}</td>
                    ${taxCols}
                    <td class="border border-black px-2 py-1 align-middle text-right">${formatMoney(row.totalTax)}</td>
                </tr>
            `;
        });

        let headerCols = '';
        if (isInterState) {
            headerCols = `<th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">IGST Amt.</th>`;
        } else {
            headerCols = `
                <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">CGST Amt.</th>
                <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">SGST Amt.</th>
            `;
        }

        taxSummaryHtml = `
            <table class="w-full border-collapse text-[13px] mt-2">
                <thead>
                    <tr>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-left" style="width: 60px;">Tax Rate</th>
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">Taxable Amt.</th>
                        ${headerCols}
                        <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right">Total Tax</th>
                    </tr>
                </thead>
                <tbody>
                    ${taxSumRows}
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
        <div class="max-w-5xl mx-auto font-[Arial,sans-serif] text-black bg-white border-[1.5px] border-black box-border text-[14px] font-medium">
            <!-- Top bar -->
            <div class="flex justify-between items-center px-3 pt-2 text-[13px] font-semibold">
                <div>GSTIN : ${company?.gstin || "-"}</div>
                <div class="italic">Triplicate Copy</div>
            </div>

            <!-- Header -->
            <div class="text-center border-b-[1.5px] border-black px-3 pb-2">
                <div class="text-sm uppercase font-bold tracking-[2px]">PO Invoice</div>
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
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">GRN No.</span><span>: —</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Dated</span><span>: ${formatDate(po.poDate)}</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Place of Supply</span><span>: ${po.billingState || "-"}</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Due Date</span><span>: —</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Reverse Charge</span><span>: N</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Challan No.</span><span>: —</span></div>
                </div>
                <div class="flex-1 p-2 space-y-1">
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Transport</span><span>: —</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Vehicle No</span><span>: —</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Station</span><span>: —</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">E-way Bill no</span><span>: —</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Invoice No.</span><span>: —</span></div>
                    <div class="flex text-[13px]"><span class="w-[110px] font-bold">Ref. PO No.</span><span>: ${po.poNumber || "—"}</span></div>
                </div>
            </div>

            <!-- Billed From / Shipped To -->
            <div class="flex border-b-[1.5px] border-black">
                <div class="flex-1 border-r-[1.5px] border-black p-2">
                    <div class="font-bold mb-1">Billed from (Supplier) :</div>
                    <div class="font-semibold">${supplier?.supplierName || "N/A"}</div>
                    <div class="font-semibold text-slate-800">
                        ${po.billingAddressLine1 || ''}<br />
                        ${po.billingCity || ''}, ${po.billingState || ''} - ${po.billingPincode || ''}
                    </div>
                    ${supplier?.gstin ? `<div class="mt-1">GSTIN / UIN : ${supplier.gstin}</div>` : ''}
                </div>
                <div class="flex-1 p-2">
                    <div class="font-bold mb-1">Shipped to (Store) :</div>
                    <div class="font-semibold">${store?.storeName || "N/A"}</div>
                    <div class="font-semibold text-slate-800">
                        ${po.shippingAddressLine1 || po.billingAddressLine1 || ''}<br />
                        ${po.shippingCity || po.billingCity || ''}, ${po.shippingState || po.billingState || ''} - ${po.shippingPincode || po.billingPincode || ''}
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
                             <th class="border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-right" style="width: 65px;">IGST Amt</th>` 
                            : 
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
                    <tr>
                        <td colspan="${isInterState ? 7 : 10}" class="border border-black px-2 py-1 text-right font-bold">
                            Grand Total
                        </td>
                        <td class="border border-black px-2 py-1 text-right font-bold font-mono">
                            ₹${formatMoney(grandTotal)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            <!-- Tax Summary -->
            ${taxSummaryHtml}

            <!-- Amount in words -->
            <div class="px-2 py-2 border-t border-black text-[14px] font-semibold">
                Rupees ${amountInWords}
            </div>

            <!-- Bank details -->
            <div class="px-2 py-2 border-t border-black text-[13px]">
                <span class="font-bold">Bank Details :</span> BANK NAME : ${company?.bankName || "BANK OF BARODA"}
                &nbsp;&nbsp; BRANCH : ${company?.bankBranch || "PALGHAR BRANCH"} <br />
                A/c No : ${company?.bankAccountNo || "123456789012"} &nbsp;&nbsp; IFSC CODE : ${company?.bankIfsc || "BARB0PALGHA"}
            </div>

            <!-- Remarks / Notes -->
            ${po.remarks ? `
                <div class="px-2 py-2 border-t border-black text-[13px]">
                    <span class="font-bold">Remarks / Notes :</span> ${po.remarks}
                </div>
            ` : ''}

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
