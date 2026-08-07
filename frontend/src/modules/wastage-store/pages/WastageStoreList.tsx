import React, { useState, useMemo, useCallback, useEffect } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchRawMaterials, deleteRawMaterial, rawMaterialCreated, rawMaterialUpdated, rawMaterialDeleted } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import type { RawMaterial } from "../../../features/raw-materials/types";
import { usePermission } from "../../../hooks/usePermission";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";

const ITEMS_PER_PAGE = 10;

const formatStockQty = (qty: number | string | null | undefined, uomStr?: string): string => {
    const num = Number(qty ?? 0);
    if (isNaN(num)) return `0 kg`;
    if (!uomStr) return `${num} kg`;

    const firstCode = uomStr.split(',')[0].trim().toLowerCase();

    // Mass conversion to primary unit kg (e.g., 200 g -> 0.2 kg)
    if (firstCode === 'g' || firstCode === 'gram' || firstCode === 'grams' || firstCode === 'gm') {
        const kgVal = num / 1000;
        return `${Number(kgVal.toFixed(3))} kg`;
    }
    if (firstCode === 't' || firstCode === 'ton' || firstCode === 'tons') {
        return `${Number((num * 1000).toFixed(3))} kg`;
    }
    if (firstCode === 'kg' || firstCode === 'kilogram' || firstCode === 'kilo' || firstCode === 'kgs') {
        return `${Number(num.toFixed(3))} kg`;
    }

    // Volume conversion to L
    if (firstCode === 'ml') {
        const lVal = num / 1000;
        return `${Number(lVal.toFixed(3))} L`;
    }
    if (firstCode === 'l' || firstCode === 'ltr' || firstCode === 'litre' || firstCode === 'litres') {
        return `${Number(num.toFixed(3))} L`;
    }

    // Count
    if (firstCode === 'ea' || firstCode === 'each' || firstCode === 'pcs') {
        return `${num} pcs`;
    }
    if (firstCode === 'dz' || firstCode === 'dozen') {
        return `${num * 12} pcs`;
    }

    return `${num} ${firstCode}`;
};

const parseBaseUom = (uomStr?: string) => {
    if (!uomStr) return { primary: "N/A", secondary: "None", list: [] };
    const list = uomStr.split(',').map(u => u.trim()).filter(Boolean);
    if (list.length === 0) return { primary: "N/A", secondary: "None", list: [] };
    const primary = list[0];
    const secondaryList = list.slice(1);
    const secondary = secondaryList.length > 0 ? secondaryList.join(', ') : "None";
    return { primary, secondary, list };
};

const formatUOM = (uomStr?: string) => {
    if (!uomStr) return "";
    const firstCode = uomStr.split(',')[0].trim();
    if (!firstCode) return "";
    const lower = firstCode.toLowerCase();
    if (lower === 'ea' || lower === 'each') return 'pcs';
    if (lower === 'g' || lower === 'gram' || lower === 'grams' || lower === 'gm') return 'kg';
    if (lower === 'kg' || lower === 'kilogram' || lower === 'kilo' || lower === 'kgs') return 'kg';
    if (lower === 't' || lower === 'ton' || lower === 'tons') return 'kg';
    if (lower === 'l' || lower === 'ltr' || lower === 'litre' || lower === 'litres') return 'L';
    if (lower === 'ml') return 'L';
    if (lower === 'm' || lower === 'mtr' || lower === 'meter') return 'm';
    if (lower === 'cm') return 'cm';
    if (lower === 'dz' || lower === 'dozen') return 'dz';
    return firstCode;
};

