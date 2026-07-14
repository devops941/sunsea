import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaSearch, FaPlus, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useRoles } from "../../../hooks/useRoles";
import { useAppSelector } from "../../../hooks/reduxHooks";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CommonModal from "../../../components/ui/Modal/CommonModal";

const ITEMS_PER_PAGE = 10;

const RoleList: React.FC = () => {
    const { roles, loading, error, loadRoles, addRole, editRole, removeRole } = useRoles();
    const { user } = useAppSelector((state) => state.auth);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedRole, setSelectedRole] = useState<any>(null);
    const [formErrors, setFormErrors] = useState<{
        code?: string;
        name?: string;
    }>({});

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        id: "",
        code: "",
        name: "",
        description: "",
        status: "active",
    });

    useEffect(() => {
        loadRoles();
    }, [loadRoles]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredRoles = useMemo(() => {
        return roles.filter(role =>
            (role.code && role.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
            role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [roles, searchTerm]);

    const totalPages = Math.ceil(filteredRoles.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedRoles = filteredRoles.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = () => {
        setEditMode(false);
        setFormData({
            id: "",
            code: "",
            name: "",
            description: "",
            status: "active",
        });
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((role: any) => {
        setEditMode(true);
        setFormData({
            id: String(role.id),
            code: role.code || "",
            name: role.name,
            description: role.description || "",
            status: role.status,
        });
        setShowFormModal(true);
    }, []);

    const handleOpenView = useCallback((role: any) => {
        setSelectedRole(role);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setRoleToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (roleToDelete !== null) {
            try {
                await removeRole(roleToDelete);
                toast.success("Role deleted successfully!");
            } catch (err: any) {
                toast.error(err.message || "Failed to delete role");
            } finally {
                setShowDeleteModal(false);
                setRoleToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const validateRoleForm = () => {
        const errors: any = {};
        if (!formData.code.trim()) errors.code = "Role code is required";
        if (!formData.name.trim()) errors.name = "Role name is required";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateRoleForm()) return;
        try {
            const payload = {
                code: formData.code,
                name: formData.name,
                description: formData.description,
                status: formData.status
            };

            if (editMode) {
                await editRole(Number(formData.id), payload);
                toast.success("Role updated successfully!");
            } else {
                await addRole(payload);
                toast.success("Role created successfully!");
            }
            setShowFormModal(true);
            setTimeout(() => setShowFormModal(false), 10);
        } catch (err: any) {
            toast.error(err.message || "Operation failed");
        }
    };

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        { header: "Role Code", accessor: "code" },
        { header: "Role Name", accessor: "name" },
        { header: "Description", accessor: "description" },
        { header: "Status", render: (role) => <StatusBadge status={role.status} />, align: "center" },
        { 
            header: "Actions", 
            render: (role) => (
                <div className="flex items-center gap-2">
                    <ViewButton onClick={() => handleOpenView(role)} />
                    <EditButton onClick={() => handleOpenEdit(role)} />
                    <DeleteButton onClick={() => triggerDelete(role.id)} />
                </div>
            ),
            align: "right"
        }
    ];

    return (
        <div className="p-4 md:p-6 min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Role Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search roles..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <CustomButton
                                text="Add Role"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        </div>
                    </div>

                    {/* Roles Table */}
                    {loading && roles.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={paginatedRoles}
                            rowKey={(row) => row.id}
                            emptyMessage="No roles found."
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
                    title={editMode ? "Edit Role" : "Add New Role"}
                    overflowVisible={true}
                    footer={
                        <div className="flex items-center justify-end gap-2 w-full">
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                onClick={() => setFormData({
                                    id: formData.id,
                                    code: "",
                                    name: "",
                                    description: "",
                                    status: "active",
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
                    <form id="roleForm" onSubmit={handleSubmit} className="space-y-4 p-2">
                        <div className="grid grid-cols-1 gap-4">
                            <TextInput
                                label="Role Code"
                                name="code"
                                value={formData.code}
                                placeholder="e.g. ROLE_ADMIN"
                                required
                                error={formErrors.code}
                                onChange={handleChange}
                                disabled={editMode && formData.code === "ROLE_ADMIN"}
                            />
                            <TextInput
                                label="Role Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Super Admin"
                                required
                                error={formErrors.name}
                                onChange={handleChange}
                            />
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="Enter role description"
                                onChange={handleChange}
                            />
                            <SelectInput
                                label="Status"
                                name="status"
                                value={formData.status}
                                options={[
                                    { value: "active", label: "Active" },
                                    { value: "inactive", label: "Inactive" },
                                ]}
                                onChange={handleChange}
                            />
                        </div>
                    </form>
                </CommonModal>

                {/* View Details Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Role Details"
                    avatarText={selectedRole ? selectedRole.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedRole ? selectedRole.name : ""}
                    sections={selectedRole ? [
                        {
                            fields: [
                                { label: "Role Code", value: selectedRole.code },
                                { label: "Role Name", value: selectedRole.name },
                                { label: "Description", value: selectedRole.description || "N/A" },
                                {
                                    label: "Status",
                                    value: <StatusBadge status={selectedRole.status} />
                                },
                                { label: "System Role", value: selectedRole.isSystem ? "Yes" : "No" },
                                { label: "Role ID", value: <span className="text-slate-500 font-mono text-sm">{String(selectedRole.id)}</span> }
                            ]
                        }
                    ] : []}
                />

                {/* Custom Delete Confirm Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this role?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default RoleList;
