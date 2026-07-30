// src/pages/sales/SalesInvoiceView.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FaArrowLeft, FaPrint, FaDownload, FaCircleNotch } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector, useDispatch } from "react-redux";
import { salesInvoiceService } from "../../services/salesInvoiceService";
import { useSocketSync } from "../../hooks/useSocketSync";
import CustomButton from "../../components/ui/Button/Button";
import SearchInput from "../../components/ui/SearchInput/SearchInput";
import { fetchCompany } from "../../features/company/companySlice";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const getMobileFromCustomer = (cust: any) => {
    if (!cust) return "";
    const m = cust.mobile;
    if (Array.isArray(m) && m.length > 0) {
        return m[0].number || m[0].value || "";
    }
    if (typeof m === "string") return m;
    return "";
};

const getTransportStation = (cust: any, transportName: string | null | undefined) => {
    if (!cust || !transportName || !Array.isArray(cust.transports)) return "—";
    const t = cust.transports.find((item: any) => item && item.transportName === transportName);
    return t ? t.city || "—" : "—";
};

// Basic number-to-words for Indian Rupees (integer part only, extend as needed)
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

// ─── Component ─────────────────────────────────────────────────────────
const SalesInvoiceView: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<any>();
    const { id: idParam } = useParams<{ id: string }>();

    const [invoice, setInvoice] = useState<any | null>((location.state as any) || null);
    const [loading, setLoading] = useState(!location.state);

    const [invoicesList, setInvoicesList] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const { data: company } = useSelector((state: any) => state.company);

    useEffect(() => {
        dispatch(fetchCompany());
    }, [dispatch]);

    const fetchList = useCallback(async () => {
        try {
            const response = await salesInvoiceService.fetchAll({ page: 1, pageSize: 100 });
            setInvoicesList(response.data || []);
        } catch (error) {
            console.error("Failed to load invoice list", error);
        } finally {
            setLoadingList(false);
        }
    }, []);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const loadDetail = useCallback(async (idToLoad: string) => {
        setLoading(true);
        try {
            const data = await salesInvoiceService.fetchById(idToLoad);
            setInvoice(data);
        } catch (error) {
            toast.error("Failed to load invoice details");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const id = idParam || (location.state as any)?.id;
        if (!id) {
            if (invoicesList.length > 0) {
                navigate(`/sales-invoices/details/${invoicesList[0].id}`);
            }
            return;
        }

        loadDetail(id.toString());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idParam, invoicesList, loadDetail]);

    const handleSocketUpdate = useCallback(() => {
        fetchList();
        const id = idParam || (location.state as any)?.id;
        if (id) {
            loadDetail(id.toString());
        }
    }, [fetchList, idParam, location.state, loadDetail]);

    useSocketSync("salesInvoice", undefined, handleSocketUpdate);

    const filteredInvoices = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return invoicesList.filter((inv) => {
            const invoiceNo = inv.invoiceNo?.toLowerCase() ?? "";
            const customerName = (inv.customer?.displayName || inv.customer?.firmName || "").toLowerCase();
            return invoiceNo.includes(term) || customerName.includes(term);
        });
    }, [invoicesList, searchTerm]);

    // ─── Tax calculations per item (CGST/SGST or IGST) ─────────────────
    const isInterState = useMemo(() => {
        if (!invoice) return false;
        return (invoice.items || []).some((item: any) => Number(item.igstAmount) > 0);
    }, [invoice]);

    const itemsWithTax = useMemo(() => {
        if (!invoice?.items) return [];
        return invoice.items.map((item: any) => {
            const qty = Number(item.quantity ?? item.qty ?? 0);
            const rate = Number(item.unitPrice ?? item.rate ?? 0);
            const amount = Number(item.amount ?? qty * rate);
            const taxPercent = Number(item.taxRate ?? item.taxPercent ?? item.tax ?? 0);

            const cgstRate = Number(item.cgstRate ?? (isInterState ? 0 : taxPercent / 2));
            const sgstRate = Number(item.sgstRate ?? (isInterState ? 0 : taxPercent / 2));
            const igstRate = Number(item.igstRate ?? (isInterState ? taxPercent : 0));

            const cgstAmount = Number(item.cgstAmount ?? (amount * cgstRate) / 100);
            const sgstAmount = Number(item.sgstAmount ?? (amount * sgstRate) / 100);
            const igstAmount = Number(item.igstAmount ?? (amount * igstRate) / 100);

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
    }, [invoice, isInterState]);

    const totalCgst = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + i.cgstAmount, 0), [itemsWithTax]);
    const totalSgst = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + i.sgstAmount, 0), [itemsWithTax]);
    const totalIgst = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + i.igstAmount, 0), [itemsWithTax]);
    const totalTaxable = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + i.amount, 0), [itemsWithTax]);
    const grandTotal = Number(invoice?.grandTotal ?? (totalTaxable + totalCgst + totalSgst + totalIgst));

    // Tax summary grouped by rate
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

            const element = document.getElementById("printable-invoice-card");
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

            pdf.save(`Invoice-${invoice?.invoiceNo || "invoice"}.pdf`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate PDF");
        }
    };

    return (
        <div className="flex bg-gray-100 overflow-hidden h-[calc(100vh-115px)] print:block print:h-auto print:overflow-visible print:bg-white">
            {/* ── Left Sidebar (Invoice List) ── */}
            <div className="hidden md:flex w-72 md:w-80 flex-shrink-0 bg-white border-r border-gray-200 flex-col h-full no-print">
                <div className="p-4 border-b border-gray-200 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate("/sales-invoices")}
                            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-bold text-lg"
                        >
                            <FaArrowLeft className="text-sm" /> Sales Invoices
                        </button>
                    </div>

                    <SearchInput
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search Invoice or customer..."
                        fullWidthOnMobileOnly={false}
                    />
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                    {loadingList ? (
                        <div className="flex items-center justify-center py-8">
                            <FaCircleNotch className="animate-spin text-gray-400 text-xl" />
                        </div>
                    ) : filteredInvoices.map((inv) => {
                        const isSelected = String(inv.id) === String(idParam || invoice?.id);
                        return (
                            <div
                                key={inv.id}
                                onClick={() => navigate(`/sales-invoices/details/${inv.id}`)}
                                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? "bg-primary/10 border-l-4 border-primary" : ""
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-gray-900">{inv.invoiceNo}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${inv.status?.toUpperCase() === "PAID"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                        }`}>
                                        {inv.status || "Draft"}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                    {inv.customer?.displayName || inv.customer?.firmName || "N/A"}
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-400">
                                    <span>{formatDate(inv.invoiceDate)}</span>
                                    <span className="font-bold text-gray-900">₹{formatMoney(inv.grandTotal)}</span>
                                </div>
                            </div>
                        );
                    })}
                    {!loadingList && filteredInvoices.length === 0 && (
                        <div className="p-8 text-center text-gray-500 text-sm">No invoices found.</div>
                    )}
                </div>
            </div>

            {/* ── Right Content (Invoice Details) ── */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 print:overflow-visible print:h-auto print:p-0 print:block">
                {loading || !invoice ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                        <FaCircleNotch className="animate-spin text-primary text-4xl mb-4" />
                        <p className="text-gray-500 font-medium">Loading invoice details...</p>
                    </div>
                ) : (
                    <div className="max-w-5xl mx-auto">
                        {/* Action buttons */}
                        <div className="flex items-center justify-between gap-4 mb-6 no-print">
                            <h2 className="text-xl font-bold text-gray-800 m-0">
                                Sales Invoice #{invoice.invoiceNo}
                            </h2>
                            <div className="flex items-center gap-3">
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
                                #printable-invoice-card, #printable-invoice-card * {
                                    visibility: visible !important;
                                }
                                #printable-invoice-card {
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
                            id="printable-invoice-card"
                            className="font-[Arial,sans-serif] text-black bg-white border-[1.5px] border-black w-full box-border text-[14px] shadow-lg font-medium"
                        >
                            {/* Top bar */}
                            <div className="flex justify-between items-center px-3 pt-2 text-[13px] font-semibold">
                                <div>GSTIN : {company?.gstin || "-"}</div>
                                <div className="italic">Triplicate Copy</div>
                            </div>

                            {/* Header */}
                            <div className="text-center border-b-[1.5px] border-black px-3 pb-2">
                                <div className="text-sm uppercase font-bold tracking-[2px]">Tax Invoice</div>
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
                                    <MetaRow label="Invoice No." value={invoice.invoiceNo} />
                                    <MetaRow label="Dated" value={formatDate(invoice.invoiceDate)} />
                                    <MetaRow label="Place of Supply" value={invoice.customer?.billingState || "-"} />
                                    <MetaRow label="Due Date" value={formatDate(invoice.dueDate)} />
                                    <MetaRow label="Reverse Charge" value="N" />
                                    <MetaRow label="GR/RR No" value="" />
                                </div>
                                <div className="flex-1 p-2 space-y-1">

                                    <MetaRow label="Transport" value={invoice.salesOrder?.transportName || "—"} />
                                    <MetaRow label="Vehicle No" value="—" />
                                    <MetaRow label="Station" value={getTransportStation(invoice.customer, invoice.salesOrder?.transportName)} />
                                    <MetaRow label="E-way Bill no" value="—" />
                                    {invoice.salesOrder?.orderNo && (
                                        <MetaRow label="Ref. Order No." value={invoice.salesOrder.orderNo} />
                                    )}
                                </div>
                            </div>

                            {/* Billed To / Shipped To */}
                            <div className="flex border-b-[1.5px] border-black">
                                <div className="flex-1 border-r-[1.5px] border-black p-2">
                                    <div className="font-bold mb-1">Billed to :</div>
                                    <div className="font-semibold">
                                        {invoice.customer?.displayName || invoice.customer?.firmName || "N/A"}
                                    </div>
                                    <div className="font-semibold">
                                        {invoice.customer?.billingAddressLine1}<br />
                                        {invoice.customer?.billingCity}, {invoice.customer?.billingState} - {invoice.customer?.billingPincode}
                                    </div>
                                    {invoice.customer?.gstin && (
                                        <div className="mt-1">GSTIN / UIN : {invoice.customer.gstin}</div>
                                    )}
                                    {(invoice.salesOrder?.mobile || getMobileFromCustomer(invoice.customer)) && (
                                        <div className="mt-1 font-semibold">Mobile: {invoice.salesOrder?.mobile || getMobileFromCustomer(invoice.customer)}</div>
                                    )}
                                </div>
                                <div className="flex-1 p-2">
                                    <div className="font-bold mb-1">Shipped to :</div>
                                    <div className="font-semibold">
                                        {invoice.customer?.displayName || invoice.customer?.firmName || "N/A"}
                                    </div>
                                    <div className="font-semibold">
                                        {invoice.salesOrder?.shippingAddressLine1 || invoice.customer?.shippingAddressLine1 || invoice.customer?.billingAddressLine1}<br />
                                        {invoice.salesOrder?.shippingCity || invoice.customer?.shippingCity || invoice.customer?.billingCity}, {invoice.salesOrder?.shippingState || invoice.customer?.shippingState || invoice.customer?.billingState} - {invoice.salesOrder?.shippingPincode || invoice.customer?.shippingPincode || invoice.customer?.billingPincode}
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
                                            <Td>{item.product?.productName || "N/A"}</Td>
                                            <Td align="center">{item.hsnCode}</Td>
                                            <Td align="right">{item.qty}</Td>
                                            <Td align="center">{item.unit}</Td>
                                            <Td align="right">{item.rate.toFixed(2)}</Td>
                                            {isInterState ? (
                                                <>
                                                    <Td align="center">{item.igstRate}%</Td>
                                                    <Td align="right">{item.igstAmount.toFixed(2)}</Td>
                                                </>
                                            ) : (
                                                <>
                                                    <Td align="center">{item.cgstRate}%</Td>
                                                    <Td align="right">{item.cgstAmount.toFixed(2)}</Td>
                                                    <Td align="center">{item.sgstRate}%</Td>
                                                    <Td align="right">{item.sgstAmount.toFixed(2)}</Td>
                                                </>
                                            )}
                                            <Td align="right">{item.amount.toFixed(2)}</Td>
                                        </tr>
                                    ))}
                                    {(!invoice.items || invoice.items.length === 0) && (
                                        <tr>
                                            <td colSpan={isInterState ? 8 : 9} className="border border-black px-2 py-4 text-center text-slate-500">
                                                No items found for this invoice.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={isInterState ? 7 : 10} className="border border-black px-2 py-1 text-right font-bold">
                                            Grand Total
                                        </td>
                                        <td className="border border-black px-2 py-1 text-right font-bold">
                                            {formatMoney(grandTotal)}
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
                                                <Td align="right">{row.taxableAmt.toFixed(2)}</Td>
                                                {isInterState ? (
                                                    <Td align="right">{row.igstAmt.toFixed(2)}</Td>
                                                ) : (
                                                    <>
                                                        <Td align="right">{row.cgstAmt.toFixed(2)}</Td>
                                                        <Td align="right">{row.sgstAmt.toFixed(2)}</Td>
                                                    </>
                                                )}
                                                <Td align="right">{row.totalTax.toFixed(2)}</Td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* Amount in words */}
                            <div className="px-2 py-2 border-t border-black text-[14px] font-medium">
                                Rupees {amountInWords}
                            </div>

                            {/* Bank details */}
                            <div className="px-2 py-2 border-t border-black text-[13px]">
                                <span className="font-bold">Bank Details :</span> BANK NAME : {company?.bankName || "BANK OF BARODA"}
                                &nbsp;&nbsp; BRANCH : {company?.bankBranch || "PALGHAR BRANCH"} <br />
                                A/c No : {company?.bankAccountNo || "123456789012"} &nbsp;&nbsp; IFSC CODE : {company?.bankIfsc || "BARB0PALGHA"}
                            </div>

                            {/* Notes */}
                            {invoice.notes && (
                                <div className="px-2 py-2 border-t border-black text-[13px]">
                                    <span className="font-bold">Notes :</span> {invoice.notes}
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
                )}
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

const Th: React.FC<{ children: React.ReactNode; w?: string; align?: "left" | "center" | "right" }> = ({ children, w, align = "left" }) => (
    <th
        className={`border border-black px-2 py-1 font-bold bg-[#f7f7f7] text-${align}`}
        style={w ? { width: w } : undefined}
    >
        {children}
    </th>
);

const Td: React.FC<{ children: React.ReactNode; align?: "left" | "center" | "right" }> = ({ children, align = "left" }) => (
    <td className={`border border-black px-2 py-1 align-middle text-${align}`}>{children}</td>
);

export default SalesInvoiceView;