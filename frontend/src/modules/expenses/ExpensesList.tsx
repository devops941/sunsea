import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "react-bootstrap";
import { FaPlus, FaFilePdf } from "react-icons/fa";
import { toast } from "react-toastify";

import DataTable from "../../components/ui/table/DataTable";
import SearchInput from "../../components/ui/SearchInput/SearchInput";
import ViewButton from "../../components/ui/viewbutton/ViewButton";
import EditButton from "../../components/ui/EditButton/EditButton";
import DeleteButton from "../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../components/ui/Button/Button";
import CommonConfirmModal from "../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CommonViewModal from "../../components/ui/CommonViewModal/CommonViewModal";
import ExpensesCreate from "./Expensescreate";
import { useExpenses } from "../../hooks/useExpenses";
import CommonModal from "../../components/ui/Modal/CommonModal";
import { useSocketSync } from "../../hooks/useSocketSync";

const ITEMS_PER_PAGE = 10;

interface Expense {
  id: string;
  expenseNumber: string;
  expenseCategory: string;
  date: string;
  expense: string;
  amount: string;
  description: string;
  supplier?: { legalName: string; supplierCode: string } | any;
  paymentMethod: string;
  status: string;
  notes: string;
  receiptInvoice: string;
}

const ExpensesList: React.FC = () => {
  const { expenses, loading, error, total, loadExpenses, removeExpense } = useExpenses();

  const [viewMode, setViewMode] = useState<"list" | "create" | "edit">("list");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const fetchExpenseData = useCallback(() => {
    loadExpenses({
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      search: searchTerm || undefined,
      category: filterCategory || undefined,
      status: filterStatus || undefined,
    });
  }, [currentPage, searchTerm, filterCategory, filterStatus, loadExpenses]);

  useSocketSync("expense", undefined, fetchExpenseData);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenseData();
    }, 500);
    return () => clearTimeout(timer);
  }, [currentPage, searchTerm, filterCategory, filterStatus, loadExpenses]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleView = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
    setShowViewModal(true);
  }, []);

  const handleEdit = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
    setViewMode("edit");
  }, []);

  const triggerDelete = useCallback((id: string) => {
    setExpenseToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (expenseToDelete !== null) {
      try {
        await removeExpense(expenseToDelete);
        toast.success("Expense deleted successfully!");
        loadExpenses({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: searchTerm || undefined,
          category: filterCategory || undefined,
          status: filterStatus || undefined,
        });
      } catch (err: any) {
        toast.error(err.message || "Failed to delete expense.");
      } finally {
        setShowDeleteModal(false);
        setExpenseToDelete(null);
      }
    }
  };

  const handleSaveComplete = () => {
    setViewMode("list");
    setSelectedExpense(null);
    loadExpenses({
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      search: searchTerm || undefined,
      category: filterCategory || undefined,
      status: filterStatus || undefined,
    });
  };

  const handleCancel = () => {
    setViewMode("list");
    setSelectedExpense(null);
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
  const paginatedExpenses = expenses || [];

  const categories = [
    "Office Supplies",
    "Travel & Lodging",
    "Software & Hosting",
    "Utilities",
    "Salaries",
    "Rent",
    "Marketing",
    "Others"
  ];
  const statuses = ["Draft", "Pending", "Approved", "Rejected"];

  const formatDateString = (isoString: string) => {
    if (!isoString) return "N/A";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  if (viewMode === "create" || (viewMode === "edit" && selectedExpense)) {
    return (
      <ExpensesCreate
        onSaveComplete={handleSaveComplete}
        onCancel={handleCancel}
        initialData={viewMode === "edit" ? selectedExpense : undefined}
      />
    );
  }

  return (
    <div>
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink">Expense Management</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search expenses..."
            />
            <select
              className="border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Categories</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <CustomButton
              text="Add Expense"
              icon={FaPlus}
              onClick={() => setViewMode("create")}
            />
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={paginatedExpenses}
          rowKey={(item) => item.id}
          loading={loading}
          emptyMessage="No expenses found."
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (page) => setCurrentPage(page),
          }}
          columns={[
            {
              header: "#",
              width: "60px",
              render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
            },
            { header: "EXPENSE NUMBER", accessor: "expenseNumber" },
            {
              header: "CATEGORY",
              render: (item) => (
                <span className="bg-card-2 text-ink-muted px-2 py-1 rounded text-xs border border-line">
                  {item.expenseCategory}
                </span>
              ),
            },
            { header: "DATE", render: (item) => formatDateString(item.date) },
            { header: "EXPENSE", accessor: "expense" },
            {
              header: "AMOUNT",
              render: (item) => (
                <span className="font-semibold text-blue-600">
                  ₹{parseFloat(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              ),
            },
            {
              header: "SUPPLIER",
              render: (item) => item.supplier?.legalName || item.supplier || "N/A",
            },
            { header: "PAYMENT METHOD", accessor: "paymentMethod" },
            {
              header: "ACTIONS",
              render: (item) => (
                <div className="flex items-center gap-2">
                  <ViewButton onClick={() => handleView(item)} />
                  <EditButton onClick={() => handleEdit(item)} />
                  <DeleteButton onClick={() => triggerDelete(item.id)} />
                </div>
              ),
            },
          ]}
        />

        {/* View Modal */}
        <CommonViewModal
          show={showViewModal}
          onHide={() => setShowViewModal(false)}
          modalTitle="Expense Details"
          avatarText={selectedExpense ? selectedExpense.expenseNumber.charAt(0).toUpperCase() : ""}
          headerTitle={selectedExpense ? selectedExpense.expenseNumber : ""}
          headerSubtitle={selectedExpense ? `Category: ${selectedExpense.expenseCategory}` : ""}
          sections={
            selectedExpense
              ? [
                {
                  fields: [
                    { label: "Expense Number", value: selectedExpense.expenseNumber },
                    { label: "Category", value: selectedExpense.expenseCategory },
                    { label: "Expense Date", value: formatDateString(selectedExpense.date) },
                    { label: "Expense Name", value: selectedExpense.expense },
                  ],
                },
                {
                  fields: [
                    {
                      label: "Amount",
                      value: `₹${parseFloat(selectedExpense.amount).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}`,
                    },
                    { label: "Supplier", value: selectedExpense.supplier?.legalName || selectedExpense.supplier || "N/A" },
                    { label: "Payment Method", value: selectedExpense.paymentMethod },
                    { label: "Status", value: selectedExpense.status === "Pending" ? "Pending Approval" : selectedExpense.status },
                  ],
                },
                {
                  title: "Additional Information",
                  fields: [
                    { label: "Description", value: selectedExpense.description || "N/A" },
                    { label: "Internal Notes", value: selectedExpense.notes || "N/A" },
                  ],
                },
                {
                  title: "Attachment",
                  fields: [
                    {
                      label: "Receipt / Invoice",
                      value: selectedExpense.receiptInvoice ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                          {selectedExpense.receiptInvoice.toLowerCase().endsWith(".pdf") ? (
                            <a
                              href={selectedExpense.receiptInvoice}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-outline-primary btn-sm"
                              style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "fit-content" }}
                            >
                              <FaFilePdf /> View PDF Document
                            </a>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <img
                                src={selectedExpense.receiptInvoice}
                                alt="Receipt Copy"
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: "300px",
                                  objectFit: "contain",
                                  border: "1px solid var(--color-border)",
                                  borderRadius: "6px",
                                }}
                                onError={(e: any) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'block';
                                }}
                              />
                              <a
                                href={selectedExpense.receiptInvoice}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-link btn-sm text-decoration-none p-0 text-start"
                                style={{ width: "fit-content" }}
                              >
                                Open in New Tab
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        "No attachment"
                      ),
                    },
                  ],
                },
              ]
              : []
          }
        />

        {/* Delete Modal */}
        <CommonConfirmModal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          title="Confirm Delete"
          message="Are you sure you want to delete this expense?"
          confirmText="Delete"
          confirmVariant="danger"
        />


      </div>
    </div>
  );
};

export default ExpensesList;
