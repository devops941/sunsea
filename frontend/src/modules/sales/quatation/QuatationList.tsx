import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppSelector } from "../../../hooks/reduxHooks";
import { toast } from "react-toastify";
import { usePermission } from "../../../hooks/usePermission";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { FaTimes, FaPrint, FaDownload, FaPlus, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { FiClipboard } from "react-icons/fi";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesOrderService, type SalesOrder, type SalesOrderStatus } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import CustomButton from "../../../components/ui/Button/Button";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { useListCache, markStaleByPrefix } from "../../../hooks/useListCache";
import EmailButton from "../../../components/ui/EmailButton/EmailButton";
import WhatsappButton from "../../../components/ui/WhatsappButton/WhatsappButton";
import { Mail, MessageCircle } from "lucide-react";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import IconButton from "../../../components/ui/IconButton/IconButton";
import { DocumentPrintLayout } from "../../../components/common/DocumentPrintLayout";
import { SalesOrderEstimateContent } from "../../../components/salesOrder/SalesOrderEstimateContent";
import { salesProductService } from "../../../services/salesProductService";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { DISPATCH_TYPE_OPTIONS, ORDER_SOURCE_OPTIONS } from "../../../constants/selectOption";
import { useCustomerGrades } from "../../../hooks/useCustomerGrades";
import { useCustomerTypes } from "../../../hooks/useCustomerTypes";

const ITEMS_PER_PAGE = 15;
type SortOrder = "default" | "asc" | "desc";
const SORT_STORAGE_KEY = "sunsea_quotation_sort_name";

// ─── Group raw order items by Sales Product, aggregating amounts ──────────────
function groupQuotationItems(orderItems: any[], salesProducts: any[]) {
    if (!salesProducts || salesProducts.length === 0) {
        return orderItems.map((oi) => ({
            id:          oi.id || oi.productId,
            productId:   oi.productId,
            product:     { productName: oi.product?.productName || `Product #${oi.productId}`, productCode: oi.product?.productCode },
            quantity:    Number(oi.quantity || 0),
            unitPrice:   Number(oi.unitPrice ?? oi.rate ?? 0),
            lineTotal:   Number(oi.lineTotal ?? oi.taxableAmount ?? (Number(oi.quantity || 0) * Number(oi.unitPrice ?? oi.rate ?? 0))),
            remarks:     oi.remarks || "",
        }));
    }

    const result: any[]        = [];
    const processedIds         = new Set<any>();

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

        // Sales-product-level quantity (same formula as SalesOrderDetail)
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

        // Aggregate line total across all components
        const groupLineTotal = matchingItems.reduce(
            (s, oi) =>
                s + Number(oi.lineTotal ?? oi.taxableAmount ?? (Number(oi.quantity || 0) * Number(oi.unitPrice ?? oi.rate ?? 0))),
            0
        );
        const groupUnitPrice = calcQty > 0 ? groupLineTotal / calcQty : 0;

        result.push({
            id:        `sp-${sp.id}`,
            productId: sp.id,
            product:   { productName: sp.salesProductName || sp.salesProductCode, productCode: sp.salesProductCode },
            quantity:  calcQty,
            unitPrice: groupUnitPrice,
            lineTotal: groupLineTotal,
            remarks:   "",
        });
    });

    // Remaining items not part of any sales product
    orderItems
        .filter((oi) => !processedIds.has(oi.id || oi.productId))
        .forEach((oi) => {
            result.push({
                id:        oi.id || oi.productId,
                productId: oi.productId,
                product:   { productName: oi.product?.productName || `Product #${oi.productId}`, productCode: oi.product?.productCode },
                quantity:  Number(oi.quantity || 0),
                unitPrice: Number(oi.unitPrice ?? oi.rate ?? 0),
                lineTotal: Number(oi.lineTotal ?? oi.taxableAmount ?? (Number(oi.quantity || 0) * Number(oi.unitPrice ?? oi.rate ?? 0))),
                remarks:   oi.remarks || "",
            });
        });

    return result;
}

const QUOTATION_CACHE_PREFIX = "quotations:";

