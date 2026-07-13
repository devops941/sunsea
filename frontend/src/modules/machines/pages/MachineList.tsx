import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines, deleteMachine } from "../../../features/machines/machineSlice";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

const ITEMS_PER_PAGE = 10;

const MachineList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    
    const { data, loading, error } = useAppSelector((state) => state.machines);
    
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchMachines());
    }, [dispatch]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.machineId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.machineName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = () => {
        navigate("/machines/create");
    };

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/machines/edit/${item.machineId}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await dispatch(deleteMachine(itemToDelete)).unwrap();
                toast.success("Machine deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete machine");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Machine Management</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search machines..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Machine"
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
                                    <th>MACHINE ID</th>
                                    <th>MACHINE NAME</th>
                                    <th>TECH TYPE</th>
                                    <th>MACHINE TYPE</th>
                                    <th>CAPACITY</th>
                                    <th>MACHINE STATUS</th>
                                    <th>ACTIVE STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="text-center p-4">
                                            <Spinner animation="border" variant="primary" />
                                        </td>
                                    </tr>
                                ) : paginatedData.length > 0 ? (
                                    paginatedData.map((item, index) => (
                                        <tr key={item.machineId} className="master-data-row">
                                            <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                            <td className="master-data-cell">{item.machineId}</td>
                                            <td className="master-data-cell">{item.machineName}</td>
                                            <td className="master-data-cell">{item.technologyType || "-"}</td>
                                            <td className="master-data-cell">{item.machineType || "-"}</td>
                                            <td className="master-data-cell">{item.capacity || "-"}</td>
                                            <td className="master-data-cell">{item.machineStatus || "-"}</td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                                    <DeleteButton onClick={() => triggerDelete(item.machineId)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="text-center p-4">No machines found.</td>
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

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this machine?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default MachineList;
