import React, { useState, useCallback, useEffect } from "react";
import { FaPlus, FaTrash, FaEye, FaWhatsapp } from "react-icons/fa";
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
import EmailButton from "../../components/ui/EmailButton/EmailButton";
import WhatsappButton from "../../components/ui/WhatsappButton/WhatsappButton";
import { Mail } from "lucide-react";
import { useAppSelector } from "../../hooks/reduxHooks";
import { useSocketSync } from "../../hooks/useSocketSync";
import { usePermission } from "../../hooks/usePermission";

const ITEMS_PER_PAGE = 10;

const getMobileFromCustomer = (cust: any) => {
    if (!cust) return "";
    const m = cust.mobile;
    if (Array.isArray(m) && m.length > 0) {
        return m[0].number || m[0].value || "";
    }
    if (typeof m === "string") return m;
    return "";
};

const calculateSalesPendingAmount = (item: any) => {
    const status = (item.status || "").toUpperCase();
    if (status === "PAID" || status === "CLOSED") return 0;
    const net = Number(item.grandTotal || 0);
    const rawPayments = Array.isArray(item.payments)
        ? item.payments
        : (typeof item.payments === "string" ? JSON.parse(item.payments || "[]") : []);
    const paid = rawPayments.reduce((sum: number, p: any) => sum + Number(p?.amount || 0), 0);
    const pending = net - paid;
    return pending > 0 ? pending : 0;
};

const SalesInvoiceList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

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

    const fetchInvoices = useCallback(async () => {
        if (!can("sales-invoices.view")) return;
        setLoading(true);
        try {
            const response = await salesInvoiceService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
            });

            setData(response.data || []);
            setTotal(response.total ?? 0)
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch invoices");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, can]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    useSocketSync("salesInvoice", undefined, fetchInvoices);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;

        try {
            await salesInvoiceService.delete(itemToDelete);
            toast.success("Invoice deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchInvoices();
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete invoice");
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
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
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || "Failed to send WhatsApp message");
        } finally {
            setSendingWhatsapp(false);
        }
    };

    const handleOpenView = async (item: any) => {
        navigate(`/sales-invoices/details/${item.id}`);
        // try {
        //     const details = await salesInvoiceService.fetchById(item.id);
        //     setSelectedItem(details);
        //     setShowViewModal(true);
        // } catch (error) {
        //     toast.error("Failed to load invoice details");
        // }
    };

    const columns: DataTableColumn<any>[] = [
        {
            header: "#",
            width: "60px",
            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
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
            header: "DUE DATE",
            render: (item) => <span className="text-ink-muted">{formatDate(item.dueDate)}</span>,
        },
        {
            header: "CUSTOMER",
            render: (item) => <span className="font-medium text-ink-muted">{item.customer?.displayName || item.customer?.firmName || "N/A"}</span>,
        },
        {
            header: "SUB TOTAL",
            render: (item) => <span className="font-semibold text-ink-muted">{formatCurrency(item.subTotal)}</span>,
        },
        {
            header: "TAX AMOUNT",
            render: (item) => <span className="font-medium text-ink-subtle">{formatCurrency(item.taxTotal)}</span>,
        },
        {
            header: "NET AMOUNT",
            render: (item) => <span className="font-bold text-emerald-600">{formatCurrency(item.grandTotal)}</span>,
        },
        {
            header: "PENDING PAYMENT",
            render: (item) => {
                const pending = calculateSalesPendingAmount(item);
                return (
                    <span className={`font-semibold ${pending > 0 ? "text-amber-600" : "text-ink-subtle"}`}>
                        {formatCurrency(pending)}
                    </span>
                );
            },
        },
        {
            header: "STATUS",
            render: () => <StatusBadge status="INVOICED" />,
        },
        {
            header: "ACTIONS",
            width: "250px",   // was 160px — too tight for 5 icons + gaps
            render: (item) => (
                <div className="flex justify-start items-center gap-1.5 whitespace-nowrap">
                    <EmailButton onClick={() => handleOpenEmailModal(item)} />
                    <WhatsappButton onClick={() => handleOpenWhatsappModal(item)} />
                    <ViewButton onClick={() => handleOpenView(item)} />
                    {item.status !== "PAID" && (
                        <EditButton onClick={() => navigate(`/sales-invoices/edit/${item.id}`)} />
                    )}
                    <DeleteButton onClick={() => {
                        setItemToDelete(item.id);
                        setShowDeleteModal(true);
                    }} />
                </div>
            ),
            align: "left"
        },
    ];

    return (
        <div>
            <div className="max-w-[1600px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
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
                        <CustomButton
                            text="Create Invoice"
                            icon={FaPlus}
                            onClick={() => navigate("/sales-invoices/create")}
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={data}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No invoices found."
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: setCurrentPage,
                    }}
                />
            </div>

            {/* View Modal */}
            <CommonViewModal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
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
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Invoice"
                message="Are you sure you want to delete this invoice? This action cannot be undone."
                confirmText="Delete"
                confirmVariant="danger"
            />

            <CommonConfirmModal
                show={showEmailModal}
                onHide={() => setShowEmailModal(false)}
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
                onHide={() => setShowWhatsappModal(false)}
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