const QuotationList: React.FC = () => {
    const navigate  = useNavigate();
    const tableRef  = useRef<HTMLDivElement>(null);
    const { can }   = usePermission();
    const canCreate = can("quotations.create");
    const canEdit   = can("quotations.edit");
    const canDelete = can("quotations.delete");
    const canExport = can("quotations.export");
    const canSendWhatsappEmail = can("quotations.whatsapp-email") || can("quotations.whatsapp_email");
    const company   = useAppSelector((state) => state.company.data);

    const location     = useLocation();
    const initialSearch = new URLSearchParams(location.search).get("search") || "";

    const [searchTerm, setSearchTerm]   = useState(initialSearch);
    const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
    const [currentPage, setCurrentPage] = useState(1);

    // ── Alphabetical Sorting with localStorage persistence ───────────────────
    const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
        try {
            const saved = localStorage.getItem(SORT_STORAGE_KEY);
            if (saved === "asc" || saved === "desc") return saved;
        } catch (_) {}
        return "default";
    });

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prev) => {
            let next: SortOrder = "default";
            if (prev === "default") next = "asc";
            else if (prev === "asc") next = "desc";
            else next = "default";
            try {
                localStorage.setItem(SORT_STORAGE_KEY, next);
            } catch (_) {}
            return next;
        });
    }, []);

    // Shortcut key (F6 or Alt+S) to toggle alphabetical sort
    useEffect(() => {
        const handleSortShortcut = (e: globalThis.KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                return;
            }
            if (e.key === "F6" || (e.altKey && (e.key === "s" || e.key === "S"))) {
                e.preventDefault();
                toggleSortOrder();
            }
        };
        window.addEventListener("keydown", handleSortShortcut);
        return () => window.removeEventListener("keydown", handleSortShortcut);
    }, [toggleSortOrder]);

    // ─── Delete ──────────────────────────────────────────────────────────────
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete]       = useState<number | null>(null);
    const [isDeleting, setIsDeleting]           = useState(false);

    // ─── Estimate preview modal ───────────────────────────────────────────────
    const [showEstimateModal,  setShowEstimateModal]  = useState(false);
    const [estimateOrder,      setEstimateOrder]      = useState<any | null>(null);
    const [loadingEstimate,    setLoadingEstimate]    = useState(false);
    const [generatingPdf,      setGeneratingPdf]      = useState(false);

    // ─── Email modal ─────────────────────────────────────────────────────────
    const [showEmailModal,  setShowEmailModal]  = useState(false);
    const [emailOrder,      setEmailOrder]      = useState<SalesOrder | null>(null);
    const [recipientEmail,  setRecipientEmail]  = useState("");
    const [emailSubject,    setEmailSubject]    = useState("");
    const [emailMessage,    setEmailMessage]    = useState("");
    const [sendingEmail,    setSendingEmail]    = useState(false);

    // ─── WhatsApp modal ──────────────────────────────────────────────────────
    const [showWhatsappModal, setShowWhatsappModal] = useState(false);
    const [whatsappOrder,     setWhatsappOrder]     = useState<SalesOrder | null>(null);
    const [recipientPhone,    setRecipientPhone]    = useState("");
    const [whatsappMessage,   setWhatsappMessage]   = useState("");
    const [sendingWhatsapp,   setSendingWhatsapp]   = useState(false);

    // ─── Filters ─────────────────────────────────────────────────────────────
    const { customerGrades } = useCustomerGrades();
    const { customerTypes } = useCustomerTypes();
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [customerGradeId, setCustomerGradeId] = useState("");
    const [customerTypeId, setCustomerTypeId] = useState("");
    const [dispatchType, setDispatchType] = useState("");
    const [orderSource, setOrderSource] = useState("");

    // ── Draft values inside the popover (only applied on "Apply") ──
    const [draftFromDate, setDraftFromDate] = useState("");
    const [draftToDate, setDraftToDate] = useState("");
    const [draftCustomerGradeId, setDraftCustomerGradeId] = useState("");
    const [draftCustomerTypeId, setDraftCustomerTypeId] = useState("");
    const [draftDispatchType, setDraftDispatchType] = useState("");
    const [draftOrderSource, setDraftOrderSource] = useState("");

    const hasActiveFilters = !!(fromDate || toDate || customerGradeId || customerTypeId || dispatchType || orderSource);
    const activeFilterCount = [fromDate, toDate, customerGradeId, customerTypeId, dispatchType, orderSource].filter(Boolean).length;

    const handleOpenFilter = () => {
        setDraftFromDate(fromDate);
        setDraftToDate(toDate);
        setDraftCustomerGradeId(customerGradeId);
        setDraftCustomerTypeId(customerTypeId);
        setDraftDispatchType(dispatchType);
        setDraftOrderSource(orderSource);
    };

    const handleApplyFilters = () => {
        setFromDate(draftFromDate);
        setToDate(draftToDate);
        setCustomerGradeId(draftCustomerGradeId);
        setCustomerTypeId(draftCustomerTypeId);
        setDispatchType(draftDispatchType);
        setOrderSource(draftOrderSource);
        setCurrentPage(1);
    };

    const handleClearFilters = () => {
        setDraftFromDate("");
        setDraftToDate("");
        setDraftCustomerGradeId("");
        setDraftCustomerTypeId("");
        setDraftDispatchType("");
        setDraftOrderSource("");
        setFromDate("");
        setToDate("");
        setCustomerGradeId("");
        setCustomerTypeId("");
        setDispatchType("");
        setOrderSource("");
        setCurrentPage(1);
    };

    // ─── Fetch orders ─────────────────────────────────────────────────────────

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const cacheKey = `${QUOTATION_CACHE_PREFIX}${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}:${fromDate}:${toDate}:${customerGradeId}:${customerTypeId}:${dispatchType}:${orderSource}`;

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const response = await salesOrderService.fetchAll({
            page: currentPage,
            pageSize: ITEMS_PER_PAGE,
            search: debouncedSearch || undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            customerGradeId: customerGradeId || undefined,
            customerTypeId: customerTypeId || undefined,
            dispatchType: dispatchType || undefined,
            orderSource: orderSource || undefined,
            quotationOnly: true,
        });
        return { data: response.data || [], total: response.total ?? 0 };
    }, [currentPage, debouncedSearch, fromDate, toDate, customerGradeId, customerTypeId, dispatchType, orderSource]);

    const { data, total, loading, refresh } = useListCache({
        cacheKey,
        socketModule: "salesOrder",
        fetcher,
        enabled: can("quotations.view"),
    });

    // Client-side sorted quotations based on persistent sortOrder
    const quotations = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        if (sortOrder === "default") return data;

        return [...data].sort((a: any, b: any) => {
            const nameA = (a.customer?.displayName || a.customer?.firmName || a.customerName || "").trim().toLowerCase();
            const nameB = (b.customer?.displayName || b.customer?.firmName || b.customerName || "").trim().toLowerCase();
            if (sortOrder === "asc") {
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
            } else {
                return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: "base" });
            }
        });
    }, [data, sortOrder]);

    const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE);

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleOpenView = useCallback((item: SalesOrder) => {
        navigate(`/sales-order/details/${item.id}`);
    }, [navigate]);

    const handleOpenEdit = useCallback((item: SalesOrder) => {
        navigate(`/quatation-order/edit/${item.id}`, { state: item });
    }, [navigate]);

    const handleCloseEstimateModal = useCallback(() => {
        setShowEstimateModal(false);
        setEstimateOrder(null);
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    const handleCloseDeleteModal = useCallback(() => {
        setShowDeleteModal(false);
        setItemToDelete(null);
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    const handleCloseEmailModal = useCallback(() => {
        setShowEmailModal(false);
        setEmailOrder(null);
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    const handleCloseWhatsappModal = useCallback(() => {
        setShowWhatsappModal(false);
        setWhatsappOrder(null);
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    // ── Table keyboard navigation ─────────────────────────────────────────────
    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: quotations?.length ?? 0,
        onEnter: (i) => {
            const item = quotations?.[i];
            if (item) handleOpenView(item);
        },
        onEdit: (i) => {
            const item = quotations?.[i];
            if (item && item.status !== "CONFIRMED" && canEdit) handleOpenEdit(item);
        },
        containerRef: tableRef,
    });

    usePageShortcuts({
        onRefresh: () => refresh(),
        onSort: () => toggleSortOrder(),
        onDelete: () => {
            if (!canDelete) return;
            const focused = quotations[focusedIndex];
            if (focused && focused.status !== "CONFIRMED") {
                setItemToDelete(focused.id);
                setShowDeleteModal(true);
            }
        },
        onNew: () => canCreate && navigate("/quatation-order/create"),
        onExport: () => {
            const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-btn], button:has(svg):has(span)");
            exportBtn?.click();
        },
    });

    const fetchQuotationsForExport = useCallback(async () => {
        const res = await salesOrderService.fetchAll({
            page: 1,
            pageSize: 100000,
            quotationOnly: true,
        });
        return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    }, []);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Order / Quotation No", accessor: (item: any) => item.orderNo || "" },
            { header: "Order Date", accessor: (item: any) => item.orderDate ? new Date(item.orderDate).toLocaleDateString("en-IN") : "" },
            { header: "Customer", accessor: (item: any) => item.customer?.displayName || item.customer?.firmName || "N/A" },
            { header: "Net Amount", accessor: (item: any) => item.netAmount != null ? Number(item.netAmount).toFixed(2) : "0.00" },
            { header: "Status", accessor: (item: any) => item.status || "" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Quotation_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    // ─── Estimate preview ─────────────────────────────────────────────────────

    const handleOpenEstimate = useCallback(async (salesOrderId: number) => {
        setLoadingEstimate(true);
        setShowEstimateModal(true);
        setEstimateOrder(null);
        try {
            const [orderData, salesProducts] = await Promise.all([
                salesOrderService.fetchById(salesOrderId),
                salesProductService.fetchAll().catch(() => []),
            ]);

            const rawItems: any[] = orderData.items || [];

            // Group items by Sales Product and aggregate line totals
            const groupedItems = groupQuotationItems(
                rawItems,
                Array.isArray(salesProducts) ? salesProducts : []
            );

            // ── Recalculate GST on the POST-DISCOUNT taxable base ──────────────
            // Raw item cgstAmount/sgstAmount are pre-discount, so we recompute
            // from each item's GST rate applied proportionally to the discounted
            // subtotal. This matches what the create-page shows.
            const storedSubtotal  = Number(orderData.subtotal  ?? 0);
            const storedDiscount  = Number(orderData.totalDiscount ?? 0);
            const taxableBase     = Math.max(0, storedSubtotal - storedDiscount);
            const discountRatio   = storedSubtotal > 0 ? taxableBase / storedSubtotal : 1;
            const isInterState    = Boolean(orderData.isInterState);

            let correctedCgst = 0;
            let correctedSgst = 0;
            let correctedIgst = 0;

            rawItems.forEach((oi: any) => {
                const lineTotal    = Number(oi.lineTotal ?? (Number(oi.quantity || 0) * Number(oi.unitPrice ?? oi.rate ?? 0)));
                const taxablePart  = lineTotal * discountRatio;

                const gstRate  = Number(oi.gstRate  ?? 0);
                const cgstRate = Number(oi.cgstRate  ?? (gstRate / 2));
                const sgstRate = Number(oi.sgstRate  ?? (gstRate / 2));
                const igstRate = Number(oi.igstRate  ?? gstRate);

                if (isInterState) {
                    correctedIgst += taxablePart * (igstRate / 100);
                } else {
                    correctedCgst += taxablePart * (cgstRate / 100);
                    correctedSgst += taxablePart * (sgstRate / 100);
                }
            });

            // Parse additional charges stored in narration JSON
            let charges = { lorryFreight: 0, othersPlus: 0, othersMinus: 0, roundOffPlus: 0, roundOffMinus: 0, tds: 0 };
            try {
                const raw = orderData.narration || "";
                if (raw.startsWith("{")) {
                    const parsed = JSON.parse(raw);
                    if (parsed.__charges__) charges = { ...charges, ...parsed.__charges__ };
                }
            } catch { /* ignore */ }

            const chargeAdditions  = charges.lorryFreight + charges.othersPlus + charges.roundOffPlus;
            const chargeDeductions = charges.othersMinus + charges.roundOffMinus + charges.tds;
            const correctedNet     = taxableBase + correctedCgst + correctedSgst + correctedIgst + chargeAdditions - chargeDeductions;

            setEstimateOrder({
                ...orderData,
                items:      groupedItems,
                totalCgst:  correctedCgst  > 0 ? correctedCgst  : undefined,
                totalSgst:  correctedSgst  > 0 ? correctedSgst  : undefined,
                totalIgst:  correctedIgst  > 0 ? correctedIgst  : undefined,
                netAmount:  correctedNet   > 0 ? correctedNet   : orderData.netAmount,
                __charges__: charges,
            });
        } catch {
            toast.error("Failed to load quotation details");
            setShowEstimateModal(false);
        } finally {
            setLoadingEstimate(false);
        }
    }, []);

    const formatDate = useCallback((dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    }, []);

    const generatePdf = async (action: "view" | "download") => {
        if (!estimateOrder) return;
        setGeneratingPdf(true);
        try {
            const html2canvas = (await import("html2canvas-pro")).default;
            const { jsPDF }   = await import("jspdf");

            const element = document.getElementById("pdf-quotation-section");
            if (!element) { toast.error("Section not found"); return; }

            const canvas  = await html2canvas(element, { scale: 3, useCORS: true });
            const imgData = canvas.toDataURL("image/png");
            const pdf     = new jsPDF("p", "mm", "a4");

            const margin    = 8;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight= pdf.internal.pageSize.getHeight();
            const imgWidth  = pageWidth - 2 * margin;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const available = pageHeight - 2 * margin;

            if (imgHeight <= available) {
                pdf.addImage(imgData, "PNG", margin, margin, imgWidth, available);
            } else {
                let heightLeft = imgHeight;
                let position   = margin;
                pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
                heightLeft -= available;
                while (heightLeft > 0) {
                    position -= available;
                    pdf.addPage();
                    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
                    heightLeft -= available;
                }
            }

            if (action === "download") {
                pdf.save(`${estimateOrder?.orderNo || "quotation"}.pdf`);
            } else {
                window.open(pdf.output("bloburl"), "_blank");
            }
        } catch {
            toast.error(`Failed to ${action} PDF`);
        } finally {
            setGeneratingPdf(false);
        }
    };

    // ─── Email ────────────────────────────────────────────────────────────────

    const handleOpenEmailModal = useCallback(async (item: SalesOrder) => {
        setSendingEmail(true);
        try {
            const fullItem = await salesOrderService.fetchById(item.id);
            setEmailOrder(fullItem);
            setRecipientEmail((fullItem.customer as any)?.email || "");
            setEmailSubject(`Quotation for Order ${fullItem.orderNo}`);
            setEmailMessage(
                `Dear ${fullItem.customer?.displayName || fullItem.customer?.firmName || "Customer"},\n\nPlease find the attached quotation.\n\nBest regards,\n${company?.companyName || "Sunsea"}`
            );
            setShowEmailModal(true);
        } catch {
            toast.error("Failed to load quotation details");
        } finally {
            setSendingEmail(false);
        }
    }, [company]);

    const handleSendEmail = async () => {
        if (!emailOrder || !recipientEmail) { toast.error("Recipient email is required."); return; }
        setSendingEmail(true);
        try {
            await salesOrderService.emailQuotation(emailOrder.id, recipientEmail, emailSubject, emailMessage);
            toast.success("Email sent successfully!");
            setShowEmailModal(false);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to send email");
        } finally {
            setSendingEmail(false);
        }
    };

    // ─── WhatsApp ─────────────────────────────────────────────────────────────

    const handleOpenWhatsappModal = useCallback(async (item: SalesOrder) => {
        setSendingWhatsapp(true);
        try {
            const fullItem = await salesOrderService.fetchById(item.id);
            setWhatsappOrder(fullItem);
            setRecipientPhone(fullItem.mobile || "");
            setWhatsappMessage(
                `Dear ${fullItem.customer?.displayName || fullItem.customer?.firmName || "Customer"},\n\nPlease find the attached quotation.\n\nBest regards,\n${company?.companyName || "Sunsea"}`
            );
            setShowWhatsappModal(true);
        } catch {
            toast.error("Failed to load quotation details");
        } finally {
            setSendingWhatsapp(false);
        }
    }, [company]);

    const handleSendWhatsapp = async () => {
        if (!whatsappOrder || !recipientPhone) { toast.error("Recipient phone is required."); return; }
        setSendingWhatsapp(true);
        try {
            await salesOrderService.whatsappQuotation(
                whatsappOrder.id,
                recipientPhone.replace(/^\+/, ""),
                whatsappMessage
            );
            toast.success("WhatsApp message sent!");
            setShowWhatsappModal(false);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to send WhatsApp");
        } finally {
            setSendingWhatsapp(false);
        }
    };

    // ─── Delete ───────────────────────────────────────────────────────────────

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null || isDeleting) return;
        setIsDeleting(true);
        try {
            await salesOrderService.delete(itemToDelete);
            toast.success("Quotation deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            markStaleByPrefix(QUOTATION_CACHE_PREFIX);
            refresh();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to delete quotation");
        } finally {
            setIsDeleting(false);
        }
    };

    const formatCurrency = (amount: number) =>
        `₹${(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div>
            <div className="max-w-[1200px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Quotation List</h2>
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
                                    label="Dispatch Type"
                                    name="dispatchType"
                                    value={draftDispatchType}
                                    defaultOptionLabel="All"
                                    options={DISPATCH_TYPE_OPTIONS}
                                    searchable={false}
                                    onChange={(e) => setDraftDispatchType(e.target.value)}
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

                        {canExport && (
                            <ExportCSVButton
                                fetchData={fetchQuotationsForExport}
                                columns={csvColumns}
                                filename={csvFilename}
                                text="Export"
                            />
                        )}

                        {canCreate && (
                            <CustomButton
                                text="Create Quotation"
                                icon={FaPlus}
                                onClick={() => navigate("/quatation-order/create")}
                            />
                        )}
                    </div>
                </div>

                {/* Active filter chips */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2 px-6 py-2 border-b border-line flex-wrap">
                        <span className="text-xs text-ink-subtle">Active filters:</span>

                        {fromDate && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                From: {fromDate}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setFromDate(""); setDraftFromDate(""); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {toDate && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                To: {toDate}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setToDate(""); setDraftToDate(""); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {customerTypeId && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                Type: {customerTypes.find((t) => String(t.id) === customerTypeId)?.name || customerTypeId}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setCustomerTypeId(""); setDraftCustomerTypeId(""); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {customerGradeId && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                Grade: {customerGrades.find((g) => String(g.id) === customerGradeId)?.name || customerGradeId}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setCustomerGradeId(""); setDraftCustomerGradeId(""); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {dispatchType && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                Dispatch: {DISPATCH_TYPE_OPTIONS.find((d) => d.value === dispatchType)?.label || dispatchType}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setDispatchType(""); setDraftDispatchType(""); setCurrentPage(1); }}
                                />
                            </span>
                        )}

                        {orderSource && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                                Source: {ORDER_SOURCE_OPTIONS.find((s) => s.value === orderSource)?.label || orderSource}
                                <FaTimes
                                    className="cursor-pointer hover:text-indigo-200 ml-0.5"
                                    onClick={() => { setOrderSource(""); setDraftOrderSource(""); setCurrentPage(1); }}
                                />
                            </span>
                        )}
                    </div>
                )}

                {/* Table — data-table-nav lets F3-exit restore focus here */}
                <div
                    ref={tableRef}
                    tabIndex={0}
                    data-table-nav
                    className="p-0 outline-none"
                >
                    <DataTable
                        data={quotations}
                        rowKey={(item) => item.id}
                        loading={loading}
                        emptyMessage="No quotations found."
                        rowClassName={(_row, index) =>
                            index === focusedIndex ? "bg-primary/8" : ""
                        }
                        onRowClick={(item, index) => {
                            setFocusedIndex(index);
                            tableRef.current?.focus({ preventScroll: true });
                            handleOpenView(item);
                        }}
                        pagination={{
                            currentPage,
                            totalPages,
                            onPageChange: (page) => setCurrentPage(page),
                        }}
                        columns={[
                            {
                                header: "#",
                                width: "60px",
                                render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                            },
                            { header: "ORDER NO",   accessor: "orderNo" },
                            { header: "ORDER DATE", render: (item) => formatDate(item.orderDate) },
                            {
                                header: "CUSTOMER",
                                headerNode: (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSortOrder();
                                        }}
                                        title={`Sort by Customer: ${
                                            sortOrder === "default"
                                                ? "Default Order"
                                                : sortOrder === "asc"
                                                ? "A to Z (Ascending)"
                                                : "Z to A (Descending)"
                                        } (Click or press F6)`}
                                        className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-[1.5px] outline-none hover:opacity-90 transition-opacity"
                                    >
                                        <span className={sortOrder !== "default" ? "text-primary font-black" : "group-hover/sort:text-ink transition-colors"}>
                                            CUSTOMER
                                        </span>
                                        <span
                                            className={`inline-flex items-center justify-center w-4 h-4 rounded transition-all duration-200 ${
                                                sortOrder === "asc" || sortOrder === "desc"
                                                    ? "bg-primary/20 text-primary scale-110"
                                                    : "text-ink-subtle/60 group-hover/sort:text-ink group-hover/sort:bg-card-2"
                                            }`}
                                        >
                                            {sortOrder === "asc" ? (
                                                <FaArrowUp size={10} />
                                            ) : sortOrder === "desc" ? (
                                                <FaArrowDown size={10} />
                                            ) : (
                                                <FaSort size={10} />
                                            )}
                                        </span>
                                        {sortOrder !== "default" && (
                                            <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-primary text-white tracking-tighter shadow-xs">
                                                {sortOrder === "asc" ? "A-Z" : "Z-A"}
                                            </span>
                                        )}
                                    </button>
                                ),
                                render: (item) => item.customer?.displayName || item.customer?.firmName || "N/A",
                            },
                            {
                                header: "NET AMOUNT",
                                render: (item) => {
                                    // Recompute netAmount: GST must apply on taxable (post-discount) amount
                                    const subtotal     = Number(item.subtotal     ?? 0);
                                    const discount     = Number(item.totalDiscount ?? 0);
                                    const totalTax     = Number(item.totalTax     ?? 0);
                                    const taxable      = Math.max(0, subtotal - discount);
                                    const discRatio    = subtotal > 0 ? taxable / subtotal : 1;
                                    const adjustedTax  = totalTax * discRatio;
                                    const correctNet   = taxable + adjustedTax;
                                    return formatCurrency(correctNet > 0 ? correctNet : item.netAmount);
                                },
                            },
                            { header: "STATUS",     render: (item) => <StatusBadge status={item.status || "PENDING"} /> },
                            {
                                header: "ACTIONS",
                                width: "300px",
                                align: "center",
                                render: (item) => {
                                    const isEditable = item.status !== "CONFIRMED";
                                    const isDeletable = item.status !== "CONFIRMED";
                                    return (
                                        <div
                                            className="flex items-center justify-center gap-1.5 whitespace-nowrap"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ViewButton onClick={() => handleOpenView(item)} />

                                            {/* Estimate preview */}
                                            <IconButton
                                                icon={FiClipboard}
                                                variant="info"
                                                title="Preview / Print Estimate"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEstimate(item.id);
                                                }}
                                            />

                                            {isEditable && canEdit && (
                                                <EditButton onClick={() => handleOpenEdit(item)} />
                                            )}

                                            {/* Email */}
                                            {canSendWhatsappEmail && (
                                                <EmailButton
                                                    disabled={sendingEmail}
                                                    onClick={() => handleOpenEmailModal(item)}
                                                />
                                            )}

                                            {/* WhatsApp */}
                                            {canSendWhatsappEmail && (
                                                <WhatsappButton
                                                    disabled={sendingWhatsapp}
                                                    onClick={() => handleOpenWhatsappModal(item)}
                                                />
                                            )}

                                            {isDeletable && canDelete && (
                                                <DeleteButton
                                                    onClick={() => { setItemToDelete(item.id); setShowDeleteModal(true); }}
                                                />
                                            )}
                                        </div>
                                    );
                                },
                            },
                        ]}
                    />
                </div>
            </div>

            {/* ── Estimate Preview Modal ── */}
            {showEstimateModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto no-print">
                    <div
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
                        onClick={handleCloseEstimateModal}
                    />
                    <div className="flex min-h-full items-end justify-center p-4 sm:items-center sm:p-0">
                        <div className="relative transform overflow-hidden rounded-2xl bg-card text-left shadow-xl sm:my-8 sm:w-full sm:max-w-4xl">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-line-soft flex items-center justify-between">
                                <h3 className="text-lg font-bold text-ink">Quotation Preview</h3>
                                <button
                                    onClick={handleCloseEstimateModal}
                                    className="rounded-lg p-1 text-ink-subtle hover:bg-card-2 hover:text-ink-muted transition-colors"
                                >
                                    <FaTimes size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 bg-card-2 min-h-[400px] max-h-[calc(100vh-200px)] overflow-y-auto">
                                {loadingEstimate ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
                                        <span className="mt-4 text-ink-subtle font-semibold">Loading details...</span>
                                    </div>
                                ) : estimateOrder ? (
                                    <DocumentPrintLayout subtitle="Quotation" title="QUOTATION">
                                        <SalesOrderEstimateContent
                                            estimateOrder={estimateOrder}
                                            formatDate={formatDate}
                                        />
                                    </DocumentPrintLayout>
                                ) : (
                                    <div className="text-center py-10 text-ink-subtle">
                                        Failed to load quotation details.
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            {estimateOrder && (
                                <div className="px-6 py-4 border-t border-line-soft bg-card-2 flex items-center justify-end gap-2">
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
            )}

            {/* Print-Only Quotation Section */}
            {estimateOrder && (
                <div id="print-only-quotation-section" className="hidden print:block">
                    <DocumentPrintLayout subtitle="Quotation" title="QUOTATION">
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
                <div
                    id="pdf-quotation-section"
                    style={{ position: "absolute", left: "-9999px", top: "0", width: "794px", minHeight: "1123px", background: "white" }}
                >
                    <DocumentPrintLayout subtitle="Quotation" title="QUOTATION">
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
                onHide={handleCloseDeleteModal}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete Quotation"
                message="Are you sure you want to delete this quotation? This action cannot be undone."
                confirmText="Delete"
                confirmVariant="danger"
                isDangerous={true}
                isLoading={isDeleting}
                loadingText="Deleting..."
            />

            {/* Email Modal */}
            <CommonConfirmModal
                show={showEmailModal}
                onHide={handleCloseEmailModal}
                onConfirm={handleSendEmail}
                title="Send Quotation Email"
                message={`Send quotation PDF to: ${recipientEmail}`}
                warningText="A PDF will be generated and emailed to the customer."
                confirmText="Send Email"
                loadingText="Sending..."
                confirmIcon={Mail}
                confirmVariant="primary"
                isLoading={sendingEmail}
            />

            {/* WhatsApp Modal */}
            <CommonConfirmModal
                show={showWhatsappModal}
                onHide={handleCloseWhatsappModal}
                onConfirm={handleSendWhatsapp}
                title="Send WhatsApp Quotation"
                message={
                    <div className="text-left mt-2 flex flex-col gap-3">
                        <p className="text-sm text-ink-subtle mb-2">Send quotation PDF via WhatsApp.</p>
                        <div>
                            <TextInput
                                label="Phone Number (with country code, e.g. 919876543210)"
                                name="recipientPhone"
                                value={recipientPhone}
                                onChange={(e) => setRecipientPhone(e.target.value)}
                            />
                        </div>
                    </div>
                }
                warningText="A PDF will be generated and sent to the customer's WhatsApp."
                confirmText="Send WhatsApp"
                loadingText="Sending..."
                confirmIcon={MessageCircle}
                confirmVariant="primary"
                isLoading={sendingWhatsapp}
            />
        </div>
    );
};

export default QuotationList;
