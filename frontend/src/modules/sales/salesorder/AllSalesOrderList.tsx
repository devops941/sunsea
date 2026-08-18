import React, { useState, useCallback, useEffect, useRef } from "react";

import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaFilter, FaTimes, FaFileInvoice, FaPrint, FaDownload, FaEye, FaEdit } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
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
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import IconButton from "../../../components/ui/IconButton/IconButton";


const ITEMS_PER_PAGE = 10;



const AllSalesOrderList: React.FC = () => {
    const navigate = useNavigate();
    const { can, isSuperAdmin, permissions } = usePermission();
    const isEstimateUser = !isSuperAdmin && permissions.includes("sales-orders.view-estimate") && !permissions.includes("sales-orders.view-gst");
    const isGstUser = !isEstimateUser;
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

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;
        try {
            await salesOrderService.delete(itemToDelete);
            toast.success("Sales order deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchOrders();
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete order");
        }
    };

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

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

            // scale 3 renders borders crisply so every table line prints as solid
            // black — same weight as the outer outline (no gray anti-alias blur)
            const canvas = await html2canvas(element, { scale: 3, useCORS: true });
            const imgData = canvas.toDataURL("image/png");

            const pdf = new jsPDF("p", "mm", "a4");
            const margin = 8; // consistent margin on all sides
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = pageWidth - 2 * margin;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const availableHeight = pageHeight - 2 * margin;

            if (imgHeight <= availableHeight) {
                // Single page — fill the available area inside the margins
                pdf.addImage(imgData, "PNG", margin, margin, imgWidth, availableHeight);
            } else {
                // Multi-page — slice across pages
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
            }

            if (action === "download") {
                // File name = sales order number (e.g. SO-2026-001.pdf)
                pdf.save(`${estimateOrder?.orderNo || "sales-order"}.pdf`);
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
                status: [
                    "DRAFT",
                    "CONFIRMED",
                    "IN_PRODUCTION",
                    "PLANNED",
                    "READY_FOR_DISPATCH",
                    "PARTIALLY_DISPATCHED",
                    "DISPATCHED",
                    "COMPLETED",
                    "CANCELLED",
                ] as any,
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

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/sales-order/edit/${item.id}`, { state: item });
    }, [navigate]);

    const handleOpenAdd = () => {
        navigate("/sales-order/create");
    };

    return (
        <div>
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Sales Order Management</h2>
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
                            <div className="space-y-3">
                                <TextInput
                                    label="From Date"
                                    name="fromDate"
                                    type="date"
                                    value={draftFromDate}
                                    max={draftToDate || undefined}
                                    onChange={(e) => setDraftFromDate(e.target.value)}
                                />

                                <TextInput
                                    label="To Date"
                                    name="toDate"
                                    type="date"
                                    value={draftToDate}
                                    min={draftFromDate || undefined}
                                    onChange={(e) => setDraftToDate(e.target.value)}
                                />

                                <SelectInput
                                    label="Dispatch Type"
                                    name="dispatchType"
                                    value={draftDispatchType}
                                    defaultOptionLabel="All"
                                    options={DISPATCH_TYPE_OPTIONS}
                                    searchable={false}
                                    onChange={(e) => setDraftDispatchType(e.target.value)}
                                />
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
                            width: "210px",
                            align: "center",
                            render: (item) => (
                                <div className="flex items-center justify-center gap-2">
                                    <ViewButton onClick={() => handleOpenView(item.id)} />
                                    <IconButton
                                        icon={FiClipboard}
                                        variant="info"
                                        title={isGstUser ? "Print / View Sales Order" : "View Estimated Pricing"}
                                        onClick={() => handleOpenEstimate(item.id)}
                                    />
                                    {can("sales-orders.edit") && <EditButton onClick={() => handleOpenEdit(item)} />}
                                    {can("sales-orders.delete") && <DeleteButton onClick={() => triggerDelete(item.id)} />}
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
                        <div className="relative transform overflow-hidden rounded-2xl bg-card text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-line-soft flex items-center justify-between">
                                <h3 className="text-lg font-bold text-ink">
                                    {isGstUser ? "Sales Order Confirmation" : "Sales Order Estimate"}
                                </h3>
                                <button
                                    onClick={() => setShowEstimateModal(false)}
                                    className="rounded-lg p-1 text-ink-subtle hover:bg-card-2 hover:text-ink-muted transition-colors"
                                >
                                    <FaTimes size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 bg-card-2 min-h-[400px]">
                                {loadingEstimate ? (
                                    <div className="flex flex-col items-center justify-center py-20 h-full">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                        <span className="mt-4 text-ink-subtle font-semibold">Loading details...</span>
                                    </div>
                                ) : estimateOrder ? (
                                    <DocumentPrintLayout
                                        subtitle="Sales Order"
                                        title={isGstUser ? "SALES ORDER" : "ESTIMATE"}
                                    >
                                        <SalesOrderEstimateContent
                                            estimateOrder={estimateOrder}
                                            formatDate={formatDate}
                                            onItemRemarksChange={handleItemRemarksChange}
                                        />
                                    </DocumentPrintLayout>
                                ) : (
                                    <div className="text-center py-10 text-ink-subtle">
                                        Failed to load sales order details.
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-line-soft bg-card-2 flex items-center justify-end">
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
                    <DocumentPrintLayout subtitle="Sales Order" title={isGstUser ? "SALES ORDER" : "ESTIMATE"}>
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
                    <DocumentPrintLayout subtitle="Sales Order" title={isGstUser ? "SALES ORDER" : "ESTIMATE"}>
                        <SalesOrderEstimateContent
                            estimateOrder={estimateOrder}
                            formatDate={formatDate}
                            isEditable={false}
                        />
                    </DocumentPrintLayout>
                </div>
            )}

            {/* Delete Modal */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Sales Order"
                message="Are you sure you want to delete this sales order? This action cannot be undone."
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default AllSalesOrderList;