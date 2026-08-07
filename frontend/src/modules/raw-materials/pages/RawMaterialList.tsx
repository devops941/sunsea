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
import SelectInput from "../../../components/form/SelectInput/SelectInput";

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

const RawMaterialList: React.FC = () => {
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

    useEffect(() => {
        if (can("raw_materials.view")) {
            dispatch(fetchStores({ storeCategory: "RAW_MATERIAL" }));
        }
    }, [dispatch, can]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (can("raw_materials.view")) {
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
            if (item.itemType === "WASTAGE") return false;
            
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
        { header: "STORE", accessor: (item: any) => item.store?.storeName || item.storeId || "-" },
        { header: "LOCATION", accessor: (item: any) => item.storeLocation?.locationCode || item.store?.location?.locationCode || item.store?.location?.locationName || item.store?.locationDesc || item.locationId || "-" },
        { header: "PHYSICAL STOCK", accessor: (item: any) => formatStockQty(item.onHandQty, item.baseUom) },
        { header: "MIN STOCK", accessor: (item: any) => formatStockQty(item.minimumStock, item.baseUom) },
        { header: "RESERVED", accessor: (item: any) => formatStockQty(item.reservedQty, item.baseUom) },
        { header: "AVAILABLE", accessor: (item: any) => formatStockQty(Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0), item.baseUom) },
        { header: "STATUS", accessor: (item: any) => item.isActive ? "Active" : "Inactive" },
    ];

    const handleOpenAdd = () => {
        navigate("/raw-materials/create");
    };

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/raw-materials/edit/${item.rawMaterialId}`, { state: item });
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
                toast.success("Raw material deleted successfully!");
            } catch (err: any) {
                const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to delete raw material";
                toast.error(errorMessage);
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
                    <div>{formatStockQty(item.onHandQty, item.baseUom)}</div>
                    <span className="text-xs text-gray-400">Min: {formatStockQty(item.minimumStock, item.baseUom)}</span>
                </div>
            ),
        },
        {
            header: "RESERVED",
            render: (item) => formatStockQty(item.reservedQty, item.baseUom),
        },
        {
            header: "AVAILABLE",
            render: (item) => {
                const available = Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0);
                const minStock = Number(item.minimumStock ?? 0);
                const reorder = Number(item.reorderLevel ?? 0);
                let color = "#2b8a3e";
                if (available <= minStock) {
                    color = "#dc3545";
                } else if (available <= reorder) {
                    color = "#d97706";
                }
                return (
                    <span style={{ color, fontWeight: 600 }}>
                        {formatStockQty(available, item.baseUom)}
                    </span>
                );
            },
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
                    <ViewButton onClick={() => handleOpenView(item)} />
                    {can("raw_materials.edit") && <EditButton onClick={() => handleOpenEdit(item)} />}
                    {can("raw_materials.delete") && <DeleteButton onClick={() => triggerDelete(item.rawMaterialId)} />}
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
                        <h2 className="text-2xl font-bold text-slate-800">Raw Materials Management</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="w-48">
                            <SelectInput
                                value={storeFilter}
                                onChange={handleStoreFilterChange}
                                defaultOptionLabel="All Stores"
                                hideLabel
                                noMargin
                                options={stores?.map((store: any) => ({
                                    label: store.storeName,
                                    value: store.storeId,
                                })) || []}
                            />
                        </div>
                        <div className="relative w-full md:w-64">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Search materials..."
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                        </div>
                        <ExportCSVButton
                            data={data || []}
                            columns={exportColumns}
                            filename="raw_materials_list.csv"
                        />
                        {can("raw_materials.create") && (
                            <CustomButton
                                text="Add Material"
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
                    emptyMessage="No raw materials found."
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
                modalTitle="Raw Material Details"
                avatarText={selectedItem ? selectedItem.materialName.charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? selectedItem.materialName : ""}
                sections={selectedItem ? [
                    {
                        fields: [
                            { label: "Material ID", value: selectedItem.rawMaterialId },
                            { label: "Material Name", value: selectedItem.materialName },
                            { label: "Category", value: selectedItem.category?.name || "N/A" },
                            { label: "HSN Code", value: selectedItem.hsnCode || "N/A" },
                            { label: "Primary UOM", value: parseBaseUom(selectedItem.baseUom).primary },
                            { label: "Secondary UOM(s)", value: parseBaseUom(selectedItem.baseUom).secondary },
                            { label: "Reorder Level", value: selectedItem.reorderLevel !== null && selectedItem.reorderLevel !== undefined ? formatStockQty(selectedItem.reorderLevel, selectedItem.baseUom) : "N/A" },
                            { label: "Minimum Stock", value: selectedItem.minimumStock !== null && selectedItem.minimumStock !== undefined ? formatStockQty(selectedItem.minimumStock, selectedItem.baseUom) : "N/A" },
                            { label: "Lead Time (Days)", value: selectedItem.leadTimeDays !== null && selectedItem.leadTimeDays !== undefined ? String(selectedItem.leadTimeDays) : "N/A" },
                            { label: "Unit Price (₹)", value: selectedItem.unitPrice !== null && selectedItem.unitPrice !== undefined ? String(selectedItem.unitPrice) : "N/A" },
                            { label: "Average Cost (₹)", value: selectedItem.avgCost !== null && selectedItem.avgCost !== undefined ? String(selectedItem.avgCost) : "N/A" },
                            { label: "Store", value: selectedItem.store?.storeName || selectedItem.storeId || "N/A" },
                            { label: "Physical Stock", value: formatStockQty(selectedItem.onHandQty, selectedItem.baseUom) },
                            { label: "Reserved Stock", value: formatStockQty(selectedItem.reservedQty, selectedItem.baseUom) },
                            { label: "Available Stock", value: formatStockQty(Number(selectedItem.onHandQty ?? 0) - Number(selectedItem.reservedQty ?? 0), selectedItem.baseUom) },
                            { label: "Status", value: selectedItem.isActive ? "Active" : "Inactive" },
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
                message="Are you sure you want to delete this raw material?"
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                isDangerous={true}
                isLoading={isDeleting}
            />
        </div>
    );
};

export default RawMaterialList;
