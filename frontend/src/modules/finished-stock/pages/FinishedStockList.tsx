import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchFinishedGoodsStocks } from "../../../features/finished-goods-stock/finishedGoodsStockSlice";


import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";

const formatUom = (uomCode: string | undefined) => {
    if (!uomCode) return "PCS";
    const code = uomCode.trim().toUpperCase();
    if (code === "EA" || code === "EACH") return "PCS";
    return code;
};

const ITEMS_PER_PAGE = 10;

const FinishedStockList: React.FC = () => {
    const dispatch = useAppDispatch();
    const { data, loading, error } = useAppSelector((state) => state.finishedGoodsStocks);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const storeId = "";
    const [currentPage, setCurrentPage] = useState(1);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);



    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch stocks based on search and storeId
    useEffect(() => {
        dispatch(fetchFinishedGoodsStocks({ storeId, search: debouncedSearch }));
    }, [dispatch, storeId, debouncedSearch]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenView = useCallback((item: any) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    // Pagination logic
    const totalPages = Math.ceil((data?.length || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = (data || []).slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const exportColumns = [
        { header: "Store / Location", accessor: (item: any) => item.store?.storeName },
        { header: "Product Code", accessor: (item: any) => item.product?.productCode },
        { header: "Product Name", accessor: (item: any) => item.product?.productName },
        { header: "Category", accessor: (item: any) => item.product?.category?.categoryName || "N/A" },
        { header: "Color", accessor: (item: any) => item.product?.colors?.map((c: any) => c.color?.colorName).join(", ") || "N/A" },
        { header: "Size", accessor: (item: any) => item.product?.size?.sizeName || "N/A" },
        { header: "Physical Stock", accessor: (item: any) => `${item.onHandQty} ${formatUom(item.product?.uom?.uomCode)}` },
    ];

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Finished Goods Stock</h2>
                                <div className="page-breadcrumb">Home / Inventory & Warehouse / Finished Goods Stock</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions d-flex justify-content-end align-items-center gap-2">
                                
                                {/* <div style={{ minWidth: "200px" }}>
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
                                        filename="finished_goods_stock.csv"
                                    />
                                </div>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Table */}
                <div className="master-table-body table-wrap">
                    {loading ? (
                        <div className="d-flex justify-content-center align-items-center p-5">
                            <Spinner animation="border" variant="primary" />
                        </div>
                    ) : (
                        <div className="master-table-body">
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>PRODUCT CODE</th>
                                        <th>PRODUCT NAME</th>
                                        <th>CATEGORY</th>
                                        <th>COLOR</th>
                                        <th>SIZE</th>
                                        <th>STORE / LOCATION</th>
                                        <th>PHYSICAL STOCK</th>
                                        <th>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.length > 0 ? (
                                        paginatedData.map((item, index) => (
                                            <tr key={`${item.storeId}-${item.productItemId}`} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{item.product?.productCode || "N/A"}</td>
                                                <td className="master-data-cell fw-medium">{item.product?.productName || "N/A"}</td>
                                                <td className="master-data-cell">{item.product?.category?.categoryName || "N/A"}</td>
                                                <td className="master-data-cell">{item.product?.colors?.map((c: any) => c.color?.colorName).join(", ") || "N/A"}</td>
                                                <td className="master-data-cell">{item.product?.size?.sizeName ? `${item.product.size.sizeName} (${item.product.size.sizeCode})` : "N/A"}</td>
                                                <td className="master-data-cell">{item.store?.storeName || "N/A"}</td>
                                                <td className="master-data-cell fw-bold">
                                                    <StatusBadge 
                                                        status={(Number(item.onHandQty) || 0) < (Number(item.product?.minimumQty) || 0) || (Number(item.onHandQty) || 0) <= 0 ? "danger" : "success"} 
                                                        customText={`${item.onHandQty} ${formatUom(item.product?.uom?.uomCode)}`} 
                                                    />
                                                </td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(item)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="text-center p-4">No finished goods stock found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {totalPages > 1 && (
                                <div className="pagination-wrap">
                                    <button className="pagination-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                                        <FaChevronLeft />
                                    </button>
                                    <div className="pagination-info">Page {currentPage} of {totalPages}</div>
                                    <button className="pagination-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                                        <FaChevronRight />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Finished Goods Stock Details"
                    avatarText={selectedItem?.product?.productName ? selectedItem.product.productName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem?.product?.productName || "N/A"}
                    headerSubtitle={selectedItem?.product?.productCode ? `Code: ${selectedItem.product.productCode}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Product Code", value: selectedItem.product?.productCode || "N/A" },
                                { label: "Product Name", value: selectedItem.product?.productName || "N/A" },
                                { label: "Category", value: selectedItem.product?.category?.categoryName || "N/A" },
                                { label: "Color", value: selectedItem.product?.colors?.map((c: any) => c.color?.colorName).join(", ") || "N/A" },
                                { label: "Size", value: selectedItem.product?.size?.sizeName ? `${selectedItem.product.size.sizeName} (${selectedItem.product.size.sizeCode})` : "N/A" },
                                { label: "Store / Location", value: selectedItem.store?.storeName || "N/A" },
                            ]
                        },
                        {
                            title: "Stock Information",
                            fields: [
                                { label: "Physical Stock (On Hand)", value: `${selectedItem.onHandQty} ${formatUom(selectedItem.product?.uom?.uomCode)}` },
                                { label: "Weight Per Piece", value: selectedItem.product?.weightPerPiece != null ? `${selectedItem.product.weightPerPiece} kg` : "N/A" },
                                { label: "Dimensions (L×B×H)", value: selectedItem.product?.dimensions || "N/A" },
                                { label: "Last Updated", value: formatDate(selectedItem.updatedAt) },
                            ]
                        }
                    ] : []}
                />
            </Container>
        </div>
    );
};

export default FinishedStockList;
