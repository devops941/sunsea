import React, { useState } from "react";
import { Container, Row, Col, Modal } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaSave, FaEraser } from "react-icons/fa";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

const ITEMS_PER_PAGE = 5;

const UomList: React.FC = () => {
    const [uoms, setUoms] = useState([
        { id: 1, uomCode: "KGS", name: "Kilogram", baseUnit: "Gram", convFactor: 1000, status: "Active" },
        { id: 2, uomCode: "NOS", name: "Numbers", baseUnit: "Piece", convFactor: 1, status: "Active" },
        { id: 3, uomCode: "LTR", name: "Liter", baseUnit: "Milliliter", convFactor: 1000, status: "Active" },
        { id: 4, uomCode: "BOX", name: "Box (24 Pcs)", baseUnit: "Piece", convFactor: 24, status: "Active" },
        { id: 5, uomCode: "MTR", name: "Meter", baseUnit: "Centimeter", convFactor: 100, status: "Inactive" },
    ]);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedUom, setSelectedUom] = useState<any>(null);

    const [formData, setFormData] = useState({
        id: "",
        uomCode: "",
        name: "",
        baseUnit: "",
        convFactor: "1",
        status: "Active",
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredUoms = uoms.filter(u =>
        u.uomCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.baseUnit.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredUoms.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedUoms = filteredUoms.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = () => {
        setEditMode(false);
        setFormData({
            id: "",
            uomCode: "",
            name: "",
            baseUnit: "",
            convFactor: "1",
            status: "Active",
        });
        setShowFormModal(true);
    };

    const handleOpenEdit = (uom: any) => {
        setEditMode(true);
        setFormData({
            id: String(uom.id),
            uomCode: uom.uomCode,
            name: uom.name,
            baseUnit: uom.baseUnit,
            convFactor: String(uom.convFactor),
            status: uom.status,
        });
        setShowFormModal(true);
    };

    const handleOpenView = (uom: any) => {
        setSelectedUom(uom);
        setShowViewModal(true);
    };

    const handleDelete = (id: number) => {
        if (window.confirm("Are you sure you want to delete this UOM?")) {
            setUoms(prev => prev.filter(u => u.id !== id));
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
            setUoms(prev =>
                prev.map(u =>
                    u.id === Number(formData.id)
                        ? { ...u, uomCode: formData.uomCode, name: formData.name, baseUnit: formData.baseUnit, convFactor: Number(formData.convFactor), status: formData.status }
                        : u
                )
            );
        } else {
            const newId = uoms.length > 0 ? Math.max(...uoms.map(u => u.id)) + 1 : 1;
            setUoms(prev => [
                ...prev,
                {
                    id: newId,
                    uomCode: formData.uomCode,
                    name: formData.name,
                    baseUnit: formData.baseUnit,
                    convFactor: Number(formData.convFactor),
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
                                <h2 className="page-title">UOM Management</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search UOMs..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add UOM"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* UOM Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>UOM Code</th>
                                    <th>UOM Name</th>
                                    <th>Base Unit</th>
                                    <th>Conversion Factor</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedUoms.length > 0 ? (
                                    paginatedUoms.map(uom => (
                                        <tr key={uom.id} className="master-data-row">
                                            <td className="master-data-cell">{uom.id}</td>
                                            <td className="master-data-cell">{uom.uomCode}</td>
                                            <td className="master-data-cell">{uom.name}</td>
                                            <td className="master-data-cell">{uom.baseUnit}</td>
                                            <td className="master-data-cell">{uom.convFactor}</td>
                                            <td className="master-data-cell">
                                                <span className={`status-pill status-pill--${uom.status === "Active" ? "active" : "inactive"}`}>
                                                    {uom.status}
                                                </span>
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(uom)} />
                                                    <EditButton onClick={() => handleOpenEdit(uom)} />
                                                    <DeleteButton onClick={() => handleDelete(uom.id)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center p-4">No UOMs found.</td>
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
                        <Modal.Title>{editMode ? "Edit UOM" : "Add New UOM"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <TextInput
                                        label="UOM Code"
                                        name="uomCode"
                                        value={formData.uomCode}
                                        placeholder="e.g. KGS"
                                        required
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="UOM Name"
                                        name="name"
                                        value={formData.name}
                                        placeholder="e.g. Kilogram"
                                        required
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Base Unit Reference"
                                        name="baseUnit"
                                        value={formData.baseUnit}
                                        placeholder="e.g. Gram"
                                        required
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Conversion Factor (to Base)"
                                        name="convFactor"
                                        type="number"
                                        value={formData.convFactor}
                                        placeholder="e.g. 1000"
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
                                    uomCode: "",
                                    name: "",
                                    baseUnit: "",
                                    convFactor: "1",
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
                        <Modal.Title>UOM Details</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {selectedUom && (
                            <div className="customer-view-section">
                                <Row className="g-3">
                                    <Col md={12}>
                                        <div className="info-item">
                                            <label>UOM ID</label>
                                            <p>{selectedUom.id}</p>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="info-item">
                                            <label>UOM Code</label>
                                            <p>{selectedUom.uomCode}</p>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="info-item">
                                            <label>UOM Name</label>
                                            <p>{selectedUom.name}</p>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="info-item">
                                            <label>Base Unit Reference</label>
                                            <p>{selectedUom.baseUnit}</p>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="info-item">
                                            <label>Conversion Factor</label>
                                            <p>{selectedUom.convFactor}</p>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="info-item">
                                            <label>Status</label>
                                            <p>{selectedUom.status}</p>
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

export default UomList;
