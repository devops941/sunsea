import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Modal } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { usePermissions } from "../../../hooks/usePermissions";

const ITEMS_PER_PAGE = 15;

const PermissionList: React.FC = () => {
    const { permissions, loading, error, loadPermissions, addPermission, editPermission, removePermission } = usePermissions();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedPerm, setSelectedPerm] = useState<any>(null);

    // Custom confirm delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [permToDelete, setPermToDelete] = useState<number | null>(null);

    usePageShortcuts({ onRefresh: () => loadPermissions(), onDelete: () => setShowDeleteModal(true) });

    const [formData, setFormData] = useState({
        id: "",
        key: "",
        module: "users",
        action: "",
        scope: "",
        description: "",
    });

    useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredPerms = useMemo(() => {
        return permissions.filter(p =>
            p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [permissions, searchTerm]);

    const totalPages = Math.ceil(filteredPerms.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedPerms = filteredPerms.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = () => {
        setEditMode(false);
        setFormData({
            id: "",
            key: "",
            module: "users",
            action: "",
            scope: "",
            description: "",
        });
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((perm: any) => {
        setEditMode(true);
        setFormData({
            id: String(perm.id),
            key: perm.key,
            module: perm.module,
            action: perm.action,
            scope: perm.scope || "",
            description: perm.description || "",
        });
        setShowFormModal(true);
    }, []);

    const handleOpenView = useCallback((perm: any) => {
        setSelectedPerm(perm);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setPermToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (permToDelete !== null) {
            try {
                await removePermission(permToDelete);
                toast.success("Permission deleted successfully!");
            } catch (err: any) {
                toast.error(err.message || "Failed to delete permission");
            } finally {
                setShowDeleteModal(false);
                setPermToDelete(null);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editMode) {
                await editPermission(Number(formData.id), {
                    module: formData.module,
                    action: formData.action,
                    scope: formData.scope || undefined,
                    description: formData.description || undefined,
                });
                toast.success("Permission updated successfully!");
            } else {
                await addPermission({
                    key: formData.key,
                    module: formData.module,
                    action: formData.action,
                    scope: formData.scope || undefined,
                    description: formData.description || undefined,
                });
                toast.success("Permission created successfully!");
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
                                <h2 className="page-title">Permission Management</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search permissions..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                        data-search-input
                                    />
                                </div>
                                <CustomButton
                                    text="Add Permission"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Permissions Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && permissions.length === 0 ? (
                            <div className="text-center p-5">
                                <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-8 w-8"></div>
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Permission Key</th>
                                        <th>Module</th>
                                        <th>Action</th>
                                        <th>Description</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedPerms.length > 0 ? (
                                        paginatedPerms.map((perm, index) => (
                                            <tr key={perm.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{perm.key}</td>
                                                <td className="master-data-cell">{perm.module}</td>
                                                <td className="master-data-cell">{perm.action}</td>
                                                <td className="master-data-cell">{perm.description || "N/A"}</td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(perm)} />
                                                        <EditButton onClick={() => handleOpenEdit(perm)} />
                                                        <DeleteButton onClick={() => triggerDelete(perm.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center p-4">No permissions found.</td>
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
                        <Modal.Title>{editMode ? "Edit Permission" : "Add New Permission"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <TextInput
                                        label="Permission Key"
                                        name="key"
                                        value={formData.key}
                                        placeholder="e.g. users.view"
                                        required
                                        disabled={editMode}
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Action Name"
                                        name="action"
                                        value={formData.action}
                                        placeholder="e.g. view"
                                        required
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <SelectInput
                                        label="Module Name"
                                        name="module"
                                        value={formData.module}
                                        options={[
                                            { value: "customers", label: "Customers" },
                                            { value: "suppliers", label: "Suppliers" },
                                            { value: "supplierpricelist", label: "Supplier Pricing" },
                                            { value: "products", label: "Product Master" },
                                            { value: "categories", label: "Categories" },
                                            { value: "uoms", label: "Units of Measure (UOM)" },
                                            { value: "raw_materials", label: "Raw Materials" },
                                            { value: "raw_material_stocks", label: "Raw Material Stocks" },
                                            { value: "finished_goods_stocks", label: "Finished Goods Stocks" },
                                            { value: "stores", label: "Stores Config" },
                                            { value: "storage-stores", label: "Warehouses" },
                                            { value: "store-types", label: "Store Types" },
                                            { value: "locations", label: "Store Locations" },
                                            { value: "machines", label: "Machines List" },
                                            { value: "shifts", label: "Shift Schedules" },
                                            { value: "users", label: "System Users" },
                                            { value: "roles", label: "User Roles" },
                                            { value: "permissions", label: "Permissions Registry" },
                                            { value: "role-permissions", label: "Role Mappings" },
                                            { value: "employees", label: "Employee Directory" },
                                            { value: "departments", label: "Departments" },
                                            { value: "profile", label: "User Profile" },
                                            { value: "reports", label: "System Reports" }
                                        ]}
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Scope (Optional)"
                                        name="scope"
                                        value={formData.scope}
                                        placeholder="e.g. global / department"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Description"
                                        name="description"
                                        value={formData.description}
                                        placeholder="Enter permission description"
                                        onChange={handleChange}
                                    />
                                </Col>
                            </Row>
                        </Modal.Body>
                        <Modal.Footer>
                            {!editMode && (
                                <CustomButton
                                    text="Clear"
                                    icon={FaEraser}
                                    variant="secondary"
                                    onClick={() => setFormData({
                                        id: "",
                                        key: "",
                                        module: "users",
                                        action: "",
                                        scope: "",
                                        description: "",
                                    })}
                                />
                            )}
                            <div className="ms-2">
                                <CustomButton
                                    text={editMode ? "Update" : "Save"}
                                    icon={FaSave}
                                    type="submit"
                                />
                            </div>
                        </Modal.Footer>
                    </form>
                </Modal>

                {/* View Details Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Permission Details"
                    avatarText={selectedPerm ? selectedPerm.key.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedPerm ? selectedPerm.key : ""}
                    headerSubtitle={selectedPerm ? `Module: ${selectedPerm.module}` : ""}
                    sections={selectedPerm ? [
                        {
                            fields: [
                                { label: "Permission Key", value: selectedPerm.key },
                                { label: "Action", value: selectedPerm.action },
                                { label: "Module", value: selectedPerm.module },
                                { label: "Scope", value: selectedPerm.scope || "N/A" },
                                { label: "Description", value: selectedPerm.description || "N/A", xs: 12 },
                                { label: "Permission ID", value: <span className="text-muted font-monospace small">{String(selectedPerm.id)}</span> }
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
                    message="Are you sure you want to delete this permission?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default PermissionList;
