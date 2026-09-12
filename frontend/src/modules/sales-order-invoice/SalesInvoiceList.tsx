import { formatDate } from "../../utils/dateUtils";
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../hooks/useTableKeyboardNav";
import { FaPlus, FaSort, FaArrowUp, FaArrowDown, FaWhatsapp } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import CommonViewModal from "../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesInvoiceService } from "../../services/salesInvoiceService";
import CustomButton from "../../components/ui/Button/Button";
import ViewButton from "../../components/ui/viewbutton/ViewButton";
import DeleteButton from "../../components/ui/DeleteButton/DeleteButton";
import StatusBadge from "../../components/ui/StatusBadge/Badge";
import EditButton from "../../components/ui/EditButton/EditButton";
import DataTable, { type DataTableColumn } from "../../components/ui/table/DataTable";
import SearchInput from "../../components/ui/SearchInput/SearchInput";
import ExportCSVButton from "../../components/ui/ExportCSVButton/ExportCSVButton";
import EmailButton from "../../components/ui/EmailButton/EmailButton";
import WhatsappButton from "../../components/ui/WhatsappButton/WhatsappButton";
import { Mail } from "lucide-react";
import { useAppSelector } from "../../hooks/reduxHooks";
import { useListCache, markStaleByPrefix } from "../../hooks/useListCache";
import { usePermission } from "../../hooks/usePermission";

const ITEMS_PER_PAGE = 15;

type SortOrder = "default" | "asc" | "desc";
const SORT_STORAGE_KEY = "sunsea_sales_invoice_sort";

const getMobileFromCustomer = (cust: any) => {
    if (!cust) return "";
    const m = cust.mobile;
    if (Array.isArray(m) && m.length > 0) {
        return m[0].number || m[0].value || "";
    }
    if (typeof m === "string") return m;
    return "";
};

const INVOICE_CACHE_PREFIX = "salesInvoices:";

