import React, { useState, useCallback, useEffect } from "react";

import { FaPlus, FaTimes, FaPrint, FaDownload } from "react-icons/fa";
import { useAppSelector } from "../../../hooks/reduxHooks";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CustomButton from "../../../components/ui/Button/Button";
import { salesOrderService } from "../../../services/salesOrderService";
import { salesProductService } from "../../../services/salesProductService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { DISPATCH_TYPE_OPTIONS, ORDER_SOURCE_OPTIONS } from "../../../constants/selectOption";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import { FiClipboard } from "react-icons/fi";
import { SalesOrderDeliveryEstimate } from "../../../components/salesOrder/SalesOrderDeliveryEstimate";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import IconButton from "../../../components/ui/IconButton/IconButton";
import { useCustomerGrades } from "../../../hooks/useCustomerGrades";
import { useCustomerTypes } from "../../../hooks/useCustomerTypes";


const ITEMS_PER_PAGE = 10;

// ─── Group raw order items by Sales Product (same logic as SalesOrderDetail) ──
function groupItemsBySalesProduct(orderItems: any[], salesProducts: any[]) {
    if (!salesProducts || salesProducts.length === 0) {
        return orderItems.map((oi) => ({
            id: oi.id || oi.productId,
            product: {
                productName: oi.product?.productName || `Product #${oi.productId}`,
                productCode: oi.product?.productCode,
            },
            quantity: Number(oi.quantity || 0),
            unit: oi.unit || "Pcs.",
            remarks: oi.remarks || "",
        }));
    }

    const result: any[] = [];
    const processedIds = new Set<any>();

    salesProducts.forEach((sp) => {
        const spComps = (sp?.components || []).filter(
            (c: any) => c.componentProduct?.productType === "SALES_PRODUCTION"
        );
        if (spComps.length === 0) return;

        const matchingItems = orderItems.filter((oi) =>
            spComps.some((c: any) => String(c.componentProductId) === String(oi.productId))
        );
        if (matchingItems.length === 0) return;

        matchingItems.forEach((oi) => processedIds.add(oi.id || oi.productId));

        // Derive the sales-product-level quantity (same formula as SalesOrderDetail)
        const calcQty = Math.max(
            ...matchingItems.map((oi) => {
                const spComp = spComps.find(
                    (c: any) => String(c.componentProductId) === String(oi.productId)
                );
                const perUnit = Number(spComp?.quantity || 1);
                return Math.round(Number(oi.quantity || 1) / perUnit);
            }),
            1
        );

        result.push({
            id: `sp-${sp.id}`,
            product: {
                productName: sp.salesProductName || sp.salesProductCode,
                productCode: sp.salesProductCode,
            },
            quantity: calcQty,
            unit: "Pcs.",
            remarks: "",
        });
    });

    // Remaining items not part of any sales product
    orderItems
        .filter((oi) => !processedIds.has(oi.id || oi.productId))
        .forEach((oi) => {
            result.push({
                id: oi.id || oi.productId,
                product: {
                    productName: oi.product?.productName || `Product #${oi.productId}`,
                    productCode: oi.product?.productCode,
                },
                quantity: Number(oi.quantity || 0),
                unit: oi.unit || "Pcs.",
                remarks: oi.remarks || "",
            });
        });

    return result;
}

