import React, { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { FaPlus, FaSave, FaEraser } from "react-icons/fa";
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
// import { useAppSelector } from "../../../hooks/reduxHooks";
import { usePermission } from "../../../hooks/usePermission";
import { useSearchParams } from "react-router-dom";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CommonModal from "../../../components/ui/Modal/CommonModal";

const ITEMS_PER_PAGE = 10;

const RoleList: React.FC = () => {
    const { roles, total, loading, error, loadRoles, addRole, editRole, removeRole } = useRoles();
    const { can } = usePermission();
    const [searchParams, setSearchParams] = useSearchParams();

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
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

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [formData, setFormData] = useState({
        id: "",
        code: "",
        name: "",
        description: "",
        status: "active",
    });

    // Debounce search term
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Fetch data when page or search term changes
    useEffect(() => {
        if (can("roles.view")) {
            loadRoles(currentPage, ITEMS_PER_PAGE, debouncedSearchTerm);
        }
    }, [loadRoles, currentPage, debouncedSearchTerm, can]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedRoles = roles; // Data is already paginated by backend

    const handleOpenAdd = useCallback(() => {
        setEditMode(false);

        // Generate sequential code (e.g., ROLE_001)
        const roleCodes = roles
            .map((r: any) => r.code)
            .filter((code: string) => code && code.startsWith("ROLE_"));

        let nextNumber = 1;
        if (roleCodes.length > 0) {
            const numbers = roleCodes.map((code: string) => {
                const parts = code.split("_");
                return parts.length > 1 ? parseInt(parts[1], 10) : 0;
            }).filter((num: number) => !isNaN(num));

            if (numbers.length > 0) {
                nextNumber = Math.max(...numbers) + 1;
            }
        }
        const nextCode = `ROLE_${nextNumber.toString().padStart(3, '0')}`;

        setFormData({
            id: "",
            code: nextCode,
            name: "",
            description: "",
            status: "active",
        });
        setShowFormModal(true);
    }, [roles]);

    useEffect(() => {
        if (searchParams.get("action") === "add") {
            handleOpenAdd();
            searchParams.delete("action");
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, setSearchParams, handleOpenAdd]);

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
        if (roleToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await removeRole(roleToDelete);
                toast.success("Role deleted successfully!");
            } catch (err: any) {
                const errorMessage = typeof err === 'string' ? err : (err?.message || "Failed to delete role");
                toast.error(errorMessage);
            } finally {
                setShowDeleteModal(false);
                setRoleToDelete(null);
                setIsDeleting(false);
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
        if (!validateRoleForm() || isSubmitting) return;
        setIsSubmitting(true);
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
            const errorMessage = typeof err === 'string' ? err : (err?.message || "Operation failed");
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns: DataTableColumn<any>[] = [
        {
            header: "#",
            render: (_, index) => <span className="text-ink-subtle font-mono text-xs">{String(startIndex + index + 1).padStart(2, '0')}</span>,
            width: "60px",
            align: "center"
        },
        { header: "Role Name", accessor: "name" },
        {
            header: "Code",
            render: (role) => (
                <span className="font-mono text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-md">
                    {role.code}
                </span>
            ),
        },
        { header: "Description", accessor: "description" },
        { header: "Status", render: (role) => <StatusBadge status={role.status} />, align: "center" },
        {
            header: "Actions",
            render: (role) => (
                <div className="flex items-center gap-2">
                    {can("roles.view") && <ViewButton onClick={() => handleOpenView(role)} />}
                    {can("roles.edit") && <EditButton onClick={() => handleOpenEdit(role)} />}
                    {can("roles.delete") && <DeleteButton onClick={() => triggerDelete(role.id)} />}
                </div>
            ),
            align: "left"
        }
    ];

    return (
        <div>
            <div className="">
                <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 border-b border-line">
                        <div>
                            <h2 className="text-xl font-bold text-ink">Role Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={15} />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-card-2 border border-line-soft rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                    placeholder="Search roles..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            {can("roles.create") && (
                                <CustomButton
                                    text="Add Role"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            )}
                        </div>
                    </div>

                    {/* Roles Table */}
                    <div className="p-0">
                        <DataTable
                            columns={columns}
                            data={paginatedRoles}
                            rowKey={(row) => row.id}
                            loading={loading}
                            emptyMessage="No roles found."
                            pagination={totalPages > 1 ? {
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage
                            } : undefined}
                        />
                    </div>
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
                                variant="secondary"
                                onClick={() => setFormData({
                                    id: formData.id,
                                    code: "",
                                    name: "",
                                    description: "",
                                    status: "active",
                                })}
                            />
                            <CustomButton
                                text={isSubmitting ? (editMode ? "Updating..." : "Saving...") : (editMode ? "Update" : "Save")}
                                icon={FaSave}
                                onClick={handleSubmit}
                                disabled={loading || isSubmitting}
                            />
                        </div>
                    }
                >
                    <form id="roleForm" onSubmit={handleSubmit} className="space-y-4 p-2">
                        <div className="grid grid-cols-1 gap-4">
                            <TextInput
                                label="Role Code (Auto Generated)"
                                name="code"
                                value={formData.code}
                                placeholder="Auto Generated"
                                required
                                error={formErrors.code}
                                onChange={handleChange}
                                disabled
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
                                { label: "Role ID", value: <span className="text-ink-subtle font-mono text-sm">{String(selectedRole.id)}</span> }
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
