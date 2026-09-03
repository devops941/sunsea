import React, { useState, useCallback, useEffect, useMemo } from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { grnInvoiceService } from "../../../../services/grnInvoiceService";
import CustomButton from "../../../../components/ui/Button/Button";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import DeleteButton from "../../../../components/ui/DeleteButton/DeleteButton";
import EditButton from "../../../../components/ui/EditButton/EditButton";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";
import { useListCache } from "../../../../hooks/useListCache";


const ITEMS_PER_PAGE = 15;

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const calculatePendingAmount = (item: any) => {
    const status = (item.paymentStatus || "").toUpperCase();
    if (status === "CLOSED" || status === "PAID") return 0;
    const net = Number(item.netAmount || 0);
    const rawPayments = Array.isArray(item.payments)
        ? item.payments
        : (typeof item.payments === "string" ? JSON.parse(item.payments || "[]") : []);
    const paid = rawPayments.reduce((sum: number, p: any) => sum + Number(p?.amount || 0), 0);
    const pending = net - paid;
    return pending > 0 ? pending : 0;
};

const InvoiceList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const fetchInvoicesForExport = useCallback(async () => {
        const response = await grnInvoiceService.fetchAll({ page: 1, pageSize: 100000 });
        const list = response?.data || (Array.isArray(response) ? response : []);
        return Array.isArray(list) ? list : [];
    }, []);

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const response = await grnInvoiceService.fetchAll({ pageSize: 10000 });
        const list = response?.data || (Array.isArray(response) ? response : []);
        return { data: list, total: response?.total || list.length };
    }, []);

    const { data: allInvoices, loading, refresh } = useListCache<any>({
        cacheKey: "grnInvoices:list",
        socketModule: "grnInvoice",
        fetcher,
    });

    const filteredData = useMemo(() => {
        if (!searchTerm) return allInvoices;
        const term = searchTerm.toLowerCase();
        return allInvoices.filter((item: any) =>
            item.grnNumber?.toLowerCase().includes(term) ||
            item.invoiceNo?.toLowerCase().includes(term) ||
            item.supplier?.legalName?.toLowerCase().includes(term)
        );
    }, [allInvoices, searchTerm]);

    const data = filteredData.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleDeleteClick = (id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;

        try {
            await grnInvoiceService.delete(itemToDelete);
            toast.success("Invoice deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            refresh();
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete invoice");
        }
    };

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

    // CSV Export Configuration
    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "GRN No", accessor: (item: any) => item.grnNumber || "" },
            { header: "Invoice No", accessor: (item: any) => item.invoiceNo || "" },
            { header: "GRN Date", accessor: (item: any) => formatDate(item.grnDate) },
            { header: "Supplier", accessor: (item: any) => item.supplier?.displayName || item.supplier?.legalName || "" },
            { header: "Net Amount", accessor: (item: any) => Number(item.netAmount || 0).toFixed(2) },
            { header: "Payment Status", accessor: (item: any) => item.paymentStatus || "—" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Bill_Invoice_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    return (
        <div>
            <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Bill & Invoice List</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search invoices..."
                        />
                        {can("invoice.export") && (
                            <ExportCSVButton
                                fetchData={fetchInvoicesForExport}
                                columns={csvColumns}
                                filename={csvFilename}
                                text="Export"
                            />
                        )}
                        {can("invoice.create") && (
                            <CustomButton
                                text="Create Invoice"
                                icon={FaPlus}
                                onClick={() => navigate("/invoice/create")}
                            />
                        )}
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={data}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No invoices found."
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
                        { header: "GRN NO", accessor: "grnNumber" },
                        { header: "INVOICE NO", accessor: "invoiceNo" },
                        { header: "GRN DATE", render: (item) => formatDate(item.grnDate) },
                        {
                            header: "SUPPLIER",
                            render: (item) => item.supplier?.displayName || item.supplier?.legalName || "N/A",
                        },
                        {
                            header: "NET AMOUNT",
                            render: (item) => (
                                <span className="font-semibold text-green-600">
                                    {formatMoney(item.netAmount)}
                                </span>
                            ),
                        },
                        {
                            header: "ACTIONS",
                            width: "160px",
                            render: (item) => {
                                return (
                                    <div className="flex items-center gap-2">
                                        <ViewButton onClick={() => navigate(`/invoice/details/${item.id}`)} />
                                        <EditButton onClick={() => navigate(`/invoice/edit/${item.id}`)} />
                                        <DeleteButton onClick={() => handleDeleteClick(item.id)} />
                                    </div>
                                );
                            },
                        },
                    ]}
                />
            </div>

            {/* Delete Modal */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm delete"
                message="Are you sure you want to delete this GRN Invoice?"
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default InvoiceList;