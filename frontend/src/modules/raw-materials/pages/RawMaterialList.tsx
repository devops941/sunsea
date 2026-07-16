import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchRawMaterials, deleteRawMaterial } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchStores } from "../../../features/stores/storeSlice";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { Form } from "react-bootstrap";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

const ITEMS_PER_PAGE = 10;

const RawMaterialList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const { data, loading, error } = useAppSelector((state) => state.rawMaterials);
    const { data: stores } = useAppSelector((state) => state.stores);

    const [searchTerm, setSearchTerm] = useState("");
    const [storeFilter, setStoreFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const handleOpenView = useCallback((item: any) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    useEffect(() => {
        dispatch(fetchStores(undefined));
    }, [dispatch]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            dispatch(fetchRawMaterials(searchTerm));
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, dispatch]);

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
        { header: "PHYSICAL STOCK", accessor: (item: any) => `${item.onHandQty ?? 0} ${(item.baseUom || "").split(',')[0]}` },
        { header: "MIN STOCK", accessor: (item: any) => `${item.minimumStock ?? 0} ${(item.baseUom || "").split(',')[0]}` },
        { header: "RESERVED", accessor: (item: any) => `${item.reservedQty ?? 0} ${(item.baseUom || "").split(',')[0]}` },
        { header: "AVAILABLE", accessor: (item: any) => `${Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0)} ${(item.baseUom || "").split(',')[0]}` },
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

    useEffect(() => {
        console.log("Raw Materials:", data);
    }, [data]);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await dispatch(deleteRawMaterial(itemToDelete)).unwrap();
                toast.success("Raw material deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete raw material");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    return (
        
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Raw Materials Management</h2>
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
                                <CustomButton
                                    text="Add Material"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                    </div>

                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "60px" }}>#</th>
                                    <th>NAME</th>
                                    <th>CATEGORY</th>
                                    <th>STORE / LOCATION</th>
                                    <th>PHYSICAL STOCK</th>
                                    <th>RESERVED</th>
                                    <th>AVAILABLE</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">
                                            <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-8 w-8"></div>
                                        </td>
                                    </tr>
                                ) : paginatedData.length > 0 ? (
                                    paginatedData.map((item, index) => (
                                        <tr key={item.rawMaterialId} className="master-data-row">
                                            <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                            <td className="master-data-cell">
                                                <div style={{ fontWeight: 600 }}>{item.materialName}</div>
                                                <span className="text-muted" style={{ fontSize: "0.82rem" }}>
                                                    ID: {item.rawMaterialId}
                                                </span>
                                            </td>
                                            <td className="master-data-cell">{item.category?.name || item.categoryId || "-"}</td>
                                            <td className="master-data-cell">
                                                <div>{item.store?.storeName || item.storeId || "-"}</div>
                                                <span className="text-muted" style={{ fontSize: "0.82rem" }}>
                                                    Loc: {item.storeLocation?.locationCode || (item.store as any)?.location?.locationCode || (item.store as any)?.location?.locationName || (item.store as any)?.locationDesc || item.locationId || "-"}
                                                </span>
                                            </td>
                                            <td className="master-data-cell">
                                                <div>{item.onHandQty ?? 0} {item.baseUom?.split(',')[0]}</div>
                                                <span className="text-muted" style={{ fontSize: "0.82rem" }}>
                                                    Min: {item.minimumStock ?? 0} {item.baseUom?.split(',')[0]}
                                                </span>
                                            </td>
                                            <td className="master-data-cell">
                                                {item.reservedQty ?? 0} {item.baseUom?.split(',')[0]}
                                            </td>
                                            <td className="master-data-cell" style={{ fontWeight: 600 }}>
                                                {(() => {
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
                                                        <span style={{ color }}>
                                                            {available} {item.baseUom?.split(',')[0]}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item)} />
                                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                                    <DeleteButton onClick={() => triggerDelete(item.rawMaterialId)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">No raw materials found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className="pagination-wrap">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
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
                                { label: "Base UOM", value: selectedItem.baseUom?.split(',')[0] },
                                { label: "Reorder Level", value: selectedItem.reorderLevel !== null && selectedItem.reorderLevel !== undefined ? `${selectedItem.reorderLevel} ${selectedItem.baseUom?.split(',')[0]}` : "N/A" },
                                { label: "Minimum Stock", value: selectedItem.minimumStock !== null && selectedItem.minimumStock !== undefined ? `${selectedItem.minimumStock} ${selectedItem.baseUom?.split(',')[0]}` : "N/A" },
                                { label: "Lead Time (Days)", value: selectedItem.leadTimeDays !== null && selectedItem.leadTimeDays !== undefined ? String(selectedItem.leadTimeDays) : "N/A" },
                                { label: "Unit Price (₹)", value: selectedItem.unitPrice !== null && selectedItem.unitPrice !== undefined ? String(selectedItem.unitPrice) : "N/A" },
                                { label: "Average Cost (₹)", value: selectedItem.avgCost !== null && selectedItem.avgCost !== undefined ? String(selectedItem.avgCost) : "N/A" },
                                { label: "Store", value: selectedItem.store?.storeName || selectedItem.storeId || "N/A" },
                                { label: "Store Location", value: selectedItem.storeLocation?.locationCode || (selectedItem.store as any)?.location?.locationCode || (selectedItem.store as any)?.location?.locationName || (selectedItem.store as any)?.locationDesc || selectedItem.locationId || "N/A" },
                                { label: "Batch No", value: selectedItem.batchNo || "N/A" },
                                { label: "Physical Stock", value: `${selectedItem.onHandQty ?? 0} ${selectedItem.baseUom?.split(',')[0]}` },
                                { label: "Reserved Stock", value: `${selectedItem.reservedQty ?? 0} ${selectedItem.baseUom?.split(',')[0]}` },
                                { label: "Available Stock", value: `${Number(selectedItem.onHandQty ?? 0) - Number(selectedItem.reservedQty ?? 0)} ${selectedItem.baseUom?.split(',')[0]}` },
                                { label: "Status", value: selectedItem.isActive ? "Active" : "Inactive" },
                                { label: "Created Date", value: selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : "-" },
                                { label: "Updated Date", value: selectedItem.updatedAt ? new Date(selectedItem.updatedAt).toLocaleString() : "-" },
                            ]
                        }
                    ] : []}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this raw material?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
            </div>
        </div>
    );
};

export default RawMaterialList;
