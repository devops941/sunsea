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
import { useColors } from "../../../hooks/useColors";
import { colorService } from "../../../services/colorService";

const ITEMS_PER_PAGE = 10;

// ─── Compact color picker — rendered OUTSIDE the main component
// so it never re-mounts on state change (fixes the auto-close bug)
const ColorPickerField = ({
    label,
    colorValue,
    onChange,
    errorMsg,
}: {
    label: string;
    colorValue: string;
    onChange: (hex: string) => void;
    errorMsg?: string;
}) => (
    <div style={{ flex: 1 }}>
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "6px 12px",
                border: `1.5px solid ${errorMsg ? "#dc3545" : "#dee2e6"}`,
                borderRadius: "8px",
                background: "#fff",
                height: "42px",
            }}
        >
            {/* Native input — visible & full size so browser keeps picker open */}
            <input
                type="color"
                value={colorValue || "#000000"}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "28px",
                    height: "28px",
                    padding: "1px",
                    border: "1.5px solid #dee2e6",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: "none",
                    flexShrink: 0,
                }}
            />
            {/* Circle swatch */}
            <div
                style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    backgroundColor: colorValue || "#e9ecef",
                    border: "1.5px solid #dee2e6",
                    flexShrink: 0,
                }}
            />
            {/* Label + hex */}
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <span style={{ fontSize: "10px", color: "#adb5bd", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    {label}
                </span>
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 700, color: "#343a40" }}>
                    {colorValue || "—"}
                </span>
            </div>
        </div>
        {errorMsg && (
            <div style={{ fontSize: "11px", color: "#dc3545", marginTop: "4px", paddingLeft: "2px" }}>
                {errorMsg}
            </div>
        )}
    </div>
);

