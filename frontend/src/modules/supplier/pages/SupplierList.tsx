import React, { useState, useEffect, useCallback } from "react";
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
import { useSuppliers } from "../../../hooks/useSuppliers";
import { supplierService } from "../../../services/supplierService";
import { hasPermission } from "../../../utils/permission";
import DataTable from "../../../components/ui/table/DataTable";
import { useSocketSync } from "../../../hooks/useSocketSync";

const ITEMS_PER_PAGE = 10;
const SupplierList: React.FC = () => {
    const navigate = useNavigate();
    const { suppliers, loading, error, total, loadSuppliers, removeSupplier } = useSuppliers();

    const canEditSupplier = hasPermission("supplier.edit");
    const canDeleteSupplier = hasPermission("supplier.delete");
    const canViewPricing = hasPermission("supplierpricelist.view");
    // BUG-SUP-009 fix: added missing create permission check
    const canCreateSupplier = hasPermission("supplier.create");

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

    const fetchSuppliersData = useCallback(() => {
        loadSuppliers({ search: searchTerm, page: currentPage, limit: ITEMS_PER_PAGE });
    }, [searchTerm, currentPage, loadSuppliers]);

    useSocketSync("supplier", undefined, fetchSuppliersData);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSuppliersData();
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchSuppliersData]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

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
                await removeSupplier(supplierToDelete);
                toast.success("Supplier deleted successfully!");
                fetchSuppliersData();
            } catch (err: any) {
                toast.error(err?.response?.data?.message || err.message || err || "Failed to delete supplier");
            } finally {
                setShowDeleteModal(false);
                setSupplierToDelete(null);
                setIsDeleting(false);
            }
        }
    };

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    return (
        <div >
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Supplier Master</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search Supplier..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
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
                            data={suppliers}
                            rowKey={(supplier) => supplier.id}
                            loading={loading}
                            emptyMessage="No suppliers found."
                            pagination={
                                total > 1
                                    ? {
                                        currentPage,
                                        totalPages: total,
                                        onPageChange: setCurrentPage,
                                    }
                                    : undefined
                            }
                            columns={[
                                { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
                                { header: "CODE", accessor: "supplierCode" },
                                { header: "NAME", accessor: "legalName" },
                                { header: "MOBILE", render: (supplier) => Array.isArray(supplier.mobile) && supplier.mobile.length > 0 ? supplier.mobile[0].number : (typeof supplier.mobile === "string" ? supplier.mobile : "N/A") },
                                { header: "PAYMENT", accessor: "paymentTerms" },
                                { header: "LEAD TIME", render: (supplier) => supplier.leadTimeDays !== null ? `${supplier.leadTimeDays} days` : "N/A" },
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