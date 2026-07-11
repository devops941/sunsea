import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Modal, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaSave, FaEraser } from "react-icons/fa";
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

    // Custom confirm delete state
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

        if (!formData.code.trim()) {
            errors.code = "Role code is required";
        }

        if (!formData.name.trim()) {
            errors.name = "Role name is required";
        }

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
            setShowFormModal(false);
        } catch (err: any) {
            toast.error(err.message || "Operation failed");
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Role Management</h2>
                                <div className="page-breadcrumb">Home / Administration / Roles</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
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
                        </Col>
                    </Row>
                </div>

                {/* Roles Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && roles.length === 0 ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Role Code</th>
                                        <th>Role Name</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRoles.length > 0 ? (
                                        paginatedRoles.map((role, index) => (
                                            <tr key={role.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{role.code}</td>
                                                <td className="master-data-cell">{role.name}</td>
                                                <td className="master-data-cell">{role.description}</td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={role.status} />
                                                </td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(role)} />
                                                        <EditButton onClick={() => handleOpenEdit(role)} />
                                                        <DeleteButton onClick={() => triggerDelete(role.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center p-4">No roles found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

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

                {/* Add/Edit Modal */}
                <Modal show={showFormModal} onHide={() => setShowFormModal(false)} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>{editMode ? "Edit Role" : "Add New Role"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
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
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Role Name"
                                        name="name"
                                        value={formData.name}
                                        placeholder="e.g. Super Admin"
                                        required
                                        error={formErrors.name}
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Description"
                                        name="description"
                                        value={formData.description}
                                        placeholder="Enter role description"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
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
                                </Col>
                            </Row>
                        </Modal.Body>
                        <Modal.Footer>
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
                            <div className="ms-2">
                                <CustomButton
                                    text={editMode ? "Update" : "Save"}
                                    icon={FaSave}
                                    type="submit"
                                    disabled={loading}
                                />
                            </div>
                        </Modal.Footer>
                    </form>
                </Modal>

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
                                { label: "Role ID", value: <span className="text-muted font-monospace small">{String(selectedRole.id)}</span> }
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
            </Container>
        </div>
    );
};

export default RoleList;
