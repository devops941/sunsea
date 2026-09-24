import { formatDate } from "../../../../utils/dateUtils";
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { FaPlus, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../../hooks/useTableKeyboardNav";

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
import { usePermission } from "../../../../hooks/usePermission";


const ITEMS_PER_PAGE = 15;
type SortOrder = "default" | "asc" | "desc";
const SORT_STORAGE_KEY = "sunsea_grn_invoice_sort";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};



/** Compute display total: DB netAmount + sundry from remarks/billSundry */
const getInvoiceDisplayTotal = (inv: any): number => {
    const dbNet = Number(inv.netAmount ?? 0);
    let sundryData: any[] = [];
    if (inv.billSundry) {
        sundryData = typeof inv.billSundry === "string" ? (() => { try { return JSON.parse(inv.billSundry); } catch { return []; } })() : inv.billSundry;
    }
    if ((!Array.isArray(sundryData) || sundryData.length === 0) && inv.remarks) {
        try {
            const parsed = JSON.parse(inv.remarks);
            if (Array.isArray(parsed?.__billSundry__)) sundryData = parsed.__billSundry__;
        } catch { /* plain text */ }
    }
    if (!Array.isArray(sundryData) || sundryData.length === 0) return dbNet;
    const sundryTotal = sundryData.reduce((sum: number, r: any) => {
        const amt = Number(r.amount) || 0;
        const t = (r.type || "").toUpperCase();
        const isNeg = t.includes("DISCOUNT") || t.includes("MINUS");
        return sum + (isNeg ? -amt : amt);
    }, 0);
    return dbNet + sundryTotal;
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

    const tableRef = useRef<HTMLDivElement>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
        try {
            const saved = localStorage.getItem(SORT_STORAGE_KEY);
            if (saved === "asc" || saved === "desc") return saved as SortOrder;
        } catch (_) {}
        return "default";
    });

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prev) => {
            const next: SortOrder = prev === "default" ? "asc" : prev === "asc" ? "desc" : "default";
            try { localStorage.setItem(SORT_STORAGE_KEY, next); } catch (_) {}
            return next;
        });
        setCurrentPage(1);
    }, []);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const cacheKey = `grnInvoices:list:${sortOrder}`;

    const fetchInvoicesForExport = useCallback(async () => {
        const response = await grnInvoiceService.fetchAll({
            page: 1,
            pageSize: 100000,
            sortBy: (sortOrder === "asc" || sortOrder === "desc") ? "supplier" : undefined,
            sortOrder: (sortOrder === "asc" || sortOrder === "desc") ? sortOrder : undefined,
        });
        const list = response?.data || (Array.isArray(response) ? response : []);
        return Array.isArray(list) ? list : [];
    }, [sortOrder]);

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const response = await grnInvoiceService.fetchAll({
            pageSize: 10000,
            sortBy: (sortOrder === "asc" || sortOrder === "desc") ? "supplier" : undefined,
            sortOrder: (sortOrder === "asc" || sortOrder === "desc") ? sortOrder : undefined,
        });
        const list = response?.data || (Array.isArray(response) ? response : []);
        return { data: list, total: response?.total || list.length };
    }, [sortOrder]);

    const { data: allInvoices, loading, refresh } = useListCache<any>({
        cacheKey,
        socketModule: "grnInvoice",
        fetcher,
    });

    usePageShortcuts({
        onRefresh: () => refresh(),
        onSort: () => toggleSortOrder(),
        onDelete: () => setShowDeleteModal(true),
        onNew: () => { if (can("invoice.create")) navigate("/invoice/create"); },
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

    const sortedData = filteredData;

    const data = sortedData.slice(
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

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

    // CSV Export Configuration
    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "GRN No", accessor: (item: any) => item.grnNumber || "" },
            { header: "Invoice No", accessor: (item: any) => item.invoiceNo || "" },
            { header: "GRN Date", accessor: (item: any) => formatDate(item.grnDate) },
            { header: "Supplier", accessor: (item: any) => item.supplier?.displayName || item.supplier?.legalName || "" },
            { header: "Net Amount", accessor: (item: any) => getInvoiceDisplayTotal(item).toFixed(2) },
            { header: "Payment Status", accessor: (item: any) => item.paymentStatus || "—" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Bill_Invoice_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: data.length,
        onEnter: (i) => navigate(`/invoice/details/${data[i].id}`),
        onEdit: (i) => navigate(`/invoice/edit/${data[i].id}`),
        containerRef: tableRef,
    });

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
                            data-search-input
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
                <div ref={tableRef} tabIndex={0} data-table-nav className="outline-none">
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
                    rowClassName={(_, i) => i === focusedIndex ? "bg-primary/8" : ""}
                    onRowClick={(row, i) => { setFocusedIndex(i); tableRef.current?.focus({ preventScroll: true }); }}
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
                            headerNode: (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleSortOrder(); }}
                                    title={`Sort by Supplier: ${sortOrder === "default" ? "Default" : sortOrder === "asc" ? "A → Z" : "Z → A"} (F6)`}
                                    className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-[1.5px] outline-none hover:opacity-90 transition-opacity"
                                >
                                    <span className={sortOrder !== "default" ? "text-primary font-black" : "group-hover/sort:text-ink transition-colors"}>
                                        SUPPLIER
                                    </span>
                                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded transition-all duration-200 ${sortOrder === "asc" || sortOrder === "desc" ? "bg-primary/20 text-primary scale-110" : "text-ink-subtle/60 group-hover/sort:text-ink group-hover/sort:bg-card-2"}`}>
                                        {sortOrder === "asc" ? <FaArrowUp size={10} /> : sortOrder === "desc" ? <FaArrowDown size={10} /> : <FaSort size={10} />}
                                    </span>
                                    {sortOrder !== "default" && (
                                        <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-primary text-white tracking-tighter shadow-xs">
                                            {sortOrder === "asc" ? "A-Z" : "Z-A"}
                                        </span>
                                    )}
                                </button>
                            ),
                            render: (item) => item.supplier?.displayName || item.supplier?.legalName || "N/A",
                        },
                        {
                            header: "NET AMOUNT",
                            render: (item) => (
                                <span className="font-semibold text-green-600">
                                    {formatMoney(getInvoiceDisplayTotal(item))}
                                </span>
                            ),
                        },
                        {
                            header: "ACTIONS",
                            width: "160px",
                            render: (item) => {
                                return (
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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