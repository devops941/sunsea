import React, { useState, useEffect, useMemo } from "react";
import { FaPrint, FaDownload, FaArrowLeft, FaWhatsapp } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import CustomButton from "../../../../components/ui/Button/Button";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// Basic number-to-words for Indian Rupees (integer part only)
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

const PoInvoicePage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { data: company } = useSelector((state: any) => state.company);
    const companyState = company?.state;

    const [po, setPo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        purchaseOrderService.fetchById(id)
            .then((data) => {
                setPo(data);
            })
            .catch(() => {
                toast.error("Failed to load Purchase Order details");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [id]);

    const supplier = po?.supplier;
    const store = po?.store;

    const isInterState = useMemo(() => {
        if (!companyState || !po?.billingState) return false;
        return companyState.toLowerCase().trim() !== po.billingState.toLowerCase().trim();
    }, [companyState, po?.billingState]);

    const itemsWithTax = useMemo(() => {
        if (!po?.items) return [];
        return po.items.map((item: any) => {
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

            return {
                ...item,
                qty,
                rate,
                amount,
                hsnCode: item.product?.hsnCode || "—",
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
    }, [po, isInterState]);

    const totalCgst = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + i.cgstAmount, 0), [itemsWithTax]);
    const totalSgst = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + i.sgstAmount, 0), [itemsWithTax]);
    const totalIgst = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + i.igstAmount, 0), [itemsWithTax]);
    const totalTaxable = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + i.amount, 0), [itemsWithTax]);
    const grandTotal = Number(po?.netAmount ?? (totalTaxable + totalCgst + totalSgst + totalIgst));

    const taxSummary = useMemo(() => {
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
        return Array.from(map.values());
    }, [itemsWithTax]);

    const amountInWords = useMemo(() => numberToWords(grandTotal), [grandTotal]);

    const handleDownloadPdf = async () => {
        try {
            const html2canvas = (await import("html2canvas-pro")).default;
            const { jsPDF } = await import("jspdf");

            const element = document.getElementById("printable-po-invoice-card");
            if (!element) return;

            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL("image/png");

            const pdf = new jsPDF("p", "mm", "a4");
            const margin = 10;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = pageWidth - 2 * margin;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const availableHeight = pageHeight - 2 * margin;

            let heightLeft = imgHeight;
            let position = margin;

            pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
            heightLeft -= availableHeight;

            while (heightLeft > 0) {
                position -= availableHeight;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
                heightLeft -= availableHeight;
            }

            pdf.save(`PO-Invoice-${po?.poNumber || "invoice"}.pdf`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate PDF");
        }
    };

    const handleSendWhatsapp = () => {
        if (!po) return;
        const supplierPhone = supplier?.phone || "";
        const formattedPhone = supplierPhone.replace(/\D/g, ""); // Keep only digits
        
        const message = `Dear ${supplier?.supplierName || "Supplier"},\n\nPlease find attached our Purchase Order details:\nPO Number: ${po.poNumber}\nPO Date: ${formatDate(po.poDate)}\nTotal Amount: ₹${formatMoney(po.netAmount)}\n\nLink to view: ${window.location.href}\n\nThank you!\nFor ${company?.legalName || company?.companyName || "Company"}`;
        
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, "_blank");
    };

    if (loading) {
        return <CommonLoader text="Loading order details..." fullScreen={false} />;
    }

    if (!po) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                <p className="text-base font-semibold">Purchase Order not found.</p>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto p-6 lg:p-8 print:p-0 print:block bg-gray-100 min-h-screen">
            <div className="max-w-5xl mx-auto">
                {/* Action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 no-print">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate("/purchase-orders")}
                            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-semibold bg-transparent border-none outline-none cursor-pointer"
                        >
                            <FaArrowLeft className="text-xs" /> Back
                        </button>
                        <h2 className="text-xl font-bold text-gray-800 m-0">
                            PO Invoice #{po.poNumber}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <CustomButton text="Send WhatsApp" icon={FaWhatsapp} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none" onClick={handleSendWhatsapp} />
                        <CustomButton text="Print" icon={FaPrint} variant="primary" onClick={() => window.print()} />
                        <CustomButton text="Download PDF" icon={FaDownload} variant="secondary" onClick={handleDownloadPdf} />
                    </div>
                </div>

                {/* Print stylesheet */}
                <style>{`
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }
                        #printable-po-invoice-card, #printable-po-invoice-card * {
                            visibility: visible !important;
                        }
                        #printable-po-invoice-card {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            background: #fff !important;
                            box-shadow: none !important;
                            margin: 0 !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        html, body {
                            height: auto;
                            overflow: visible !important;
                        }
                    }
                `}</style>

                {/* GST Tax Invoice Card */}
                <div
                    id="printable-po-invoice-card"
                    className="font-[Arial,sans-serif] text-black bg-white border-[1.5px] border-black w-full min-h-[265mm] flex flex-col justify-between box-border text-[14px] shadow-lg font-medium"
                >
                    {/* Top bar */}
                    <div className="flex justify-between items-center px-3 pt-2 text-[13px] font-semibold">
                        <div>GSTIN : {company?.gstin || "-"}</div>
                        <div className="italic">Triplicate Copy</div>
                    </div>

                    {/* Header */}
                    <div className="text-center border-b-[1.5px] border-black px-3 pb-2">
                        <div className="text-sm uppercase font-bold tracking-[2px]">PO Invoice</div>
                        <h1 className="text-2xl font-extrabold m-0 tracking-[1px] mt-1">
                            {company?.legalName || company?.companyName || "Company Name"}
                        </h1>
                        <div className="text-[13px] mt-1">
                            {company?.addressLine1}
                            {company?.city && `, ${company.city}`}
                            {company?.state && `, ${company.state}`}
                            {company?.pincode && ` - ${company.pincode}`}
                        </div>
                    </div>

                    {/* Invoice meta block */}
                    <div className="flex border-b-[1.5px] border-black">
                        <div className="flex-1 border-r-[1.5px] border-black p-2 space-y-1">
                            <MetaRow label="GRN No." value="—" />
                            <MetaRow label="Dated" value={formatDate(po.poDate)} />
                            <MetaRow label="Place of Supply" value={po.billingState || "-"} />
                            <MetaRow label="Due Date" value="—" />
                            <MetaRow label="Reverse Charge" value="N" />
                            <MetaRow label="Challan No." value="—" />
                        </div>
                        <div className="flex-1 p-2 space-y-1">
                            <MetaRow label="Transport" value="—" />
                            <MetaRow label="Vehicle No" value="—" />
                            <MetaRow label="Station" value="—" />
                            <MetaRow label="E-way Bill no" value="—" />
                            <MetaRow label="Invoice No." value="—" />
                            <MetaRow label="Ref. PO No." value={po.poNumber || "—"} />
                        </div>
                    </div>

                    {/* Billed From / Shipped To */}
                    <div className="flex border-b-[1.5px] border-black">
                        <div className="flex-1 border-r-[1.5px] border-black p-2">
                            <div className="font-bold mb-1">Billed from (Supplier) :</div>
                            <div className="font-semibold">
                                {supplier?.supplierName || "N/A"}
                            </div>
                            <div className="font-semibold text-slate-800">
                                {po.billingAddressLine1}<br />
                                {po.billingCity}, {po.billingState} - {po.billingPincode}
                            </div>
                            {supplier?.gstin && (
                                <div className="mt-1">GSTIN / UIN : {supplier.gstin}</div>
                            )}
                        </div>
                        <div className="flex-1 p-2">
                            <div className="font-bold mb-1">Shipped to (Store) :</div>
                            <div className="font-semibold">
                                {store?.storeName || "N/A"}
                            </div>
                            <div className="font-semibold text-slate-800">
                                {po.shippingAddressLine1 || po.billingAddressLine1}<br />
                                {po.shippingCity || po.billingCity}, {po.shippingState || po.billingState} - {po.shippingPincode || po.billingPincode}
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table className="w-full border-collapse text-[13px]">
                        <thead>
                            <tr>
                                <Th w="35px">S.N.</Th>
                                <Th>Description of Goods</Th>
                                <Th w="60px">HSN/SAC</Th>
                                <Th w="55px" align="right">Qty.</Th>
                                <Th w="45px">Unit</Th>
                                <Th w="60px" align="right">Price</Th>
                                {isInterState ? (
                                    <>
                                        <Th w="50px">IGST Rate</Th>
                                        <Th w="65px" align="right">IGST Amt</Th>
                                    </>
                                ) : (
                                    <>
                                        <Th w="50px">CGST Rate</Th>
                                        <Th w="65px" align="right">CGST Amt</Th>
                                        <Th w="50px">SGST Rate</Th>
                                        <Th w="65px" align="right">SGST Amt</Th>
                                    </>
                                )}
                                <Th w="70px" align="right">Amount(Rs.)</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemsWithTax.map((item: any, idx: number) => (
                                <tr key={item.id || idx}>
                                    <Td align="center">{idx + 1}.</Td>
                                    <Td>{item.description || "N/A"}</Td>
                                    <Td align="center">{item.hsnCode}</Td>
                                    <Td align="right">{item.qty}</Td>
                                    <Td align="center">{item.unit}</Td>
                                    <Td align="right">{formatMoney(item.rate)}</Td>
                                    {isInterState ? (
                                        <>
                                            <Td align="center">{item.igstRate}%</Td>
                                            <Td align="right">{formatMoney(item.igstAmount)}</Td>
                                        </>
                                    ) : (
                                        <>
                                            <Td align="center">{item.cgstRate}%</Td>
                                            <Td align="right">{formatMoney(item.cgstAmount)}</Td>
                                            <Td align="center">{item.sgstRate}%</Td>
                                            <Td align="right">{formatMoney(item.sgstAmount)}</Td>
                                        </>
                                    )}
                                    <Td align="right">{formatMoney(item.amount)}</Td>
                                </tr>
                            ))}
                            {(!po.items || po.items.length === 0) && (
                                <tr>
                                    <td colSpan={isInterState ? 8 : 9} className="border border-black px-2 py-4 text-center text-slate-500">
                                        No items found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={isInterState ? 7 : 10} className="border border-black px-2 py-1 text-right font-bold">
                                    Grand Total
                                </td>
                                <td className="border border-black px-2 py-1 text-right font-bold font-mono">
                                    ₹{formatMoney(grandTotal)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Tax Summary */}
                    {taxSummary.length > 0 && (
                        <table className="w-full border-collapse text-[13px] mt-2">
                            <thead>
                                <tr>
                                    <Th w="60px">Tax Rate</Th>
                                    <Th align="right">Taxable Amt.</Th>
                                    {isInterState ? (
                                        <Th align="right">IGST Amt.</Th>
                                    ) : (
                                        <>
                                            <Th align="right">CGST Amt.</Th>
                                            <Th align="right">SGST Amt.</Th>
                                        </>
                                    )}
                                    <Th align="right">Total Tax</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {taxSummary.map((row, i) => (
                                    <tr key={i}>
                                        <Td align="center">{row.taxRate}%</Td>
                                        <Td align="right">{formatMoney(row.taxableAmt)}</Td>
                                        {isInterState ? (
                                            <Td align="right">{formatMoney(row.igstAmt)}</Td>
                                        ) : (
                                            <>
                                                <Td align="right">{formatMoney(row.cgstAmt)}</Td>
                                                <Td align="right">{formatMoney(row.sgstAmt)}</Td>
                                            </>
                                        )}
                                        <Td align="right">{formatMoney(row.totalTax)}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Amount in words */}
                    <div className="px-2 py-2 border-t border-black text-[14px] font-semibold">
                        Rupees {amountInWords}
                    </div>

                    {/* Bank details */}
                    <div className="px-2 py-2 border-t border-black text-[13px]">
                        <span className="font-bold">Bank Details :</span> BANK NAME : {company?.bankName || "BANK OF BARODA"}
                        &nbsp;&nbsp; BRANCH : {company?.bankBranch || "PALGHAR BRANCH"} <br />
                        A/c No : {company?.bankAccountNo || "123456789012"} &nbsp;&nbsp; IFSC CODE : {company?.bankIfsc || "BARB0PALGHA"}
                    </div>

                    {/* Remarks / Notes */}
                    {po.remarks && (
                        <div className="px-2 py-2 border-t border-black text-[13px] print:block">
                            <span className="font-bold">Remarks / Notes :</span> {po.remarks}
                        </div>
                    )}

                    {/* Footer: Terms + Signature */}
                    <div className="flex border-t-[1.5px] border-black text-[13px]">
                        <div className="flex-1 border-r border-black p-2">
                            <div className="font-bold mb-1">Terms &amp; Conditions</div>
                            <div>E &amp; O.E.</div>
                            <div>1. Goods once sold will not be taken back.</div>
                            <div>2. Interest @ 18% p.a. will be charged if the payment is not made within the stipulated time.</div>
                        </div>
                        <div className="flex-1 p-2 flex flex-col justify-between">
                            <div className="font-bold">Receiver's Signature :</div>
                            <div className="text-right font-bold mt-6">
                                For {company?.legalName || company?.companyName || "Company"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Small table helpers ─────────────────────────────────────────────
const MetaRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex text-[13px]">
        <span className="w-[110px] font-bold">{label}</span>
        <span>: {value}</span>
    </div>
);

const Th: React.FC<{ children?: React.ReactNode; w?: string; align?: "left" | "center" | "right" }> = ({ children, w, align = "left" }) => (
    <th
        className={`border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-${align}`}
        style={w ? { width: w } : undefined}
    >
        {children}
    </th>
);

const Td: React.FC<{ children?: React.ReactNode; align?: "left" | "center" | "right" }> = ({ children, align = "left" }) => (
    <td className={`border border-black px-2 py-1 align-middle text-${align}`}>{children}</td>
);

export default PoInvoicePage;
