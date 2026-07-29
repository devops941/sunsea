import React, { useState, useCallback, useEffect } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import CustomButton from "../../components/ui/Button/Button";
import StatusBadge from "../../components/ui/StatusBadge/Badge";
import EditButton from "../../components/ui/EditButton/EditButton";
import DataTable, { type DataTableColumn } from "../../components/ui/table/DataTable";
import GstTaxModal, { type GstTaxFormValues } from "./GstModal";
import type { GstTax } from "../../services/gstTaxService";
import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import { createGstTax, fetchGstTaxes, updateGstTax, deleteGstTax, gstTaxCreated, gstTaxUpdated, gstTaxDeleted } from "../../features/gst/gstSlice";
import { useSocketSync } from "../../hooks/useSocketSync";
import CommonConfirmModal from "../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DeleteButton from "../../components/ui/DeleteButton/DeleteButton";

const ITEMS_PER_PAGE = 10;

const GstTaxList: React.FC = () => {
    const dispatch = useAppDispatch();
    const { data, loading, totalPages } = useAppSelector((state) => state.gst);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    useSocketSync<GstTax>("gstTax", {
        created: gstTaxCreated,
        updated: gstTaxUpdated,
        deleted: gstTaxDeleted,
    });

    // ─── Modal state (Add / Edit) ──────────────────────────────
    const [showModal, setShowModal] = useState(false);
    const [editingTax, setEditingTax] = useState<GstTaxFormValues | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [taxToDelete, setTaxToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ─── Fetch list (debounced) ──────────────────────────────
    const loadGstTaxes = useCallback(() => {
        dispatch(
            fetchGstTaxes({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
            })
        );
    }, [dispatch, currentPage, searchTerm]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadGstTaxes();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadGstTaxes]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    // ─── Add / Edit handlers ──────────────────────────────
    const handleAddClick = () => {
        setEditingTax(null); // null => modal treats this as create mode
        setShowModal(true);
    };

    const handleEditClick = (tax: GstTax) => {
        const formValues: GstTaxFormValues = {
            id: tax.id,
            taxName: tax.taxName,
            taxType: tax.taxType,
            taxRate: String(tax.taxRate),
            status: tax.status,
        };
        setEditingTax(formValues);
        setShowModal(true);
    };

    const handleClose = () => {
        setShowModal(false);
        setEditingTax(null);
    };

    const handleSave = async (formData: GstTaxFormValues) => {
        try {
            const payload = {
                taxName: formData.taxName,
                taxType: formData.taxType,
                taxRate: Number(formData.taxRate),
                status: formData.status,
            };

            if (formData.id) {
                await dispatch(updateGstTax({ id: formData.id, data: payload })).unwrap();
                toast.success("GST tax rate updated successfully");
            } else {
                await dispatch(createGstTax(payload)).unwrap();
                toast.success("GST tax rate created successfully");
            }

            loadGstTaxes();
        } catch (err: any) {
            console.error(err);
            const errorMessage = typeof err === 'string' ? err : err?.message || err || "Failed to save GST tax rate";
            toast.error(errorMessage);
            throw err; // keeps modal open on failure — see GstTaxModal's submit handler
        }
    };

    const triggerDelete = (id: string) => {
        setTaxToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (taxToDelete && !isDeleting) {
            setIsDeleting(true);
            try {
                await dispatch(deleteGstTax(taxToDelete)).unwrap();
                toast.success("GST Tax deleted successfully!");
            } catch (err: any) {
                const errorMessage = typeof err === 'string' ? err : err?.message || err || "Failed to delete GST Tax";
                toast.error(errorMessage);
            } finally {
                setShowDeleteModal(false);
                setTaxToDelete(null);
                setIsDeleting(false);
            }
        }
    };

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        { header: "Tax Name", accessor: "taxName" },
        { header: "Rate (%)", accessor: "taxRate" },
        { header: "Status", render: (tax) => <StatusBadge status={tax.status} />, align: "center" },
        {
            header: "Actions",
            render: (tax) => (
                <div className="flex items-center gap-2">
                    <EditButton onClick={() => handleEditClick(tax)} />
                    {/* <DeleteButton onClick={() => triggerDelete(tax.id)} /> */}
                </div>
            ),
            align: "right"
        }
    ];

    return (
        <div>
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">GST Tax Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search tax name..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <CustomButton
                                text="Add GST"
                                icon={FaPlus}
                                onClick={handleAddClick}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="p-0">
                        <DataTable
                            columns={columns}
                            data={data}
                            rowKey={(row) => row.id}
                            loading={loading}
                            emptyMessage="No GST tax rates found."
                            pagination={totalPages > 1 ? {
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage
                            } : undefined}
                        />
                    </div>
                </div>
                {/* Add/Edit Modal */}
                <GstTaxModal
                    show={showModal}
                    onClose={handleClose}
                    onSave={handleSave}
                    initialData={editingTax}
                />

                {/* Delete Confirm Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this GST Tax Rate?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default GstTaxList;