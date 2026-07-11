import React, { useState, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchRawMaterialStocks } from "../../../features/raw-materials/rawMaterialStockSlice";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { storeService } from "../../../services/storeService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { rawMaterialService } from "../../../services/rawMaterialService";

const ITEMS_PER_PAGE = 10;

const StockList: React.FC = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const { data, loading, error } = useAppSelector((state) => state.rawMaterialStocks);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [storeId, setStoreId] = useState("");
    const [stores, setStores] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [showView, setShowView] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const handleDeleteClick = (rawMaterialId: string) => {
        setItemToDelete(rawMaterialId);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await rawMaterialService.delete(itemToDelete);
            toast.success("Raw material deleted successfully.");
            dispatch(fetchRawMaterialStocks({ search: debouncedSearch, storeId }));
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || "Cannot delete raw material. It might be in use.");
        } finally {
            setShowDeleteModal(false);
            setItemToDelete(null);
        }
    };

    // Fetch stores for dropdown
    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await storeService.fetchAll();
                setStores(res?.stores || res || []);
            } catch (err) {
                console.error(err);
            }
        };
        fetchStores();
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch stocks based on search and storeId
    useEffect(() => {
        dispatch(fetchRawMaterialStocks({ search: debouncedSearch, storeId }));
    }, [dispatch, debouncedSearch, storeId]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const totalPages = Math.ceil((data?.length || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = (data || []).slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const formatExportQty = (qty: any, uom: string) => {
        const num = Number(qty) || 0;
        const primaryUom = uom ? uom.split(',')[0] : "";
        return `${num} ${primaryUom}`;
    };

    const formatDisplayQty = (qty: any, uom: string, prefix = "") => {
        const num = Number(qty) || 0;
        const primaryUom = uom ? uom.split(',')[0] : "";
        return (
            <>
                {prefix}{num} {primaryUom}
            </>
        );
    };

    const exportColumns = [
        { header: "NAME", accessor: (item: any) => (item as any).materialName || item.rawMaterial?.materialName || "-" },
        { header: "ID", accessor: (item: any) => item.rawMaterialId || "-" },
        { header: "CATEGORY", accessor: (item: any) => (item as any).category?.categoryName || item.rawMaterial?.category?.name || (item as any).categoryId || "-" },
        { header: "STORE", accessor: (item: any) => item.store?.storeName || item.storeId || "-" },
        { header: "LOCATION", accessor: (item: any) => (item as any).storeLocation?.locationCode || item.locationId || "-" },
        { header: "PHYSICAL STOCK", accessor: (item: any) => formatExportQty(item.onHandQty ?? 0, (item as any).baseUom || item.rawMaterial?.baseUom || "") },
        { header: "MIN STOCK", accessor: (item: any) => formatExportQty(Number((item as any).minimumStock || item.rawMaterial?.minimumStock || 0), (item as any).baseUom || item.rawMaterial?.baseUom || "") },
        { header: "RESERVED", accessor: (item: any) => formatExportQty(item.reservedQty ?? 0, (item as any).baseUom || item.rawMaterial?.baseUom || "") },
        { header: "AVAILABLE", accessor: (item: any) => formatExportQty(Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0), (item as any).baseUom || item.rawMaterial?.baseUom || "") },
        { header: "STATUS", accessor: (item: any) => item.status || "Active" },
    ];

    return (
        <div className="inner-container stock-list">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={4} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Stock Ledger Management</h2>
                                <div className="page-breadcrumb">Home / Inventory & Warehouse / Stock Ledger</div>
                            </div>
                        </Col>
                        <Col lg={8} md={12}>
                            <div className="page-header-actions">
                               
                                {/* <div className="page-search-wrap me-2" style={{ minWidth: "200px" }}>
                                    <SelectInput
                                        label="Select Store"
                                        hideLabel
                                        name="storeFilter"
                                        value={storeId}
                                        options={[
                                            { label: "All Stores", value: "" },
                                            ...stores.map(s => ({
                                                label: s.storeName,
                                                value: s.storeId
                                            }))
                                        ]}
                                        onChange={(e) => {
                                            setStoreId(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                    />
                                </div> */}
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search stock..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                
                                <div className="me-2">
                                    <ExportCSVButton
                                        data={data || []}
                                        columns={exportColumns}
                                        filename="stock_ledger_balances.csv"
                                    />
                                </div>
                                 <div className="me-2">
                                    <CustomButton
                                        text="Add Raw Material"
                                        icon={FaPlus}
                                        onClick={() => navigate("/raw-materials/create")}
                                    />
                                </div>
                                
                            </div>
                        </Col>
                    </Row>
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
                                            <Spinner animation="border" variant="primary" />
                                        </td>
                                    </tr>
                                ) : paginatedData.length > 0 ? (
                                    paginatedData.map((item, index) => {
                                        const matName = (item as any).materialName || item.rawMaterial?.materialName || "-";
                                        const baseUom = (item as any).baseUom || item.rawMaterial?.baseUom || "";
                                        const minStock = Number((item as any).minimumStock || item.rawMaterial?.minimumStock || 0);
                                        const reorderLevel = Number((item as any).reorderLevel || item.rawMaterial?.reorderLevel || 0);
                                        const catName = (item as any).category?.categoryName || item.rawMaterial?.category?.name || (item as any).categoryId || "-";
                                        const locCode = (item as any).storeLocation?.locationCode || item.locationId || "-";

                                        const available = Number(item.onHandQty ?? 0) - Number(item.reservedQty ?? 0);

                                        let availColor = "#2b8a3e";
                                        if (available <= minStock) {
                                            availColor = "#dc3545";
                                        } else if (available <= reorderLevel) {
                                            availColor = "#d97706";
                                        }

                                        return (
                                            <tr key={item.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">
                                                    <div style={{ fontWeight: 600 }}>{matName}</div>
                                                    <span className="text-muted" style={{ fontSize: "0.82rem" }}>
                                                        ID: {item.rawMaterialId}
                                                    </span>
                                                </td>
                                                <td className="master-data-cell">{catName}</td>
                                                <td className="master-data-cell">
                                                    <div>{item.store?.storeName || item.storeId || "-"}</div>
                                                    <span className="text-muted" style={{ fontSize: "0.82rem" }}>
                                                        Loc: {locCode}
                                                    </span>
                                                </td>

                                                <td className="master-data-cell">
                                                    <div>{formatDisplayQty(item.onHandQty, baseUom)}</div>
                                                    <div className="text-muted" style={{ fontSize: "0.82rem" }}>
                                                        {formatDisplayQty(minStock, baseUom, "Min: ")}
                                                    </div>
                                                </td>
                                                <td className="master-data-cell">
                                                    {formatDisplayQty(item.reservedQty, baseUom)}
                                                </td>
                                                <td className="master-data-cell" style={{ fontWeight: 600 }}>
                                                    <span style={{ color: availColor }}>
                                                        {formatDisplayQty(available, baseUom)}
                                                    </span>
                                                </td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={item.status || "Active"} />
                                                </td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton
                                                            onClick={() => {
                                                                setSelectedItem(item);
                                                                setShowView(true);
                                                            }}
                                                        />
                                                        <EditButton onClick={() => navigate(`/raw-materials/edit/${item.rawMaterialId}`)} />
                                                        <DeleteButton onClick={() => handleDeleteClick(item.rawMaterialId)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">No stock records found.</td>
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

            </Container>

            <CommonViewModal
                show={showView}
                onHide={() => setShowView(false)}
                modalTitle="Stock Details"
                avatarText={selectedItem ? ((selectedItem as any).materialName || selectedItem.rawMaterial?.materialName || "S").charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? ((selectedItem as any).materialName || selectedItem.rawMaterial?.materialName || selectedItem.rawMaterialId) : ""}
                sections={selectedItem ? [
                    {
                        fields: [
                            { label: "Material ID", value: selectedItem.rawMaterialId },
                            { label: "Material Name", value: (selectedItem as any).materialName || selectedItem.rawMaterial?.materialName || "N/A" },
                            { label: "Category", value: (selectedItem as any).category?.categoryName || selectedItem.rawMaterial?.category?.name || "N/A" },
                            { label: "Base UOM", value: (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "N/A" },
                            { label: "Reorder Level", value: ((selectedItem as any).reorderLevel || selectedItem.rawMaterial?.reorderLevel) != null ? `${(selectedItem as any).reorderLevel || selectedItem.rawMaterial?.reorderLevel} ${(selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || ""}` : "N/A" },
                            { label: "Minimum Stock", value: ((selectedItem as any).minimumStock || selectedItem.rawMaterial?.minimumStock) != null ? formatExportQty((selectedItem as any).minimumStock || selectedItem.rawMaterial?.minimumStock, (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "") : "N/A" },
                            { label: "Store", value: selectedItem.store?.storeName || selectedItem.storeId || "N/A" },
                            { label: "Store Location", value: (selectedItem as any).storeLocation?.locationCode || selectedItem.locationId || "N/A" },
                            { label: "Batch No", value: selectedItem.batchNo || "N/A" },
                            { label: "Physical Stock", value: formatExportQty(selectedItem.onHandQty ?? 0, (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "") },
                            { label: "Reserved Stock", value: formatExportQty(selectedItem.reservedQty ?? 0, (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "") },
                            { label: "Available Stock", value: formatExportQty(Number(selectedItem.onHandQty ?? 0) - Number(selectedItem.reservedQty ?? 0), (selectedItem as any).baseUom || selectedItem.rawMaterial?.baseUom || "") },
                            { label: "Average Cost (₹)", value: selectedItem.avgCost != null ? String(selectedItem.avgCost) : "N/A" },
                            { label: "Status", value: selectedItem.status || "Active" },
                            { label: "Last Movement", value: selectedItem.lastMovementAt ? new Date(selectedItem.lastMovementAt).toLocaleString() : "-" }
                        ]
                    }
                ] : []}
            />

            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Delete Raw Material"
                bodyText="Are you sure you want to delete this Raw Material? This action cannot be undone."
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default StockList;
