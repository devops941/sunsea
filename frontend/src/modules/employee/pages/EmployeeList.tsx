import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaPlus } from "react-icons/fa";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { usePermission } from "../../../hooks/usePermission";
import { useListCache } from "../../../hooks/useListCache";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import { departmentService } from "../../../services/departmentService";
import { roleService } from "../../../services/roleService";
import { employeeService } from "../../../services/employeeService";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";

const ITEMS_PER_PAGE = 15;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
];

const Employeelist: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canView = can("employees.view");
  const canCreate = can("employees.create");
  const canEdit = can("employees.edit");
  const canDelete = can("employees.delete");

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Draft filter state (inside popover)
  const [draftRoleId, setDraftRoleId] = useState("");
  const [draftDeptId, setDraftDeptId] = useState("");
  const [draftStatus, setDraftStatus] = useState("");

  // Applied filter state (sent to API)
  const [appliedRoleId, setAppliedRoleId] = useState("");
  const [appliedDeptId, setAppliedDeptId] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");

  // Reference data for filter dropdowns
  const [roles, setRoles] = useState<{ value: string; label: string }[]>([]);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEmployeesForExport = useCallback(async () => {
    const res = await employeeService.fetchAll({ limit: 100000 });
    return Array.isArray(res) ? res : (res?.employees || res?.data || []);
  }, []);

  // Load roles and departments for filter dropdowns
  useEffect(() => {
    roleService.fetchAll({ limit: 200 }).then(res => {
      const list = Array.isArray(res.data) ? res.data : [];
      setRoles(list
        .filter((r: any) => !r.code?.toLowerCase().includes("super_admin") && !r.code?.toLowerCase().includes("superadmin"))
        .map((r: any) => ({ value: String(r.id), label: r.name })));
    }).catch(() => { });

    departmentService.fetchAll({ limit: 200 }).then(res => {
      const list = Array.isArray(res.data) ? res.data : [];
      setDepartments(list.map((d: any) => ({ value: String(d.id), label: d.name })));
    }).catch(() => { });
  }, []);

  // Fetch employees (cached)
  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await employeeService.fetchAll({ limit: 10000 });
    const list = Array.isArray(res) ? res : (res.employees || res.data || []);
    return { data: list, total: res.total || list.length };
  }, []);

  const { data: employees, loading, refresh } = useListCache<any>({
    cacheKey: "employees:list",
    socketModule: "employee",
    fetcher,
  });

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp: any) => {
      const matchesSearch = !searchTerm ||
        emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.empCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.mobile?.includes(searchTerm);
      const matchesRole = !appliedRoleId || String(emp.roleId || emp.role?.id || emp.user?.roleId) === appliedRoleId;
      const matchesDept = !appliedDeptId || String(emp.departmentId) === appliedDeptId;
      const matchesStatus = !appliedStatus || emp.status === appliedStatus;
      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [employees, searchTerm, appliedRoleId, appliedDeptId, appliedStatus]);

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const activeFilterCount = (appliedRoleId ? 1 : 0) + (appliedDeptId ? 1 : 0) + (appliedStatus ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const handleApplyFilters = useCallback(() => {
    setAppliedRoleId(draftRoleId);
    setAppliedDeptId(draftDeptId);
    setAppliedStatus(draftStatus);
    setCurrentPage(1);
  }, [draftRoleId, draftDeptId, draftStatus]);

  const handleClearFilters = useCallback(() => {
    setDraftRoleId(""); setDraftDeptId(""); setDraftStatus("");
    setAppliedRoleId(""); setAppliedDeptId(""); setAppliedStatus("");
    setCurrentPage(1);
  }, []);

  const handleView = useCallback((employee: any) => {
    navigate(`/employees/view/${employee.id}`);
  }, [navigate]);

  const handleEdit = useCallback((employee: any) => {
    navigate(`/employees/edit/${employee.id}`, { state: employee });
  }, [navigate]);

  const triggerDelete = useCallback((id: string) => {
    setEmployeeToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (employeeToDelete && !isDeleting) {
      setIsDeleting(true);
      try {
        await employeeService.delete(employeeToDelete);
        toast.success("Employee deleted successfully!");
        refresh();
      } catch (err: any) {
        toast.error(err?.response?.data?.message || err.message || err || "Failed to delete employee");
      } finally {
        setShowDeleteModal(false);
        setEmployeeToDelete(null);
        setIsDeleting(false);
      }
    }
  };

  // CSV Export Configuration
  const { csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Employee Code", accessor: (emp: any) => emp.empCode },
      { header: "Employee Name", accessor: (emp: any) => emp.fullName },
      { header: "Mobile", accessor: (emp: any) => emp.mobile || "—" },
      { header: "Role", accessor: (emp: any) => emp.role?.name || emp.user?.role?.name || "—" },
      { header: "Department", accessor: (emp: any) => emp.department?.name || "—" },
      {
        header: "Login Account",
        accessor: (emp: any) =>
          emp.user ? (emp.user.status === "active" ? "Enabled" : emp.user.status?.toUpperCase() || "Disabled") : "No Login",
      },
      { header: "Status", accessor: (emp: any) => (emp.status ? emp.status.toUpperCase() : "—") },
    ];
    return {
      csvColumns: columns,
      csvFilename: `Employee_List_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, []);



  const columns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "50px",
      align: "center",
      render: (_, index) => (
        <span className="text-ink-subtle font-mono text-xs">{String(startIndex + index + 1).padStart(2, '0')}</span>
      ),
    },
    { header: "Employee Code", accessor: "empCode", width: "120px" },
    { header: "Employee Name", accessor: "fullName" },
    { header: "Mobile", width: "130px", render: (emp) => emp.mobile || "—" },
    { header: "Role", width: "130px", render: (emp) => emp.role?.name || emp.user?.role?.name || "—" },
    {
      header: "Login Account",
      width: "150px",
      align: "center",
      render: (emp) => {
        if (!emp.user) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-card-2 text-ink-subtle border border-line/80">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              No Login
            </span>
          );
        }
        const isActive = emp.user.status === "active";
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${isActive
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
              {isActive ? "Enabled" : emp.user.status?.toUpperCase() || "Disabled"}
            </span>
            {emp.user.username && (
              <span className="text-[11px] font-mono text-ink-subtle">@{emp.user.username}</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Status",
      width: "110px",
      align: "center",
      render: (emp) => {
        const statusMap: Record<string, string> = {
          active: "ACTIVE", inactive: "INACTIVE", resigned: "RESIGNED", terminated: "TERMINATED",
        };
        return <StatusBadge status={statusMap[emp.status] ?? emp.status?.toUpperCase() ?? "INACTIVE"} />;
      },
    },
    {
      header: "Actions",
      width: "120px",
      align: "center",
      render: (emp) => (
        <div className="flex items-center gap-2">
          {canView && <ViewButton onClick={() => handleView(emp)} />}
          {canEdit && <EditButton onClick={() => handleEdit(emp)} />}
          {canDelete && <DeleteButton onClick={() => triggerDelete(emp.id)} />}
        </div>
      ),
    }
  ];

  return (
    <div>
      <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-visible">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
          <div>
            <h2 className="text-base font-bold text-ink">Employee Management</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={15} />
              <input
                type="text"
                className="w-full pl-9 pr-4 py-2 bg-card-2 border border-line-soft rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>

            {/* Filter Popover */}
            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">Role</label>
                  <SelectInput
                    name="draftRoleId"
                    value={draftRoleId}
                    onChange={(e) => setDraftRoleId(e.target.value)}
                    options={roles}
                    defaultOptionLabel="All Roles"
                    noMargin
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">Department</label>
                  <SelectInput
                    name="draftDeptId"
                    value={draftDeptId}
                    onChange={(e) => setDraftDeptId(e.target.value)}
                    options={departments}
                    defaultOptionLabel="All Departments"
                    noMargin
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">Status</label>
                  <SelectInput
                    name="draftStatus"
                    value={draftStatus}
                    onChange={(e) => setDraftStatus(e.target.value)}
                    options={STATUS_OPTIONS}
                    defaultOptionLabel="All Statuses"
                    noMargin
                  />
                </div>
              </div>
            </FilterPopover>

            <ExportCSVButton
              fetchData={fetchEmployeesForExport}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
            />

            {canCreate && (
              <CustomButton
                text="Add Employee"
                icon={FaPlus}
                onClick={() => navigate("/employees/create")}
              />
            )}
          </div>
        </div>

        {/* Table */}
        <div className="p-0 overflow-hidden rounded-b-2xl">
          <DataTable
            data={paginatedEmployees}
            rowKey={(emp) => emp.id}
            loading={loading}
            emptyMessage="No employees found."
            pagination={
              totalPages > 1
                ? { currentPage, totalPages, onPageChange: setCurrentPage }
                : undefined
            }
            columns={columns}
          />
        </div>
      </div>

      <CommonConfirmModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this employee?"
        confirmText={isDeleting ? "Deleting..." : "Delete"}
        confirmVariant="danger"
      />
    </div>
  );
};

export default Employeelist;
