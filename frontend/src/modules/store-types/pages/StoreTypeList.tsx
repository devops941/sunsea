import React, { useState, useCallback, useEffect } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchStoreTypes, deleteStoreType } from "../../../features/store-types/storeTypeSlice";
import type { StoreType } from "../../../features/store-types/types";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DataTable from "../../../components/ui/table/DataTable";

const ITEMS_PER_PAGE = 10;

const StoreTypeList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const {
        data,
        loading,
        error,
        totalPages,
    } = useAppSelector(state => state.storeTypes);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<StoreType | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            dispatch(
                fetchStoreTypes({
                    search: searchTerm,
                    page: currentPage,
                    sortBy: "code",
                    sortOrder: "asc",
                })
            );
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [dispatch, searchTerm, currentPage]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenView = useCallback((item: StoreType) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = () => {
        navigate("/store-types/create");
    };

    const handleOpenEdit = useCallback((item: StoreType) => {
        navigate(`/store-types/edit/${item.id}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await dispatch(deleteStoreType(itemToDelete)).unwrap();
                toast.success("Store Type deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete store type");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Store Type Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search types..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <CustomButton
                                text="Add Type"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    {loading && data.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <DataTable
                            data={data}
                            rowKey={(item) => item.id}
                            emptyMessage="No store types found."
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
                                { header: "CODE", accessor: "code" },
                                { header: "NAME", accessor: "name" },
                                { header: "DESCRIPTION", render: (item) => item.description || "N/A" },
                                {
                                    header: "STATUS", render: (item) => (
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${item.isActive
                                                ? "bg-green-100 text-green-700 border border-green-200"
                                                : "bg-red-100 text-red-700 border border-red-200"
                                            }`}>
                                            {item.isActive ? "ACTIVE" : "INACTIVE"}
                                        </span>
                                    )
                                },
                                {
                                    header: "ACTIONS",
                                    render: (item) => (
                                        <div className="flex items-center gap-2">
                                            <ViewButton onClick={() => handleOpenView(item)} />
                                            <EditButton onClick={() => handleOpenEdit(item)} />
                                            <DeleteButton onClick={() => triggerDelete(item.id)} />
                                        </div>
                                    ),
                                    align: "right"
                                },
                            ]}
                        />
                    )}
                </div>

                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Store Type Details"
                    avatarText={selectedItem ? selectedItem.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.name : ""}
                    headerSubtitle={selectedItem ? `Code: ${selectedItem.code}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Code", value: selectedItem.code },
                                { label: "Name", value: selectedItem.name },
                                { label: "Description", value: selectedItem.description || "N/A", xs: 12 },
                            ]
                        },
                        {
                            title: "Status",
                            fields: [
                                { label: "Status", value: selectedItem.isActive ? "Active" : "Inactive" },
                            ]
                        }
                    ] : []}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this store type?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default StoreTypeList;
