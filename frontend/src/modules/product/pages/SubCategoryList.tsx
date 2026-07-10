import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Modal, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { useSubCategories } from "../../../hooks/useSubCategories";
import { useCategories } from "../../../hooks/useCategories";
import { subCategoryService } from "../../../services/subCategoryService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

const ITEMS_PER_PAGE = 10;

const SubCategoryList: React.FC = () => {
    const { subCategories, loading, error, loadSubCategories, addSubCategory, editSubCategory, removeSubCategory } = useSubCategories();
    const { categories, loadCategories } = useCategories();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedSubCategory, setSelectedSubCategory] = useState<any>(null);
    const [errors, setErrors] = useState({
        code: "",
        name: "",
        parentCategoryId: "",
    });

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        id: "",
        code: "",
        name: "",
        parentCategoryId: "",
        description: "",
        status: "ACTIVE",
    });

    useEffect(() => {
        loadSubCategories();
        loadCategories({ isActive: true });
    }, [loadCategories]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setCurrentPage(1);

        loadSubCategories({
            search: value,
        });
    };

    const validateForm = () => {
        const newErrors = {
            code: "",
            name: "",
            parentCategoryId: "",
        };

        let isValid = true;

        if (!formData.parentCategoryId) {
            newErrors.parentCategoryId = "Parent category is required";
            isValid = false;
        }

        if (!formData.code.trim()) {
            newErrors.code = "Code is required";
            isValid = false;
        }

        if (!formData.name.trim()) {
            newErrors.name = "Name is required";
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };



    const totalPages = Math.ceil(subCategories.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedSubCategories = subCategories.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const categoryOptions = useMemo(() => {
        return [
            { value: "", label: "Select Parent Category" },
            ...categories.map((cat: any) => ({
                value: String(cat.id),
                label: `${cat.name} (${cat.code})`
            })),
        ];
    }, [categories]);

    const handleOpenAdd = async () => {
        setEditMode(false);

        let nextCode = "";
        try {
            nextCode = await subCategoryService.fetchNextId();
        } catch (error) {
            console.error("Failed to fetch next sub category code:", error);
        }

        setFormData({
            id: "",
            code: nextCode,
            name: "",
            parentCategoryId: "",
            description: "",
            status: "ACTIVE",
        });
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((subCat: any) => {
        setEditMode(true);
        setFormData({
            id: String(subCat.id),
            code: subCat.code,
            name: subCat.name,
            parentCategoryId: String(subCat.parentCategoryId),
            description: subCat.description || "",
            status: subCat.status,
        });
        setShowFormModal(true);
    }, []);

    const handleOpenView = useCallback((subCat: any) => {
        setSelectedSubCategory(subCat);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await removeSubCategory(itemToDelete);
                toast.success("Sub-category deleted successfully!");
            } catch (err: any) {
                toast.error("Failed to delete sub-category as it is already assigned in product");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === "name") {
            if (!/^[A-Za-z\s]*$/.test(value)) {
                return;
            }
        }
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
        setErrors(prev => ({
            ...prev,
            [name]: "",
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        try {
            const payload = {
                code: formData.code,
                name: formData.name,
                parentCategoryId: Number(formData.parentCategoryId),
                description: formData.description,
                status: formData.status
            };

            if (editMode) {
                await editSubCategory(Number(formData.id), payload);
                toast.success("Sub-category updated successfully!");
            } else {
                await addSubCategory(payload);
                toast.success("Sub-category created successfully!");
            }
            setShowFormModal(false);
        } catch (err: any) {
            toast.error(err || "Operation failed");
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
                                <h2 className="page-title">Sub Category Management</h2>
                                <div className="page-breadcrumb">Home / Product Master / Sub Categories</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search by code, name, or parent..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Sub Category"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Sub Categories Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && subCategories.length === 0 ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Parent Category</th>
                                        <th>Status</th>
                                        <th>Created Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSubCategories.length > 0 ? (
                                        paginatedSubCategories.map((sc: any, index: number) => (
                                            <tr key={sc.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{sc.code}</td>
                                                <td className="master-data-cell">{sc.name}</td>
                                                <td className="master-data-cell">{sc.category?.name || sc.parentCategoryId}</td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={sc.status} />
                                                </td>
                                                <td className="master-data-cell">{new Date(sc.createdAt).toLocaleDateString()}</td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(sc)} />
                                                        <EditButton onClick={() => handleOpenEdit(sc)} />
                                                        <DeleteButton onClick={() => triggerDelete(sc.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="text-center p-4">No sub-categories found.</td>
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
                <Modal show={showFormModal} onHide={() => {
                    setShowFormModal(false)
                    setErrors({
                        code: "",
                        name: "",
                        parentCategoryId: "",
                    });
                }} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>{editMode ? "Edit Sub Category" : "Add New Sub Category"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <SelectInput
                                        label="Parent Category"
                                        name="parentCategoryId"
                                        value={formData.parentCategoryId}
                                        options={categoryOptions}
                                        onChange={handleChange}
                                        required
                                        error={errors.parentCategoryId}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Sub Category Code"
                                        name="code"
                                        value={formData.code}
                                        placeholder="e.g. SC-01"
                                        required
                                        onChange={handleChange}
                                        disabled
                                        error={errors.code}

                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Sub Category Name"
                                        name="name"
                                        value={formData.name}
                                        placeholder="e.g. Mobile Phones"
                                        required
                                        onChange={handleChange}
                                        error={errors.name}

                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Description"
                                        name="description"
                                        value={formData.description}
                                        placeholder="Enter sub-category description"
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
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
                                </Col>
                            </Row>
                        </Modal.Body>
                        <Modal.Footer>
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                onClick={() => setFormData({
                                    id: formData.id,
                                    code: formData?.code,
                                    name: "",
                                    parentCategoryId: "",
                                    description: "",
                                    status: "ACTIVE",
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

                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Sub Category Details"
                    avatarText={selectedSubCategory ? selectedSubCategory.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedSubCategory ? selectedSubCategory.name : ""}
                    headerSubtitle={selectedSubCategory ? `Code: ${selectedSubCategory.code}` : ""}
                    sections={selectedSubCategory ? [
                        {
                            fields: [
                                { label: "Parent Category", value: selectedSubCategory.category?.name || selectedSubCategory.parentCategoryId },
                                { label: "Sub Category Name", value: selectedSubCategory.name },
                                { label: "Sub Category Code", value: selectedSubCategory.code },
                                { label: "Description", value: selectedSubCategory.description || "N/A", xs: 12 },
                                { label: "Status", value: selectedSubCategory.status },
                                { label: "Created Date", value: new Date(selectedSubCategory.createdAt).toLocaleString() },
                                { label: "Updated Date", value: new Date(selectedSubCategory.updatedAt).toLocaleString() },
                            ]
                        }
                    ] : []}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this sub-category?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default SubCategoryList;