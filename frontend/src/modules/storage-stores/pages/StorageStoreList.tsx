import React, { useState, useCallback, useEffect } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchStores, deleteStore } from "../../../features/stores/storeSlice";
import type { Store } from "../../../features/stores/types";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DataTable from "../../../components/ui/table/DataTable";

const ITEMS_PER_PAGE = 10;

const StorageStoreList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const { data, loading, error, totalPages } = useAppSelector(state => state.stores);
    useEffect(() => { if (error) toast.error(error); }, [error]);
    const [storeType, setStoreType] = useState("");
    const storeTypeOptions = [
        { label: "All Store Types", value: "" },
        { label: "Raw Material Store", value: "1" },
        { label: "Finished Goods Store", value: "2" },
        { label: "Scrap Store", value: "3" },
    ];
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Store | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            dispatch(
                fetchStores({
                    search: searchTerm,
                    storeTypeId: storeType,
                    page: currentPage,
                    limit: ITEMS_PER_PAGE,
                    sortBy: "storeId",
                    sortOrder: "asc",
                })
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [dispatch, searchTerm, storeType, currentPage]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = data;

    const handleOpenView = useCallback((item: Store) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = () => {
        navigate("/storage-stores/create");
    };

    const handleOpenEdit = useCallback((item: Store) => {
        navigate(`/storage-stores/edit/${item.storeId}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await dispatch(deleteStore(itemToDelete)).unwrap();
                toast.success("Store deleted successfully!");
            } catch (err: any) {
                const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to delete store";
                toast.error(errorMessage);
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    if (error) {
        toast.error(error);
    }

    return (
        <div>
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Storage Store Management</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="w-48">
                                <SelectInput
                                    label="Store Type"
                                    hideLabel={true}
                                    name="storeType"
                                    value={storeType}
                                    options={storeTypeOptions}
                                    onChange={(e) => {
                                        setStoreType(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search stores..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <CustomButton
                                text="Add Store"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="p-0">
                        <DataTable
                            data={paginatedData}
                            rowKey={(item) => item.storeId}
                            emptyMessage="No stores found."
                            loading={loading}
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
                                { header: "CODE", accessor: "storeId" },
                                { header: "STORE NAME", accessor: "storeName" },
                                { header: "LOCATION", render: (item) => (item as any).location?.locationName ?? "N/A" },
                                { header: "STORE TYPE", render: (item) => item.storeTypeRef?.name || "N/A" },
                                { header: "INCHARGE", render: (item) => item.incharge?.fullName || "N/A" },
                                { header: "GST PLACE", render: (item) => item.gstPlace || (item as any).location?.state || "N/A" },
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
                                            <DeleteButton onClick={() => triggerDelete(item.storeId)} />
                                        </div>
                                    ),
                                    align: "left"
                                },
                            ]}
                        />
                    </div>
                </div>

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Store Details"
                    avatarText={selectedItem ? selectedItem.storeName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.storeName : ""}
                    headerSubtitle={selectedItem ? `Code: ${selectedItem.storeId}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Store Code", value: selectedItem.storeId },
                                { label: "Store Name", value: selectedItem.storeName },
                                { label: "Location", value: selectedItem.locationId || "N/A" },
                                { label: "Store Type", value: selectedItem.storeTypeRef?.name || "N/A" },
                            ]
                        },
                        {
                            title: "Additional Details",
                            fields: [
                                { label: "Incharge", value: selectedItem.incharge?.fullName || "N/A" },
                                { label: "Costing Method", value: selectedItem.costMethod || "N/A" },
                                { label: "GST Place", value: selectedItem.gstPlace || "N/A" },
                                { label: "Allow Negative", value: selectedItem.allowNegative ? "Yes" : "No" },
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

                {/* Delete Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this store?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default StorageStoreList;
