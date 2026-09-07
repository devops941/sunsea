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
import { customerService } from "../../services/customerService";

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

// Extracts address from CustomerAddress[] (addresses stored as JSON in each record)
const getCustomerAddress = (cust: any) => {
    if (!cust || !Array.isArray(cust.addresses) || cust.addresses.length === 0) return null;
    const defaultEntry = cust.addresses.find((a: any) => a.is_default) || cust.addresses[0];
    const addr = defaultEntry?.address;
    if (!addr || typeof addr !== "object") return null;
    return {
        addressLine1: addr.addressLine1 || addr.line1 || "",
        addressLine2: addr.addressLine2 || addr.line2 || "",
        city: addr.city || "",
        state: addr.state || "",
        pincode: addr.pincode || "",
    };
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
    const [customerBalance, setCustomerBalance] = useState<{ amount: number; type: string } | null>(null);

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
        if (!idToLoad) return;
        setLoading(true);
        try {
            const data = await salesInvoiceService.fetchById(idToLoad);
            setInvoice(data);
        } catch (error: any) {
            const status = error?.response?.status;
            if (status === 404) {
                toast.error("Invoice not found");
                navigate("/sales-invoices");
            } else {
                toast.error("Failed to load invoice details");
            }
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    // Load invoice details when idParam changes
    useEffect(() => {
        const id = idParam || (location.state as any)?.id;
        if (!id) return;
        loadDetail(id.toString());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idParam]);

    // Fetch customer balance when invoice loads
    useEffect(() => {
        if (!invoice?.customerId) { setCustomerBalance(null); return; }
        customerService.fetchById(invoice.customerId)
            .then((cust: any) => {
                const bal = Number(cust.balanceAmount ?? cust.netBalance ?? cust.openingBalance ?? 0);
                const bType = (cust.balanceType || cust.openingBalanceType || "").toString().toUpperCase();
                setCustomerBalance({ amount: bal, type: bType.startsWith("D") ? "Dr" : bType.startsWith("C") ? "Cr" : "" });
            })
            .catch(() => setCustomerBalance(null));
    }, [invoice?.customerId, invoice?.id]);

    // Auto-navigate to first invoice only when there is no id at all
    useEffect(() => {
        const id = idParam || (location.state as any)?.id;
        if (!id && !loadingList && invoicesList.length > 0) {
            navigate(`/sales-invoices/details/${invoicesList[0].id}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoicesList, loadingList]);

    // Keyboard navigation: Escape to go back, ArrowUp/ArrowDown to navigate list, F10 to print
    const filteredInvoices = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return invoicesList.filter((inv) => {
            const invoiceNo = inv.invoiceNo?.toLowerCase() ?? "";
            const customerName = (inv.customer?.displayName || inv.customer?.firmName || "").toLowerCase();
            return invoiceNo.includes(term) || customerName.includes(term);
        });
    }, [invoicesList, searchTerm]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

            if (e.key === "Escape") {
                e.preventDefault();
                navigate("/sales-invoices");
                return;
            }

            if (e.key === "F10") {
                e.preventDefault();
                window.print();
                return;
            }

            // Arrow navigation through sidebar list when not typing in search
            if (!inField && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                if (filteredInvoices.length === 0) return;
                const currentIndex = filteredInvoices.findIndex((inv) => String(inv.id) === String(idParam || invoice?.id));
                if (e.key === "ArrowDown") {
                    const nextIdx = Math.min((currentIndex >= 0 ? currentIndex : -1) + 1, filteredInvoices.length - 1);
                    if (nextIdx !== currentIndex && filteredInvoices[nextIdx]) {
                        e.preventDefault();
                        navigate(`/sales-invoices/details/${filteredInvoices[nextIdx].id}`);
                    }
                } else if (e.key === "ArrowUp") {
                    const prevIdx = Math.max((currentIndex >= 0 ? currentIndex : 1) - 1, 0);
                    if (prevIdx !== currentIndex && filteredInvoices[prevIdx]) {
                        e.preventDefault();
                        navigate(`/sales-invoices/details/${filteredInvoices[prevIdx].id}`);
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filteredInvoices, idParam, invoice, navigate]);

    const handleSocketUpdate = useCallback(() => {
        fetchList();
        // Re-load current invoice detail only if we have a valid database id (from URL param)
        if (idParam) {
            loadDetail(idParam);
        }
    }, [fetchList, idParam, loadDetail]);

    useSocketSync("salesInvoice", undefined, handleSocketUpdate);

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
    const totalTax = totalCgst + totalSgst + totalIgst;
    const invoiceDiscount = Number(invoice?.totalDiscount || 0);
    const invDiscountValue = Number(invoice?.discountValue || 0);
    const invDiscountType = (invoice as any)?.discountType || "";
    const grandTotal = Number(invoice?.grandTotal ?? (totalTaxable + totalTax));

    // Parse charge rows from narration
    const CHARGE_META: Record<string, { label: string; sign: 1 | -1 }> = {
        LORRY_FREIGHT: { label: "Lorry Freight", sign: 1 }, LORRY_FREIGHT_MINUS: { label: "Lorry Freight", sign: -1 },
        OTHERS_PLUS: { label: "Others", sign: 1 }, OTHERS_MINUS: { label: "Others", sign: -1 },
        ROUND_OFF_PLUS: { label: "Round Off", sign: 1 }, ROUND_OFF_MINUS: { label: "Round Off", sign: -1 },
        TDS: { label: "TDS", sign: -1 },
    };
    const viewChargeRows = useMemo(() => {
        const rows: any[] = [];
        // From narration
        if (invoice?.narration) {
            try {
                const parsed = JSON.parse(invoice.narration);
                (parsed?.__chargeRows__ || [])
                    .filter((r: any) => Number(r.amount) > 0)
                    .forEach((r: any) => rows.push({ label: CHARGE_META[r.type]?.label || r.type, sign: CHARGE_META[r.type]?.sign ?? 1, amount: Number(r.amount) }));
            } catch {}
        }
        // From billSundry
        const sundry = invoice?.billSundry;
        if (Array.isArray(sundry)) {
            sundry.filter((r: any) => Number(r.amount) > 0).forEach((r: any) => {
                const typeStr = String(r.type || "").toUpperCase();
                const isDeduction = typeStr.includes("DISCOUNT") || typeStr.includes("MINUS");
                const cleanLabel = (r.type || "Sundry")
                    .replace(/_/g, " ")
                    .replace(/\b(MINUS|PLUS|minus|plus)\b/gi, "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
                rows.push({ label: cleanLabel || "Sundry", sign: isDeduction ? -1 : 1, amount: Number(r.amount) });
            });
        }
        return rows;
    }, [invoice?.narration, invoice?.billSundry]);

    const totalWeight = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + Number(i.weight || 0), 0), [itemsWithTax]);

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
            const availableHeight = pageHeight - 2 * margin;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Use full available printable height for 1-page document to match print preview height
            const renderHeight = imgHeight < availableHeight ? availableHeight : imgHeight;

            let heightLeft = renderHeight;
            let position = margin;

            pdf.addImage(imgData, "PNG", margin, position, imgWidth, renderHeight);
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
        <div className="flex bg-page overflow-hidden h-[calc(100vh-115px)] print:block print:h-auto print:overflow-visible print:bg-white">
            {/* ── Left Sidebar (Invoice List) ── */}
            <div className="hidden md:flex w-72 md:w-80 flex-shrink-0 bg-card border-r border-line flex-col h-full no-print">
                <div className="p-4 border-b border-line flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate("/sales-invoices")}
                            className="flex items-center gap-2 text-ink hover:text-primary font-bold text-lg transition-colors"
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

                <div className="flex-1 overflow-y-auto divide-y divide-line-soft">
                    {loadingList ? (
                        <div className="flex items-center justify-center py-8">
                            <FaCircleNotch className="animate-spin text-ink-subtle text-xl" />
                        </div>
                    ) : filteredInvoices.map((inv) => {
                        const isSelected = String(inv.id) === String(idParam || invoice?.id);
                        return (
                            <div
                                key={inv.id}
                                onClick={() => navigate(`/sales-invoices/details/${inv.id}`)}
                                className={`p-4 cursor-pointer hover:bg-card-2 transition-colors ${isSelected ? "bg-primary/10 border-l-4 border-primary" : ""}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-ink">{inv.invoiceNo}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${inv.status?.toUpperCase() === "PAID"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                        }`}>
                                        {inv.status || "Draft"}
                                    </span>
                                </div>
                                <div className="text-sm text-ink-muted mb-2">
                                    {inv.customer?.displayName || inv.customer?.firmName || "N/A"}
                                </div>
                                <div className="flex justify-between items-center text-xs text-ink-subtle">
                                    <span>{formatDate(inv.invoiceDate)}</span>
                                    <span className="font-bold text-ink">₹{formatMoney(inv.grandTotal)}</span>
                                </div>
                            </div>
                        );
                    })}
                    {!loadingList && filteredInvoices.length === 0 && (
                        <div className="p-8 text-center text-ink-muted text-sm">No invoices found.</div>
                    )}
                </div>
            </div>

            {/* ── Right Content (Invoice Details) ── */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 print:overflow-visible print:h-auto print:p-0 print:block">
                {loading || !invoice ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                        <FaCircleNotch className="animate-spin text-primary text-4xl mb-4" />
                        <p className="text-ink-muted font-medium">Loading invoice details...</p>
                    </div>
                ) : (
                    <div className="max-w-5xl mx-auto">
                        {/* Action buttons */}
                        <div className="flex items-center justify-between gap-4 mb-6 no-print">
                            <h2 className="text-xl font-bold text-ink m-0">
                                Sales Invoice #{invoice.invoiceNo}
                            </h2>
                            <div className="flex items-center gap-3">
                                <CustomButton text="Print" icon={FaPrint} variant="primary" onClick={() => window.print()} />
                                <CustomButton text="Download PDF" icon={FaDownload} variant="secondary" onClick={handleDownloadPdf} />
                            </div>
                        </div>

                        {/* Print + screen overrides — invoice card always white/black regardless of theme */}
                        <style>{`
                            #printable-invoice-card,
                            #printable-invoice-card * {
                                color: #000 !important;
                                border-color: #000 !important;
                            }
                            #printable-invoice-card {
                                background: #fff !important;
                            }
                            @media print {
                                @page { size: A4 portrait; margin: 10mm; }
                                html, body {
                                    background: #fff !important;
                                    height: auto;
                                    overflow: visible !important;
                                    margin: 0 !important;
                                    padding: 0 !important;
                                }
                                body * { visibility: hidden !important; }
                                #printable-invoice-card,
                                #printable-invoice-card * {
                                    visibility: visible !important;
                                    -webkit-print-color-adjust: exact;
                                    print-color-adjust: exact;
                                }
                                #printable-invoice-card {
                                    position: absolute;
                                    left: 0; top: 0;
                                    width: 100%;
                                    height: 100%;
                                    box-shadow: none !important;
                                    margin: 0 !important;
                                    padding: 4mm !important;
                                    font-size: 12px !important;
                                    border-width: 1.5px !important;
                                }
                                #printable-invoice-card table {
                                    font-size: 11px !important;
                                }
                                #printable-invoice-card td,
                                #printable-invoice-card th {
                                    padding: 2px 4px !important;
                                }
                                .no-print { display: none !important; visibility: hidden !important; }
                                .wt-hide { display: none !important; visibility: hidden !important; }
                            }
                        `}</style>

                        {/* GST Tax Invoice Card — always white bg, black text */}
                        <div
                            id="printable-invoice-card"
                            className="font-[Arial,sans-serif] border-[2px] w-full min-h-[100mm] flex flex-col justify-between box-border text-[13px] shadow-lg font-medium p-6"
                        >
                            <div>
                                {/* Top bar */}
                               

                                {/* Header */}
                                <div className="text-center border-b-[2px] border-black px-3 py-3">
                                    <div className="text-base uppercase font-bold tracking-[3px]">Tax Invoice</div>
                                </div>

                                {/* Invoice meta block */}
                                <div className="flex border-b-[2px] border-black">
                                    <div className="flex-1 border-r-[2px] border-black p-3 space-y-1.5">
                                        <MetaRow label="Invoice No." value={invoice.invoiceNo} />
                                        <MetaRow label="Dated" value={formatDate(invoice.invoiceDate)} />
                                        <MetaRow label="Due Date" value={invoice.dueDate ? formatDate(invoice.dueDate) : "—"} />
                                    </div>
                                    <div className="flex-1 p-3 space-y-1.5">
                                        <MetaRow label="Transport" value={(invoice.transport as any)?.name || invoice.transportName || "—"} />
                                        {invoice.salesOrder?.orderNo && (
                                            <MetaRow label="Ref. Order No." value={invoice.salesOrder.orderNo} />
                                        )}
                                        {invoice.numberOfBundle && (
                                            <MetaRow label="No. of Bundle" value={String(invoice.numberOfBundle)} />
                                        )}
                                    </div>
                                </div>

                                {/* Billed To / Shipped To */}
                                {(() => {
                                    const cust = invoice.customer;
                                    const so = invoice.salesOrder;
                                    const custName = cust?.displayName || cust?.firmName || "N/A";
                                    const mobile = so?.mobile || getMobileFromCustomer(cust);

                                    // Billing: from sales order or customer
                                    const billingAddr = {
                                        line1: so?.billingAddressLine1 || cust?.billingAddressLine1 || "",
                                        city: so?.billingCity || cust?.billingCity || "",
                                        state: so?.billingState || cust?.billingState || "",
                                        pincode: so?.billingPincode || cust?.billingPincode || "",
                                    };
                                    // Fallback to customer addresses if empty
                                    if (!billingAddr.line1) {
                                        const addr = getCustomerAddress(cust);
                                        if (addr) {
                                            billingAddr.line1 = addr.addressLine1;
                                            billingAddr.city = addr.city;
                                            billingAddr.state = addr.state;
                                            billingAddr.pincode = addr.pincode;
                                        }
                                    }

                                    // Shipping: from invoice → sales order → customer addresses → billing fallback
                                    const shippingAddr = {
                                        line1: invoice.shippingAddressLine1 || so?.shippingAddressLine1 || "",
                                        city: invoice.shippingCity || so?.shippingCity || "",
                                        state: invoice.shippingState || so?.shippingState || "",
                                        pincode: invoice.shippingPincode || so?.shippingPincode || "",
                                    };
                                    if (!shippingAddr.line1 && Array.isArray(cust?.addresses) && cust.addresses.length > 1) {
                                        const secondAddr = cust.addresses[1]?.address || cust.addresses[1];
                                        shippingAddr.line1 = secondAddr?.addressLine1 || secondAddr?.line1 || "";
                                        shippingAddr.city = secondAddr?.city || "";
                                        shippingAddr.state = secondAddr?.state || "";
                                        shippingAddr.pincode = secondAddr?.pincode || "";
                                    }
                                    if (!shippingAddr.line1) {
                                        shippingAddr.line1 = billingAddr.line1;
                                        shippingAddr.city = billingAddr.city;
                                        shippingAddr.state = billingAddr.state;
                                        shippingAddr.pincode = billingAddr.pincode;
                                    }

                                    const formatAddr = (a: { line1: string; city: string; state: string; pincode: string }) =>
                                        [a.line1, a.city, a.state ? `${a.state}${a.pincode ? ` - ${a.pincode}` : ""}` : a.pincode].filter(Boolean).join(", ");

                                    return (
                                        <div className="flex border-b-[2px] border-black">
                                            <div className="flex-1 border-r-[2px] border-black p-3">
                                                <div className="font-bold mb-1.5 text-[12px] uppercase tracking-wide">Billed to :</div>
                                                <div className="font-semibold">{custName}</div>
                                                <div className="font-semibold">{formatAddr(billingAddr)}</div>
                                                {mobile && (
                                                    <div className="mt-1 font-semibold">Mobile: {mobile}</div>
                                                )}
                                            </div>
                                            <div className="flex-1 p-3">
                                                <div className="font-bold mb-1.5 text-[12px] uppercase tracking-wide">Shipped to :</div>
                                                <div className="font-semibold">{custName}</div>
                                                <div className="font-semibold">{formatAddr(shippingAddr)}</div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Items Table */}
                                <table className="w-full border-collapse text-[13px]">
                                    <thead>
                                        <tr>
                                            <Th w="35px">S.N.</Th>
                                            <Th>Description of Goods</Th>
                                            <Th w="55px" align="right">Qty.</Th>
                                            <th className="border border-black px-2 py-1 text-[11px] font-bold uppercase bg-gray-100 wt-hide" style={{ width: "65px", textAlign: "right" }}>Weight(KG)</th>
                                            <Th w="60px" align="right">Price</Th>
                                            <Th w="80px" align="right">Amount(Rs.)</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemsWithTax.map((item: any, idx: number) => (
                                            <tr key={item.id || idx} style={{ height: "30px" }}>
                                                <Td align="center">{idx + 1}.</Td>
                                                <Td>{item.description || item.product?.productName || "N/A"}</Td>
                                                <Td align="right">{item.qty}</Td>
                                                <td className="border border-black px-2 py-1 text-right wt-hide">{Number(item.weight || 0).toFixed(1)}</td>
                                                <Td align="right">{item.rate.toFixed(2)}</Td>
                                                <Td align="right">{item.amount.toFixed(2)}</Td>
                                            </tr>
                                        ))}
                                        {Array.from({ length: Math.max(0, 8 - itemsWithTax.length) }).map((_, idx) => (
                                            <tr key={`empty-${idx}`} style={{ height: "24px" }}>
                                                <Td align="center"></Td>
                                                <Td></Td>
                                                <Td align="right"></Td>
                                                <td className="border border-black px-2 py-1 wt-hide"></td>
                                                <Td align="right"></Td>
                                                <Td align="right"></Td>
                                            </tr>
                                        ))}
                                        {(!invoice.items || invoice.items.length === 0) && (
                                            <tr>
                                                <td colSpan={6} className="border border-black px-2 py-4 text-center text-slate-500">
                                                    No items found for this invoice.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={3} className="border border-black px-2 py-1 text-right font-bold">Total</td>
                                            <td className="border border-black px-2 py-1 text-right font-bold wt-hide">{totalWeight.toFixed(1)}</td>
                                            <td className="border border-black px-2 py-1"></td>
                                            <td className="border border-black px-2 py-1 text-right font-bold">{formatMoney(totalTaxable)}</td>
                                        </tr>
                                        {invoiceDiscount > 0 && (
                                            <>
                                                <tr>
                                                    <td colSpan={4} className="border border-black px-2 py-1 text-right text-[13px] text-red-600">
                                                        Discount {invDiscountValue > 0 ? `(${invDiscountValue}${invDiscountType === "PERCENT" ? "%" : " Flat"})` : ""} (-)
                                                    </td>
                                                    <td className="border border-black px-2 py-1 wt-hide"></td>
                                                    <td className="border border-black px-2 py-1 text-right text-[13px] text-red-600">- {formatMoney(invoiceDiscount)}</td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={4} className="border border-black px-2 py-1 text-right text-[13px]">Taxable Amount</td>
                                                    <td className="border border-black px-2 py-1 wt-hide"></td>
                                                    <td className="border border-black px-2 py-1 text-right text-[13px]">{formatMoney(totalTaxable - invoiceDiscount)}</td>
                                                </tr>
                                            </>
                                        )}
                                        {totalTax > 0 && (isInterState ? (
                                            <tr>
                                                <td colSpan={4} className="border border-black px-2 py-1 text-right text-[13px]">IGST</td>
                                                <td className="border border-black px-2 py-1 wt-hide"></td>
                                                <td className="border border-black px-2 py-1 text-right text-[13px]">+ {formatMoney(totalIgst)}</td>
                                            </tr>
                                        ) : (
                                            <>
                                                <tr>
                                                    <td colSpan={4} className="border border-black px-2 py-1 text-right text-[13px]">CGST</td>
                                                    <td className="border border-black px-2 py-1 wt-hide"></td>
                                                    <td className="border border-black px-2 py-1 text-right text-[13px]">+ {formatMoney(totalCgst)}</td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={4} className="border border-black px-2 py-1 text-right text-[13px]">SGST</td>
                                                    <td className="border border-black px-2 py-1 wt-hide"></td>
                                                    <td className="border border-black px-2 py-1 text-right text-[13px]">+ {formatMoney(totalSgst)}</td>
                                                </tr>
                                            </>
                                        ))}
                                        {viewChargeRows.map((cr: any, idx: number) => (
                                            <tr key={idx}>
                                                <td colSpan={4} className="border border-black px-2 py-1 text-right text-[11px]">
                                                    {cr.label}
                                                </td>
                                                <td className="border border-black px-2 py-1 wt-hide"></td>
                                                <td className="border border-black px-2 py-1 text-right text-[11px]">
                                                    {cr.sign === 1 ? "+" : "-"} {formatMoney(cr.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <td colSpan={4} className="border border-black px-2 py-1 text-right font-bold">Grand Total</td>
                                            <td className="border border-black px-2 py-1 wt-hide"></td>
                                            <td className="border border-black px-2 py-1 text-right font-bold">{formatMoney(grandTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>

                                {/* Amount in words */}
                                <div className="px-3 py-2.5 border-t-[2px] border-black text-[13px]">
                                    <span className="font-bold">Amount in Words:</span> Rupees {amountInWords}
                                </div>

                                {/* Customer Balance */}
                                {customerBalance && (
                                    <div className="border-t border-black">
                                        {(() => {
                                            const isDr = customerBalance.type === "Dr";
                                            const invoiceAmt = grandTotal;
                                            const closingRaw = isDr ? customerBalance.amount + invoiceAmt : customerBalance.amount - invoiceAmt;
                                            const closingAbs = Math.abs(closingRaw);
                                            const closingType = closingRaw > 0 ? (isDr ? "Dr" : "Cr") : closingRaw < 0 ? (isDr ? "Cr" : "Dr") : "";
                                            return (
                                                <table className="w-full text-[13px]">
                                                    <tbody>
                                                        <tr>
                                                            <td className="px-2 py-1 text-right">Opening Balance</td>
                                                            <td className="px-2 py-1 text-right w-[120px]">
                                                                ₹{customerBalance.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {customerBalance.type}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td className="px-2 py-1 text-right">Invoice Amount</td>
                                                            <td className="px-2 py-1 text-right">
                                                                ₹{invoiceAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td className="px-2 py-1 text-right font-bold text-[14px]">Closing Balance</td>
                                                            <td className="px-2 py-1 text-right font-bold text-[15px]">
                                                                ₹{closingAbs.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {closingType}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            <div>
                                {/* Notes */}
                                {invoice.notes && (
                                    <div className="px-2 py-2 border-t border-black text-[13px]">
                                        <span className="font-bold">Notes :</span> {invoice.notes}
                                    </div>
                                )}

                                {/* Footer: Terms + Signature */}
                                <div className="flex border-t-[2px] border-black text-[13px]">
                                    <div className="flex-1 border-r border-black p-3">
                                        <div className="font-bold text-[12px] uppercase tracking-wide">Receiver's Signature :</div>
                                        <div className="mt-10"></div>
                                    </div>
                                    <div className="flex-1 p-3 flex flex-col justify-between">
                                        <div></div>
                                        <div className="text-right font-bold mt-10">
                                            For {company?.legalName || company?.companyName || "Company"}
                                        </div>
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

export default SalesInvoiceView;