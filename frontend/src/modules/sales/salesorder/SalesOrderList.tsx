import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { usePermission } from "../../../hooks/usePermission";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesOrderService } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import { FaPrint, FaEye, FaDownload, FaTimes, FaPen, FaTrash, FaPlus, FaCheck, FaFileInvoice } from "react-icons/fa";
import { FiClipboard } from "react-icons/fi";
import CustomButton from "../../../components/ui/Button/Button";
import { DocumentPrintLayout } from "../../../components/common/DocumentPrintLayout";
import { SalesOrderEstimateContent } from "../../../components/salesOrder/SalesOrderEstimateContent";
import { ReceiptText } from "lucide-react";
import { useSocketSync } from "../../../hooks/useSocketSync";


const ITEMS_PER_PAGE = 10;

const SalesOrderList: React.FC = () => {
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

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

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

    const fetchOrders = useCallback(async () => {
        if (!can("sales-orders.view")) return;
        setLoading(true);
        try {
            const response = await salesOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                status: 'DRAFT',
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
    }, [currentPage, searchTerm, can]);

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

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatCurrency = (amount: number) =>
        `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    const handleOpenView = useCallback((item: any) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/draft-order/edit/${item.id}`, { state: item });
    }, [navigate]);

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Draft Orders List</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search orders..."
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={data}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No draft orders found."
                    pagination={{
                        currentPage,
                        totalPages: total,
                        onPageChange: (page) => setCurrentPage(page),
                    }}
                    columns={[
                        {
                            header: "#",

                            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                        },
                        { header: "ORDER NO", accessor: "orderNo" },
                        { header: "ORDER DATE", render: (item) => formatDate(item.orderDate) },
                        {
                            header: "CUSTOMER",
                            render: (item) => item.customer?.displayName || item.customer?.firmName || "N/A",
                        },
                        { header: "STATUS", render: (item) => <StatusBadge status={item.status} /> },
                        {
                            header: "ACTIONS",
                            render: (item) => (
                                <div className="flex justify-end items-center gap-2">
                                    <ViewButton onClick={() => handleOpenView(item)} />
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
                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                    <DeleteButton onClick={() => triggerDelete(item.id)} />
                                </div>
                            ),
                        },
                    ]}
                />

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Sales Order Details"
                    avatarText={selectedItem ? selectedItem.orderNo.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.orderNo : ""}
                    headerSubtitle={selectedItem ? `Customer: ${selectedItem.customerName || selectedItem.customer?.displayName || selectedItem.customer?.firmName}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Order No", value: selectedItem.orderNo },
                                { label: "Order Date", value: formatDate(selectedItem.orderDate) },
                                { label: "Customer", value: selectedItem.customerName || selectedItem.customer?.displayName || selectedItem.customer?.firmName },
                                { label: "Mobile Number", value: selectedItem.mobile || "N/A" },
                                { label: "Sales Person", value: selectedItem.salesPersonName || "N/A" },
                                { label: "Payment Term", value: selectedItem.paymentTermName || "N/A" },
                                ...(selectedItem.transportName ? [{ label: "Transport", value: selectedItem.transportName }] : []),
                            ]
                        },
                        {
                            title: "Address Details",
                            fields: [
                                { label: "Billing Address", value: selectedItem.billingAddress || "N/A" },
                                { label: "Shipping Address", value: selectedItem.shippingAddress || "N/A" },
                            ]
                        },
                        {
                            title: "Order Summary",
                            fields: [
                                { label: "Total Items", value: String(selectedItem.totalItems || 0) },
                                { label: "Total Amount", value: formatCurrency(selectedItem.totalAmount || 0) },
                                { label: "Status", value: selectedItem.status },
                                { label: "Remarks", value: selectedItem.remarks || "N/A" },
                                { label: "Internal Notes", value: selectedItem.internalNotes || "N/A" },
                            ]
                        },
                        {
                            title: "Timestamps",
                            fields: [
                                { label: "Created At", value: formatDate(selectedItem.createdAt) },
                                { label: "Last Updated", value: formatDate(selectedItem.updatedAt) },
                            ]
                        }
                    ] : []}
                />

                {/* Delete Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this sales order?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />

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
                    <div id="pdf-estimate-section" style={{ position: "absolute", left: "-9999px", top: "0", width: "794px", background: "white" }}>
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
        </div>
    );
};

export default SalesOrderList;