import React, { useState, useEffect,useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FaSearch, FaPlus, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useDepartments } from "../../../hooks/useDepartments";
import { usePermission } from "../../../hooks/usePermission";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CommonModal from "../../../components/ui/Modal/CommonModal";

const ITEMS_PER_PAGE = 10;

const DepartmentList: React.FC = () => {
    const { departments, total, loading, error, loadDepartments, addDepartment, editDepartment, removeDepartment } = useDepartments();
    const { can } = usePermission();
    const canCreateDepartment = can("departments.create");
    const canEditDepartment = can("departments.edit");
    const canDeleteDepartment = can("departments.delete");

    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedDept, setSelectedDept] = useState<any>(null);

    // Custom confirm delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deptToDelete, setDeptToDelete] = useState<number | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [formErrors, setFormErrors] = useState<{ name?: string }>({});

    const validateForm = () => {
        const errors: { name?: string } = {};
        const name = formData.name.trim();

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
        name: "",
        description: "",
    });

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        loadDepartments(currentPage, ITEMS_PER_PAGE, debouncedSearchTerm);
    }, [loadDepartments, currentPage, debouncedSearchTerm]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedDepts = departments;

    const handleOpenAdd = () => {
        setEditMode(false);
        setFormData({ id: "", name: "", description: "" });
        setFormErrors({});
        setShowFormModal(true);
    };

    // Lets the "Add Department" sidebar link open the create modal directly.
    // The param is cleared straight away so a refresh or back-nav doesn't
    // reopen the modal, which also stops this effect from looping.
    useEffect(() => {
        if (searchParams.get("action") === "add") {
            handleOpenAdd();
            searchParams.delete("action");
            setSearchParams(searchParams, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const handleOpenEdit = useCallback((dept: any) => {
        setEditMode(true);
        setFormData({
            id: String(dept.id),
            name: dept.name,
            description: dept.description || "",
        });
        setFormErrors({});
        setShowFormModal(true);
    }, [setFormData, setFormErrors]);

    const handleOpenView = useCallback((dept: any) => {
        setSelectedDept(dept);
        setShowViewModal(true);
    }, []);

    const triggerDelete = useCallback((id: number) => {
        setDeptToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (deptToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await removeDepartment(deptToDelete);
                toast.success("Department deleted successfully!");
            } catch (err: any) {
                const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to delete department";
                toast.error(errorMessage);
            } finally {
                setShowDeleteModal(false);
                setDeptToDelete(null);
                setIsDeleting(false);
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

        if (!validateForm() || isSubmitting) {
            return;
        }
        setIsSubmitting(true);

        try {
            if (editMode) {
                await editDepartment(Number(formData.id), { name: formData.name.trim(), description: formData.description.trim() || null });
                toast.success("Department updated successfully!");
            } else {
                await addDepartment({ name: formData.name.trim(), description: formData.description.trim() || null });
                toast.success("Department created successfully!");
            }
            setShowFormModal(false);
            setFormErrors({});
        } catch (err: any) {
            const errorMessage = typeof err === 'string' ? err : err?.message || "Operation failed";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        { header: "Department Name", accessor: "name" },
        { header: "Description", render: (dept) => dept.description || "N/A" },
        {
            header: "Actions",
            render: (dept) => (
                <div className="flex items-center gap-2">
                    {can("departments.view") && <ViewButton onClick={() => handleOpenView(dept)} />}
                    {canEditDepartment && (<EditButton onClick={() => handleOpenEdit(dept)} />)}
                    {canDeleteDepartment && (<DeleteButton onClick={() => triggerDelete(dept.id)} />)}
                </div>
            ),
            align: "left"
        }
    ];

    return (
        <div className="bg-card">
            <div className="">
                <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                        <div>
                            <h2 className="text-2xl font-bold text-ink">Department Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-card border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                    </div>

                    {/* Departments Table */}
                    <div className="p-0">
                        <DataTable
                            columns={columns}
                            data={paginatedDepts}
                            rowKey={(row) => row.id}
                            loading={loading}
                            emptyMessage="No departments found."
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
                    onHide={() => { setShowFormModal(false); setFormErrors({}); }}
                    title={editMode ? "Edit Department" : "Add New Department"}
                    overflowVisible={true}
                    footer={
                        <div className="flex items-center justify-end gap-2 w-full">
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                variant="secondary"
                                onClick={() => setFormData({
                                    id: formData.id,
                                    name: "",
                                    description: "",
                                })}
                            />
                            <CustomButton
                                text={isSubmitting ? (editMode ? "Updating..." : "Saving...") : (editMode ? "Update" : "Save")}
                                icon={FaSave}
                                onClick={handleSubmit}
                                disabled={loading || isSubmitting}
                            />
                        </div>
                    }
                >
                    <form id="departmentForm" onSubmit={handleSubmit} className="space-y-4 p-2">
                        <div className="grid grid-cols-1 gap-4">
                            <TextInput
                                label="Department Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Information Technology"
                                required
                                onChange={handleChange}
                                error={formErrors.name}
                            />
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="Enter department description"
                                onChange={handleChange}
                            />
                        </div>
                    </form>
                </CommonModal>

                {/* View Details Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Department Details"
                    avatarText={selectedDept ? selectedDept.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedDept ? selectedDept.name : ""}
                    headerSubtitle={selectedDept ? `ID: ${selectedDept.id}` : ""}
                    sections={selectedDept ? [
                        {
                            fields: [
                                { label: "Department Name", value: selectedDept.name },
                                { label: "Description", value: selectedDept.description || "N/A" },
                                { label: "Department ID", value: <span className="text-ink-subtle font-mono text-sm">{String(selectedDept.id)}</span> }
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
            </div>
        </div>
    );
};

export default DepartmentList;
