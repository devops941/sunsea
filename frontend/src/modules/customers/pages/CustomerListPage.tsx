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
  const { customers, loading, error, loadCustomers, removeCustomer } = useCustomers();
  const canEditCustomer = hasPermission("customers.edit");
  const canDeleteCustomer = hasPermission("customers.delete");

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialSearch = searchParams.get("search") || "";

  const [searchTerm, setSearchTerm] = useState(initialSearch);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, loadCustomers]);

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
    setCurrentPage(1);
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
      } catch (err: any) {
        toast.error(err.message || "Failed to delete customer");
      } finally {
        setShowDeleteModal(false);
        setCustomerToDelete(null);
      }
    }
  };
  
  const filteredCustomers = customers ?? [];
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="p-4 md:p-6 min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto">
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
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
          {loading && (customers ?? []).length === 0 ? (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <DataTable
              data={paginatedCustomers}
              rowKey={(customer) => customer.id}
              emptyMessage="No customers found."
              pagination={
                  totalPages > 1
                      ? {
                            currentPage,
                            totalPages,
                            onPageChange: setCurrentPage,
                        }
                      : undefined
              }
              columns={[
                  { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
                  { header: "CUSTOMER CODE", accessor: "customerCode" },
                  { header: "FIRM NAME", accessor: "firmName" },
                  { header: "MOBILE", render: (customer) => customer.mobile || "N/A" },
                  { header: "GMAIL", render: (customer) => customer.email || "N/A" },
                  { header: "GST TYPE", render: (customer) => customer.gstRegType || "N/A" },
                  { header: "STATUS", render: (customer) => (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        customer.status === "Active" 
                            ? "bg-green-100 text-green-700 border border-green-200" 
                            : "bg-red-100 text-red-700 border border-red-200"
                    }`}>
                      {customer.status}
                    </span>
                  ) },
                  {
                      header: "ACTIONS",
                      render: (customer) => (
                          <div className="flex items-center gap-2">
                              <ViewButton onClick={() => handleView(customer)} />
                              {canEditCustomer && <EditButton onClick={() => handleEdit(customer)} />}
                              {canDeleteCustomer && <DeleteButton onClick={() => triggerDelete(customer.id)} />}
                          </div>
                      ),
                      align: "right"
                  },
              ]}
            />
          )}
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