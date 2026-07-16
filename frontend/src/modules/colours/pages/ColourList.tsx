import React, { useState } from "react";
import { Container, Row, Col, Modal } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaSave, FaEraser } from "react-icons/fa";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

const ITEMS_PER_PAGE = 5;

const ColourList: React.FC = () => {
    const [colours, setColours] = useState([
        { id: 1, colourCode: "RED", name: "Red", hexCode: "#EF4444", status: "Active" },
        { id: 2, colourCode: "BLU", name: "Blue", hexCode: "#3B82F6", status: "Active" },
        { id: 3, colourCode: "GRN", name: "Green", hexCode: "#10B981", status: "Active" },
        { id: 4, colourCode: "BLK", name: "Black", hexCode: "#111827", status: "Active" },
        { id: 5, colourCode: "WHT", name: "White", hexCode: "#FFFFFF", status: "Active" },
        { id: 6, colourCode: "YLW", name: "Yellow", hexCode: "#F59E0B", status: "Inactive" },
    ]);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedColour, setSelectedColour] = useState<any>(null);

    const [formData, setFormData] = useState({
        id: "",
        colourCode: "",
        name: "",
        hexCode: "#000000",
        status: "Active",
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredColours = colours.filter(c =>
        c.colourCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.hexCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredColours.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedColours = filteredColours.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = () => {
        setEditMode(false);
        setFormData({
            id: "",
            colourCode: "",
            name: "",
            hexCode: "#000000",
            status: "Active",
        });
        setShowFormModal(true);
    };

    const handleOpenEdit = (colour: any) => {
        setEditMode(true);
        setFormData({
            id: String(colour.id),
            colourCode: colour.colourCode,
            name: colour.name,
            hexCode: colour.hexCode,
            status: colour.status,
        });
        setShowFormModal(true);
    };

    const handleOpenView = (colour: any) => {
        setSelectedColour(colour);
        setShowViewModal(true);
    };

    const handleDelete = (id: number) => {
        if (window.confirm("Are you sure you want to delete this colour?")) {
            setColours(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editMode) {
            setColours(prev =>
                prev.map(c =>
                    c.id === Number(formData.id)
                        ? { ...c, colourCode: formData.colourCode, name: formData.name, hexCode: formData.hexCode, status: formData.status }
                        : c
                )
            );
        } else {
            const newId = colours.length > 0 ? Math.max(...colours.map(c => c.id)) + 1 : 1;
            setColours(prev => [
                ...prev,
                {
                    id: newId,
                    colourCode: formData.colourCode,
                    name: formData.name,
                    hexCode: formData.hexCode,
                    status: formData.status,
                },
            ]);
        }
        setShowFormModal(false);
    };

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Colour Management</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search colours..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Colour"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Colours Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Colour Code</th>
                                    <th>Colour Name</th>
                                    <th>Hex Preview</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedColours.length > 0 ? (
                                    paginatedColours.map(colour => (
                                        <tr key={colour.id} className="master-data-row">
                                            <td className="master-data-cell">{colour.id}</td>
                                            <td className="master-data-cell">{colour.colourCode}</td>
                                            <td className="master-data-cell">{colour.name}</td>
                                            <td className="master-data-cell">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span
                                                        className="d-inline-block rounded-circle border"
                                                        style={{ width: "24px", height: "24px", backgroundColor: colour.hexCode }}
                                                    />
                                                    <code>{colour.hexCode}</code>
                                                </div>
                                            </td>
                                            <td className="master-data-cell">
                                                <span className={`status-pill status-pill--${colour.status === "Active" ? "active" : "inactive"}`}>
                                                    {colour.status}
                                                </span>
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(colour)} />
                                                    <EditButton onClick={() => handleOpenEdit(colour)} />
                                                    <DeleteButton onClick={() => handleDelete(colour.id)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="text-center p-4">No colours found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

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
                        <Modal.Title>{editMode ? "Edit Colour" : "Add New Colour"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <TextInput
                                        label="Colour Code"
                                        name="colourCode"
                                        value={formData.colourCode}
                                        placeholder="e.g. RED"
                                        required
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Colour Name"
                                        name="name"
                                        value={formData.name}
                                        placeholder="e.g. Red"
                                        required
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Hex Code"
                                        name="hexCode"
                                        type="color"
                                        value={formData.hexCode}
                                        required
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <SelectInput
                                        label="Status"
                                        name="status"
                                        value={formData.status}
                                        options={[
                                            { value: "Active", label: "Active" },
                                            { value: "Inactive", label: "Inactive" },
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
                                variant="secondary"
                                onClick={() => setFormData({
                                    id: formData.id,
                                    colourCode: "",
                                    name: "",
                                    hexCode: "#000000",
                                    status: "Active",
                                })}
                            />
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
                <Modal show={showViewModal} onHide={() => setShowViewModal(false)} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>Colour Details</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {selectedColour && (
                            <div className="customer-view-section">
                                <Row className="g-3">
                                    <Col md={12}>
                                        <div className="info-item">
                                            <label>Colour ID</label>
                                            <p>{selectedColour.id}</p>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="info-item">
                                            <label>Colour Code</label>
                                            <p>{selectedColour.colourCode}</p>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="info-item">
                                            <label>Colour Name</label>
                                            <p>{selectedColour.name}</p>
                                        </div>
                                    </Col>
                                    <Col md={12}>
                                        <div className="info-item">
                                            <label>Hex Code Preview</label>
                                            <div className="d-flex align-items-center gap-2 mt-1">
                                                <span
                                                    className="d-inline-block rounded-circle border"
                                                    style={{ width: "32px", height: "32px", backgroundColor: selectedColour.hexCode }}
                                                />
                                                <p className="mb-0 fw-bold">{selectedColour.hexCode}</p>
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="info-item">
                                            <label>Status</label>
                                            <p>{selectedColour.status}</p>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        )}
                    </Modal.Body>
                </Modal>
            </Container>
        </div>
    );
};

export default ColourList;
