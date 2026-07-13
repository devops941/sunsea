import React, { useState, useEffect, useCallback } from "react";
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
import { useCategories } from "../../../hooks/useCategories";
import { categoryService } from "../../../services/categoryService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

const ITEMS_PER_PAGE = 10;

const CategoryList: React.FC = () => {
    const { categories, loading, error, loadCategories, addCategory, editCategory, removeCategory } = useCategories();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [errors, setErrors] = useState({
        code: "",
        name: "",
    });

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
        loadCategories("");
    }, []);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setCurrentPage(1);
        loadCategories(value);
    };



    const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedCategories = categories.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = async () => {
        setEditMode(false);

        let nextCode = "";
        try {
            nextCode = await categoryService.fetchNextId();
        } catch (error) {
            console.error("Failed to fetch next category code:", error);
        }

        setFormData({
            id: "",
            code: nextCode,
            name: "",
            description: "",
            status: "ACTIVE",
        });
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((category: any) => {
        setEditMode(true);
        setFormData({
            id: String(category.id),
            code: category.code,
            name: category.name,
            description: category.description || "",
            status: category.status,
        });
        setShowFormModal(true);
    }, []);

    const validateForm = () => {
        const newErrors = {
            code: "",
            name: "",
        };

        let isValid = true;

        if (!formData.code.trim()) {
            newErrors.code = "category code is required";
            isValid = false;
        }

        if (!formData.name.trim()) {
            newErrors.name = "category name is required";
            isValid = false;
        } else if (/^[0-9]+$/.test(formData.name.trim())) {
            newErrors.name = "Category name cannot be only numbers";
            isValid = false;
        }

        setErrors(newErrors);

        return isValid;
    };

    const handleOpenView = useCallback((category: any) => {
        setSelectedCategory(category);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await removeCategory(itemToDelete);
                toast.success("Category deleted successfully!");
            } catch (err: any) {
                toast.error("Failed to delete category! as it is already assigned in product");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));

        setErrors((prev) => ({
            ...prev,
            [name]: "",
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) {
            return;
        }
        try {
            const payload = {
                code: formData.code,
                name: formData.name,
                description: formData.description,
                status: formData.status
            };

            if (editMode) {
                await editCategory(Number(formData.id), payload);
                toast.success("Category updated successfully!");
            } else {
                await addCategory(payload);
                toast.success("Category created successfully!");
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
                                <h2 className="page-title">Category Management</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search by code or name..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Category"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Categories Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && categories.length === 0 ? (
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
                                        <th>Status</th>
                                        <th>Created Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedCategories.length > 0 ? (
                                        paginatedCategories.map((category: any, index: number) => (
                                            <tr key={category.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{category.code}</td>
                                                <td className="master-data-cell">{category.name}</td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={category.status} />
                                                </td>
                                                <td className="master-data-cell">{new Date(category.createdAt).toLocaleDateString()}</td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(category)} />
                                                        <EditButton onClick={() => handleOpenEdit(category)} />
                                                        <DeleteButton onClick={() => triggerDelete(category.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center p-4">No categories found.</td>
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
                    setErrors({
                        code: "",
                        name: "",
                    });
                    setShowFormModal(false);
                }} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>{editMode ? "Edit Category" : "Add New Category"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <TextInput
                                        label="Category Code"
                                        name="code"
                                        value={formData.code}
                                        placeholder="e.g. CAT-01"
                                        required
                                        onChange={handleChange}
                                        error={errors.code}
                                        disabled
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Category Name"
                                        name="name"
                                        value={formData.name}
                                        placeholder="e.g. Electronics"
                                        required
                                        onChange={handleChange}
                                        error={errors.name}
                                    // onKeyDown={(e) => {
                                    //     if (/\d/.test(e.key)) {
                                    //         e.preventDefault();
                                    //     }
                                    // }}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Description"
                                        name="description"
                                        value={formData.description}
                                        placeholder="Enter category description"
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
                                    code: "",
                                    name: "",
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
                    modalTitle="Category Details"
                    avatarText={selectedCategory ? selectedCategory.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedCategory ? selectedCategory.name : ""}
                    headerSubtitle={selectedCategory ? `Code: ${selectedCategory.code}` : ""}
                    sections={selectedCategory ? [
                        {
                            fields: [
                                { label: "Category Name", value: selectedCategory.name },
                                { label: "Category Code", value: selectedCategory.code },
                                { label: "Description", value: selectedCategory.description || "N/A", xs: 12 },
                                { label: "Status", value: selectedCategory.status },
                                { label: "Created Date", value: new Date(selectedCategory.createdAt).toLocaleString() },
                                { label: "Updated Date", value: new Date(selectedCategory.updatedAt).toLocaleString() },
                            ]
                        }
                    ] : []}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this category?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default CategoryList;
