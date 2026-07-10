import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import EmployeeViewModal from "../../employee/components/EmployeeViewModal";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useEmployees } from "../../../hooks/useEmployees";
import Select from "react-select";
import { hasPermission } from "../../../utils/permission";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

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


  // Custom Delete Modal State
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


  const paginatedEmployees = employees;

  console.log(employees, "emp")

  return (
    <div className="inner-container">
      <Container fluid>
        {/* Page Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Employee Management</h2>
                <div className="page-breadcrumb">Home / Employees</div>
              </div>
            </Col>
            <Col lg={6} md={12}>
              <div className="page-header-actions">

                <div className="page-search-wrap">
                  <FaSearch className="page-search-icon" />
                  <input
                    type="text"
                    className="page-search-input"
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
            </Col>
          </Row>
        </div>

        {/* View Table */}
        <div className="master-table-body table-wrap">
          <div className="master-table-body">
            {loading && employees.length === 0 ? (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : (
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>#</th>
                    <th>EMPLOYEE CODE</th>
                    <th>EMPLOYEE NAME</th>
                    <th>MOBILE</th>
                    <th>DEPARTMENT</th>
                    {/* <th>DESIGNATION</th> */}
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEmployees.length > 0 ? (
                    paginatedEmployees.map((employee, index) => (
                      <tr key={employee.id} className="master-data-row">
                        <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                        <td className="master-data-cell">{employee.empCode}</td>
                        <td className="master-data-cell">{employee.fullName}</td>
                        <td className="master-data-cell">{employee.mobile || "N/A"}</td>
                        <td className="master-data-cell">{employee.department?.name || "N/A"}</td>
                        {/* <td className="master-data-cell">{employee.designation?.name || "N/A"}</td> */}
                        <td className="master-data-cell">
                          <StatusBadge status={employee.status === "active" ? "ACTIVE" : "INACTIVE"} />
                        </td>
                        <td className="master-data-cell">
                          <div className="table-action-group">
                            <ViewButton onClick={() => handleView(employee)} />
                            {canEditEmployee && <EditButton onClick={() => handleEdit(employee)} />}
                            {canDeleteEmployee && <DeleteButton onClick={() => triggerDelete(employee.id)} />}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center p-4">No employees found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination-wrap">
                <button
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <FaChevronLeft />
                </button>
                <div className="pagination-info">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  className="pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <FaChevronRight />
                </button>
              </div>
            )}
          </div>
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
      </Container>
    </div>
  );
};

export default Employeelist;