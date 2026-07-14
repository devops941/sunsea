import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaSearch, FaPlus, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { useSizes } from "../../../hooks/useSizes";
import { sizeService } from "../../../services/sizeService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CommonModal from "../../../components/ui/Modal/CommonModal";

const ITEMS_PER_PAGE = 10;

const SizeList: React.FC = () => {
    const { sizes, loading, error, loadSizes, addSize, editSize, removeSize } = useSizes();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedSize, setSelectedSize] = useState<any>(null);
    const [errors, setErrors] = useState({ code: "", name: "" });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        id: "",
        code: "",
        name: "",
        description: "",
        status: "ACTIVE",
    });

    useEffect(() => {
        loadSizes(""); 
    }, [loadSizes]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setCurrentPage(1);
        loadSizes(value);
    };

    const totalPages = Math.ceil(sizes.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedSizes = sizes.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = async () => {
        setEditMode(false);
        let nextCode = "";
        try {
            nextCode = await sizeService.fetchNextId();
        } catch (error) {
            console.error("Failed to fetch next size code:", error);
        }

        setFormData({
            id: "",
            code: nextCode,
            name: "",
            description: "",
            status: "ACTIVE",
        });
        setErrors({ code: "", name: "" });
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((size: any) => {
        setEditMode(true);
        setFormData({
            id: String(size.id),
            code: size.code,
            name: size.name,
            description: size.description || "",
            status: size.status,
        });
        setErrors({ code: "", name: "" });
        setShowFormModal(true);
    }, []);

    const validateForm = () => {
        const newErrors = { code: "", name: "" };
        let isValid = true;

        if (!formData.code.trim()) {
            newErrors.code = "size code is required";
            isValid = false;
        }

        if (!formData.name.trim()) {
            newErrors.name = "size name is required";
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleOpenView = useCallback((size: any) => {
        setSelectedSize(size);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await removeSize(itemToDelete);
                toast.success("Size deleted successfully!");
            } catch (err: any) {
                toast.error("Failed to delete size as it is already assigned in product");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: "" }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        
        try {
            const payload = {
                code: formData.code,
                name: formData.name,
                description: formData.description,
                status: formData.status
            };

            if (editMode) {
                await editSize(Number(formData.id), payload);
                toast.success("Size updated successfully!");
            } else {
                await addSize(payload);
                toast.success("Size created successfully!");
            }
            setShowFormModal(false);
        } catch (err: any) {
            toast.error(err || "Operation failed");
        }
    };

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        { header: "Code", accessor: "code" },
        { header: "Name", accessor: "name" },
        { header: "Status", render: (size) => <StatusBadge status={size.status} />, align: "center" },
        { header: "Created Date", render: (size) => new Date(size.createdAt).toLocaleDateString() },
        {
            header: "Actions",
            render: (size) => (
                <div className="flex items-center gap-2 justify-end">
                    <ViewButton onClick={() => handleOpenView(size)} />
                    <EditButton onClick={() => handleOpenEdit(size)} />
                    <DeleteButton onClick={() => triggerDelete(size.id)} />
                </div>
            ),
            align: "right"
        }
    ];

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className="">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Size Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search sizes..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <CustomButton text="Add Size" icon={FaPlus} onClick={handleOpenAdd} />
                        </div>
                    </div>

                    {/* Sizes Table */}
                    {loading && sizes.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={paginatedSizes}
                            rowKey={(row) => row.id}
                            emptyMessage="No sizes found."
                            pagination={totalPages > 1 ? {
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage
                            } : undefined}
                        />
                    )}
                </div>

                {/* Add/Edit Modal */}
                <CommonModal
                    show={showFormModal}
                    onHide={() => setShowFormModal(false)}
                    title={editMode ? "Edit Size" : "Add New Size"}
                    overflowVisible={true}
                    footer={
                        <div className="flex items-center justify-end gap-2 w-full">
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                onClick={() => setFormData({
                                    id: formData.id,
                                    code: formData.code,
                                    name: "",
                                    description: "",
                                    status: "ACTIVE",
                                })}
                            />
                            <CustomButton
                                text={editMode ? "Update" : "Save"}
                                icon={FaSave}
                                onClick={handleSubmit}
                                disabled={loading}
                            />
                        </div>
                    }
                >
                    <form onSubmit={handleSubmit} className="space-y-4 p-2">
                        <div className="grid grid-cols-1 gap-4">
                            <TextInput
                                label="Size Code"
                                name="code"
                                value={formData.code}
                                placeholder="e.g. XL"
                                required
                                onChange={handleChange}
                                disabled
                                error={errors.code}
                            />
                            <TextInput
                                label="Size Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Extra Large"
                                required
                                onChange={handleChange}
                                error={errors.name}
                            />
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="Enter size description"
                                onChange={handleChange}
                            />
                            <SelectInput
                                label="Status"
                                name="status"
                                value={formData.status}
                                options={[
                                    { value: "ACTIVE", label: "Active" },
                                    { value: "INACTIVE", label: "Inactive" },
                                ]}
                                onChange={handleChange}
                            />
                        </div>
                    </form>
                </CommonModal>

                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Size Details"
                    avatarText={selectedSize ? selectedSize.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedSize ? selectedSize.name : ""}
                    headerSubtitle={selectedSize ? `Code: ${selectedSize.code}` : ""}
                    sections={selectedSize ? [
                        {
                            fields: [
                                { label: "Size Name", value: selectedSize.name },
                                { label: "Size Code", value: selectedSize.code },
                                { label: "Description", value: selectedSize.description || "N/A" },
                                { label: "Status", value: <StatusBadge status={selectedSize.status} /> },
                                { label: "Created Date", value: new Date(selectedSize.createdAt).toLocaleString() },
                                { label: "Updated Date", value: new Date(selectedSize.updatedAt).toLocaleString() },
                            ]
                        }
                    ] : []}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this size?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default SizeList;
