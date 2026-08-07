import React, { useState, useCallback, useEffect, useRef } from "react";

import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaFilter, FaTimes, FaFileInvoice, FaPrint, FaDownload, FaEye, FaEdit } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../components/ui/Button/Button";
import { salesOrderService } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { DISPATCH_TYPE_OPTIONS } from "../../../constants/selectOption";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import { DocumentPrintLayout } from "../../../components/common/DocumentPrintLayout";
import { SalesOrderEstimateContent } from "../../../components/salesOrder/SalesOrderEstimateContent";
import { FiClipboard, FiFileText } from "react-icons/fi";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";


const ITEMS_PER_PAGE = 10;



const AllSalesOrderList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showEstimateModal, setShowEstimateModal] = useState(false);
    const [estimateOrder, setEstimateOrder] = useState<any | null>(null);
    const [loadingEstimate, setLoadingEstimate] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    const generatePdf = async (action: "view" | "download") => {
        if (!estimateOrder) return;
        setGeneratingPdf(true);
        try {
            const html2canvas = (await import("html2canvas-pro")).default;
            const { jsPDF } = await import("jspdf");

            const element = document.getElementById("pdf-estimate-section");
            if (!element) {
                toast.error("Estimate elements not found");
                return;
            }

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

            if (action === "download") {
                pdf.save(`Estimate-${estimateOrder?.orderNo || "estimate"}.pdf`);
            } else {
                const pdfUrl = pdf.output("bloburl");
                window.open(pdfUrl, "_blank");
            }
        } catch (err) {
            console.error(err);
            toast.error(`Failed to ${action} PDF`);
        } finally {
            setGeneratingPdf(false);
        }
    };

    const handleOpenEstimate = async (salesOrderId: number) => {
        setLoadingEstimate(true);
        setShowEstimateModal(true);
        setEstimateOrder(null);
        try {
            const orderData = await salesOrderService.fetchById(salesOrderId);
            setEstimateOrder(orderData);
        } catch (error) {
            toast.error("Failed to load sales order estimate");
            setShowEstimateModal(false);
        } finally {
            setLoadingEstimate(false);
        }
    };

    const handleItemRemarksChange = (itemId: string | number, newRemarks: string) => {
        if (!estimateOrder) return;
        setEstimateOrder((prev: any) => ({
            ...prev,
            items: prev.items.map((item: any) =>
                String(item.id) === String(itemId) ? { ...item, remarks: newRemarks } : item
            ),
        }));
    };


    // ─── Filters ────────────────────────────────────────────────
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [dispatchType, setDispatchType] = useState("");

    // ── Draft values inside the popover (only applied on "Apply") ──
    const [draftFromDate, setDraftFromDate] = useState("");
    const [draftToDate, setDraftToDate] = useState("");
    const [draftDispatchType, setDraftDispatchType] = useState("");

    const hasActiveFilters = !!(fromDate || toDate || dispatchType);
    const activeFilterCount = [fromDate, toDate, dispatchType].filter(Boolean).length;

    const fetchOrders = useCallback(async () => {
        if (!can("sales-orders.view")) return;
        setLoading(true);
        try {
            const response = await salesOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined,
                dispatchType: dispatchType || undefined,
            });

            setData(response.data || []);
            setTotal(Math.ceil((response.total ?? 0) / ITEMS_PER_PAGE));
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, fromDate, toDate, dispatchType, can]);

    useSocketSync("salesOrder", undefined, fetchOrders);

    // ─── Load Data on Mount & Dependencies ─────────────────────
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchOrders]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenFilter = () => {
        setDraftFromDate(fromDate);
        setDraftToDate(toDate);
        setDraftDispatchType(dispatchType);
    };

    const handleApplyFilters = () => {
        setFromDate(draftFromDate);
        setToDate(draftToDate);
        setDispatchType(draftDispatchType);
        setCurrentPage(1);
    };

    const handleClearFilters = () => {
        setDraftFromDate("");
        setDraftToDate("");
        setDraftDispatchType("");
        setFromDate("");
        setToDate("");
        setDispatchType("");
        setCurrentPage(1);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const handleOpenView = (id: number) => {
        navigate(`/sales-order/details/${id}`);
    };

    const handleOpenAdd = () => {
        navigate("/sales-order/create");
    };

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Sales Order Management</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search orders..."
                        />

                        {/* ── Filter trigger button ── */}
                        <FilterPopover
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            onApply={handleApplyFilters}
                            onClear={handleClearFilters}
                            onOpen={handleOpenFilter}
                        >
                            <div className="mb-3">
                                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                    From Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                    value={draftFromDate}
                                    max={draftToDate || undefined}
                                    onChange={(e) => setDraftFromDate(e.target.value)}
                                />
                            </div>

                            <div className="mb-3">
                                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                    To Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                    value={draftToDate}
                                    min={draftFromDate || undefined}
                                    onChange={(e) => setDraftToDate(e.target.value)}
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                    Dispatch Type
                                </label>
                                <select
                                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                                    value={draftDispatchType}
                                    onChange={(e) => setDraftDispatchType(e.target.value)}
                                >
                                    <option value="">All</option>
                                    {DISPATCH_TYPE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </FilterPopover>

                        <CustomButton
                            text="Add Sales Order"
                            icon={FaPlus}
                            onClick={handleOpenAdd}
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={data}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No sales orders found."
                    pagination={{
                        currentPage,
                        totalPages: total,
                        onPageChange: (page) => setCurrentPage(page),
                    }}
                    columns={[
                        {
                            header: "#",
                            width: "60px",
                            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                        },
                        { header: "ORDER NO", accessor: "orderNo" },
                        { header: "ORDER DATE", render: (item) => formatDate(item.orderDate) },
                        {
                            header: "CUSTOMER",
                            render: (item) => item.customer?.displayName || item.customer?.firmName || "N/A",
                        },
                        { header: "DISPATCH", render: (item) => item?.dispatchType },
                        { header: "STATUS", render: (item) => <StatusBadge status={item.status} /> },
                        {
                            header: "ACTIONS",
                            width: "120px",
                            render: (item) => (
                                <div className="flex justify-start gap-2">
                                    <ViewButton onClick={() => handleOpenView(item.id)} />
                                    <button
                                        type="button"
                                        title="View Sales Order Estimate"
                                        onClick={() => handleOpenEstimate(item.id)}
                                        className="
                                       w-10 h-10
                                       flex items-center justify-center
                                       rounded-xl
                                       border-none
                                       cursor-pointer
                                       bg-violet-500/10
                                       text-violet-600
                                       transition-all duration-300 ease-in-out
                                       hover:-translate-y-[3px]
                                       hover:bg-violet-500/20
                                       hover:shadow-[0_8px_18px_rgba(139,92,246,0.18)]
                                       active:scale-95
                                     "
                                    >
                                        <FiClipboard className="text-[18px]" />
                                    </button>
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

            {/* Sales Order Estimate Modal (Tailwind CSS - On-Screen Only) */}
            {showEstimateModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto no-print">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowEstimateModal(false)}
                    />

                    {/* Modal Wrapper */}
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-800">
                                    Sales Order Estimate
                                </h3>
                                <button
                                    onClick={() => setShowEstimateModal(false)}
                                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                                >
                                    <FaTimes size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 bg-slate-50 min-h-[400px]">
                                {loadingEstimate ? (
                                    <div className="flex flex-col items-center justify-center py-20 h-full">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                        <span className="mt-4 text-slate-500 font-semibold">Loading estimate details...</span>
                                    </div>
                                ) : estimateOrder ? (
                                    <DocumentPrintLayout subtitle="Sales Order" title="ESTIMATE">
                                        <SalesOrderEstimateContent
                                            estimateOrder={estimateOrder}
                                            formatDate={formatDate}
                                            onItemRemarksChange={handleItemRemarksChange}
                                        />
                                    </DocumentPrintLayout>
                                ) : (
                                    <div className="text-center py-10 text-slate-500">
                                        Failed to load order estimate.
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                <button
                                    onClick={() => setShowEstimateModal(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                >
                                    Close
                                </button>
                                {estimateOrder && (
                                    <div className="flex gap-2">
                                        <CustomButton
                                            text="Print"
                                            icon={FaPrint}
                                            onClick={() => window.print()}
                                            variant="primary"
                                        />
                                        <CustomButton
                                            text={generatingPdf ? "Generating..." : "View PDF"}
                                            icon={FaEye}
                                            onClick={() => generatePdf("view")}
                                            variant="secondary"
                                            disabled={generatingPdf}
                                        />
                                        <CustomButton
                                            text={generatingPdf ? "Downloading..." : "Download PDF"}
                                            icon={FaDownload}
                                            onClick={() => generatePdf("download")}
                                            variant="primary"
                                            disabled={generatingPdf}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print-Only Estimate Section */}
            {estimateOrder && (
                <div id="print-only-estimate-section" className="hidden print:block">
                    <DocumentPrintLayout subtitle="Sales Order" title="ESTIMATE">
                        <SalesOrderEstimateContent
                            estimateOrder={estimateOrder}
                            formatDate={formatDate}
                            isEditable={false}
                        />
                    </DocumentPrintLayout>
                </div>
            )}

            {/* Off-screen section for PDF generation */}
            {estimateOrder && (
                <div id="pdf-estimate-section" style={{ position: "absolute", left: "-9999px", top: "0", width: "794px", minHeight: "1123px", background: "white" }}>
                    <DocumentPrintLayout subtitle="Sales Order" title="ESTIMATE">
                        <SalesOrderEstimateContent
                            estimateOrder={estimateOrder}
                            formatDate={formatDate}
                            isEditable={false}
                        />
                    </DocumentPrintLayout>
                </div>
            )}
        </div>
    );
};

export default AllSalesOrderList;