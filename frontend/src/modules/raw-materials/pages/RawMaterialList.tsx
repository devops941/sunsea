import React, { useState, useMemo, useCallback, useEffect } from "react";
import { FaPlus } from "react-icons/fa";
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
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import { formatStockQty, parseBaseUom } from "../../../utils/uomConversion";

const ITEMS_PER_PAGE = 10;




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
                    <div className="font-semibold text-ink">{item.materialName}</div>
                    <span className="text-xs text-ink-subtle">ID: {item.rawMaterialId}</span>
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
                    <span className="text-xs text-ink-subtle">Min: {formatStockQty(item.minimumStock, item.baseUom)}</span>
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
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Raw Materials Management</h2>
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
                        <div className="w-full md:w-64">
                            <SearchInput
                                value={searchTerm}
                                onChange={handleSearch}
                                placeholder="Search materials..."
                            />
                        </div>
                       
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
                            { label: "Rate (₹)", value: selectedItem.rate !== null && selectedItem.rate !== undefined ? String(selectedItem.rate) : (selectedItem.unitPrice !== null && selectedItem.unitPrice !== undefined ? String(selectedItem.unitPrice) : "N/A") },
                            { label: "Store", value: selectedItem.store?.storeName || selectedItem.storeId || "N/A" },
                            { label: "Physical Stock", value: formatStockQty(selectedItem.onHandQty, selectedItem.baseUom) },
                            { label: "Reserved Stock", value: formatStockQty(selectedItem.reservedQty, selectedItem.baseUom) },
                            { label: "Available Stock", value: formatStockQty(Number(selectedItem.onHandQty ?? 0) - Number(selectedItem.reservedQty ?? 0), selectedItem.baseUom) },
                            { label: "Narration", value: selectedItem.narration || selectedItem.remarks || "N/A" },
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
