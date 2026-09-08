import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useSearchParams } from "react-router-dom";
import { FaPlus, FaSave, FaEraser, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useDepartments } from "../../../hooks/useDepartments";
import { usePermission } from "../../../hooks/usePermission";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { departmentService } from "../../../services/departmentService";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CommonModal from "../../../components/ui/Modal/CommonModal";

const ITEMS_PER_PAGE = 15;
type SortOrder = "default" | "asc" | "desc";
const SORT_STORAGE_KEY = "sunsea_department_sort_name";

const DepartmentList: React.FC = () => {
    const { departments, total, loading, error, loadDepartments, addDepartment, editDepartment, removeDepartment } = useDepartments();
    const { can } = usePermission();
    const canCreateDepartment = can("departments.create");
    const canEditDepartment = can("departments.edit");
    const canDeleteDepartment = can("departments.delete");
    const canViewDepartment = can("departments.view");
    const canExportDepartment = can("departments.export");

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

    // Discard / Save Changes Modal State
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [formErrors, setFormErrors] = useState<{ name?: string }>({});

    const tableRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const handleFormKeyDown = useFormKeyboardNav(formRef);
    const lastFocusedElementRef = useRef<HTMLElement | null>(null);

    const [formData, setFormData] = useState({
        id: "",
        name: "",
        description: "",
    });

    const [originalFormData, setOriginalFormData] = useState({
        id: "",
        name: "",
        description: "",
    });

    const isDirty = useMemo(() => {
        return (
            formData.name.trim() !== originalFormData.name.trim() ||
            formData.description.trim() !== originalFormData.description.trim()
        );
    }, [formData, originalFormData]);

    const isDirtyRef = useRef(isDirty);
    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

    const saveConfirmOpenRef = useRef(saveConfirmOpen);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

    // ── Alphabetical Sorting with localStorage persistence ───────────────────
    const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
        try {
            const saved = localStorage.getItem(SORT_STORAGE_KEY);
            if (saved === "asc" || saved === "desc") return saved;
        } catch (_) {}
        return "default";
    });

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prev) => {
            let next: SortOrder = "default";
            if (prev === "default") next = "asc";
            else if (prev === "asc") next = "desc";
            else next = "default";
            try {
                localStorage.setItem(SORT_STORAGE_KEY, next);
            } catch (_) {}
            return next;
        });
    }, []);

    // Shortcut key (F6 or Alt+S) to toggle alphabetical sort
    useEffect(() => {
        const handleSortShortcut = (e: globalThis.KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                return;
            }
            if (e.key === "F6" || (e.altKey && (e.key === "s" || e.key === "S"))) {
                e.preventDefault();
                toggleSortOrder();
            }
        };
        window.addEventListener("keydown", handleSortShortcut);
        return () => window.removeEventListener("keydown", handleSortShortcut);
    }, [toggleSortOrder]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        if (canViewDepartment) {
            loadDepartments(currentPage, ITEMS_PER_PAGE, debouncedSearchTerm);
        }
    }, [loadDepartments, currentPage, debouncedSearchTerm, canViewDepartment]);

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

    // Client-side sorted departments based on persistent sortOrder
    const sortedDepartments = useMemo(() => {
        if (!departments || !Array.isArray(departments)) return [];
        if (sortOrder === "default") return departments;

        return [...departments].sort((a: any, b: any) => {
            const nameA = (a.name || "").trim().toLowerCase();
            const nameB = (b.name || "").trim().toLowerCase();
            if (sortOrder === "asc") {
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
            } else {
                return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: "base" });
            }
        });
    }, [departments, sortOrder]);

    const handleOpenAdd = () => {
        setEditMode(false);
        const initialData = { id: "", name: "", description: "" };
        setFormData(initialData);
        setOriginalFormData(initialData);
        setFormErrors({});
        setShowFormModal(true);
    };

    // Lets the "Add Department" sidebar link open the create modal directly.
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
        const editData = {
            id: String(dept.id),
            name: dept.name || "",
            description: dept.description || "",
        };
        setFormData(editData);
        setOriginalFormData(editData);
        setFormErrors({});
        setShowFormModal(true);
    }, []);

    const handleOpenView = useCallback((dept: any) => {
        setSelectedDept(dept);
        setShowViewModal(true);
    }, []);

    const handleCloseViewModal = useCallback(() => {
        setShowViewModal(false);
        setSelectedDept(null);
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    const handleForceCloseFormModal = useCallback(() => {
        setShowFormModal(false);
        setSaveConfirmOpen(false);
        setFormErrors({});
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    const handleResume = useCallback(() => {
        setSaveConfirmOpen(false);
        setTimeout(() => {
            if (lastFocusedElementRef.current && typeof lastFocusedElementRef.current.focus === "function") {
                lastFocusedElementRef.current.focus();
            } else {
                const firstInput = formRef.current?.querySelector<HTMLElement>(
                    "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])"
                );
                firstInput?.focus();
            }
        }, 50);
    }, []);

    const handleDiscard = useCallback(() => {
        handleForceCloseFormModal();
    }, [handleForceCloseFormModal]);

    const handleRequestCloseFormModal = useCallback(() => {
        if (saveConfirmOpenRef.current) {
            handleResume();
            return;
        }
        if (isDirtyRef.current) {
            lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
            setSaveConfirmOpen(true);
        } else {
            handleForceCloseFormModal();
        }
    }, [handleResume, handleForceCloseFormModal]);

    const triggerDelete = useCallback((id: number) => {
        setDeptToDelete(id);
        setShowDeleteModal(true);
    }, []);

    // ── Table keyboard navigation ─────────────────────────────────────────────
    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: sortedDepartments.length,
        onEnter: (i) => {
            const dept = sortedDepartments[i];
            if (dept && canViewDepartment) handleOpenView(dept);
        },
        onEdit: (i) => {
            const dept = sortedDepartments[i];
            if (dept && canEditDepartment) handleOpenEdit(dept);
        },
        containerRef: tableRef,
    });

    usePageShortcuts({
        onRefresh: () => loadDepartments(currentPage, ITEMS_PER_PAGE, debouncedSearchTerm),
        onSort: () => toggleSortOrder(),
        onDelete: () => {
            const currentDept = sortedDepartments[focusedIndex];
            if (currentDept && canDeleteDepartment) {
                triggerDelete(currentDept.id);
            } else if (canDeleteDepartment) {
                setShowDeleteModal(true);
            }
        },
        onNew: () => canCreateDepartment && handleOpenAdd(),
        onExport: () => {
            const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-btn], button:has(svg):has(span)");
            exportBtn?.click();
        },
    });

    // Auto-focus Department Name field when Form Modal opens
    useEffect(() => {
        if (showFormModal) {
            const timer = setTimeout(() => {
                const nameInput = formRef.current?.querySelector<HTMLInputElement>('input[name="name"]');
                nameInput?.focus();
                nameInput?.select();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showFormModal]);

    const fetchDepartmentsForExport = useCallback(async () => {
        const res = await departmentService.fetchAll({ page: 1, limit: 100000 });
        const list = res?.data || (Array.isArray(res) ? res : []);
        return Array.isArray(list) ? list : [];
    }, []);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Department Name", accessor: (item: any) => item.name || "" },
            { header: "Description", accessor: (item: any) => item.description || "" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Department_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
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
                setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
        if (formErrors[name as keyof typeof formErrors]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: undefined,
            }));
        }
    };

    const validateForm = useCallback(() => {
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
        if (Object.keys(errors).length > 0) {
            const el = formRef.current?.querySelector<HTMLElement>('input[name="name"]');
            el?.focus();
            return false;
        }
        return true;
    }, [formData, departments]);

    const submitForm = useCallback(async () => {
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
            handleForceCloseFormModal();
        } catch (err: any) {
            const errorMessage = typeof err === 'string' ? err : err?.message || "Operation failed";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }, [validateForm, isSubmitting, editMode, formData, editDepartment, addDepartment, handleForceCloseFormModal]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitForm();
    };

    // Save action from the Discard confirmation popup
    const handleSaveFromModal = useCallback(() => {
        setSaveConfirmOpen(false);
        setTimeout(() => {
            const isValid = validateForm();
            if (!isValid) {
                toast.error("Required fields fill pannunga — please fill all required fields.");
                return;
            }
            submitForm();
        }, 150);
    }, [validateForm, submitForm]);

    // Global form shortcuts integration (F2 / F9) when modal is open
    useFormShortcuts({
        onSave: () => {
            if (showFormModal && !saveConfirmOpen) {
                submitForm();
            }
        },
    });

    // Ctrl+S shortcut support inside modal
    useEffect(() => {
        if (!showFormModal || saveConfirmOpen) return;
        const handleCtrlS = (e: KeyboardEvent) => {
            if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
                e.preventDefault();
                e.stopPropagation();
                submitForm();
            }
        };
        window.addEventListener("keydown", handleCtrlS, { capture: true });
        return () => window.removeEventListener("keydown", handleCtrlS, { capture: true });
    }, [showFormModal, saveConfirmOpen, submitForm]);

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        {
            header: "DEPARTMENT NAME",
            accessor: "name",
            headerNode: (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleSortOrder();
                    }}
                    title={`Sort Alphabetically: ${
                        sortOrder === "default"
                            ? "Default Order"
                            : sortOrder === "asc"
                            ? "A to Z (Ascending)"
                            : "Z to A (Descending)"
                    } (Click or press F6)`}
                    className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-[1.5px] outline-none hover:opacity-90 transition-opacity"
                >
                    <span className={sortOrder !== "default" ? "text-primary font-black" : "group-hover/sort:text-ink transition-colors"}>
                        DEPARTMENT NAME
                    </span>
                    <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded transition-all duration-200 ${
                            sortOrder === "asc" || sortOrder === "desc"
                                ? "bg-primary/20 text-primary scale-110"
                                : "text-ink-subtle/60 group-hover/sort:text-ink group-hover/sort:bg-card-2"
                        }`}
                    >
                        {sortOrder === "asc" ? (
                            <FaArrowUp size={10} />
                        ) : sortOrder === "desc" ? (
                            <FaArrowDown size={10} />
                        ) : (
                            <FaSort size={10} />
                        )}
                    </span>
                    {sortOrder !== "default" && (
                        <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-primary text-white tracking-tighter shadow-xs">
                            {sortOrder === "asc" ? "A-Z" : "Z-A"}
                        </span>
                    )}
                </button>
            ),
            render: (dept) => (
                <span className="block max-w-[200px] truncate font-medium text-ink" title={dept.name}>{dept.name}</span>
            ),
        },
        {
            header: "Description",
            render: (dept) => (
                <span className="block max-w-[200px] truncate text-ink-muted" title={dept.description || "N/A"}>{dept.description || "—"}</span>
            ),
        },
        {
            header: "Actions",
            render: (dept) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {canViewDepartment && <ViewButton onClick={() => handleOpenView(dept)} />}
                    {canEditDepartment && (<EditButton onClick={() => handleOpenEdit(dept)} />)}
                    {canDeleteDepartment && (<DeleteButton onClick={() => triggerDelete(dept.id)} />)}
                </div>
            ),
            align: "left"
        }
    ];

    return (
        <div>
            <div className="">
                <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                        <div>
                            <h2 className="text-2xl font-bold text-ink">Department Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <SearchInput
                                value={searchTerm}
                                onChange={handleSearch}
                                placeholder="Search departments..."
                            />
                            {canExportDepartment && (
                                <ExportCSVButton
                                    fetchData={fetchDepartmentsForExport}
                                    columns={csvColumns}
                                    filename={csvFilename}
                                    text="Export"
                                />
                            )}
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
                    <div
                        ref={tableRef}
                        tabIndex={0}
                        data-table-nav
                        className="p-0 outline-none"
                    >
                        <DataTable
                            columns={columns}
                            data={sortedDepartments}
                            rowKey={(row) => row.id}
                            loading={loading}
                            emptyMessage="No departments found."
                            rowClassName={(_row, index) =>
                                index === focusedIndex
                                    ? "bg-primary/8"
                                    : ""
                            }
                            onRowClick={(dept, index) => {
                                setFocusedIndex(index);
                                tableRef.current?.focus({ preventScroll: true });
                                handleOpenView(dept);
                            }}
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
                    onHide={handleRequestCloseFormModal}
                    title={editMode ? "Edit Department" : "Add New Department"}
                    overflowVisible={true}
                    footer={
                        <div className="flex items-center justify-end gap-2 w-full">
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                variant="secondary"
                                onClick={() => {
                                    setFormData({
                                        id: formData.id,
                                        name: "",
                                        description: "",
                                    });
                                    setFormErrors({});
                                    setTimeout(() => {
                                        const nameInput = formRef.current?.querySelector<HTMLInputElement>('input[name="name"]');
                                        nameInput?.focus();
                                    }, 50);
                                }}
                            />
                            <CustomButton
                                text={isSubmitting ? (editMode ? "Updating..." : "Saving...") : (editMode ? "Update" : "Save")}
                                icon={FaSave}
                                onClick={submitForm}
                                disabled={loading || isSubmitting}
                            />
                        </div>
                    }
                >
                    <form ref={formRef} id="departmentForm" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4 p-2" noValidate>
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
                    onHide={handleCloseViewModal}
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
                    onHide={() => {
                        setShowDeleteModal(false);
                        setDeptToDelete(null);
                        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
                    }}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this department?"
                    confirmText="Delete"
                    confirmVariant="danger"
                    isDangerous={true}
                />

                {/* Discard Changes Confirm Modal (Esc key / Close when form is modified) */}
                <CommonConfirmModal
                    isOpen={saveConfirmOpen}
                    onClose={handleResume}
                    onCancel={handleDiscard}
                    onConfirm={handleSaveFromModal}
                    title="Discard Changes?"
                    message="Are you sure you want to leave? Any unsaved department details will be lost."
                    warningText="Save to keep your changes, or Discard to leave."
                    cancelText="Discard"
                    cancelVariant="danger"
                    confirmText="Save"
                    confirmVariant="primary"
                    confirmIcon={FaSave}
                    isDangerous={false}
                    defaultFocusCancel={false}
                />
            </div>
        </div>
    );
};

export default DepartmentList;
