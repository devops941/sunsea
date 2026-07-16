// src/pages/sales/SalesInvoiceView.tsx
import React, { useEffect, useState, useMemo } from "react";
import { FaArrowLeft, FaPrint, FaEye, FaDownload, FaCircleNotch, FaSearch } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector, useDispatch } from "react-redux";
import { salesInvoiceService } from "../../services/salesInvoiceService";
import CustomButton from "../../components/ui/Button/Button";
import SearchInput from "../../components/ui/SearchInput/SearchInput";
import { fetchCompany } from "../../features/company/companySlice";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Component ─────────────────────────────────────────────────────────
const SalesInvoiceView: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<any>();
    const { id: idParam } = useParams<{ id: string }>();

    const [invoice, setInvoice] = useState<any | null>((location.state as any) || null);
    console.log(invoice, "invoice")
    const [loading, setLoading] = useState(!location.state);

    // Left pane list state
    const [invoicesList, setInvoicesList] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const { data: company } = useSelector((state: any) => state.company);

    // Fetch the company settings on mount
    useEffect(() => {
        dispatch(fetchCompany());
    }, [dispatch]);

    // Fetch the list of all invoices
    useEffect(() => {
        const fetchList = async () => {
            try {
                const response = await salesInvoiceService.fetchAll({
                    page: 1,
                    pageSize: 100, // Load a reasonable number of invoices for the list
                });
                setInvoicesList(response.data || []);
            } catch (error) {
                console.error("Failed to load invoice list", error);
            } finally {
                setLoadingList(false);
            }
        };
        fetchList();
    }, []);

    // Fetch details when idParam changes
    useEffect(() => {
        const id = idParam || (location.state as any)?.id;
        if (!id) {
            // If no ID is specified, navigate to the first invoice in the list if available
            if (invoicesList.length > 0) {
                navigate(`/sales-invoices/details/${invoicesList[0].id}`);
            }
            return;
        }

        const load = async () => {
            setLoading(true);
            try {
                const data = await salesInvoiceService.fetchById(id.toString());
                setInvoice(data);
            } catch (error) {
                toast.error("Failed to load invoice details");
            } finally {
                setLoading(false);
            }
        };

        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idParam, invoicesList]);

    // Filter invoices for the left panel search
    const filteredInvoices = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return invoicesList.filter((inv) => {
            const invoiceNo = inv.invoiceNo?.toLowerCase() ?? "";
            const customerName = (inv.customer?.displayName || inv.customer?.firmName || "").toLowerCase();
            return invoiceNo.includes(term) || customerName.includes(term);
        });
    }, [invoicesList, searchTerm]);

    return (
        <div className="flex bg-gray-100 overflow-hidden h-[calc(100vh-115px)]">
            {/* ── Left Sidebar (Invoice List) ── */}
            <div className="hidden md:flex w-72 md:w-80 flex-shrink-0 bg-white border-r border-gray-200 flex-col h-full">
                {/* Header with Title and Search Input */}
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

                {/* List Content */}
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
                                    <span className="font-bold text-gray-900">{formatMoney(inv.grandTotal)}</span>
                                </div>
                            </div>
                        );
                    })}
                    {!loadingList && filteredInvoices.length === 0 && (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            No invoices found.
                        </div>
                    )}
                </div>
            </div>

            {/* ── Right Content (Invoice Details) ── */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {loading || !invoice ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                        <FaCircleNotch className="animate-spin text-primary text-4xl mb-4" />
                        <p className="text-gray-500 font-medium">Loading invoice details...</p>
                    </div>
                ) : (
                    <div className="max-w-5xl mx-auto">
                        {/* Action buttons */}
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <h2 className="text-xl font-bold text-gray-800 m-0">
                                Sales Invoice #{invoice.invoiceNo}
                            </h2>
                            <div className="flex items-center gap-3">
                                <CustomButton text="Print" icon={FaPrint} variant="primary" onClick={() => window.print()} />
                                <CustomButton text="View PDF" icon={FaEye} variant="secondary" onClick={() => window.print()} />
                                <CustomButton text="Download PDF" icon={FaDownload} variant="primary" onClick={() => window.print()} />
                            </div>
                        </div>

                        {/* Print stylesheet */}
                        <style>{`
                            @media print {
                                /* Hide parent containers and other sections */
                                body * {
                                    visibility: hidden;
                                }
                                #printable-invoice-card, #printable-invoice-card * {
                                    visibility: visible;
                                }
                                #printable-invoice-card {
                                    position: absolute;
                                    left: 0;
                                    top: 0;
                                    width: 100%;
                                    background-color: #F4EFE6 !important;
                                    -webkit-print-color-adjust: exact;
                                    print-color-adjust: exact;
                                    box-shadow: none !important;
                                    border-radius: 0 !important;
                                    margin: 0 !important;
                                    padding: 2rem !important;
                                }
                                /* Hide scrollbars and fix page size */
                                html, body {
                                    height: auto;
                                    overflow: visible !important;
                                }
                            }
                        `}</style>

                        {/* Printable Invoice Card */}
                        <div id="printable-invoice-card" className="bg-[#F4EFE6] shadow-lg border-t-4 border-primary rounded-b-lg overflow-hidden">
                            <div className="p-8 sm:p-12">
                                {/* Top Section */}
                                <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-8">
                                    <div>
                                        {company?.logoUrl ? (
                                            <img
                                                src={company.logoUrl}
                                                alt={company.legalName || "Logo"}
                                                className="max-h-16 object-contain mb-1"
                                            />
                                        ) : (
                                            <div className="text-3xl font-black text-primary tracking-tighter mb-1">
                                                {company?.legalName || company?.companyName || "SUNSEA"}
                                            </div>
                                        )}
                                    </div>

                                    <div className="md:text-right flex flex-col md:items-end">
                                        <h1 className="text-3xl font-bold text-gray-900 uppercase mb-6">
                                            SALES INVOICE
                                        </h1>

                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-gray-700 text-left">
                                            <div className="font-semibold text-gray-600">Invoice Number</div>
                                            <div className="font-bold text-gray-900 text-right">{invoice.invoiceNo}</div>

                                            <div className="font-semibold text-gray-600">Invoice Date</div>
                                            <div className="font-bold text-gray-900 text-right">{formatDate(invoice.invoiceDate)}</div>

                                            <div className="font-semibold text-gray-600">Due Date</div>
                                            <div className="font-bold text-gray-900 text-right">{formatDate(invoice.dueDate)}</div>
                                        </div>

                                        <div className="w-full h-px bg-gray-300 mt-4 mb-1"></div>
                                    </div>
                                </div>

                                {/* Address Section */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                            BILL TO
                                        </div>
                                        <div className="text-lg font-bold text-gray-900 mb-2">
                                            {invoice.customer?.displayName || invoice.customer?.firmName || "N/A"}
                                        </div>
                                        <div className="text-sm text-gray-700 leading-relaxed">
                                            {invoice.customer?.billingAddressLine1} <br />
                                            {(invoice.customer?.billingCity || invoice.customer?.billingState) && (
                                                <>
                                                    {invoice.customer?.billingCity}, {invoice.customer?.billingState} — {invoice.customer?.billingPincode} <br />
                                                </>
                                            )}
                                            {invoice.customer?.phone && `Phone: ${invoice.customer.phone}`}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                            SHIP TO
                                        </div>
                                        <div className="text-lg font-bold text-gray-900 mb-2">
                                            {invoice.customer?.displayName || invoice.customer?.firmName || "N/A"}
                                        </div>
                                        <div className="text-sm text-gray-700 leading-relaxed">
                                            {invoice.customer?.shippingAddressLine1 || "Same as Billing Address"} <br />
                                            {(invoice.customer?.shippingCity || invoice.customer?.shippingState) && (
                                                <>
                                                    {invoice.customer?.shippingCity}, {invoice.customer?.shippingState} — {invoice.customer?.shippingPincode}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Table Section */}
                                <div className="mb-10">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-gray-800 text-xs font-bold text-gray-900 uppercase tracking-wider">
                                                <th className="py-3 px-2 w-12 text-center">#</th>
                                                <th className="py-3 px-2">ITEM DESCRIPTION</th>
                                                <th className="py-3 px-2 w-24 text-right">QTY</th>
                                                <th className="py-3 px-2 w-32 text-right">RATE</th>
                                                <th className="py-3 px-2 w-24 text-right">TAX</th>
                                                <th className="py-3 px-2 w-32 text-right">AMOUNT</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-gray-800">
                                            {invoice.items?.map((item: any, idx: number) => (
                                                <tr key={item.id || idx} className="border-b border-gray-300">
                                                    <td className="py-4 px-2 text-center font-medium text-gray-600">{idx + 1}</td>
                                                    <td className="py-4 px-2">
                                                        <div className="font-bold text-gray-900">
                                                            {item.product?.productName || "Item Name"}
                                                        </div>
                                                        {item.product?.productCode && (
                                                            <div className="text-xs text-gray-500 mt-0.5">
                                                                SKU: {item.product.productCode}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-2 text-right font-semibold">{item.quantity ?? item.qty}</td>
                                                    <td className="py-4 px-2 text-right">{formatMoney(item.unitPrice ?? item.rate)}</td>
                                                    <td className="py-4 px-2 text-right font-medium">
                                                        {((item.taxRate ?? item.taxPercent) !== undefined && (item.taxRate ?? item.taxPercent) !== null) ? `${item.taxRate ?? item.taxPercent}%` : "0%"}
                                                    </td>
                                                    <td className="py-4 px-2 text-right font-bold text-gray-900">{formatMoney(item.totalAmount ?? item.total ?? item.amount)}</td>
                                                </tr>
                                            ))}
                                            {(!invoice.items || invoice.items.length === 0) && (
                                                <tr>
                                                    <td colSpan={6} className="py-8 text-center text-gray-500 text-sm">
                                                        No items found for this invoice.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Totals Section */}
                                <div className="flex flex-col items-end mb-8">
                                    <div className="w-full md:w-1/2 lg:w-1/3 space-y-3">
                                        <div className="flex justify-between text-sm font-semibold text-gray-700 px-2">
                                            <span>Subtotal</span>
                                            <span>{formatMoney(invoice.subTotal)}</span>
                                        </div>

                                        {Number(invoice.discountTotal) !== 0 && (
                                            <div className="flex justify-between text-sm font-semibold text-gray-700 px-2">
                                                <span>Discount</span>
                                                <span>− {formatMoney(invoice.discountTotal)}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between text-sm font-semibold text-gray-700 px-2">
                                            <span>Total Tax</span>
                                            <span>+ {formatMoney(invoice.taxTotal)}</span>
                                        </div>

                                        <div className="border-t-2 border-gray-800 my-2"></div>

                                        <div className="flex justify-between text-lg font-bold text-gray-900 px-2">
                                            <span>Grand Total</span>
                                            <span>{formatMoney(invoice.grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer / Notes */}
                                {invoice.notes && (
                                    <div className="mt-12 pt-6 border-t border-gray-300">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                            Notes / Payment Terms
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed max-w-2xl">
                                            {invoice.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesInvoiceView;
