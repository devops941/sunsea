import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
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
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

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

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Store Type Management</h2>
                                <div className="page-breadcrumb">Home / Settings / Store Types</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
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
                        </Col>
                    </Row>
                </div>

                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "60px" }}>#</th>
                                    <th>CODE</th>
                                    <th>NAME</th>
                                    <th>DESCRIPTION</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-4">
                                            <Spinner animation="border" variant="primary" />
                                        </td>
                                    </tr>
                                ) : data.length > 0 ? (
                                    data.map((item, index) => (
                                        <tr key={item.id} className="master-data-row">
                                            <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                            <td className="master-data-cell">{item.code}</td>
                                            <td className="master-data-cell">{item.name}</td>
                                            <td className="master-data-cell">{item.description || "N/A"}</td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item)} />
                                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                                    <DeleteButton onClick={() => triggerDelete(item.id)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="text-center p-4">No store types found.</td>
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
            </Container>
        </div>
    );
};

export default StoreTypeList;