const ColorList: React.FC = () => {
    const { colors, loading, error, loadColors, addColor, editColor, removeColor } = useColors();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedColor, setSelectedColor] = useState<any>(null);
    const [errors, setErrors] = useState({
        code: "",
        name: "",
        hexCode: "",
        hexCode2: "",
        type: "",
    });

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        id: "",
        code: "",
        name: "",
        hexCode: "",
        hexCode2: "",
        type: "",
        status: "ACTIVE",
    });

    useEffect(() => {
        loadColors("");
    }, []);

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setCurrentPage(1);
        loadColors(value);
    };

    const totalPages = Math.ceil(colors.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedColors = colors.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = async () => {
        setEditMode(false);
        let nextCode = "";
        try {
            nextCode = await colorService.fetchNextId();
        } catch (err) {
            console.error("Failed to fetch next color code:", err);
        }
        setFormData({ id: "", code: nextCode, name: "", hexCode: "", hexCode2: "", type: "", status: "ACTIVE" });
        setErrors({ code: "", name: "", hexCode: "", hexCode2: "", type: "" });
        setShowFormModal(true);
    };

    const handleOpenEdit = useCallback((color: any) => {
        console.log(color, "salk")
        setEditMode(true);
        setFormData({
            id: String(color.id),
            code: color.code,
            name: color.name,
            hexCode: color.hexCode || "",
            hexCode2: color.hexCode2 || "",
            type: color.colorType || "",
            status: color.status,
        });
        setErrors({ code: "", name: "", hexCode: "", hexCode2: "", type: "" });
        setShowFormModal(true);
    }, []);

    const handleOpenView = useCallback((color: any) => {
        setSelectedColor(color);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await removeColor(itemToDelete);
                toast.success("Color deleted successfully!");
            } catch (err: any) {
                toast.error("Failed to delete color as it is already assigned in product");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    const validateForm = () => {
        const newErrors = { code: "", name: "", hexCode: "", hexCode2: "", type: "" };
        let isValid = true;

        if (!formData.code.trim()) { newErrors.code = "color code is required"; isValid = false; }
        if (!formData.name.trim()) { newErrors.name = "color name is required"; isValid = false; }
        if (!formData.type.trim()) { newErrors.type = "type is required"; isValid = false; }
        if (!formData.hexCode.trim()) { newErrors.hexCode = "color 1 is required"; isValid = false; }
        if (formData.type === "mc" && !formData.hexCode2.trim()) {
            newErrors.hexCode2 = "color 2 is required";
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
            ...(name === "type" && value === "sc" ? { hexCode2: "" } : {}),
        }));
        setErrors(prev => ({ ...prev, [name]: "" }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        try {
            const payload = {
                code: formData.code,
                name: formData.name,
                hexCode: formData.hexCode,
                hexCode2: formData.type === "mc" ? formData.hexCode2 : undefined,
                type: formData.type,
                status: formData.status,
            };
            if (editMode) {
                await editColor(Number(formData.id), payload);
                toast.success("Color updated successfully!");
            } else {
                await addColor(payload);
                toast.success("Color created successfully!");
            }
            setShowFormModal(false);
        } catch (err: any) {
            toast.error(err || "Operation failed");
        }
    };

    const handleClear = () => {
        setFormData({ id: formData.id, code: formData.code, name: "", hexCode: "", hexCode2: "", type: "", status: "ACTIVE" });
        setErrors({ code: "", name: "", hexCode: "", hexCode2: "", type: "" });
    };

    const handleCloseFormModal = () => {
        setShowFormModal(false);
        setErrors({ code: "", name: "", hexCode: "", hexCode2: "", type: "" });
    };

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Color Management</h2>
                                <div className="page-breadcrumb">Home / Product Master / Colors</div>
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
                                <CustomButton text="Add Color" icon={FaPlus} onClick={handleOpenAdd} />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Colors Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && colors.length === 0 ? (
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
                                        <th>Color</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedColors.length > 0 ? (
                                        paginatedColors.map((color: any, index: number) => (
                                            <tr key={color.id} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{color.code}</td>
                                                <td className="master-data-cell">{color.name}</td>
                                                <td className="master-data-cell">
                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                        {color.hexCode && (
                                                            <div title={color.hexCode} style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: color.hexCode, border: "1px solid #ccc", flexShrink: 0 }} />
                                                        )}
                                                        {color.hexCode2 && (
                                                            <div title={color.hexCode2} style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: color.hexCode2, border: "1px solid #ccc", flexShrink: 0 }} />
                                                        )}
                                                        <span style={{ fontSize: "12px", color: "#555", fontFamily: "monospace" }}>
                                                            {color.hexCode}{color.hexCode2 ? ` / ${color.hexCode2}` : ""}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="master-data-cell">
                                                    <span className={`status-pill status-pill--${color.status === "ACTIVE" ? "active" : "inactive"}`}>
                                                        {color.status}
                                                    </span>
                                                </td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(color)} />
                                                        <EditButton onClick={() => handleOpenEdit(color)} />
                                                        <DeleteButton onClick={() => triggerDelete(color.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center p-4">No colors found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination-wrap">
                                <button className="pagination-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">Page {currentPage} of {totalPages}</div>
                                <button className="pagination-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Add / Edit Modal */}
                <Modal show={showFormModal} onHide={handleCloseFormModal} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>{editMode ? "Edit Color" : "Add New Color"}</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <TextInput
                                        label="Color Code"
                                        name="code"
                                        value={formData.code}
                                        placeholder="e.g. BLK"
                                        required
                                        onChange={handleChange}
                                        disabled
                                        error={errors.code}
                                    />
                                </Col>

                                <Col md={12}>
                                    <TextInput
                                        label="Color Name"
                                        name="name"
                                        value={formData.name}
                                        placeholder="e.g. Black"
                                        required
                                        onChange={handleChange}
                                        error={errors.name}
                                    />
                                </Col>

                                <Col md={12}>
                                    <SelectInput
                                        label="Color Type"
                                        name="type"
                                        value={formData.type}
                                        options={[
                                            { value: "sc", label: "Single Color" },
                                            { value: "mc", label: "Multi Color" },
                                        ]}
                                        onChange={handleChange}
                                        error={errors.type}
                                        defaultOptionLabel="Select color type"
                                    />
                                </Col>

                                {/* Color picker(s) — side by side in one row */}
                                {formData.type && (
                                    <Col md={12}>
                                        <label className="form-label fw-semibold" style={{ marginBottom: "8px", display: "block", fontSize: "14px" }}>
                                            {formData.type === "mc" ? "Select Colors" : "Select Color"}
                                        </label>

                                        <div style={{ display: "flex", gap: "10px" }}>
                                            {/* Color 1 — always shown */}
                                            <ColorPickerField
                                                label={formData.type === "mc" ? "Color 1" : "Color"}
                                                colorValue={formData.hexCode}
                                                onChange={(hex) => {
                                                    setFormData(prev => ({ ...prev, hexCode: hex }));
                                                    setErrors(prev => ({ ...prev, hexCode: "" }));
                                                }}
                                                errorMsg={errors.hexCode}
                                            />

                                            {/* Color 2 — only for multi color */}
                                            {formData.type === "mc" && (
                                                <ColorPickerField
                                                    label="Color 2"
                                                    colorValue={formData.hexCode2}
                                                    onChange={(hex) => {
                                                        setFormData(prev => ({ ...prev, hexCode2: hex }));
                                                        setErrors(prev => ({ ...prev, hexCode2: "" }));
                                                    }}
                                                    errorMsg={errors.hexCode2}
                                                />
                                            )}
                                        </div>

                                        {/* Gradient preview strip — only when both colors picked */}
                                        {formData.type === "mc" && formData.hexCode && formData.hexCode2 && (
                                            <div
                                                style={{
                                                    marginTop: "10px",
                                                    height: "6px",
                                                    borderRadius: "999px",
                                                    background: `linear-gradient(to right, ${formData.hexCode}, ${formData.hexCode2})`,
                                                }}
                                            />
                                        )}
                                    </Col>
                                )}

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
                            <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} />
                            <div className="ms-2">
                                <CustomButton text={editMode ? "Update" : "Save"} icon={FaSave} type="submit" disabled={loading} />
                            </div>
                        </Modal.Footer>
                    </form>
                </Modal>

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Color Details"
                    avatarText={selectedColor ? selectedColor.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedColor ? selectedColor.name : ""}
                    headerSubtitle={selectedColor ? `Code: ${selectedColor.code}` : ""}
                    sections={
                        selectedColor
                            ? [{
                                fields: [
                                    { label: "Color Name", value: selectedColor.name },
                                    { label: "Color Code", value: selectedColor.code },
                                    { label: "Color Type", value: selectedColor.type === "mc" ? "Multi Color" : "Single Color" },
                                    {
                                        label: "Color 1",
                                        value: selectedColor.hexCode ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <div style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: selectedColor.hexCode, border: "1px solid #ccc" }} />
                                                {selectedColor.hexCode}
                                            </div>
                                        ) : "N/A",
                                    },
                                    ...(selectedColor.type === "mc" ? [{
                                        label: "Color 2",
                                        value: selectedColor.hexCode2 ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <div style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: selectedColor.hexCode2, border: "1px solid #ccc" }} />
                                                {selectedColor.hexCode2}
                                            </div>
                                        ) : "N/A",
                                    }] : []),
                                    { label: "Status", value: selectedColor.status },
                                    { label: "Created Date", value: new Date(selectedColor.createdAt).toLocaleString() },
                                    { label: "Updated Date", value: new Date(selectedColor.updatedAt).toLocaleString() },
                                ],
                            }]
                            : []
                    }
                />

                {/* Delete Confirm Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this color?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default ColorList;