const AllSalesOrderList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const company = useAppSelector((state) => state.company.data);
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
    // Remarks typed by the user — outer key = orderId, inner key = itemId
    // Persists across close/reopen of the same order
    const [remarksMap, setRemarksMap] = useState<Record<number, Record<string | number, string>>>({});

    // Convenience: remarks for the currently open order
    const itemRemarks: Record<string | number, string> =
        estimateOrder?.id ? (remarksMap[estimateOrder.id] ?? {}) : {};

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null || isDeleting) return;
        setIsDeleting(true);
        try {
            await salesOrderService.delete(itemToDelete);
            toast.success("Sales order deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchOrders();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to delete order");
        } finally {
            setIsDeleting(false);
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
        } catch {
            toast.error(`Failed to ${action} PDF`);
        } finally {
            setGeneratingPdf(false);
        }
    };

    const handleOpenEstimate = async (salesOrderId: number) => {
        // Do NOT reset remarks — preserve previously typed values for this order
        setLoadingEstimate(true);
        setShowEstimateModal(true);
        setEstimateOrder(null);
        try {
            const [orderData, salesProducts] = await Promise.all([
                salesOrderService.fetchById(salesOrderId),
                salesProductService.fetchAll().catch(() => []),
            ]);

            // Group items by sales product (e.g. "Arasan Bucket") instead of
            // showing individual components (20L Bucket, Bucket Lid, …)
            const groupedItems = groupItemsBySalesProduct(
                orderData.items || [],
                Array.isArray(salesProducts) ? salesProducts : []
            );

            setEstimateOrder({ ...orderData, items: groupedItems });
        } catch (error) {
            toast.error("Failed to load sales order estimate");
            setShowEstimateModal(false);
        } finally {
            setLoadingEstimate(false);
        }
    };

    // Merge typed remarks into order items for PDF rendering
    const estimateOrderForPdf = estimateOrder
        ? {
              ...estimateOrder,
              items: estimateOrder.items?.map((item: any) => ({
                  ...item,
                  remarks:
                      itemRemarks[item.id] !== undefined
                          ? itemRemarks[item.id]
                          : item.remarks ?? "",
              })),
          }
        : null;

    // ─── Filters ────────────────────────────────────────────────
    const { customerGrades } = useCustomerGrades();
    const { customerTypes } = useCustomerTypes();
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [customerGradeId, setCustomerGradeId] = useState("");
    const [customerTypeId, setCustomerTypeId] = useState("");
    const [orderSource, setOrderSource] = useState("");

    // ── Draft values inside the popover (only applied on "Apply") ──
    const [draftFromDate, setDraftFromDate] = useState("");
    const [draftToDate, setDraftToDate] = useState("");
    const [draftCustomerGradeId, setDraftCustomerGradeId] = useState("");
    const [draftCustomerTypeId, setDraftCustomerTypeId] = useState("");
    const [draftOrderSource, setDraftOrderSource] = useState("");

    const hasActiveFilters = !!(fromDate || toDate || customerGradeId || customerTypeId || orderSource);
    const activeFilterCount = [fromDate, toDate, customerGradeId, customerTypeId, orderSource].filter(Boolean).length;

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
                customerGradeId: customerGradeId || undefined,
                customerTypeId: customerTypeId || undefined,
                orderSource: orderSource || undefined,
            });

            setData(response.data || []);
            setTotal(Math.ceil((response.total ?? 0) / ITEMS_PER_PAGE));
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, fromDate, toDate, customerGradeId, customerTypeId, orderSource, can]);

    useSocketSync("salesOrder", undefined, fetchOrders);

    // ─── Load Data on Mount & Dependencies ─────────────────────
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchOrders]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleOpenFilter = () => {
        setDraftFromDate(fromDate);
        setDraftToDate(toDate);
        setDraftCustomerGradeId(customerGradeId);
        setDraftCustomerTypeId(customerTypeId);
        setDraftOrderSource(orderSource);
    };

    const handleApplyFilters = () => {
        setFromDate(draftFromDate);
        setToDate(draftToDate);
        setCustomerGradeId(draftCustomerGradeId);
        setCustomerTypeId(draftCustomerTypeId);
        setOrderSource(draftOrderSource);
        setCurrentPage(1);
    };

    const handleClearFilters = () => {
        setDraftFromDate("");
        setDraftToDate("");
        setDraftCustomerGradeId("");
        setDraftCustomerTypeId("");
        setDraftOrderSource("");
        setFromDate("");
        setToDate("");
        setCustomerGradeId("");
        setCustomerTypeId("");
        setOrderSource("");
        setCurrentPage(1);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const handleOpenView = useCallback((id: number) => {
        navigate(`/sales-order/details/${id}`);
    }, [navigate]);

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/sales-order/edit/${item.id}`, { state: item });
    }, [navigate]);

    const handleOpenAdd = useCallback(() => {
        navigate("/sales-order/create");
    }, [navigate]);

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
                                    label="Customer Type"
                                    name="customerTypeId"
                                    value={draftCustomerTypeId}
                                    defaultOptionLabel="All Types"
                                    options={customerTypes.map((t) => ({ label: t.name, value: String(t.id) }))}
                                    searchable={false}
                                    onChange={(e) => setDraftCustomerTypeId(e.target.value)}
                                />

                                <SelectInput
                                    label="Customer Grade"
                                    name="customerGradeId"
                                    value={draftCustomerGradeId}
                                    defaultOptionLabel="All Grades"
                                    options={customerGrades.map((g) => ({ label: g.name, value: String(g.id) }))}
                                    searchable={false}
                                    onChange={(e) => setDraftCustomerGradeId(e.target.value)}
                                />

                                <SelectInput
                                    label="Order Source"
                                    name="orderSource"
                                    value={draftOrderSource}
                                    defaultOptionLabel="All Sources"
                                    options={ORDER_SOURCE_OPTIONS}
                                    searchable={false}
                                    onChange={(e) => setDraftOrderSource(e.target.value)}
                                />
                            </div>
                        </FilterPopover>

                        {can("sales-orders.create") && (
                            <CustomButton
                                text="Add Sales Order"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        )}
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
                                        title="Print / View Sales Order"
                                        onClick={() => handleOpenEstimate(item.id)}
                                    />
                                    {item.status === "DRAFT" && (
                                        <>
                                        
                                            {can("sales-orders.edit") && <EditButton onClick={() => handleOpenEdit(item)} />}
                                            {can("sales-orders.delete") && <DeleteButton onClick={() => triggerDelete(item.id)} />}
                                        </>
                                    )}
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
                                    Sales Order Confirmation
                                </h3>
                                <button
                                    onClick={() => setShowEstimateModal(false)}
                                    className="rounded-lg p-1 text-ink-subtle hover:bg-card-2 hover:text-ink-muted transition-colors"
                                >
                                    <FaTimes size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 bg-card-2 min-h-[400px] max-h-[calc(100vh-200px)] overflow-y-auto">
                                {loadingEstimate ? (
                                    <div className="flex flex-col items-center justify-center py-20 h-full">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                        <span className="mt-4 text-ink-subtle font-semibold">Loading details...</span>
                                    </div>
                                ) : estimateOrder ? (
                                    <SalesOrderDeliveryEstimate
                                        order={estimateOrder}
                                        company={company}
                                        formatDate={formatDate}
                                        isEditable={true}
                                        itemRemarks={itemRemarks}
                                        onItemRemarksChange={(id, val) =>
                                            setRemarksMap((prev) => ({
                                                ...prev,
                                                [estimateOrder.id]: {
                                                    ...(prev[estimateOrder.id] ?? {}),
                                                    [id]: val,
                                                },
                                            }))
                                        }
                                    />
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
                                            variant="secondary"
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
            {estimateOrderForPdf && (
                <div id="print-only-estimate-section" className="hidden print:block">
                    <SalesOrderDeliveryEstimate
                        order={estimateOrderForPdf}
                        company={company}
                        formatDate={formatDate}
                    />
                </div>
            )}

            {/* Off-screen section for PDF generation */}
            {estimateOrderForPdf && (
                <div id="pdf-estimate-section" style={{ position: "absolute", left: "-9999px", top: "0", width: "794px", minHeight: "1123px", background: "white" }}>
                    <SalesOrderDeliveryEstimate
                        order={estimateOrderForPdf}
                        company={company}
                        formatDate={formatDate}
                    />
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
                isDangerous={true}
                isLoading={isDeleting}
                loadingText="Deleting..."
            />
        </div>
    );
};

export default AllSalesOrderList;