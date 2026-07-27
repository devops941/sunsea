import React, { useState, useCallback, useEffect } from "react";
import { FaSearch, FaPlus, FaSave, FaEraser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchLocations, deleteLocation, createLocation, updateLocation } from "../../../features/locations/locationSlice";
import { locationService } from "../../../services/locationService";
import type { Location } from "../../../features/locations/types";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import DataTable from "../../../components/ui/table/DataTable";

const ITEMS_PER_PAGE = 10;

const locationTypeOptions = [
    { label: "All Types", value: "" },
    { label: "Store", value: "Store" },
    { label: "Warehouse", value: "Warehouse" },
    { label: "Factory", value: "Factory" },
    { label: "Office", value: "Office" },
];

const LOCATION_TYPE_FORM_OPTIONS = [
    { label: "Warehouse", value: "Warehouse" },
    { label: "Office", value: "Office" },
    { label: "Factory", value: "Factory" },
    { label: "Retail", value: "Retail" },
    { label: "Store", value: "Store" },
];

const initialFormState = {
    locationId: "",
    locationCode: "",
    locationName: "",
    locationType: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    isActive: true,
};

const locationSchema = z.object({
    locationName: z
        .string()
        .trim()
        .min(1, "Location Name is required")
        .max(100, "Maximum 100 characters allowed")
        .regex(
            /^[A-Za-z0-9\s&()-]+$/,
            "Location Name contains invalid characters"
        ),

    locationType: z
        .string()
        .trim()
        .min(1, "Location Type is required"),

    address: z
        .string()
        .trim()
        .min(1, "Address is required")
        .max(255, "Maximum 255 characters allowed"),

    city: z
        .string()
        .trim()
        .min(1, "City is required")
        .max(100, "Maximum 100 characters allowed"),

    state: z
        .string()
        .trim()
        .min(1, "State is required")
        .max(100, "Maximum 100 characters allowed"),

    country: z
        .string()
        .trim()
        .min(1, "Country is required")
        .max(100, "Maximum 100 characters allowed"),
});

