import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Modal, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useDepartments } from "../../../hooks/useDepartments";
import { hasPermission } from "../../../utils/permission";

const ITEMS_PER_PAGE = 10;

const DepartmentList: React.FC = () => {
    const { departments, loading, error, loadDepartments, addDepartment, editDepartment, removeDepartment } = useDepartments();
    const canCreateDepartment = hasPermission("departments.create");
    const canEditDepartment = hasPermission("departments.edit");
    const canDeleteDepartment = hasPermission("departments.delete");

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedDept, setSelectedDept] = useState<any>(null);

    // Custom confirm delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deptToDelete, setDeptToDelete] = useState<number | null>(null);

    const [formErrors, setFormErrors] = useState<{ code?: string; name?: string }>({});

    const validateForm = () => {
        const errors: { code?: string; name?: string } = {};
        const code = formData.code.trim();
        const name = formData.name.trim();

        if (!code) {
            errors.code = "Department code is required.";
        } else if (!/^[A-Za-z0-9_-]{2,10}$/.test(code)) {
            errors.code = "Code must be 2-10 characters (letters, numbers, - or _ only).";
        } else if (
            departments.some(
                d =>
                    d.code.toLowerCase() === code.toLowerCase() &&
                    String(d.id) !== formData.id
            )
        ) {
            errors.code = "This department code already exists.";
        }

        if (!name) {
            errors.name = "Department name is required.";
        } else if (name.length < 3) {
            errors.name = "Department name must be at least 3 characters.";
        } else if (name.length > 100) {
            errors.name = "Department name must be under 100 characters.";
        } else if (
            departments.some(
                d =>
                    d.name.toLowerCase() === name.toLowerCase() &&
                    String(d.id) !== formData.id
            )
        ) {
            errors.name = "This department name already exists.";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const [formData, setFormData] = useState({
        id: "",
        code: "",
        name: "",
    });

    useEffect(() => {
        loadDepartments();
    }, [loadDepartments]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredDepts = useMemo(() => {
        return departments.filter(d =>
            d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [departments, searchTerm]);

    const totalPages = Math.ceil(filteredDepts.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedDepts = filteredDepts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = () => {
        setEditMode(false);
        setFormData({ id: "", code: "", name: "" });
        setFormErrors({});
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((dept: any) => {
        setEditMode(true);
        setFormData({
            id: String(dept.id),
            code: dept.code,
            name: dept.name,
        });
        setFormErrors({});
        setShowFormModal(true);
    }, []);

    const handleOpenView = useCallback((dept: any) => {
        setSelectedDept(dept);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setDeptToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (deptToDelete !== null) {
            try {
                await removeDepartment(deptToDelete);
                toast.success("Department deleted successfully!");
            } catch (err: any) {
                toast.error(err.message || "Failed to delete department");
            } finally {
                setShowDeleteModal(false);
                setDeptToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
        setFormErrors(prev => ({
            ...prev,
            [name]: undefined,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            if (editMode) {
                await editDepartment(Number(formData.id), { code: formData.code.trim(), name: formData.name.trim() });
                toast.success("Department updated successfully!");
            } else {
                await addDepartment({ code: formData.code.trim(), name: formData.name.trim() });
                toast.success("Department created successfully!");
            }
            setShowFormModal(false);
            setFormErrors({});
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
                                <h2 className="page-title">Department Management</h2>
                                <div className="page-breadcrumb">Home / HR Management / Departments</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search departments..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>

                                {canCreateDepartment && (
                                    <CustomButton
                                        text="Add Department"
                                        icon={FaPlus}
                                        onClick={handleOpenAdd}
                                    />
                                )}
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Departments Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && departments.length === 0 ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Department Code</th>
                                        <th>Department Name</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedDepts.length > 0 ? (
                                        paginatedDepts.map((dept, index) => (
                                            <tr key={dept.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{dept.code}</td>
                                                <td className="master-data-cell">{dept.name}</td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(dept)} />
                                                        {canEditDepartment && (<EditButton onClick={() => handleOpenEdit(dept)} />)}
                                                        {canDeleteDepartment && (<DeleteButton onClick={() => triggerDelete(dept.id)} />)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="text-center p-4">No departments found.</td>
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
                <Modal show={showFormModal} onHide={() => { setShowFormModal(false); setFormErrors({}); }} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>{editMode ? "Edit Department" : "Add New Department"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <TextInput
                                        label="Department Code"
                                        name="code"
                                        value={formData.code}
                                        placeholder="e.g. IT"
                                        required
                                        onChange={handleChange}
                                        error={formErrors.code}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Department Name"
                                        name="name"
                                        value={formData.name}
                                        placeholder="e.g. Information Technology"
                                        required
                                        onChange={handleChange}
                                        error={formErrors.name}
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
                    modalTitle="Department Details"
                    avatarText={selectedDept ? selectedDept.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedDept ? selectedDept.name : ""}
                    headerSubtitle={selectedDept ? `Code: ${selectedDept.code}` : ""}
                    sections={selectedDept ? [
                        {
                            fields: [
                                { label: "Department Code", value: selectedDept.code },
                                { label: "Department Name", value: selectedDept.name },
                                { label: "Department ID", value: <span className="text-muted font-monospace small">{String(selectedDept.id)}</span>, xs: 12 }
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
                    message="Are you sure you want to delete this department?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default DepartmentList;
