import React, { useState, useCallback, useEffect } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
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
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DataTable from "../../../components/ui/table/DataTable";

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
    }, [dispatch, searchTerm, locationType, currentPage]);

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

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Location Management</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="w-48">
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
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                    </div>

                    {/* Table */}
                    {loading && data.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <DataTable
                            data={data}
                            rowKey={(item) => item.locationId}
                            emptyMessage="No locations found."
                            pagination={
                                totalPages > 1
                                    ? {
                                        currentPage,
                                        totalPages,
                                        onPageChange: setCurrentPage,
                                    }
                                    : undefined
                            }
                            columns={[
                                { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
                                { header: "LOCATION ID", accessor: "locationCode" },
                                { header: "LOCATION NAME", accessor: "locationName" },
                                { header: "LOCATION TYPE", accessor: "locationType" },
                                { header: "CITY", render: (item) => item.city || "N/A" },
                                {
                                    header: "STATUS", render: (item) => (
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${item.isActive
                                                ? "bg-green-100 text-green-700 border border-green-200"
                                                : "bg-red-100 text-red-700 border border-red-200"
                                            }`}>
                                            {item.isActive ? "ACTIVE" : "INACTIVE"}
                                        </span>
                                    )
                                },
                                {
                                    header: "ACTIONS",
                                    render: (item) => (
                                        <div className="flex items-center gap-2">
                                            <ViewButton onClick={() => handleOpenView(item)} />
                                            <EditButton onClick={() => handleOpenEdit(item)} />
                                            <DeleteButton onClick={() => triggerDelete(item.locationId)} />
                                        </div>
                                    ),
                                    align: "right"
                                },
                            ]}
                        />
                    )}
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
            </div>
        </div>
    );
};

export default LocationList;
