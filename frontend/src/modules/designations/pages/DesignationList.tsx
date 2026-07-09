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
import { useDesignations } from "../../../hooks/useDesignations";
import { hasPermission } from "../../../utils/permission";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { useDepartments } from "../../../hooks/useDepartments";

const ITEMS_PER_PAGE = 10;

const DesignationList: React.FC = () => {
    const { designations, loading, error, loadDesignations, addDesignation, editDesignation, removeDesignation } = useDesignations();
    const canCreateDepartment = hasPermission("departments.create");
    const canEditDepartment = hasPermission("departments.edit");
    const canDeleteDepartment = hasPermission("departments.delete");
    const [errors, setErrors] = useState<any>({});

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const { departments, loadDepartments } = useDepartments();
    const [selectedDesig, setSelectedDesig] = useState<any>(null);

    interface FormErrors {
        code?: string;
        name?: string;
    }



    const validate = (): boolean => {
        const newErrors: any = {};

        if (!formData.code.trim()) {
            newErrors.code = "Designation code is required";
        } else {
            const codeExists = designations.some(
                (d) =>
                    d.code.toLowerCase().trim() === formData.code.toLowerCase().trim() &&
                    String(d.id) !== formData.id
            );
            if (codeExists) {
                newErrors.code = "Designation code already exists";
            }
        }

        if (!formData.name.trim()) {
            newErrors.name = "Designation title is required";
        } else {
            const nameExists = designations.some(
                (d) =>
                    d.name.toLowerCase().trim() === formData.name.toLowerCase().trim() &&
                    String(d.id) !== formData.id
            );
            if (nameExists) {
                newErrors.name = "Designation title already exists";
            }
        }
        if (!formData.departmentId) {
            newErrors.departmentId = "Department is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Custom confirm delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [desigToDelete, setDesigToDelete] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        id: "",
        code: "",
        name: "",
        departmentId: "",
    });





    useEffect(() => {
        loadDesignations();
        loadDepartments();
    }, [loadDesignations, loadDepartments]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);



    const departmentOptions = useMemo(() => {
        return departments.map(d => ({ value: String(d.id), label: d.name }));
    }, [departments]);


    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredDesigs = useMemo(() => {
        return designations.filter(d =>
            d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [designations, searchTerm]);

    const totalPages = Math.ceil(filteredDesigs.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedDesigs = filteredDesigs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = () => {
        setEditMode(false);
        setFormData({
            id: "",
            code: "",
            name: "",
            departmentId: departments?.[0]?.id ? String(departments[0].id) : "",
        });
        setErrors({});
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((desig: any) => {
        setEditMode(true);
        setFormData({
            id: String(desig.id),
            code: desig.code,
            name: desig.name,
            departmentId: String(desig.departmentId),
        });
        setErrors({});
        setShowFormModal(true);
    }, []);

    const handleOpenView = useCallback((desig: any) => {
        setSelectedDesig(desig);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setDesigToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (desigToDelete !== null) {
            try {
                await removeDesignation(desigToDelete);
                toast.success("Designation deleted successfully!");
            } catch (err: any) {
                toast.error(err.message || "Failed to delete designation");
            } finally {
                setShowDeleteModal(false);
                setDesigToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
        if (errors[name as keyof FormErrors]) {
            setErrors((prev: any) => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        try {
            if (editMode) {
                await editDesignation(Number(formData.id), { code: formData.code, name: formData.name, departmentId: Number(formData.departmentId) });
                toast.success("Designation updated successfully!");
            } else {
                await addDesignation({ code: formData.code, name: formData.name, departmentId: Number(formData.departmentId) });
                toast.success("Designation created successfully!");
            }
            await loadDesignations();
            setShowFormModal(false);
            setErrors({});
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
                                <h2 className="page-title">Designation Management</h2>
                                <div className="page-breadcrumb">Home / HR Management / Designations</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search designations..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                {canCreateDepartment && <CustomButton
                                    text="Add Designation"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />}
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Designations Table */}
                <div className="master-table-body">

                    {loading && designations.length === 0 ? (
                        <div className="text-center p-5">
                            <Spinner animation="border" variant="primary" />
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Designation Code</th>
                                        <th>Designation Title</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedDesigs.length > 0 ? (
                                        paginatedDesigs.map((desig, index) => (
                                            <tr key={desig.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{desig.code}</td>
                                                <td className="master-data-cell">{desig.name}</td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(desig)} />
                                                        {canEditDepartment && <EditButton onClick={() => handleOpenEdit(desig)} />}
                                                        {canDeleteDepartment && <DeleteButton onClick={() => triggerDelete(desig.id)} />}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="text-center p-4">No designations found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
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

                {/* Add/Edit Modal */}
                <Modal show={showFormModal} onHide={() => {
                    setShowFormModal(false)
                    setErrors({})
                }} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>{editMode ? "Edit Designation" : "Add New Designation"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <TextInput
                                        label="Designation Code"
                                        name="code"
                                        value={formData.code}
                                        placeholder="e.g. MGR"
                                        required
                                        onChange={handleChange}
                                        error={errors.code}

                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Designation Title"
                                        name="name"
                                        value={formData.name}
                                        placeholder="e.g. Manager"
                                        required
                                        onChange={handleChange}
                                        error={errors.name}

                                    />
                                </Col>
                                <Col md={12}>
                                    <SelectInput
                                        required
                                        label="Department"
                                        name="departmentId"
                                        value={formData.departmentId}
                                        options={departmentOptions}
                                        onChange={handleChange}
                                        error={errors.departmentId}
                                    />
                                </Col>
                            </Row>
                        </Modal.Body>
                        <Modal.Footer>
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                onClick={() => {
                                    setFormData({
                                        id: formData.id,
                                        code: "",
                                        name: "",
                                        departmentId: "",
                                    });
                                    setErrors({});
                                }}
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
                    modalTitle="Designation Details"
                    avatarText={selectedDesig ? selectedDesig.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedDesig ? selectedDesig.name : ""}
                    headerSubtitle={selectedDesig ? `Code: ${selectedDesig.code}` : ""}
                    sections={selectedDesig ? [
                        {
                            fields: [
                                { label: "Designation Code", value: selectedDesig.code },
                                { label: "Designation Title", value: selectedDesig.name },
                                { label: "Designation ID", value: <span className="text-muted font-monospace small">{String(selectedDesig.id)}</span>, xs: 12 }
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
                    message="Are you sure you want to delete this designation?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default DesignationList;