const LocationList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const { data, loading, error, totalPages } = useAppSelector(state => state.locations);
    useEffect(() => { if (error) toast.error(error); }, [error]);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Location | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [locationType, setLocationType] = useState("");

    // Form Modal State
    const [showFormModal, setShowFormModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleOpenAdd = async () => {
        setEditMode(false);
        setErrors({});
        
        let nextCode = "";
        try {
            nextCode = await locationService.fetchNextId();
        } catch (err) {
            console.error("Failed to fetch next location code:", err);
        }
        
        setFormData({ ...initialFormState, locationId: nextCode, locationCode: nextCode });
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((item: Location) => {
        setEditMode(true);
        setErrors({});
        setFormData({
            locationId: item.locationId,
            locationCode: item.locationCode,
            locationName: item.locationName,
            locationType: item.locationType,
            address: item.address || "",
            city: item.city || "",
            state: item.state || "",
            country: item.country || "India",
            isActive: item.isActive,
        });
        setShowFormModal(true);
    }, []);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            setIsDeleting(true);
            try {
                await dispatch(deleteLocation(itemToDelete)).unwrap();
                toast.success("Location deleted successfully!");
            } catch (err: any) {
                console.log("Delete Location Error:", err);
                const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to delete location";
                toast.error(errorMessage);
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target;
        const { name, value } = target;
        const type = (target as any).type;

        const checked =
            type === "checkbox"
                ? (target as HTMLInputElement).checked
                : undefined;

        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));

        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
    };

    const handleClear = () => {
        setFormData(prev => ({
            ...initialFormState,
            locationId: prev.locationId,
            locationCode: prev.locationCode
        }));
        setErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            locationSchema.parse(formData);
            setErrors({});
        } catch (error) {
            if (error instanceof z.ZodError) {
                const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
                const formattedErrors: Record<string, string> = {};
                Object.keys(fieldErrors).forEach((key) => {
                    const message = fieldErrors[key]?.[0];
                    if (message) formattedErrors[key] = message;
                });
                setErrors(formattedErrors);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            if (editMode) {
                await dispatch(updateLocation({ id: formData.locationId, data: formData })).unwrap();
                toast.success("Location updated successfully!");
            } else {
                await dispatch(createLocation(formData)).unwrap();
                toast.success("Location created successfully!");
            }
            setShowFormModal(false);
        } catch (err: any) {
            const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to save location";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    return (
        <div>
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
                                    name="locationTypeFilter"
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
                    <div className="p-0">
                        <DataTable
                            data={data}
                            rowKey={(item) => item.locationId}
                            emptyMessage="No locations found."
                            loading={loading}
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
                                    align: "left"
                                },
                            ]}
                        />
                    </div>
                </div>

                {/* Form Modal (Add / Edit) */}
                <CommonModal
                    show={showFormModal}
                    onHide={() => setShowFormModal(false)}
                    title={editMode ? "Edit Location" : "Add New Location"}
                    maxWidth="3xl"
                    footer={
                        <div className="flex items-center justify-end gap-2 w-full">
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                onClick={handleClear}
                                disabled={isSubmitting}
                            />
                            <CustomButton
                                type="submit"
                                text={editMode ? "Update Location" : "Save Location"}
                                icon={FaSave}
                                variant="primary"
                                disabled={isSubmitting}
                                onClick={handleSubmit}
                            />
                        </div>
                    }
                >
                    <form onSubmit={handleSubmit} className="space-y-4 p-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextInput
                                label="Location ID"
                                name="locationId"
                                value={formData.locationId}
                                placeholder="e.g. LOC001"
                                required
                                disabled
                                onChange={handleChange}
                                error={errors.locationId}
                            />
                            <TextInput
                                label="Location Name"
                                name="locationName"
                                value={formData.locationName}
                                placeholder="e.g. Main Warehouse"
                                required
                                onChange={handleChange}
                                error={errors.locationName}
                            />
                            <SelectInput
                                label="Location Type"
                                name="locationType"
                                value={formData.locationType}
                                options={[
                                    { label: "Select Type", value: "" },
                                    ...LOCATION_TYPE_FORM_OPTIONS
                                ]}
                                required
                                onChange={handleChange}
                                error={errors.locationType}
                            />
                            <div className="col-span-1 md:col-span-2">
                                <TextInput
                                    label="Address"
                                    name="address"
                                    value={formData.address}
                                    placeholder="Enter full street address"
                                    required
                                    onChange={handleChange}
                                    error={errors.address}
                                />
                            </div>
                            <CityStateSelect
                                cityValue={formData.city}
                                stateValue={formData.state}
                                onCityChange={(val) => {
                                    setFormData((prev) => ({ ...prev, city: val.name }));
                                    if (errors.city) setErrors((prev) => ({ ...prev, city: "" }));
                                }}
                                onStateChange={(val) => {
                                    setFormData((prev) => ({ ...prev, state: val.name, city: "" }));
                                    if (errors.state) setErrors((prev) => ({ ...prev, state: "", city: "" }));
                                }}
                                cityError={errors.city}
                                stateError={errors.state}
                                countryValue={formData.country}
                                onCountryChange={(val) => {
                                    setFormData((prev) => ({ ...prev, country: val.name }));
                                    if (errors.country) setErrors((prev) => ({ ...prev, country: "" }));
                                }}
                                countryError={errors.country}
                                required
                            />
                            <SelectInput
                                label="Status"
                                name="isActive"
                                value={formData.isActive.toString()}
                                options={[
                                    { label: "Active", value: "true" },
                                    { label: "Inactive", value: "false" }
                                ]}
                                required
                                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === "true" }))}
                            />
                        </div>
                    </form>
                </CommonModal>

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
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this location?"
                    confirmText={isDeleting ? "Deleting..." : "Delete"}
                    cancelText="Cancel"
                    isDangerous={true}
                    isLoading={isDeleting}
                />
            </div>
        </div>
    );
};

export default LocationList;
