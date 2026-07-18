import React, { useState, useCallback, useEffect, useMemo } from "react";
import { FaPrint, FaEye, FaDownload, FaTrash, FaArrowLeft, FaFilePdf } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector, useDispatch } from "react-redux";

import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { grnInvoiceService } from "../../../../services/grnInvoiceService";
import CustomButton from "../../../../components/ui/Button/Button";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import { fetchCompany } from "../../../../features/company/companySlice";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const GrnInvoiceViewPage: React.FC = () => {
    const navigate = useNavigate();
    const { id: idParam } = useParams<{ id: string }>();
    const dispatch = useDispatch<any>();
    const { data: company } = useSelector((state: any) => state.company);

    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(true);

    // Left pane list state
    const [invoicesList, setInvoicesList] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Fetch company settings on mount
    useEffect(() => {
        dispatch(fetchCompany());
    }, [dispatch]);

    // Fetch all invoices for the sidebar list
    const fetchInvoicesList = useCallback(async () => {
        setLoadingList(true);
        try {
            const response = await grnInvoiceService.fetchAll({
                page: 1,
                pageSize: 100,
            });
            setInvoicesList(response.data || []);
        } catch (error) {
            console.error("Failed to load sidebar list", error);
        } finally {
            setLoadingList(false);
        }
    }, []);

    useEffect(() => {
        fetchInvoicesList();
    }, [fetchInvoicesList]);

    // Load active invoice detail by ID
    const loadDetail = useCallback(async (id: string) => {
        setLoadingDetail(true);
        try {
            const details = await grnInvoiceService.fetchById(id);
            setSelectedItem(details);
        } catch (error) {
            toast.error("Failed to load invoice details");
            navigate("/invoice");
        } finally {
            setLoadingDetail(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (idParam) {
            loadDetail(idParam);
        }
    }, [idParam, loadDetail]);

    const handleDeleteClick = (id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;

        try {
            await grnInvoiceService.delete(itemToDelete);
            toast.success("Invoice deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);

            // Determine redirect/selection after delete
            const remaining = invoicesList.filter(inv => String(inv.id) !== String(itemToDelete));
            setInvoicesList(remaining);
            if (remaining.length > 0) {
                navigate(`/invoice/details/${remaining[0].id}`);
            } else {
                navigate("/invoice");
            }
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete invoice");
        }
    };

    // Filter sidebar list
    const filteredInvoices = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return invoicesList.filter((inv) => {
            const grnNumber = inv.grnNumber?.toLowerCase() ?? "";
            const invoiceNo = inv.invoiceNo?.toLowerCase() ?? "";
            const supplierName = (inv.supplier?.displayName || inv.supplier?.legalName || "").toLowerCase();
            return grnNumber.includes(term) || invoiceNo.includes(term) || supplierName.includes(term);
        });
    }, [invoicesList, searchTerm]);

    return (
        <div className="flex bg-gray-100 overflow-hidden h-[calc(100vh-115px)]">
            {/* ── Left Sidebar ── */}
            <div className="hidden md:flex w-72 md:w-80 flex-shrink-0 bg-white border-r border-gray-200 flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex flex-col gap-3">
                    <button
                        onClick={() => navigate("/invoice")}
                        className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-bold text-lg bg-transparent border-none outline-none cursor-pointer text-left"
                    >
                        <FaArrowLeft className="text-sm" /> Bill & Invoice
                    </button>
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
                        <CommonLoader text="Loading invoices..." fullScreen={false} />
                    ) : filteredInvoices.map((inv) => {
                        const isSelected = String(inv.id) === String(idParam);
                        return (
                            <div
                                key={inv.id}
                                onClick={() => navigate(`/invoice/details/${inv.id}`)}
                                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? "bg-primary/10 border-l-4 border-primary" : ""}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-gray-900">{inv.invoiceNo || inv.grnNumber}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${inv.paymentStatus?.toUpperCase() === "PAID"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                        }`}>
                                        {inv.paymentStatus || "Unpaid"}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600 mb-2 truncate">
                                    {inv.supplier?.displayName || inv.supplier?.legalName || "N/A"}
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-400">
                                    <span>{formatDate(inv.grnDate)}</span>
                                    <span className="font-bold text-gray-900">{formatMoney(inv.netAmount)}</span>
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

            {/* ── Right Content Panel ── */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {loadingDetail ? (
                    <CommonLoader text="Loading invoice details..." fullScreen={false} />
                ) : !selectedItem ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400">
                        <p className="text-base font-semibold">Select an invoice from the sidebar to view details.</p>
                    </div>
                ) : (
                    <div className="max-w-5xl mx-auto">
                        {/* Action buttons */}
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate("/invoice")}
                                    className="md:hidden flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-semibold bg-transparent border-none outline-none cursor-pointer"
                                >
                                    <FaArrowLeft className="text-xs" /> Back
                                </button>
                                <h2 className="text-xl font-bold text-gray-800 m-0">
                                    GRN Invoice #{selectedItem.invoiceNo || selectedItem.grnNumber}
                                </h2>
                            </div>
                            <div className="flex items-center gap-3">
                                <CustomButton text="Print" icon={FaPrint} variant="primary" onClick={() => window.print()} />
                                <CustomButton text="View PDF" icon={FaEye} variant="secondary" onClick={() => window.print()} />
                                <CustomButton text="Download PDF" icon={FaDownload} variant="primary" onClick={() => window.print()} />
                            </div>
                        </div>

                        {/* Print stylesheet */}
                        <style>{`
                            @media print {
                                body * {
                                    visibility: hidden;
                                }
                                #printable-grn-invoice-card, #printable-grn-invoice-card * {
                                    visibility: visible;
                                }
                                #printable-grn-invoice-card {
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
                            }
                        `}</style>

                        {/* Printable Invoice Card */}
                        <div id="printable-grn-invoice-card" className="bg-[#F4EFE6] shadow-lg border-t-4 border-primary rounded-b-lg overflow-hidden text-slate-800">
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
                                            GRN INVOICE
                                        </h1>

                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-gray-700 text-left">
                                            <div className="font-semibold text-gray-600">GRN Number</div>
                                            <div className="font-bold text-gray-900 text-right">{selectedItem.grnNumber}</div>

                                            <div className="font-semibold text-gray-600">Invoice Number</div>
                                            <div className="font-bold text-gray-900 text-right">{selectedItem.invoiceNo || "N/A"}</div>

                                            <div className="font-semibold text-gray-600">GRN Date</div>
                                            <div className="font-bold text-gray-900 text-right">{formatDate(selectedItem.grnDate)}</div>

                                            {selectedItem.billDueDate && (
                                                <>
                                                    <div className="font-semibold text-gray-600">Due Date</div>
                                                    <div className="font-bold text-gray-900 text-right">{formatDate(selectedItem.billDueDate)}</div>
                                                </>
                                            )}
                                        </div>

                                        <div className="w-full h-px bg-gray-300 mt-4 mb-1"></div>
                                    </div>
                                </div>

                                {/* Address Section */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                            BILL FROM (SUPPLIER)
                                        </div>
                                        <div className="text-lg font-bold text-gray-900 mb-2">
                                            {selectedItem.supplier?.displayName || selectedItem.supplier?.legalName || "N/A"}
                                        </div>
                                        <div className="text-sm text-gray-700 leading-relaxed">
                                            {selectedItem.billingAddressLine1} <br />
                                            {(selectedItem.billingCity || selectedItem.billingState) && (
                                                <>
                                                    {selectedItem.billingCity}, {selectedItem.billingState} — {selectedItem.billingPincode} <br />
                                                </>
                                            )}
                                            {selectedItem.supplier?.phone && `Phone: ${selectedItem.supplier.phone}`}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                            SHIP TO (STORE)
                                        </div>
                                        <div className="text-lg font-bold text-gray-900 mb-2">
                                            {selectedItem.store?.storeName || "N/A"}
                                        </div>
                                        <div className="text-sm text-gray-700 leading-relaxed">
                                            {selectedItem.shippingAddressLine1 || "Same as Billing Address"} <br />
                                            {(selectedItem.shippingCity || selectedItem.shippingState) && (
                                                <>
                                                    {selectedItem.shippingCity}, {selectedItem.shippingState} — {selectedItem.shippingPincode}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Table Section */}
                                <div className="mb-10 overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[650px]">
                                        <thead>
                                            <tr className="border-b-2 border-gray-800 text-xs font-bold text-gray-900 uppercase tracking-wider">
                                                <th className="py-3 px-2 w-12 text-center">#</th>
                                                <th className="py-3 px-2">MATERIAL DESCRIPTION</th>
                                                <th className="py-3 px-2 w-24 text-right">QTY</th>
                                                <th className="py-3 px-2 w-24 text-center">UOM</th>
                                                <th className="py-3 px-2 w-32 text-right">RATE</th>
                                                <th className="py-3 px-2 w-24 text-right">TAX</th>
                                                <th className="py-3 px-2 w-32 text-right">AMOUNT</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-gray-800">
                                            {selectedItem.items?.map((item: any, idx: number) => (
                                                <tr key={item.id || idx} className="border-b border-gray-300">
                                                    <td className="py-4 px-2 text-center font-medium text-gray-600">{idx + 1}</td>
                                                    <td className="py-4 px-2">
                                                        <div className="font-bold text-gray-900">
                                                            {item.rawMaterial?.materialName || item.description || "N/A"}
                                                        </div>
                                                        {item.productId && (
                                                            <div className="text-xs text-gray-500 mt-0.5">
                                                                SKU: {item.productId}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-2 text-right font-semibold">{item.quantity}</td>
                                                    <td className="py-4 px-2 text-center font-medium text-gray-600">{item.uom || "—"}</td>
                                                    <td className="py-4 px-2 text-right">{formatMoney(item.unitPrice)}</td>
                                                    <td className="py-4 px-2 text-right font-medium">
                                                        {item.tax ? `${item.tax}%` : "0%"}
                                                    </td>
                                                    <td className="py-4 px-2 text-right font-bold text-gray-900">{formatMoney(item.lineTotal || item.taxableAmount)}</td>
                                                </tr>
                                            ))}
                                            {(!selectedItem.items || selectedItem.items.length === 0) && (
                                                <tr>
                                                    <td colSpan={7} className="py-8 text-center text-gray-500 text-sm">
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
                                            <span>{formatMoney(selectedItem.subtotal)}</span>
                                        </div>

                                        {Number(selectedItem.totalDiscount) !== 0 && (
                                            <div className="flex justify-between text-sm font-semibold text-gray-700 px-2">
                                                <span>Discount</span>
                                                <span>− {formatMoney(selectedItem.totalDiscount)}</span>
                                            </div>
                                        )}

                                        {selectedItem.totalIgst > 0 ? (
                                            <div className="flex justify-between text-sm font-semibold text-gray-700 px-2">
                                                <span>Total IGST</span>
                                                <span className="text-green-600">+ {formatMoney(selectedItem.totalIgst)}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between text-sm font-semibold text-gray-700 px-2">
                                                    <span>Total CGST</span>
                                                    <span className="text-blue-600">+ {formatMoney(selectedItem.totalCgst)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm font-semibold text-gray-700 px-2">
                                                    <span>Total SGST</span>
                                                    <span className="text-purple-600">+ {formatMoney(selectedItem.totalSgst)}</span>
                                                </div>
                                            </>
                                        )}

                                        <div className="border-t-2 border-gray-800 my-2"></div>

                                        <div className="flex justify-between text-lg font-bold text-gray-900 px-2">
                                            <span>Grand Total</span>
                                            <span>{formatMoney(selectedItem.netAmount)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Attachment Section */}
                                {selectedItem.invoiceImage && (
                                    <div className="mt-12 pt-6 border-t border-gray-300 print:hidden">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                            Invoice Attachment
                                        </div>
                                        {selectedItem.invoiceImage.toLowerCase().endsWith(".pdf") ? (
                                            <a
                                                href={selectedItem.invoiceImage}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-decoration-none"
                                            >
                                                <FaFilePdf size={14} /> View PDF Document
                                            </a>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                <img
                                                    src={selectedItem.invoiceImage}
                                                    alt="Invoice Copy"
                                                    className="max-h-60 object-contain border border-gray-300 rounded-lg max-w-sm"
                                                />
                                                <a
                                                    href={selectedItem.invoiceImage}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-sm font-semibold text-blue-600 hover:underline"
                                                >
                                                    Open in New Tab
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Footer / Notes */}
                                {selectedItem.remarks && (
                                    <div className="mt-12 pt-6 border-t border-gray-300">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                            Remarks / Notes
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed max-w-2xl">
                                            {selectedItem.remarks}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Modal */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm delete"
                message="Are you sure you want to delete this GRN Invoice?"
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default GrnInvoiceViewPage;
