export const generateQuotationHtml = (quotationOrder: any, company: any): string => {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatCurrency = (amount: number | undefined | null) => {
        if (amount == null) return "₹0.00";
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        }).format(amount);
    };

    const n = (v: any): number => Number(v ?? 0);

    const isInterState = quotationOrder.isInterState;
    const baseColSpan = isInterState ? 7 : 8;
    const footerColSpan = baseColSpan;

    const companyDetailsHtml = company ? `
        <div class="text-right text-sm text-black leading-tight">
            <h3 class="text-lg font-bold text-black m-0 mb-1">${company.companyName || ''}</h3>
            ${company.addressLine1 ? `<p class="m-0">${company.addressLine1}</p>` : ''}
            ${(company.city || company.state || company.zipcode) ? `<p class="m-0">${[company.city, company.state, company.zipcode].filter(Boolean).join(", ")}</p>` : ''}
            ${company.phone ? `<p class="m-0 mt-1">Phone: ${company.phone}</p>` : ''}
            ${company.email ? `<p class="m-0">Email: ${company.email}</p>` : ''}
            ${company.gstin ? `<p class="m-0 mt-1 font-semibold text-black">GSTIN: ${company.gstin}</p>` : ''}
        </div>
    ` : '';

    let itemsHtml = '';
    quotationOrder.items?.forEach((item: any, idx: number) => {
        const uom      = item.product?.uom?.uomName || "Pcs.";
        const qty       = n(item.quantity);
        // taxableAmount = qty × unitPrice (subtotal before tax)
        const taxable   = n(item.taxableAmount) || (qty * n(item.unitPrice));
        // Derive unitPrice from taxableAmount/qty for older records where unitPrice was not stored
        const unitPrice = n(item.unitPrice) || (qty > 0 ? taxable / qty : 0);
        const lineTotal = n(item.lineTotal);

        let taxHtml = '';
        if (isInterState) {
            taxHtml = `
                <td class="text-right border border-slate-300 px-2.5 py-2 align-middle text-black">
                    ${formatCurrency(n(item.igstAmount) || n(item.gstAmount))}
                    <div class="text-[10px] text-black">(${n(item.igstRate) || n(item.gstRate)}%)</div>
                </td>
            `;
        } else {
            taxHtml = `
                <td class="text-right border border-slate-300 px-2.5 py-2 align-middle text-black">
                    ${formatCurrency(n(item.cgstAmount) || n(item.gstAmount) / 2)}
                    <div class="text-[10px] text-black">(${n(item.cgstRate) || n(item.gstRate) / 2}%)</div>
                </td>
                <td class="text-right border border-slate-300 px-2.5 py-2 align-middle text-black">
                    ${formatCurrency(n(item.sgstAmount) || n(item.gstAmount) / 2)}
                    <div class="text-[10px] text-black">(${n(item.sgstRate) || n(item.gstRate) / 2}%)</div>
                </td>
            `;
        }

        itemsHtml += `
            <tr>
                <td class="text-center border border-slate-300 px-2.5 py-2 align-middle text-black">${idx + 1}.</td>
                <td class="border border-slate-300 px-2.5 py-2 align-middle font-medium text-black">${item.product?.productName || "N/A"}</td>
                <td class="text-right border border-slate-300 px-2.5 py-2 align-middle font-bold text-black">${qty}</td>
                <td class="text-center border border-slate-300 px-2.5 py-2 align-middle text-black">${uom}</td>
                <td class="text-right border border-slate-300 px-2.5 py-2 align-middle text-black">${formatCurrency(unitPrice)}</td>
                <td class="text-right border border-slate-300 px-2.5 py-2 align-middle text-black">${formatCurrency(taxable)}</td>
                ${taxHtml}
                <td class="text-right border border-slate-300 px-2.5 py-2 align-middle font-bold text-black">${formatCurrency(lineTotal)}</td>
            </tr>
        `;
    });

    let footerHtml = `
        <tr>
            <td colspan="${footerColSpan}" class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">Subtotal:</td>
            <td class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">${formatCurrency(n(quotationOrder.subtotal))}</td>
        </tr>
    `;

    if (n(quotationOrder.totalDiscount) > 0) {
        footerHtml += `
            <tr>
                <td colspan="${footerColSpan}" class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">Discount:</td>
                <td class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">-${formatCurrency(n(quotationOrder.totalDiscount))}</td>
            </tr>
        `;
    }

    if (isInterState) {
        if (n(quotationOrder.totalIgst) || n(quotationOrder.totalGst)) {
            footerHtml += `
                <tr>
                    <td colspan="${footerColSpan}" class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">IGST:</td>
                    <td class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">
                        ${formatCurrency(n(quotationOrder.totalIgst) || n(quotationOrder.totalGst))}
                    </td>
                </tr>
            `;
        }
    } else {
        footerHtml += `
            <tr>
                <td colspan="${footerColSpan}" class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">CGST:</td>
                <td class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">
                    ${formatCurrency(n(quotationOrder.totalCgst) || n(quotationOrder.totalGst) / 2)}
                </td>
            </tr>
            <tr>
                <td colspan="${footerColSpan}" class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">SGST:</td>
                <td class="text-right border border-slate-300 px-2.5 py-2 font-bold text-black">
                    ${formatCurrency(n(quotationOrder.totalSgst) || n(quotationOrder.totalGst) / 2)}
                </td>
            </tr>
        `;
    }

    footerHtml += `
        <tr class="bg-[#f7f7f7]">
            <td colspan="${footerColSpan}" class="text-right border border-slate-300 px-2.5 py-2 font-bold text-[14px] text-black">Total Net Amount:</td>
            <td class="text-right border border-slate-300 px-2.5 py-2 font-bold text-[14px] text-black">${formatCurrency(n(quotationOrder.netAmount))}</td>
        </tr>
    `;

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
        <div class="max-w-[800px] mx-auto">
            <div class="flex justify-between items-end border-b-2 border-gray-300 pb-4 mb-6">
                <div>
                    <h1 class="text-3xl font-bold text-black m-0">QUOTATION</h1>
                    <p class="text-black text-sm mt-1 mb-0">Original for Recipient</p>
                </div>
                ${companyDetailsHtml}
            </div>

            <!-- details-box -->
            <div class="flex border border-b-0 border-slate-300">
                <!-- party-details -->
                <div class="flex-[1.2] border-r border-slate-300 p-3 text-[13px] leading-[1.5]">
                    <div class="font-bold mb-1 text-black">Customer Details :</div>
                    <div class="font-semibold text-black">
                        ${quotationOrder.customer?.displayName || quotationOrder.customer?.firmName || "N/A"}
                    </div>
                    <div class="text-black mt-1">
                        ${quotationOrder.billingAddressLine1 || ''}<br />
                        ${quotationOrder.billingCity || ''}, ${quotationOrder.billingState || ''} - ${quotationOrder.billingPincode || ''}
                    </div>
                </div>
                <!-- order-details -->
                <div class="flex-[0.8] p-3 text-[13px] leading-[1.6] border-l border-slate-200">
                    <div class="flex mb-1.5 text-black">
                        <span class="w-[90px] font-bold">Quotation No.</span>
                        <span class="flex-1">: ${quotationOrder.orderNo}</span>
                    </div>
                    <div class="flex mb-1.5 text-black">
                        <span class="w-[90px] font-bold">Date</span>
                        <span class="flex-1">: ${formatDate(quotationOrder.orderDate)}</span>
                    </div>
                    <div class="flex text-black">
                        <span class="w-[90px] font-bold">Valid Until</span>
                        <span class="flex-1">: ${formatDate(quotationOrder.expectedCompletionDate)}</span>
                    </div>
                </div>
            </div>

            <!-- items-table -->
            <table class="w-full border-collapse text-[13px]">
                <thead>
                    <tr>
                        <th class="text-center border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black" style="width: 40px;">S.N.</th>
                        <th class="text-left border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black">Description of Goods</th>
                        <th class="text-right border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black" style="width: 60px;">Qty.</th>
                        <th class="text-center border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black" style="width: 60px;">Unit</th>
                        <th class="text-right border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black" style="width: 80px;">Rate</th>
                        <th class="text-right border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black" style="width: 90px;">SubTotal</th>
                        ${isInterState ? 
                            `<th class="text-right border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black" style="width: 80px;">IGST</th>` :
                            `<th class="text-right border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black" style="width: 80px;">CGST</th>
                             <th class="text-right border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black" style="width: 80px;">SGST</th>`
                        }
                        <th class="text-right border border-slate-300 px-2.5 py-2 align-middle font-bold bg-[#f7f7f7] text-black" style="width: 100px;">Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
                <tfoot>
                    ${footerHtml}
                </tfoot>
            </table>
        </div>
    </body>
    </html>
    `;
};
