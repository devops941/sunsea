import React, { useState, useEffect, useCallback } from "react";
import { FaSearch, FaPlus, FaSave, FaEraser } from "react-icons/fa";
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
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CommonModal from "../../../components/ui/Modal/CommonModal";

const ITEMS_PER_PAGE = 10;

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
                border: `1.5px solid ${errorMsg ? "#dc3545" : "#e2e8f0"}`,
                borderRadius: "8px",
                background: "#fff",
                height: "42px",
            }}
        >
            <input
                type="color"
                value={colorValue || "#000000"}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "28px",
                    height: "28px",
                    padding: "1px",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: "none",
                    flexShrink: 0,
                }}
            />
            <div
                style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    backgroundColor: colorValue || "#f8fafc",
                    border: "1.5px solid #e2e8f0",
                    flexShrink: 0,
                }}
            />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    {label}
                </span>
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 700, color: "#334155" }}>
                    {colorValue || "—"}
                </span>
            </div>
        </div>
        {errorMsg && (
            <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px", paddingLeft: "2px" }}>
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
    const [errors, setErrors] = useState({ code: "", name: "", hexCode: "", hexCode2: "", type: "" });
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
    }, [loadColors]);

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
        setEditMode(true);
        setFormData({
            id: String(color.id),
            // Revert to correct mapped frontend fields
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
            const payload: any = {
                code: formData.code,
                name: formData.name,
                hexCode: formData.hexCode,
                hexCode2: formData.type === "mc" ? formData.hexCode2 : undefined,
                colorType: formData.type,
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

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        // Revert to correct mapped frontend fields
        { header: "Code", render: (color) => color.code },
        { header: "Name", render: (color) => color.name },
        {
            header: "Color",
            render: (color) => (
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
            )
        },
        { header: "Status", render: (color) => <StatusBadge status={color.status} />, align: "center" },
        {
            header: "Actions",
            render: (color) => (
                <div className="flex items-center gap-2 justify-end">
                    <ViewButton onClick={() => handleOpenView(color)} />
                    <EditButton onClick={() => handleOpenEdit(color)} />
                    <DeleteButton onClick={() => triggerDelete(color.id)} />
                </div>
            ),
            align: "left"
        }
    ];

    return (
        <div>
            <div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Color Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search colors..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            <CustomButton text="Add Color" icon={FaPlus} onClick={handleOpenAdd} />
                        </div>
                    </div>

                    {/* Colors Table */}
                    <div className="p-0">
                        <DataTable
                            columns={columns}
                            data={paginatedColors}
                            rowKey={(row) => row.id}
                            loading={loading}
                            emptyMessage="No colors found."
                            pagination={totalPages > 1 ? {
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage
                            } : undefined}
                        />
                    </div>
                </div>

                {/* Add/Edit Modal */}
                <CommonModal
                    show={showFormModal}
                    onHide={() => setShowFormModal(false)}
                    title={editMode ? "Edit Color" : "Add New Color"}
                    overflowVisible={true}
                    footer={
                        <div className="flex items-center justify-end gap-2 w-full">
                            <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} />
                            <CustomButton text={editMode ? "Update" : "Save"} icon={FaSave} onClick={handleSubmit} disabled={loading} />
                        </div>
                    }
                >
                    <form onSubmit={handleSubmit} className="space-y-4 p-2">
                        <div className="grid grid-cols-1 gap-4">
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
                            <TextInput
                                label="Color Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Black"
                                required
                                onChange={handleChange}
                                error={errors.name}
                            />
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

                            {/* Color picker(s) */}
                            {formData.type && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        {formData.type === "mc" ? "Select Colors" : "Select Color"}
                                    </label>
                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <ColorPickerField
                                            label={formData.type === "mc" ? "Color 1" : "Color"}
                                            colorValue={formData.hexCode}
                                            onChange={(hex) => {
                                                setFormData(prev => ({ ...prev, hexCode: hex }));
                                                setErrors(prev => ({ ...prev, hexCode: "" }));
                                            }}
                                            errorMsg={errors.hexCode}
                                        />
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
                                </div>
                            )}

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
                        </div>
                    </form>
                </CommonModal>

                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Color Details"
                    avatarText={selectedColor ? selectedColor.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedColor ? selectedColor.name : ""}
                    headerSubtitle={selectedColor ? `Code: ${selectedColor.code}` : ""}
                    sections={selectedColor ? [{
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
                            { label: "Status", value: <StatusBadge status={selectedColor.status} /> },
                            { label: "Created Date", value: new Date(selectedColor.createdAt).toLocaleString() },
                            { label: "Updated Date", value: new Date(selectedColor.updatedAt).toLocaleString() },
                        ],
                    }] : []}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this color?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default ColorList;