const SalesInvoiceList: React.FC = () => {
    const navigate = useNavigate();
    const tableRef = useRef<HTMLDivElement>(null);
    const { can } = usePermission();
    const canSendWhatsappEmail = can("sales-invoices.whatsapp-email") || can("sales-invoices.whatsapp_email");
    const canCreate = can("sales-invoices.create");
    const canEdit = can("sales-invoices.edit");
    const canDelete = can("sales-invoices.delete");
    const canExport = can("sales-invoices.export");

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const company = useAppSelector((state) => state.company.data);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailInvoice, setEmailInvoice] = useState<any | null>(null);
    const [recipientEmail, setRecipientEmail] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [emailMessage, setEmailMessage] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);

    const [showWhatsappModal, setShowWhatsappModal] = useState(false);
    const [whatsappInvoice, setWhatsappInvoice] = useState<any | null>(null);
    const [recipientPhone, setRecipientPhone] = useState("");
    const [whatsappMessage, setWhatsappMessage] = useState("");
    const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

    // ── Alphabetical / Column Sorting with localStorage persistence ──────────
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

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const cacheKey = `${INVOICE_CACHE_PREFIX}${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}`;

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const response = await salesInvoiceService.fetchAll({
            page: currentPage,
            pageSize: ITEMS_PER_PAGE,
            search: debouncedSearch || undefined,
        });
        return { data: response.data || [], total: response.total ?? 0 };
    }, [currentPage, debouncedSearch]);

    const { data: rawData, total, loading, refresh } = useListCache({
        cacheKey,
        socketModule: "salesInvoice",
        fetcher,
        enabled: can("sales-invoices.view"),
    });

    // Client-side sorted invoices based on sortOrder
    const data = useMemo(() => {
        if (!rawData || !Array.isArray(rawData)) return [];
        if (sortOrder === "default") return rawData;

        return [...rawData].sort((a: any, b: any) => {
            const nameA = (a.customer?.displayName || a.customer?.firmName || a.invoiceNo || "").trim().toLowerCase();
            const nameB = (b.customer?.displayName || b.customer?.firmName || b.invoiceNo || "").trim().toLowerCase();
            if (sortOrder === "asc") {
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
            } else {
                return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: "base" });
            }
        });
    }, [rawData, sortOrder]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleEdit = useCallback((invoice: any) => {
        if (invoice && invoice.status !== "PAID" && canEdit) {
            navigate(`/sales-invoices/edit/${invoice.id}`);
        }
    }, [canEdit, navigate]);

    const handleOpenView = useCallback((item: any) => {
        navigate(`/sales-invoices/details/${item.id}`);
    }, [navigate]);

    // ── Table keyboard navigation (Arrow keys, Enter to view, E to edit) ────
    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: data?.length ?? 0,
        onEnter: (i) => {
            const invoice = data?.[i];
            if (invoice) handleOpenView(invoice);
        },
        onEdit: (i) => {
            const invoice = data?.[i];
            if (invoice) handleEdit(invoice);
        },
        containerRef: tableRef,
    });

    // ── Page Shortcuts (F5 refresh, F6 sort, F8 delete, Ins new, Ctrl+Shift+E export) ──
    usePageShortcuts({
        onRefresh: () => refresh(),
        onSort: () => toggleSortOrder(),
        onDelete: () => {
            const item = data?.[focusedIndex];
            if (item && canDelete) {
                setItemToDelete(item.id);
                setShowDeleteModal(true);
            }
        },
        onNew: () => canCreate && navigate("/sales-invoices/create"),
        onExport: () => {
            const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-btn], button:has(svg):has(span)");
            exportBtn?.click();
        },
    });

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;

        try {
            await salesInvoiceService.delete(itemToDelete);
            toast.success("Invoice deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            markStaleByPrefix(INVOICE_CACHE_PREFIX);
            refresh();
            setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
        } catch (error: any) {
            console.error("Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete invoice");
        }
    };

    

    const formatCurrency = (amount: any) =>
        `₹${Number(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    const handleOpenEmailModal = async (item: any) => {
        try {
            setSendingEmail(true);
            const fullItem = await salesInvoiceService.fetchById(item.id);
            setEmailInvoice(fullItem);
            setRecipientEmail((fullItem.customer as any)?.email || "");
            setEmailSubject(`Invoice ${fullItem.invoiceNo}`);
            setEmailMessage(`Dear ${fullItem.customer?.displayName || fullItem.customer?.firmName || "Customer"},\n\nPlease find the attached invoice for your reference.\n\nBest regards,\n${company?.companyName || "Sunsea"}`);
            setShowEmailModal(true);
        } catch (error: any) {
            toast.error("Failed to load invoice details");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleSendEmail = async () => {
        if (!emailInvoice || !recipientEmail) {
            toast.error("Recipient email is required.");
            return;
        }
        setSendingEmail(true);
        try {
            await salesInvoiceService.emailInvoice(
                emailInvoice.id,
                recipientEmail,
                emailSubject,
                emailMessage
            );

            toast.success("Email sent successfully!");
            setShowEmailModal(false);
            setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || "Failed to send email");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleOpenWhatsappModal = async (item: any) => {
        try {
            setSendingWhatsapp(true);
            const fullItem = await salesInvoiceService.fetchById(item.id);
            setWhatsappInvoice(fullItem);

            // Extract best mobile number from customer object
            let rPhone = "";
            if (fullItem.customer?.mobile) {
                if (Array.isArray(fullItem.customer.mobile) && fullItem.customer.mobile.length > 0) {
                    rPhone = fullItem.customer.mobile[0].number || fullItem.customer.mobile[0].value || "";
                } else if (typeof fullItem.customer.mobile === "string") {
                    rPhone = fullItem.customer.mobile;
                }
            }
            setRecipientPhone(rPhone);

            setWhatsappMessage(`Dear ${fullItem.customer?.displayName || fullItem.customer?.firmName || "Customer"},\n\nPlease find the attached invoice for your reference.\n\nBest regards,\n${company?.companyName || "Sunsea"}`);
            setShowWhatsappModal(true);
        } catch (error: any) {
            toast.error("Failed to load invoice details");
        } finally {
            setSendingWhatsapp(false);
        }
    };

    const handleSendWhatsapp = async () => {
        if (!whatsappInvoice || !recipientPhone) {
            toast.error("Recipient phone is required.");
            return;
        }
        setSendingWhatsapp(true);
        try {
            const formattedPhone = recipientPhone.replace(/^\+/, "");
            await salesInvoiceService.whatsappInvoice(
                whatsappInvoice.id,
                formattedPhone,
                whatsappMessage
            );

            toast.success("WhatsApp message sent successfully!");
            setShowWhatsappModal(false);
            setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || "Failed to send WhatsApp message");
        } finally {
            setSendingWhatsapp(false);
        }
    };

    const fetchSalesInvoicesForExport = useCallback(async () => {
        const res = await salesInvoiceService.fetchAll({ page: 1, pageSize: 100000 });
        return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    }, []);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Invoice No", accessor: (item: any) => item.invoiceNo || "" },
            { header: "Invoice Date", accessor: (item: any) => formatDate(item.invoiceDate) },
            { header: "Due Date", accessor: (item: any) => formatDate(item.dueDate) },
            { header: "Customer", accessor: (item: any) => item.customer?.displayName || item.customer?.firmName || "N/A" },
            { header: "Net Amount", accessor: (item: any) => item.grandTotal != null ? Number(item.grandTotal).toFixed(2) : "0.00" },
            { header: "Status", accessor: (item: any) => item.status || "" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Sales_Invoice_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    const columns: DataTableColumn<any>[] = [
        {
            header: "#",
            width: "60px",
            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
            align: "center",
        },
        {
            header: "INVOICE NO",
            render: (item) => <span className="font-semibold text-ink">{item.invoiceNo}</span>,
        },
        {
            header: "INVOICE DATE",
            render: (item) => <span className="text-ink-muted">{formatDate(item.invoiceDate)}</span>,
        },
        {
            header: "CUSTOMER",
            headerNode: (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleSortOrder();
                    }}
                    title={`Sort Alphabetically: ${
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
            render: (item) => <span className="font-medium text-ink-muted">{item.customer?.displayName || item.customer?.firmName || "N/A"}</span>,
        },
        // {
        //     header: "SUB TOTAL",
        //     render: (item) => <span className="font-semibold text-ink-muted">{formatCurrency(item.subTotal)}</span>,
        //     align: "right",
        // },
        // {
        //     header: "TAX AMOUNT",
        //     render: (item) => <span className="font-medium text-ink-subtle">{formatCurrency(item.taxTotal)}</span>,
        //     align: "right",
        // },
        {
            header: "NET AMOUNT",
            render: (item) => <span className="font-bold text-emerald-600">{formatCurrency(item.grandTotal)}</span>,
            align: "right",
        },
        {
            header: "STATUS",
            render: () => <StatusBadge status="INVOICED" />,
            align: "center",
        },
        {
            header: "ACTIONS",
            width: "250px",
            render: (item) => (
                <div className="flex justify-center items-center gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {canSendWhatsappEmail && <EmailButton onClick={() => handleOpenEmailModal(item)} />}
                    {canSendWhatsappEmail && <WhatsappButton onClick={() => handleOpenWhatsappModal(item)} />}
                    <ViewButton onClick={() => handleOpenView(item)} />
                    {item.status !== "PAID" && canEdit && (
                        <EditButton onClick={() => handleEdit(item)} />
                    )}
                    {canDelete && (
                        <DeleteButton onClick={() => {
                            setItemToDelete(item.id);
                            setShowDeleteModal(true);
                        }} />
                    )}
                </div>
            ),
            align: "center",
        },
    ];

    return (
        <div>
            <div className="max-w-[1700px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Sales Invoice List</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search invoices..."
                        />
                        {canExport && (
                            <ExportCSVButton
                                fetchData={fetchSalesInvoicesForExport}
                                columns={csvColumns}
                                filename={csvFilename}
                                text="Export"
                            />
                        )}
                        {canCreate && (
                            <CustomButton
                                text="Add Sales Invoice"
                                icon={FaPlus}
                                onClick={() => navigate("/sales-invoices/create")}
                            />
                        )}
                    </div>
                </div>

                {/* Table with Keyboard Navigation */}
                <div
                    ref={tableRef}
                    tabIndex={0}
                    data-table-nav
                    className="p-0 outline-none"
                >
                    <DataTable
                        columns={columns}
                        data={data}
                        rowKey={(item) => item.id}
                        loading={loading}
                        emptyMessage="No invoices found."
                        rowClassName={(_row, index) =>
                            index === focusedIndex
                                ? "bg-primary/8"
                                : ""
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
                    />
                </div>
            </div>

            {/* View Modal */}
            <CommonViewModal
                show={showViewModal}
                onHide={() => {
                    setShowViewModal(false);
                    setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
                }}
                modalTitle="Sales Invoice details"
                avatarText={selectedItem ? selectedItem.invoiceNo.charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? selectedItem.invoiceNo : ""}
                headerSubtitle={
                    selectedItem ? `Customer: ${selectedItem.customer?.displayName || selectedItem.customer?.firmName || "N/A"}` : ""
                }
                sections={
                    selectedItem
                        ? [
                            {
                                fields: [
                                    { label: "Invoice No", value: selectedItem.invoiceNo },
                                    { label: "Invoice Date", value: formatDate(selectedItem.invoiceDate) },
                                    { label: "Due Date", value: formatDate(selectedItem.dueDate) },
                                    { label: "Mobile Number", value: getMobileFromCustomer(selectedItem.customer) || "N/A" },
                                ],
                            },
                            {
                                title: "Billing & Shipping Details",
                                fields: [
                                    {
                                        label: "Billing address",
                                        value: [
                                            selectedItem.customer?.billingAddressLine1,
                                            selectedItem.customer?.billingCity,
                                            selectedItem.customer?.billingState,
                                            selectedItem.customer?.billingPincode,
                                        ]
                                            .filter(Boolean)
                                            .join(", ") || "N/A",
                                    },
                                    {
                                        label: "Shipping address",
                                        value: [
                                            selectedItem.customer?.shippingAddressLine1,
                                            selectedItem.customer?.shippingCity,
                                            selectedItem.customer?.shippingState,
                                            selectedItem.customer?.shippingPincode,
                                        ]
                                            .filter(Boolean)
                                            .join(", ") || "N/A",
                                    },
                                ],
                            },
                            {
                                title: "Invoice Summary",
                                fields: [
                                    { label: "Total items", value: String(selectedItem.items?.length ?? 0) },
                                    { label: "Subtotal", value: formatCurrency(selectedItem.subTotal) },
                                    { label: "Total tax", value: formatCurrency(selectedItem.taxTotal) },
                                    { label: "Grand Total", value: formatCurrency(selectedItem.grandTotal) },
                                    { label: "Notes", value: selectedItem.notes || "N/A" },
                                ],
                            },
                        ]
                        : []
                }
            />

            {/* Delete Confirmation Modal */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => {
                    setShowDeleteModal(false);
                    setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
                }}
                onConfirm={handleDeleteConfirm}
                title="Delete Invoice"
                message="Are you sure you want to delete this invoice? This action cannot be undone."
                confirmText="Delete"
                confirmVariant="danger"
            />

            <CommonConfirmModal
                show={showEmailModal}
                onHide={() => {
                    setShowEmailModal(false);
                    setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
                }}
                onConfirm={handleSendEmail}
                title="Send Email"
                message={`Are you sure you want to send the invoice to ${recipientEmail || "this customer"}?`}
                warningText="This will generate a PDF and send it to the customer."
                confirmText="Send Email"
                loadingText="Sending..."
                confirmIcon={Mail}
                confirmVariant="primary"
                isLoading={sendingEmail}
            />

            <CommonConfirmModal
                show={showWhatsappModal}
                onHide={() => {
                    setShowWhatsappModal(false);
                    setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
                }}
                onConfirm={handleSendWhatsapp}
                title="Send WhatsApp"
                message={
                    <div className="text-left mt-2 flex flex-col gap-3">
                        <p className="text-sm text-ink-subtle mb-2">Are you sure you want to send the invoice via WhatsApp?</p>
                        <div>
                            <label className="block text-sm font-medium text-ink-muted mb-1">Phone Number (with country code, e.g. 919876543210)</label>
                            {(() => {
                                const phones = [];
                                if (whatsappInvoice?.customer) {
                                    if (Array.isArray(whatsappInvoice.customer.mobile)) {
                                        whatsappInvoice.customer.mobile.forEach((m: any) => {
                                            if (m.number || m.value) phones.push({ label: m.label || "Mobile", number: m.number || m.value });
                                        });
                                    } else if (typeof whatsappInvoice.customer.mobile === "string" && whatsappInvoice.customer.mobile) {
                                        phones.push({ label: "Mobile", number: whatsappInvoice.customer.mobile });
                                    }
                                    if (typeof whatsappInvoice.customer.altPhone === "string" && whatsappInvoice.customer.altPhone) {
                                        phones.push({ label: "Alternative", number: whatsappInvoice.customer.altPhone });
                                    }
                                }

                                if (phones.length > 1) {
                                    return (
                                        <select
                                            className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-card"
                                            value={recipientPhone}
                                            onChange={(e) => setRecipientPhone(e.target.value)}
                                        >
                                            {phones.map((p, idx) => (
                                                <option key={idx} value={p.number}>
                                                    {p.label ? `${p.label} (${p.number})` : p.number}
                                                </option>
                                            ))}
                                        </select>
                                    );
                                }
                                return (
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                                        value={recipientPhone}
                                        onChange={(e) => setRecipientPhone(e.target.value)}
                                    />
                                );
                            })()}
                        </div>
                    </div>
                }
                warningText="This will generate a PDF and send it to the customer's WhatsApp."
                confirmText="Send WhatsApp"
                loadingText="Sending..."
                confirmIcon={FaWhatsapp}
                confirmVariant="primary"
                isLoading={sendingWhatsapp}
            />
        </div>
    );
};

export default SalesInvoiceList;
