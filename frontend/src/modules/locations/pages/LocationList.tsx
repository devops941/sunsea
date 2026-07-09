import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchLocations, deleteLocation } from "../../../features/locations/locationSlice";
import type { Location } from "../../../features/locations/types";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

const ITEMS_PER_PAGE = 10;
const locationTypeOptions = [
    { label: "All Types", value: "" },
    { label: "Store", value: "STORE" },
    { label: "Warehouse", value: "WAREHOUSE" },
    { label: "Factory", value: "FACTORY" },
    { label: "Office", value: "OFFICE" },
];

const LocationList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const { data, loading, error, totalPages } = useAppSelector(state => state.locations);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Location | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [locationType, setLocationType] = useState("");

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
       dispatch(fetchLocations({
    search: searchTerm,
    locationType,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    sortBy: "locationCode",
    sortOrder: "asc",
}));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
}, [
    dispatch,
    searchTerm,
    locationType,
    currentPage,
]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenView = useCallback((item: Location) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = () => {
        navigate("/locations/create");
    };

    const handleOpenEdit = useCallback((item: Location) => {
        navigate(`/locations/edit/${item.locationId}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await dispatch(deleteLocation(itemToDelete)).unwrap();
                toast.success("Location deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete location");
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
                                <h2 className="page-title">Location Management</h2>
                                <div className="page-breadcrumb">Home / Settings / Locations</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div style={{ width: "220px" }}>
                                    <SelectInput
                                        label="Location Type"
                                        hideLabel={true}
                                        value={locationType}
                                        options={locationTypeOptions}
                                        onChange={(e) => {
                                            setLocationType(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                    />
                                </div>
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search locations..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Location"
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
                                    <th>LOCATION ID</th>
                                    <th>LOCATION NAME</th>
                                    <th>LOCATION TYPE</th>
                                    <th>CITY</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center p-4">
                                            <Spinner animation="border" variant="primary" />
                                        </td>
                                    </tr>
                                ) : data.length > 0 ? (
                                    data.map((item, index) => (
                                        <tr key={item.locationId} className="master-data-row">
                                            <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                            <td className="master-data-cell">{item.locationCode}</td>
                                            <td className="master-data-cell">{item.locationName}</td>
                                            <td className="master-data-cell">{item.locationType}</td>
                                            <td className="master-data-cell">{item.city || "N/A"}</td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item)} />
                                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                                    <DeleteButton onClick={() => triggerDelete(item.locationId)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center p-4">No locations found.</td>
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
                    modalTitle="Location Details"
                    avatarText={selectedItem ? selectedItem.locationName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.locationName : ""}
                    headerSubtitle={selectedItem ? `Code: ${selectedItem.locationCode}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Location Code", value: selectedItem.locationCode },
                                { label: "Location Name", value: selectedItem.locationName },
                                { label: "Location Type", value: selectedItem.locationType },
                            ]
                        },
                        {
                            title: "Address Information",
                            fields: [
                                { label: "Address", value: selectedItem.address || "N/A", xs: 12 },
                                { label: "City", value: selectedItem.city || "N/A" },
                                { label: "State", value: selectedItem.state || "N/A" },
                                { label: "Country", value: selectedItem.country || "N/A" },
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
                    message="Are you sure you want to delete this location?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default LocationList;
