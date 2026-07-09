import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
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
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

import SelectInput from "../../../components/form/SelectInput/SelectInput";

const ITEMS_PER_PAGE = 10;

const StorageStoreList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const { data, loading, error } = useAppSelector(state => state.stores);
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

    const filteredData = useMemo(() => {
        return data
            .filter(item =>
                item.storeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item as any).location?.locationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.storeTypeRef?.name?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.storeId.localeCompare(b.storeId));
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
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
                toast.error(err || "Failed to delete store");
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
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Storage Store Management</h2>
                                <div className="page-breadcrumb">Home / Inventory & Warehouse / Storage Stores</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <SelectInput
                                    label=""
                                    hideLabel
                                    name="storeType"
                                    value={storeType}
                                    options={storeTypeOptions}
                                    onChange={(e) => {
                                        setStoreType(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />

                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
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
                        </Col>
                    </Row>
                </div>

                {/* Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "60px" }}>#</th>
                                    <th>CODE</th>
                                    <th>STORE NAME</th>
                                    <th>LOCATION</th>
                                    <th>STORE TYPE</th>
                                    <th>INCHARGE</th>
                                    <th>COST METHOD</th>
                                    <th>GST PLACE</th>
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
                                    paginatedData.map((item, index) => (
                                        <tr key={item.id || item.storeId} className="master-data-row">
                                            <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                            <td className="master-data-cell">{item.storeId}</td>
                                            <td className="master-data-cell">{item.storeName}</td>
                                            <td className="master-data-cell">{(item as any).location?.locationName ?? "N/A"}</td>
                                            <td className="master-data-cell">{item.storeTypeRef?.name || "N/A"}</td>
                                            <td className="master-data-cell">{item.incharge?.fullName || "N/A"}</td>
                                            <td className="master-data-cell">{item.costMethod || "N/A"}</td>
                                            <td className="master-data-cell">{item.gstPlace || "N/A"}</td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item)} />
                                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                                    <DeleteButton onClick={() => triggerDelete(item.storeId)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">No stores found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
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
            </Container>
        </div>
    );
};

export default StorageStoreList;
