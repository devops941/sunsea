import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppSelector } from "../../../hooks/reduxHooks";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesOrderService, type SalesOrder, type SalesOrderStatus } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useSocketSync } from "../../../hooks/useSocketSync";
import EmailButton from "../../../components/ui/EmailButton/EmailButton";
import { Mail } from "lucide-react";
import EditButton from "../../../components/ui/EditButton/EditButton";

const ITEMS_PER_PAGE = 10;

const QuotationList: React.FC = () => {
    const navigate = useNavigate();
    const company = useAppSelector((state) => state.company.data);
    const [data, setData] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<SalesOrder | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailOrder, setEmailOrder] = useState<SalesOrder | null>(null);
    const [recipientEmail, setRecipientEmail] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [emailMessage, setEmailMessage] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);

    // ─── Fetch only CONFIRMED and MD_REJECTED orders ────────────────────────────
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await salesOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                status: ['CONFIRMED', 'MD_REJECTED'] as SalesOrderStatus[],
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
    }, [currentPage, searchTerm]);

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
            toast.success("Sales order deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchOrders();
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete order");
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


    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatCurrency = (amount: number) =>
        `₹${(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    const handleOpenView = useCallback((item: SalesOrder) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenEdit = useCallback(
        (item: SalesOrder) => {
            navigate(`/quatation-order/edit/${item.id}`, { state: item });
        },
        [navigate]
    );

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Quotation List</h2>
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
                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                    <EmailButton onClick={() => handleOpenEmailModal(item)} />
                                    {/* <DeleteButton onClick={() => triggerDelete(item.id)} /> */}
                                </div>
                            ),
                        },
                    ]}
                />

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Sales order details"
                    avatarText={selectedItem ? selectedItem.orderNo.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.orderNo : ""}
                    headerSubtitle={
                        selectedItem
                            ? `Customer: ${selectedItem.customer?.displayName || selectedItem.customer?.firmName || "N/A"}`
                            : ""
                    }
                    sections={
                        selectedItem
                            ? [
                                {
                                    fields: [
                                        { label: "Order No", value: selectedItem.orderNo },
                                        { label: "Order Date", value: formatDate(selectedItem.orderDate) },
                                        {
                                            label: "Customer",
                                            value:
                                                selectedItem.customer?.displayName ||
                                                selectedItem.customer?.firmName ||
                                                "N/A",
                                        },
                                        { label: "Mobile Number", value: selectedItem.mobile || "N/A" },
                                        ...(selectedItem.transportName ? [{ label: "Transport", value: selectedItem.transportName }] : []),
                                    ],
                                },
                                {
                                    title: "Address details",
                                    fields: [
                                        {
                                            label: "Billing address",
                                            value: selectedItem.billingAddressLine1
                                                ? [
                                                    selectedItem.billingAddressLine1,
                                                    selectedItem.billingCity,
                                                    selectedItem.billingState,
                                                    selectedItem.billingPincode,
                                                ]
                                                    .filter(Boolean)
                                                    .join(", ")
                                                : "N/A",
                                        },
                                        {
                                            label: "Shipping address",
                                            value: selectedItem.shippingAddressLine1
                                                ? [
                                                    selectedItem.shippingAddressLine1,
                                                    selectedItem.shippingCity,
                                                    selectedItem.shippingState,
                                                    selectedItem.shippingPincode,
                                                ]
                                                    .filter(Boolean)
                                                    .join(", ")
                                                : "Same as billing",
                                        },
                                    ],
                                },
                                {
                                    title: "Order summary",
                                    fields: [
                                        { label: "Total items", value: String(selectedItem.items?.length ?? 0) },
                                        { label: "Subtotal", value: formatCurrency(selectedItem.subtotal) },
                                        { label: "Total discount", value: formatCurrency(selectedItem.totalDiscount) },
                                        { label: "Net amount", value: formatCurrency(selectedItem.netAmount) },
                                        { label: "Status", value: selectedItem.status || "Draft" },
                                        { label: "Remarks", value: selectedItem.remarks || "N/A" },
                                        { label: "Internal notes", value: selectedItem.internalNotes || "N/A" },
                                    ],
                                },
                                {
                                    title: "Approval trail",
                                    fields: [
                                        { label: "MD approval", value: selectedItem.mdApprovalStatus },
                                        { label: "MD rejection reason", value: selectedItem.mdRejectionReason || "N/A" },
                                        { label: "Customer approval", value: selectedItem.customerApprovalStatus },
                                        {
                                            label: "Customer rejection reason",
                                            value: selectedItem.customerRejectionReason || "N/A",
                                        },
                                    ],
                                },
                                {
                                    title: "Timestamps",
                                    fields: [
                                        { label: "Created at", value: formatDate(selectedItem.createdAt) },
                                        { label: "Last updated", value: formatDate(selectedItem.updatedAt) },
                                    ],
                                },
                            ]
                            : []
                    }
                />

                {/* Delete Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm delete"
                    message="Are you sure you want to delete this sales order?"
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
        </div>
    );
};

export default QuotationList;
