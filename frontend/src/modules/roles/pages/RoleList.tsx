import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FaPlus, FaSave, FaEraser, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { toast } from "react-toastify";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useRoles } from "../../../hooks/useRoles";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { roleService } from "../../../services/roleService";
import { usePermission } from "../../../hooks/usePermission";
import { useSearchParams } from "react-router-dom";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import RecordAuditInfo, { type AuditData } from "../../../components/ui/RecordAuditInfo/RecordAuditInfo";

const ITEMS_PER_PAGE = 5;
type SortOrder = "default" | "asc" | "desc";
const SORT_STORAGE_KEY = "sunsea_role_sort_name";

const RoleList: React.FC = () => {
    const { roles, total, loading, error, loadRoles, addRole, editRole, removeRole } = useRoles();
    const { can } = usePermission();
    const canCreateRole = can("roles.create");
    const canEditRole = can("roles.edit");
    const canDeleteRole = can("roles.delete");
    const canViewRole = can("roles.view");
    const canExportRole = can("roles.export");

    const [searchParams, setSearchParams] = useSearchParams();

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedRole, setSelectedRole] = useState<any>(null);
    const [auditInfo, setAuditInfo] = useState<AuditData | null>(null);
    const [formErrors, setFormErrors] = useState<{
        code?: string;
        name?: string;
    }>({});

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<number | null>(null);

    // Discard / Save Changes Modal State
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const tableRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const handleFormKeyDown = useFormKeyboardNav(formRef);
    const lastFocusedElementRef = useRef<HTMLElement | null>(null);

    const [formData, setFormData] = useState({
        id: "",
        code: "",
        name: "",
        description: "",
        status: "active",
    });

    const [originalFormData, setOriginalFormData] = useState({
        id: "",
        code: "",
        name: "",
        description: "",
        status: "active",
    });

    const isDirty = useMemo(() => {
        return (
            formData.name.trim() !== originalFormData.name.trim() ||
            formData.description.trim() !== originalFormData.description.trim() ||
            formData.status !== originalFormData.status
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

    // Debounce search term
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Fetch data when page or search term changes
    useEffect(() => {
        if (canViewRole) {
            loadRoles(currentPage, ITEMS_PER_PAGE, debouncedSearchTerm);
        }
    }, [loadRoles, currentPage, debouncedSearchTerm, canViewRole]);

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

    // Client-side sorted roles based on persistent sortOrder
    const sortedRoles = useMemo(() => {
        if (!roles || !Array.isArray(roles)) return [];
        if (sortOrder === "default") return roles;

        return [...roles].sort((a: any, b: any) => {
            const nameA = (a.name || "").trim().toLowerCase();
            const nameB = (b.name || "").trim().toLowerCase();
            if (sortOrder === "asc") {
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
            } else {
                return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: "base" });
            }
        });
    }, [roles, sortOrder]);

    const handleOpenAdd = useCallback(() => {
        setEditMode(false);

        // Generate sequential code (e.g., ROLE_001)
        const roleCodes = roles
            .map((r: any) => r.code)
            .filter((code: string) => code && code.startsWith("ROLE_"));

        let nextNumber = 1;
        if (roleCodes.length > 0) {
            const numbers = roleCodes.map((code: string) => {
                const parts = code.split("_");
                return parts.length > 1 ? parseInt(parts[1], 10) : 0;
            }).filter((num: number) => !isNaN(num));

            if (numbers.length > 0) {
                nextNumber = Math.max(...numbers) + 1;
            }
        }
        const nextCode = `ROLE_${nextNumber.toString().padStart(3, '0')}`;

        const initialData = {
            id: "",
            code: nextCode,
            name: "",
            description: "",
            status: "active",
        };
        setFormData(initialData);
        setOriginalFormData(initialData);
        setFormErrors({});
        setAuditInfo(null);
        setShowFormModal(true);
    }, [roles]);

    const handleOpenEdit = useCallback((role: any) => {
        setEditMode(true);
        const editData = {
            id: String(role.id),
            code: role.code || "",
            name: role.name || "",
            description: role.description || "",
            status: role.status || "active",
        };
        setFormData(editData);
        setOriginalFormData(editData);
        setFormErrors({});
        setAuditInfo({
            createdAt: role.createdAt,
            createdBy: role.createdUserName || role.createdBy,
            editHistory: role.editHistory,
        });
        setShowFormModal(true);

        roleService.getById(Number(role.id)).then((fullRole: any) => {
            if (fullRole) {
                setAuditInfo({
                    createdAt: fullRole.createdAt,
                    createdBy: fullRole.createdUserName || fullRole.createdBy,
                    editHistory: fullRole.editHistory,
                });
            }
        }).catch(() => {});
    }, []);

    const handleOpenView = useCallback((role: any) => {
        setSelectedRole(role);
        setShowViewModal(true);
    }, []);

    const handleCloseViewModal = useCallback(() => {
        setShowViewModal(false);
        setSelectedRole(null);
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    const handleForceCloseFormModal = useCallback(() => {
        setShowFormModal(false);
        setSaveConfirmOpen(false);
        setFormErrors({});
        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
    }, []);

    // Ref to remember blocker's proceed()/reset() from the current block-attempt
    // so the existing discard modal can drive them from its buttons.
    const proceedRef = useRef<(() => void) | null>(null);
    const resetRef = useRef<(() => void) | null>(null);
    useDirtyNavGuard(isDirty, (proceed, reset) => {
        proceedRef.current = proceed;
        resetRef.current = reset;
        setSaveConfirmOpen(true);
    });

    const handleResume = useCallback(() => {
        setSaveConfirmOpen(false);
        if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); }
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
        if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
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
        setRoleToDelete(id);
        setShowDeleteModal(true);
    }, []);

    // ── Table keyboard navigation ─────────────────────────────────────────────
    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: sortedRoles.length,
        onEnter: (i) => {
            const role = sortedRoles[i];
            if (role && canViewRole) handleOpenView(role);
        },
        onEdit: (i) => {
            const role = sortedRoles[i];
            if (role && canEditRole) handleOpenEdit(role);
        },
        containerRef: tableRef,
    });

    usePageShortcuts({
        onRefresh: () => loadRoles(currentPage, ITEMS_PER_PAGE, debouncedSearchTerm),
        onSort: () => toggleSortOrder(),
        onDelete: () => {
            const currentRole = sortedRoles[focusedIndex];
            if (currentRole && canDeleteRole) {
                triggerDelete(currentRole.id);
            } else if (canDeleteRole) {
                setShowDeleteModal(true);
            }
        },
        onNew: () => canCreateRole && handleOpenAdd(),
        onExport: () => {
            const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-btn], button:has(svg):has(span)");
            exportBtn?.click();
        },
    });

    // Auto-focus Role Name field when Form Modal opens
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

    const fetchRolesForExport = useCallback(async () => {
        const res = await roleService.fetchAll({ page: 1, limit: 100000 });
        const list = res?.data || (Array.isArray(res) ? res : []);
        return Array.isArray(list) ? list : [];
    }, []);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Role Name", accessor: (item: any) => item.name || "" },
            { header: "Code", accessor: (item: any) => item.code || "" },
            { header: "Description", accessor: (item: any) => item.description || "" },
            { header: "Status", accessor: (item: any) => item.status || "" },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Role_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    useEffect(() => {
        if (searchParams.get("action") === "add") {
            handleOpenAdd();
            searchParams.delete("action");
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, setSearchParams, handleOpenAdd]);

    const handleDeleteConfirm = async () => {
        if (roleToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await removeRole(roleToDelete);
                toast.success("Role deleted successfully!");
            } catch (err: any) {
                const errorMessage = typeof err === 'string' ? err : (err?.message || "Failed to delete role");
                toast.error(errorMessage);
            } finally {
                setShowDeleteModal(false);
                setRoleToDelete(null);
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

    const validateRoleForm = useCallback(() => {
        const errors: { code?: string; name?: string } = {};
        if (!formData.code.trim()) errors.code = "Role code is required";
        if (!formData.name.trim()) errors.name = "Role name is required";
        setFormErrors(errors);
        if (Object.keys(errors).length > 0) {
            const firstErrorField = errors.code ? "code" : "name";
            const el = formRef.current?.querySelector<HTMLElement>(`input[name="${firstErrorField}"]`);
            el?.focus();
            return false;
        }
        return true;
    }, [formData]);

    const submitForm = useCallback(async () => {
        if (!validateRoleForm() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const payload = {
                code: formData.code,
                name: formData.name.trim(),
                description: formData.description.trim(),
                status: formData.status
            };

            if (editMode) {
                await editRole(Number(formData.id), payload);
                toast.success("Role updated successfully!");
            } else {
                await addRole(payload);
                toast.success("Role created successfully!");
            }
            handleForceCloseFormModal();
        } catch (err: any) {
            const errorMessage = typeof err === 'string' ? err : (err?.message || "Operation failed");
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }, [validateRoleForm, isSubmitting, formData, editMode, editRole, addRole, handleForceCloseFormModal]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitForm();
    };

    // Save action from the Discard confirmation popup
    const handleSaveFromModal = useCallback(() => {
        setSaveConfirmOpen(false);
        setTimeout(() => {
            const isValid = validateRoleForm();
            if (!isValid) {
                toast.error("Please fill all required fields.");
                return;
            }
            submitForm();
        }, 150);
    }, [validateRoleForm, submitForm]);

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
        {
            header: "#",
            render: (_, index) => <span className="text-ink-subtle font-mono text-xs">{String(startIndex + index + 1).padStart(2, '0')}</span>,
            width: "60px",
            align: "center"
        },
        {
            header: "ROLE NAME",
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
                        ROLE NAME
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
            render: (role) => (
                <span className="block max-w-[150px] truncate font-medium text-ink" title={role.name}>
                    {role.name}
                </span>
            ),
        },
        {
            header: "Code",
            render: (role) => (
                <span className="font-mono text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-md">
                    {role.code}
                </span>
            ),
        },
        {
            header: "Description",
            render: (role) => (
                <span className="block max-w-[200px] truncate text-ink-muted" title={role.description || ""}>
                    {role.description || "—"}
                </span>
            ),
        },
        { header: "Status", render: (role) => <StatusBadge status={role.status} />, align: "center" },
        {
            header: "Actions",
            render: (role) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {canViewRole && <ViewButton onClick={() => handleOpenView(role)} />}
                    {canEditRole && <EditButton onClick={() => handleOpenEdit(role)} />}
                    {canDeleteRole && <DeleteButton onClick={() => triggerDelete(role.id)} />}
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
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
                        <div>
                            <h2 className="text-base font-bold text-ink flex items-center gap-2">
                                Role Management
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-xs dark:bg-slate-800/90 dark:text-slate-200 dark:border dark:border-slate-700/60">
                                    {total || 0}
                                </span>
                            </h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <SearchInput
                                value={searchTerm}
                                onChange={handleSearch}
                                placeholder="Search roles..."
                            />
                            {canExportRole && (
                                <ExportCSVButton
                                    fetchData={fetchRolesForExport}
                                    columns={csvColumns}
                                    filename={csvFilename}
                                    text="Export"
                                />
                            )}
                            {canCreateRole && (
                                <CustomButton
                                    text="Add Role"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            )}
                        </div>
                    </div>

                    {/* Roles Table */}
                    <div
                        ref={tableRef}
                        tabIndex={0}
                        data-table-nav
                        className="p-0 outline-none"
                    >
                        <DataTable
                            columns={columns}
                            data={sortedRoles}
                            rowKey={(row) => row.id}
                            loading={loading}
                            emptyMessage="No roles found."
                            rowClassName={(_row, index) =>
                                index === focusedIndex
                                    ? "bg-primary/8"
                                    : ""
                            }
                            onRowClick={(role, index) => {
                                setFocusedIndex(index);
                                tableRef.current?.focus({ preventScroll: true });
                                handleOpenView(role);
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
                    title={
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span>{editMode ? "Edit Role" : "Add New Role"}</span>
                                {editMode && formData.code && (
                                    <span className="text-purple-400 text-sm leading-none font-mono">*{formData.code}</span>
                                )}
                            </div>
                            {editMode && <RecordAuditInfo auditData={auditInfo} title="Role" />}
                        </div>
                    }
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
                                        code: formData.code,
                                        name: "",
                                        description: "",
                                        status: "active",
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
                    <form ref={formRef} id="roleForm" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4 p-2" noValidate>
                        <div className="grid grid-cols-1 gap-4">
                            <TextInput
                                label="Role Code (Auto Generated)"
                                name="code"
                                value={formData.code}
                                placeholder="Auto Generated"
                                required
                                error={formErrors.code}
                                onChange={handleChange}
                                disabled
                            />
                            <TextInput
                                label="Role Name"
                                name="name"
                                value={formData.name}
                                placeholder="e.g. Super Admin"
                                required
                                error={formErrors.name}
                                onChange={handleChange}
                            />
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="Enter role description"
                                onChange={handleChange}
                            />
                            <SelectInput
                                label="Status"
                                name="status"
                                value={formData.status}
                                options={[
                                    { value: "active", label: "Active" },
                                    { value: "inactive", label: "Inactive" },
                                ]}
                                onChange={handleChange}
                            />
                        </div>
                    </form>
                </CommonModal>

                {/* View Details Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={handleCloseViewModal}
                    modalTitle="Role Details"
                    avatarText={selectedRole ? selectedRole.name.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedRole ? selectedRole.name : ""}
                    sections={selectedRole ? [
                        {
                            fields: [
                                { label: "Role Code", value: selectedRole.code },
                                { label: "Role Name", value: selectedRole.name },
                                { label: "Description", value: selectedRole.description || "N/A" },
                                {
                                    label: "Status",
                                    value: <StatusBadge status={selectedRole.status} />
                                },
                                { label: "System Role", value: selectedRole.isSystem ? "Yes" : "No" },
                                { label: "Role ID", value: <span className="text-ink-subtle font-mono text-sm">{String(selectedRole.id)}</span> }
                            ]
                        }
                    ] : []}
                />

                {/* Custom Delete Confirm Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => {
                        setShowDeleteModal(false);
                        setRoleToDelete(null);
                        setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
                    }}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this role? This action cannot be undone."
                    confirmText={isDeleting ? "Deleting..." : "Delete"}
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
                    message="Are you sure you want to leave? Any unsaved role details will be lost."
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

export default RoleList;
