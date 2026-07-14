import React, { useState, useEffect, useCallback } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import EmployeeViewModal from "../../employee/components/EmployeeViewModal";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useEmployees } from "../../../hooks/useEmployees";
import { hasPermission } from "../../../utils/permission";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";

const ITEMS_PER_PAGE = 10;

const Employeelist: React.FC = () => {
  const navigate = useNavigate();
  const { employees, loading, error, loadEmployees, removeEmployee, totalPages } = useEmployees();

  const canCreateEmployee = hasPermission("employees.create");
  const canEditEmployee = hasPermission("employees.edit");
  const canDeleteEmployee = hasPermission("employees.delete");

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadEmployees({
        search: searchTerm,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
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
    setSelectedEmployee(employee);
    setShowViewModal(true);
  }, []);

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
    if (employeeToDelete) {
      try {
        await removeEmployee(employeeToDelete);
        toast.success("Employee deleted successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete employee");
      } finally {
        setShowDeleteModal(false);
        setEmployeeToDelete(null);
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
    { header: "Status", render: (emp) => <StatusBadge status={emp.status === "active" ? "ACTIVE" : "INACTIVE"} />, align: "center" },
    {
      header: "Actions",
      render: (emp) => (
        <div className="flex items-center gap-2">
          <ViewButton onClick={() => handleView(emp)} />
          {canEditEmployee && <EditButton onClick={() => handleEdit(emp)} />}
          {canDeleteEmployee && <DeleteButton onClick={() => triggerDelete(emp.id)} />}
        </div>
      ),
      align: "right"
    }
  ];

  return (
    <div className="p-4 md:p-6 min-h-screen bg-white">
      <div className="">
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Employee Management</h2>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Search Employee..."
                  value={searchTerm}
                  onChange={handleSearch}
                />
              </div>
              {canCreateEmployee && (
                <CustomButton
                  text="Add Employee"
                  icon={FaPlus}
                  onClick={() => navigate("/employees/create")}
                />
              )}
            </div>
          </div>

          {/* View Table */}
          {loading && employees.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={employees}
              rowKey={(row) => row.id}
              emptyMessage="No employees found."
              pagination={totalPages > 1 ? {
                currentPage,
                totalPages,
                onPageChange: setCurrentPage
              } : undefined}
            />
          )}
        </div>

        {/* Employee View Modal */}
        <EmployeeViewModal
          show={showViewModal}
          onHide={() => setShowViewModal(false)}
          employee={selectedEmployee}
        />

        {/* Custom Confirmation Modal for Deletion */}
        <CommonConfirmModal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          title="Confirm Delete"
          message="Are you sure you want to delete this employee?"
          confirmText="Delete"
          confirmVariant="danger"
        />
      </div>
    </div>
  );
};

export default Employeelist;