import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppSelector } from "../../../hooks/reduxHooks";
import { toast } from "react-toastify";
import { usePermission } from "../../../hooks/usePermission";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesOrderService, type SalesOrder, type SalesOrderStatus } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useSocketSync } from "../../../hooks/useSocketSync";
import EmailButton from "../../../components/ui/EmailButton/EmailButton";
import WhatsappButton from "../../../components/ui/WhatsappButton/WhatsappButton";
import { Download, Mail, MessageCircle } from "lucide-react";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import IconButton from "../../../components/ui/IconButton/IconButton";
import ToggleSwitch from "../../../components/ui/ToggleSwitch/ToggleSwitch";

const ITEMS_PER_PAGE = 10;

const QuotationList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const company = useAppSelector((state) => state.company.data);
    const [data, setData] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailOrder, setEmailOrder] = useState<SalesOrder | null>(null);
    const [recipientEmail, setRecipientEmail] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [emailMessage, setEmailMessage] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);

    const [showWhatsappModal, setShowWhatsappModal] = useState(false);
    const [whatsappOrder, setWhatsappOrder] = useState<SalesOrder | null>(null);
    const [recipientPhone, setRecipientPhone] = useState("");
    const [whatsappMessage, setWhatsappMessage] = useState("");
    const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

    const [downloading, setDownloading] = useState<number | null>(null);

    const [showApproveModal, setShowApproveModal] = useState(false);
    const [itemToApprove, setItemToApprove] = useState<SalesOrder | null>(null);
    const [approvingId, setApprovingId] = useState<number | null>(null);

    const fetchOrders = useCallback(async () => {
        if (!can("sales-orders.view")) return;
        setLoading(true);
        try {
            const response = await salesOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                status: [
                    'QUOTATION_IN_PROGRESS',
                    'QUOTATION_COMPLETED',
                    'PENDING_MD_APPROVAL',
                    'MD_APPROVED',
                    'MD_REJECTED',
                    'PENDING_CUSTOMER_APPROVAL',
                    'CUSTOMER_APPROVED',
                    'CUSTOMER_REJECTED',
                ] as SalesOrderStatus[],
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
            toast.success("Quotation deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchOrders();
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete quotation");
        }
    };

    const handleOpenEmailModal = async (item: SalesOrder) => {
        try {
            setSendingEmail(true);
            const fullItem = await salesOrderService.fetchById(item.id);
            setEmailOrder(fullItem);
            setRecipientEmail((fullItem.customer as any)?.email || "");
            setEmailSubject(`Quotation for Order ${fullItem.orderNo}`);
            setEmailMessage(`Dear ${fullItem.customer?.displayName || fullItem.customer?.firmName || "Customer"},\n\nPlease find the attached quotation for your reference.\n\nBest regards,\n${company?.companyName || "Sunsea"}`);
            setShowEmailModal(true);
        } catch (error: any) {
            toast.error("Failed to load quotation details");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleSendEmail = async () => {
        if (!emailOrder || !recipientEmail) {
            toast.error("Recipient email is required.");
            return;
        }
        setSendingEmail(true);
        try {
            await salesOrderService.emailQuotation(
                emailOrder.id,
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

    const handleApproveConfirm = async () => {
        if (!itemToApprove) return;
        setApprovingId(itemToApprove.id);
        try {
            await salesOrderService.approveMd(itemToApprove.id, { decision: 'APPROVED', approverId: '' });
            toast.success("Quotation approved by MD!");
            setShowApproveModal(false);
            setItemToApprove(null);
            fetchOrders();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to approve");
        } finally {
            setApprovingId(null);
        }
    };

    const handleDownload = async (item: SalesOrder) => {
        setDownloading(item.id);
        try {
            await salesOrderService.downloadQuotation(item.id, item.orderNo);
            toast.success("PDF downloaded!");
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || "Failed to download PDF");
        } finally {
            setDownloading(null);
        }
    };

    const handleOpenWhatsappModal = async (item: SalesOrder) => {
        try {
            setSendingWhatsapp(true);
            const fullItem = await salesOrderService.fetchById(item.id);
            setWhatsappOrder(fullItem);
            setRecipientPhone(fullItem.mobile || "");
            setWhatsappMessage(`Dear ${fullItem.customer?.displayName || fullItem.customer?.firmName || "Customer"},\n\nPlease find the attached quotation for your reference.\n\nBest regards,\n${company?.companyName || "Sunsea"}`);
            setShowWhatsappModal(true);
        } catch (error: any) {
            toast.error("Failed to load quotation details");
        } finally {
            setSendingWhatsapp(false);
        }
    };

    const handleSendWhatsapp = async () => {
        if (!whatsappOrder || !recipientPhone) {
            toast.error("Recipient phone is required.");
            return;
        }
        setSendingWhatsapp(true);
        try {
            const formattedPhone = recipientPhone.replace(/^\+/, "");
            await salesOrderService.whatsappQuotation(
                whatsappOrder.id,
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


    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatCurrency = (amount: number) =>
        `₹${(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    // Open the full details page (same as the Sales Order list) instead of a popup
    const handleOpenView = useCallback((item: SalesOrder) => {
        navigate(`/sales-order/details/${item.id}`);
    }, [navigate]);

    const handleOpenEdit = useCallback(
        (item: SalesOrder) => {
            navigate(`/quatation-order/edit/${item.id}`, { state: item });
        },
        [navigate]
    );

    return (
        <div>
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
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
                        {can("quotations.create") && (
                            <CustomButton
                                text="Create Quotation"
                                onClick={() => navigate('/quatation-order/create')}
                                className="!bg-blue-600 !text-white hover:!bg-blue-700"
                            />
                        )}
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={data}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No orders pending for quotation."
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
                        { header: "NET AMOUNT", render: (item) => formatCurrency(item.netAmount) },
                        { header: "STATUS", render: (item) => <StatusBadge status={item.status || "PENDING"} /> },
                        {
                            header: "ACTIONS",
                            render: (item) => (
                                <div className="flex items-center gap-2">
                                    <ViewButton onClick={() => handleOpenView(item)} />
                                    {item.status !== 'MD_APPROVED' && (
                                        <EditButton onClick={() => handleOpenEdit(item)} />
                                    )}
                                    <IconButton
                                        icon={Download}
                                        variant="primary"
                                        title="Download PDF"
                                        disabled={downloading === item.id}
                                        onClick={() => handleDownload(item)}
                                    />
                                    <EmailButton onClick={() => handleOpenEmailModal(item)} />
                                    <WhatsappButton onClick={() => handleOpenWhatsappModal(item)} />
                                    {item.status !== 'MD_APPROVED' && (
                                        <DeleteButton onClick={() => { setItemToDelete(item.id); setShowDeleteModal(true); }} />
                                    )}

                                    {(item.status === 'MD_APPROVED' || item.status === 'CUSTOMER_APPROVED') && (
                                        <button
                                            type="button"
                                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                                            onClick={() => navigate('/sales-invoices/create', { state: { preselectedOrderId: String(item.id) } })}
                                        >
                                            Create Invoice
                                        </button>
                                    )}
                                    {item.status === 'PENDING_MD_APPROVAL' && (
                                        <ToggleSwitch
                                            checked={false}
                                            title="Approve for MD"
                                            onChange={() => { setItemToApprove(item); setShowApproveModal(true); }}
                                        />
                                    )}
                                </div>
                            ),
                        },
                    ]}
                />

                {/* Delete Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete Quotation"
                    message="Are you sure you want to delete this quotation?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>



            <CommonConfirmModal
                show={showEmailModal}
                onHide={() => setShowEmailModal(false)}
                onConfirm={handleSendEmail}
                title="Send Email"
                message={`Are you sure you want to send the quotation to ${recipientEmail}?`}
                warningText="This will generate a PDF and send it to the customer."
                confirmText="Send Email"
                loadingText="Sending..."
                confirmIcon={Mail}
                confirmVariant="primary"
                isLoading={sendingEmail}
            />

            <CommonConfirmModal
                show={showApproveModal}
                onHide={() => { setShowApproveModal(false); setItemToApprove(null); }}
                onConfirm={handleApproveConfirm}
                title="Approve Quotation"
                message={`Are you sure you want to MD-approve quotation ${itemToApprove?.orderNo}?`}
                confirmText="Approve"
                loadingText="Approving..."
                confirmVariant="primary"
                isLoading={approvingId !== null}
            />

            <CommonConfirmModal
                show={showWhatsappModal}
                onHide={() => setShowWhatsappModal(false)}
                onConfirm={handleSendWhatsapp}
                title="Send WhatsApp"
                message={
                    <div className="text-left mt-2 flex flex-col gap-3">
                        <p className="text-sm text-ink-subtle mb-2">Are you sure you want to send the quotation via WhatsApp?</p>
                        <div>
                            <label className="block text-sm font-medium text-ink-muted mb-1">Phone Number (with country code, e.g. 919876543210)</label>
                            {(() => {
                                const phones = [];
                                if (whatsappOrder?.customer) {
                                    if (Array.isArray(whatsappOrder.customer.mobile)) {
                                        whatsappOrder.customer.mobile.forEach((m: any) => {
                                            if (m.number || m.value) phones.push({ label: m.label || "Mobile", number: m.number || m.value });
                                        });
                                    } else if (typeof whatsappOrder.customer.mobile === "string" && whatsappOrder.customer.mobile) {
                                        phones.push({ label: "Mobile", number: whatsappOrder.customer.mobile });
                                    }
                                    if (typeof (whatsappOrder.customer as any).altPhone === "string" && (whatsappOrder.customer as any).altPhone) {
                                        phones.push({ label: "Alternative", number: (whatsappOrder.customer as any).altPhone });
                                    }
                                }
                                if (whatsappOrder?.mobile && !phones.find(p => p.number === whatsappOrder.mobile)) {
                                    phones.push({ label: "Order Number", number: whatsappOrder.mobile });
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
                confirmIcon={MessageCircle}
                confirmVariant="primary"
                isLoading={sendingWhatsapp}
            />

        </div>
    );
};

export default QuotationList;
