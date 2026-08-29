import React, { useState, useEffect, useCallback } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useEmployees } from "../../../hooks/useEmployees";
import { usePermission } from "../../../hooks/usePermission";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";

const ITEMS_PER_PAGE = 15;

const Employeelist: React.FC = () => {
  const navigate = useNavigate();
  const { employees, loading, error, loadEmployees, removeEmployee, totalPages } = useEmployees();
  const { can } = usePermission();
  const canView   = can("employees.view");
  const canCreate = can("employees.create");
  const canEdit   = can("employees.edit");
  const canDelete = can("employees.delete");

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (canView) {
        loadEmployees({
          search: searchTerm,
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        });
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [loadEmployees, searchTerm, currentPage]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleView = useCallback((employee: any) => {
    navigate(`/employees/view/${employee.id}`);
  }, [navigate]);

  const handleEdit = useCallback((employee: any) => {
    navigate(`/employees/edit/${employee.id}`, {
      state: employee,
    });
  }, [navigate]);

  const triggerDelete = useCallback((id: string) => {
    setEmployeeToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (employeeToDelete && !isDeleting) {
      setIsDeleting(true);
      try {
        await removeEmployee(employeeToDelete);
        toast.success("Employee deleted successfully!");
      } catch (err: any) {
        toast.error(err?.response?.data?.message || err.message || err || "Failed to delete employee");
      } finally {
        setShowDeleteModal(false);
        setEmployeeToDelete(null);
        setIsDeleting(false);
      }
    }
  };

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const columns: DataTableColumn<any>[] = [
    { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
    { header: "Employee Code", accessor: "empCode" },
    { header: "Employee Name", accessor: "fullName" },
    { header: "Mobile", render: (emp) => emp.mobile || "N/A" },
    { header: "Department", render: (emp) => emp.department?.name || "N/A" },
    { header: "Role", render: (emp) => emp.role?.name || emp.user?.role?.name || "N/A" },
    {
      header: "Login Account",
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              ></span>
              {isActive ? "Enabled" : emp.user.status?.toUpperCase() || "Disabled"}
            </span>
            {emp.user.username && (
              <span className="text-[11px] font-mono text-ink-subtle">
                @{emp.user.username}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Status", render: (emp) => {
        const statusMap: Record<string, string> = {
          active: "ACTIVE",
          inactive: "INACTIVE",
          resigned: "RESIGNED",
          terminated: "TERMINATED",
        };
        // BUG-EMP-009 fix: map all 4 statuses correctly instead of only active/inactive
        return <StatusBadge status={statusMap[emp.status] ?? emp.status?.toUpperCase() ?? "INACTIVE"} />;
      }, align: "center"
    },
    {
      header: "Actions",
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
      <div className="">

        <div className="max-w-[1450px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
            <div>
              <h2 className="text-2xl font-bold text-ink">Employee Management</h2>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-card border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Search Employee..."
                  value={searchTerm}
                  onChange={handleSearch}
                />
              </div>
              {canCreate && (
                <CustomButton
                  text="Add Employee"
                  icon={FaPlus}
                  onClick={() => navigate("/employees/create")}
                />
              )}
            </div>
          </div>

          {/* View Table */}
          <div className="p-0">
            <DataTable
              data={employees}
              rowKey={(emp) => emp.id}
              loading={loading}
              emptyMessage="No employees found."
              pagination={
                totalPages > 1
                  ? {
                    currentPage,
                    totalPages,
                    onPageChange: setCurrentPage,
                  }
                  : undefined
              }
              columns={columns}
            />
          </div>
        </div>

        {/* Custom Confirmation Modal for Deletion */}
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
    </div>
  );
};

export default Employeelist;