const WastageStoreList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const { data, loading, error } = useAppSelector((state) => state.rawMaterials);
    const { data: stores } = useAppSelector((state) => state.stores);
    const { can } = usePermission();

    const [searchTerm, setSearchTerm] = useState("");
    const [storeFilter, setStoreFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const handleOpenView = useCallback((item: any) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    useSocketSync<RawMaterial>("rawMaterial", {
        created: rawMaterialCreated,
        updated: rawMaterialUpdated,
        deleted: rawMaterialDeleted,
    });

    const fetchWastageStoresData = useCallback(() => {
        if (can("wastage-store.view")) {
            dispatch(fetchStores({ storeCategory: "WASTAGE" }));
        }
    }, [can, dispatch]);

    useSocketSync("store", undefined, fetchWastageStoresData);

    useEffect(() => {
        fetchWastageStoresData();
    }, [fetchWastageStoresData]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (can("wastage-store.view")) {
                dispatch(fetchRawMaterials(searchTerm));
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, dispatch, can]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleStoreFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setStoreFilter(e.target.value);
        setCurrentPage(1);
    };

    const filteredData = useMemo(() => {
        return data.filter(item => {
            // Filter only WASTAGE items
            if (item.itemType !== "WASTAGE") return false;
            
            const matchesStore = storeFilter ? item.storeId === storeFilter : true;
            return matchesStore;
        });
    }, [data, storeFilter]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const exportColumns = [
        { header: "NAME", accessor: (item: any) => item.materialName || "-" },
        { header: "ID", accessor: (item: any) => item.rawMaterialId || "-" },
        { header: "CATEGORY", accessor: (item: any) => item.category?.name || item.categoryId || "-" },
        { header: "PRIMARY UOM", accessor: (item: any) => parseBaseUom(item.baseUom).primary },
        { header: "SECONDARY UOM(S)", accessor: (item: any) => parseBaseUom(item.baseUom).secondary },
        { header: "STORE", accessor: (item: any) => item.store?.storeName || item.storeId || "-" },
        { header: "PHYSICAL STOCK", accessor: (item: any) => formatStockQty(item.onHandQty, item.baseUom) },
        { header: "REMARKS", accessor: (item: any) => item.remarks || "-" },
        { header: "STATUS", accessor: (item: any) => item.isActive ? "Active" : "Inactive" },
    ];

    const handleOpenAdd = () => {
        navigate("/wastage-store/create");
    };

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/wastage-store/edit/${item.rawMaterialId}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            setIsDeleting(true);
            try {
                await dispatch(deleteRawMaterial(itemToDelete)).unwrap();
                toast.success("Wastage product deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete wastage product");
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const columns: DataTableColumn<any>[] = [
        {
            header: "#",
            width: "60px",
            align: "center",
            render: (_, index) => startIndex + index + 1,
        },
        {
            header: "NAME",
            render: (item) => (
                <div>
                    <div className="font-semibold text-gray-800">{item.materialName}</div>
                    <span className="text-xs text-gray-400">ID: {item.rawMaterialId}</span>
                </div>
            ),
        },
        {
            header: "CATEGORY",
            render: (item) => item.category?.name || item.categoryId || "-",
        },
        {
            header: "STORE",
            render: (item) => (
                <div>
                    <div>{item.store?.storeName || item.storeId || "-"}</div>
                </div>
            ),
        },
        {
            header: "PHYSICAL STOCK",
            render: (item) => (
                <div>
                    <div className="font-semibold text-gray-800">{formatStockQty(item.onHandQty, item.baseUom)}</div>
                </div>
            ),
        },
        {
            header: "STATUS",
            align: "center",
            render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />,
        },
        {
            header: "ACTIONS",
            align: "left",
            render: (item) => (
                <div className="flex items-center gap-2">
                    {(can("wastage-store.view") || can("production-wastages.view")) && (
                        <ViewButton onClick={() => handleOpenView(item)} />
                    )}
                    {(can("wastage-store.edit") || can("production-wastages.edit")) && <EditButton onClick={() => handleOpenEdit(item)} />}
                    {(can("wastage-store.delete") || can("production-wastages.delete")) && <DeleteButton onClick={() => triggerDelete(item.rawMaterialId)} />}
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Wastage Products Management</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="page-filter-wrap">
                            <select
                                value={storeFilter}
                                onChange={handleStoreFilterChange}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                style={{ minWidth: "120px" }}
                            >
                                <option value="">All Stores</option>
                                {stores?.map((store: any) => (
                                    <option key={store.storeId} value={store.storeId}>
                                        {store.storeName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="relative w-full md:w-64">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                        </div>
                        <ExportCSVButton
                            data={filteredData || []}
                            columns={exportColumns}
                            filename="wastage_products_list.csv"
                        />
                        {(can("wastage-store.create") || can("production-wastages.create")) && (
                            <CustomButton
                                text="Add Product"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        )}
                    </div>
                </div>

                {/* Data Table */}
                <DataTable
                    columns={columns}
                    data={paginatedData}
                    rowKey={(row) => row.rawMaterialId}
                    loading={loading}
                    emptyMessage="No wastage products found."
                    pagination={totalPages > 1 ? {
                        currentPage,
                        totalPages,
                        onPageChange: setCurrentPage,
                    } : undefined}
                />
            </div>

            <CommonViewModal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
                modalTitle="Wastage Product Details"
                avatarText={selectedItem ? selectedItem.materialName.charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? selectedItem.materialName : ""}
                sections={selectedItem ? [
                    {
                        fields: [
                            { label: "Wastage ID", value: selectedItem.rawMaterialId },
                            { label: "Material Name", value: selectedItem.materialName },
                            { label: "Category", value: selectedItem.category?.name || "N/A" },
                            { label: "Primary UOM", value: parseBaseUom(selectedItem.baseUom).primary },
                            { label: "Secondary UOM(s)", value: parseBaseUom(selectedItem.baseUom).secondary },
                            { label: "Store", value: selectedItem.store?.storeName || selectedItem.storeId || "N/A" },
                            { label: "Physical Stock", value: formatStockQty(selectedItem.onHandQty, selectedItem.baseUom) },
                            { label: "Status", value: selectedItem.isActive ? "Active" : "Inactive" },
                            { label: "Remarks", value: selectedItem.remarks || "N/A" },
                            { label: "Created Date", value: selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : "-" },
                            { label: "Updated Date", value: selectedItem.updatedAt ? new Date(selectedItem.updatedAt).toLocaleString() : "-" },
                        ]
                    }
                ] : []}
            />

            <CommonConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message="Are you sure you want to delete this wastage product?"
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                isDangerous={true}
                isLoading={isDeleting}
            />
        </div>
    );
};

export default WastageStoreList;
