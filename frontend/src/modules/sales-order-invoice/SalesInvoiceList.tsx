import React, { useState, useCallback, useEffect } from "react";
import { FaPlus, FaTrash, FaEye } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

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
import { Mail } from "lucide-react";
import { useAppSelector } from "../../hooks/reduxHooks";

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

const SalesInvoiceList: React.FC = () => {
    const navigate = useNavigate();
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

    const fetchInvoices = useCallback(async () => {
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
    }, [currentPage, searchTerm]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

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
            render: (item) => <span className="font-semibold text-slate-800">{item.invoiceNo}</span>,
        },
        {
            header: "INVOICE DATE",
            render: (item) => <span className="text-slate-600">{formatDate(item.invoiceDate)}</span>,
        },
        {
            header: "DUE DATE",
            render: (item) => <span className="text-slate-600">{formatDate(item.dueDate)}</span>,
        },
        {
            header: "CUSTOMER",
            render: (item) => <span className="font-medium text-slate-700">{item.customer?.displayName || item.customer?.firmName || "N/A"}</span>,
        },
        {
            header: "SUB TOTAL",
            render: (item) => <span className="font-semibold text-slate-700">{formatCurrency(item.subTotal)}</span>,
        },
        {
            header: "TAX AMOUNT",
            render: (item) => <span className="font-medium text-slate-400">{formatCurrency(item.taxTotal)}</span>,
        },
        {
            header: "NET AMOUNT",
            render: (item) => <span className="font-bold text-emerald-600">{formatCurrency(item.grandTotal)}</span>,
        },
        {
            header: "STATUS",
            render: (item) => <StatusBadge status={item.status} />,
        },
        {
            header: "ACTIONS",
            width: "160px",
            render: (item) => (
                <div className="flex justify-start gap-2">
                    <EmailButton onClick={() => handleOpenEmailModal(item)} />
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
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Sales Invoice List</h2>
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
        </div>
    );
};

export default SalesInvoiceList;
