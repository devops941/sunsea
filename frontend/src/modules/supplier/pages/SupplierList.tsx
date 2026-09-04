import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { FaSearch, FaPlus } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import PricingButton from "../../../components/ui/PricingButton/PricingButton";
import SupplierViewModal from "../components/SupplierViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { supplierService } from "../../../services/supplierService";
import { usePermission } from "../../../hooks/usePermission";
import DataTable from "../../../components/ui/table/DataTable";
import { useListCache } from "../../../hooks/useListCache";

const ITEMS_PER_PAGE = 15;
const SupplierList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const canEditSupplier = can("suppliers.edit");
    const canDeleteSupplier = can("suppliers.delete");
    const canViewPricing = can("supplierpricelist.view");
    const canCreateSupplier = can("suppliers.create");
    const canExportSupplier = can("suppliers.export");

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";

    const [searchTerm, setSearchTerm] = useState(initialSearch);

    // Custom confirm delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchSuppliersForExport = useCallback(async () => {
        const res = await supplierService.fetchAll({ page: 1, limit: 100000 });
        const list = res?.suppliers || (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        return Array.isArray(list) ? list : [];
    }, []);

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const res = await supplierService.fetchAll({ limit: 10000 });
        const list = res?.suppliers || (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        return { data: list, total: list.length };
    }, []);

    const { data: allSuppliers, loading, refresh } = useListCache<any>({
        cacheKey: "suppliers:list",
        socketModule: "supplier",
        fetcher,
    });

    usePageShortcuts({ onRefresh: () => refresh(), onDelete: () => setShowDeleteModal(true) });

    const suppliers = useMemo(() => {
        if (!searchTerm) return allSuppliers;
        const term = searchTerm.toLowerCase();
        return allSuppliers.filter((s: any) =>
            s.supplierCode?.toLowerCase().includes(term) ||
            s.legalName?.toLowerCase().includes(term) ||
            s.displayName?.toLowerCase().includes(term)
        );
    }, [allSuppliers, searchTerm]);

    const totalPages = Math.ceil(suppliers.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedSuppliers = suppliers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenView = useCallback((sup: any) => {
        setSelectedSupplier(sup);
        setShowViewModal(true);
    }, []);

    const handleEdit = useCallback((sup: any) => {
        navigate(`/suppliers/edit/${sup.id}`, {
            state: sup,
        });
    }, [navigate]);

    const handleViewPricing = useCallback((sup: any) => {
        navigate(`/suppliers/${sup.id}/material-prices`);
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setSupplierToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (supplierToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await supplierService.delete(supplierToDelete);
                toast.success("Supplier deleted successfully!");
                refresh();
            } catch (err: any) {
                toast.error(err?.response?.data?.message || err.message || err || "Failed to delete supplier");
            } finally {
                setShowDeleteModal(false);
                setSupplierToDelete(null);
                setIsDeleting(false);
            }
        }
    };

    // CSV Export Configuration
    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Supplier Code", accessor: (item: any) => item.supplierCode || "" },
            { header: "Name", accessor: (item: any) => item.legalName || item.displayName || "" },
            { header: "Mobile", accessor: (item: any) => Array.isArray(item.mobile) && item.mobile.length > 0 ? item.mobile[0].number : (typeof item.mobile === "string" ? item.mobile : "") },
            { header: "Email", accessor: (item: any) => item.email || "" },
            { header: "GSTIN", accessor: (item: any) => item.gstin || "" },
            { header: "Opening Balance", accessor: (item: any) => Number(item.openingBalance || 0).toFixed(2) },
            { header: "Balance Type", accessor: (item: any) => item.openingBalanceType || "CREDIT" },
            { header: "Status", accessor: (item: any) => item.status || "" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Supplier_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    return (
        <div >
            <div className="">
                <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                        <div>
                            <h2 className="text-2xl font-bold text-ink">Supplier Master</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                                <input
                                    type="text"
                                    data-search-input
                                    className="w-full pl-10 pr-4 py-2 bg-card border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search Supplier..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            {canExportSupplier && (
                                <ExportCSVButton
                                    fetchData={fetchSuppliersForExport}
                                    columns={csvColumns}
                                    filename={csvFilename}
                                    text="Export"
                                />
                            )}
                            {/* BUG-SUP-009 fix: only show Add Supplier button to users with create permission */}
                            {canCreateSupplier && (
                                <CustomButton
                                    text="Add Supplier"
                                    icon={FaPlus}
                                    onClick={() => navigate("/suppliers/create")}
                                />
                            )}
                        </div>
                    </div>

                    {/* View Table */}
                    <div className="p-0">
                        <DataTable
                            data={paginatedSuppliers}
                            rowKey={(supplier) => supplier.id}
                            loading={loading}
                            emptyMessage="No suppliers found."
                            pagination={
                                totalPages > 1
                                    ? {
                                        currentPage,
                                        totalPages,
                                        onPageChange: setCurrentPage,
                                    }
                                    : undefined
                            }
                            columns={[
                                { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
                                // { header: "CODE", accessor: "supplierCode" },
                                { header: "NAME", accessor: "legalName" },
                                { header: "MOBILE", render: (supplier) => Array.isArray(supplier.mobile) && supplier.mobile.length > 0 ? supplier.mobile[0].number : (typeof supplier.mobile === "string" ? supplier.mobile : "N/A") },
                                { header: "EMAIL", render: (supplier) => supplier.email || "N/A" },
                                { header: "GSTIN", render: (supplier) => supplier.gstin || "-" },
                                {
                                    header: "BALANCE",
                                    align: "right",
                                    render: (supplier) => {
                                        const bal = Number(supplier.openingBalance || 0);
                                        const type = supplier.openingBalanceType || "CREDIT";
                                        const suffix = type === "CREDIT" ? "Cr" : "Dr";
                                        const color = bal > 0 ? (type === "CREDIT" ? "text-orange-500" : "text-emerald-500") : "text-ink-subtle";
                                        return (
                                            <span className={`font-mono ${color}`}>
                                                ₹{bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {bal > 0 ? suffix : ""}
                                            </span>
                                        );
                                    }
                                },

                                // { header: "ON TIME", render: (supplier) => supplier.onTimePct !== null ? `${supplier.onTimePct} %` : "N/A" },
                                {
                                    header: "STATUS", render: (supplier) => (
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${supplier.status === "Active"
                                            ? "bg-green-100 text-green-700 border border-green-200"
                                            : "bg-red-100 text-red-700 border border-red-200"
                                            }`}>
                                            {supplier.status}
                                        </span>
                                    ), align: "center"
                                },
                                {
                                    header: "ACTIONS",
                                    render: (supplier) => (
                                        <div className="flex items-center gap-2">
                                            <ViewButton onClick={() => handleOpenView(supplier)} />
                                            {/* BUG-SUP-009 fix: only show Edit / Delete actions to authorized users */}
                                            {canEditSupplier && <EditButton onClick={() => handleEdit(supplier)} />}
                                            {canDeleteSupplier && <DeleteButton onClick={() => triggerDelete(String(supplier.id))} />}
                                        </div>
                                    ),
                                    align: "center"
                                },
                            ]}
                        />
                    </div>
                </div>

                <SupplierViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    supplier={selectedSupplier}
                />

                {/* Custom Delete Confirm Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this supplier?"
                    confirmText={isDeleting ? "Deleting..." : "Delete"}
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default SupplierList;