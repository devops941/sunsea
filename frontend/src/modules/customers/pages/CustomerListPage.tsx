import React, { useState, useEffect, useCallback } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useCustomers } from "../../../hooks/useCustomers";
import { hasPermission } from "../../../utils/permission";
import CustomerViewModal from "../components/CustomerViewModal";
import DataTable from "../../../components/ui/table/DataTable";

const ITEMS_PER_PAGE = 10;

const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();
  // BUG-CUST-004 fix: destructure pagination metadata from hook
  const { customers, loading, error, totalPages, loadCustomers, removeCustomer } = useCustomers();


  const canEditCustomer = hasPermission("customers.edit");
  const canDeleteCustomer = hasPermission("customers.delete");

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  // BUG-CUST-004 fix: currentPage drives server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialSearch = searchParams.get("search") || "";

  const [searchTerm, setSearchTerm] = useState(initialSearch);

  // BUG-CUST-004 fix: send page + limit to server on every search/page change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers({ search: searchTerm, page: currentPage, limit: ITEMS_PER_PAGE });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, currentPage, loadCustomers]);

  // Custom confirm delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // reset to page 1 on new search
  };

  const handleView = useCallback((customer: any) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  }, []);

  const handleEdit = useCallback((customer: any) => {
    navigate(`/customers/edit/${customer.id}`, {
      state: customer,
    });
  }, [navigate]);

  const triggerDelete = useCallback((id: string) => {
    setCustomerToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (customerToDelete !== null) {
      try {
        await removeCustomer(customerToDelete);
        toast.success("Customer deleted successfully!");
        // Reload current page after deletion
        loadCustomers({ search: searchTerm, page: currentPage, limit: ITEMS_PER_PAGE });
      } catch (err: any) {
        toast.error(err.message || "Failed to delete customer");
      } finally {
        setShowDeleteModal(false);
        setCustomerToDelete(null);
      }
    }
  };

  // BUG-CUST-004 fix: data already paginated by server — no client-side slicing needed
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  return (
    <div>
      <div className="">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Customer Management</h2>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Search customer..."
                  value={searchTerm}
                  onChange={handleSearch}
                />
              </div>
              <CustomButton
                text="Add Customer"
                icon={FaPlus}
                onClick={() => navigate("/customers/create")}
              />
            </div>
          </div>

          {/* View Table */}
          <div className="p-0">
            <DataTable
              data={customers ?? []}
              rowKey={(customer) => customer.id}
              loading={loading}
              emptyMessage="No customers found."
              pagination={
                totalPages > 1
                  ? {
                    currentPage,
                    totalPages,
                    onPageChange: (page) => setCurrentPage(page),
                  }
                  : undefined
              }
              columns={[
                { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
                { header: "CUSTOMER CODE", accessor: "customerCode" },
                { header: "FIRM NAME", accessor: "firmName" },
                { header: "MOBILE", render: (customer) => Array.isArray(customer.mobile) && customer.mobile.length > 0 ? customer.mobile[0].number : (typeof customer.mobile === "string" ? customer.mobile : "N/A") },
                // BUG-CUST-006 fix: renamed "GMAIL" to "EMAIL"
                { header: "EMAIL", render: (customer) => customer.email || "N/A" },
                {
                  header: "STATUS", render: (customer) => (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${customer.status === "Active"
                      ? "bg-green-100 text-green-700 border border-green-200"
                      : "bg-red-100 text-red-700 border border-red-200"
                      }`}>
                      {customer.status}
                    </span>
                  ), align: "center"
                },
                {
                  header: "ACTIONS",
                  render: (customer) => (
                    <div className="flex items-center gap-2">
                      <ViewButton onClick={() => handleView(customer)} />
                      {canEditCustomer && <EditButton onClick={() => handleEdit(customer)} />}
                      {canDeleteCustomer && <DeleteButton onClick={() => triggerDelete(customer.id)} />}
                    </div>
                  ),
                  align: "center"
                },
              ]}
            />
          </div>
        </div>

        <CustomerViewModal
          show={showViewModal}
          onHide={() => setShowViewModal(false)}
          customer={selectedCustomer}
        />

        {/* Custom Delete Confirm Modal */}
        <CommonConfirmModal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          title="Confirm Delete"
          message="Are you sure you want to delete this customer?"
          confirmText="Delete"
          confirmVariant="danger"
        />
      </div>
    </div>
  );
};

export default CustomerListPage;