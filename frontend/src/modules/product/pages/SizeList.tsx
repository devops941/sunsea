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
import { useSizes } from "../../../hooks/useSizes";
import { sizeService } from "../../../services/sizeService";

const ITEMS_PER_PAGE = 10;

const SizeList: React.FC = () => {
    const { sizes, loading, error, loadSizes, addSize, editSize, removeSize } = useSizes();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedSize, setSelectedSize] = useState<any>(null);
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
        loadSizes(""); // initial load with no search
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
        setShowFormModal(true);
    }, []);

    const validateForm = () => {
        const newErrors = {
            code: "",
            name: "",
        };

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

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Size Management</h2>
                                <div className="page-breadcrumb">Home / Product Master / Sizes</div>
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
                                    text="Add Size"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Sizes Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && sizes.length === 0 ? (
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
                                    {paginatedSizes.length > 0 ? (
                                        paginatedSizes.map((size: any, index: number) => (
                                            <tr key={size.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{size.code}</td>
                                                <td className="master-data-cell">{size.name}</td>
                                                <td className="master-data-cell">
                                                    <span className={`status-pill status-pill--${size.status === "ACTIVE" ? "active" : "inactive"}`}>
                                                        {size.status}
                                                    </span>
                                                </td>
                                                <td className="master-data-cell">{new Date(size.createdAt).toLocaleDateString()}</td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(size)} />
                                                        <EditButton onClick={() => handleOpenEdit(size)} />
                                                        <DeleteButton onClick={() => triggerDelete(size.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center p-4">No sizes found.</td>
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
                    setShowFormModal(false);
                    setErrors({
                        code: "",
                        name: "",
                    });
                }} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>{editMode ? "Edit Size" : "Add New Size"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
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
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Size Name"
                                        name="name"
                                        value={formData.name}
                                        placeholder="e.g. Extra Large"
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
                                        placeholder="Enter size description"
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
                                    code: formData.code,
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
                    modalTitle="Size Details"
                    avatarText={selectedSize ? selectedSize.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedSize ? selectedSize.name : ""}
                    headerSubtitle={selectedSize ? `Code: ${selectedSize.code}` : ""}
                    sections={selectedSize ? [
                        {
                            fields: [
                                { label: "Size Name", value: selectedSize.name },
                                { label: "Size Code", value: selectedSize.code },
                                { label: "Description", value: selectedSize.description || "N/A", xs: 12 },
                                { label: "Status", value: selectedSize.status },
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
            </Container>
        </div>
    );
};

export default SizeList;
