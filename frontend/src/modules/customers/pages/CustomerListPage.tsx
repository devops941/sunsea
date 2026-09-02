import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaTimes, FaPlus } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { useCustomers } from "../../../hooks/useCustomers";
import { usePermission } from "../../../hooks/usePermission";
import { useCustomerTypes } from "../../../hooks/useCustomerTypes";
import { useCustomerGrades } from "../../../hooks/useCustomerGrades";
import CustomerViewModal from "../components/CustomerViewModal";
import DataTable from "../../../components/ui/table/DataTable";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { customerService } from "../../../services/customerService";

const ITEMS_PER_PAGE = 15;

interface FilterState {
  status: string;         // "" = all  |  "Active"  |  "Inactive"
  customerTypeId: string; // "" = all  |  numeric string
  customerGradeId: string;
}

const DEFAULT_FILTERS: FilterState = {
  status: "",
  customerTypeId: "",
  customerGradeId: "",
};

const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();
  const { customers, loading, error, totalPages, loadCustomers, removeCustomer } = useCustomers();
  const { customerTypes } = useCustomerTypes();
  const { customerGrades } = useCustomerGrades();

  const { can } = usePermission();
  const canCreate      = can("customers.create");
  const canEditCustomer   = can("customers.edit");
  const canDeleteCustomer = can("customers.delete");

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const location = useLocation();
  const initialSearch = new URLSearchParams(location.search).get("search") || "";
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  // Applied = sent to server; Draft = shown inside filter panel before Apply
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draftFilters,   setDraftFilters]   = useState<FilterState>(DEFAULT_FILTERS);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeFilterCount = [
    appliedFilters.status        !== "",
    appliedFilters.customerTypeId  !== "",
    appliedFilters.customerGradeId !== "",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  // Debounced server fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (can("customers.view")) {
        loadCustomers({
          search:          searchTerm || undefined,
          page:            currentPage,
          limit:           ITEMS_PER_PAGE,
          status:          appliedFilters.status        || undefined,
          customerTypeId:  appliedFilters.customerTypeId  ? Number(appliedFilters.customerTypeId)  : undefined,
          customerGradeId: appliedFilters.customerGradeId ? Number(appliedFilters.customerGradeId) : undefined,
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, currentPage, appliedFilters, loadCustomers, can]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  }, []);

  // Sync draft with applied when panel opens
  const handleFilterOpen = useCallback(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setCurrentPage(1);
  }, [draftFilters]);

  const handleClearFilters = useCallback(() => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  }, []);

  const handleCloseViewModal = useCallback(() => {
    setShowViewModal(false);
    setSelectedCustomer(null);
  }, []);

  const fetchCustomersForExport = useCallback(async () => {
    const res = await customerService.fetchAll({ page: 1, limit: 100000 });
    return res?.customers || (Array.isArray(res) ? res : []);
  }, []);

  const { csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Customer Code", accessor: (item: any) => item.customerCode || "" },
      { header: "Customer Name", accessor: (item: any) => item.customerName || item.companyName || "" },
      { header: "Contact Person", accessor: (item: any) => item.contactPerson || "" },
      { header: "Mobile", accessor: (item: any) => item.mobile || "" },
      { header: "Email", accessor: (item: any) => item.email || "" },
      { header: "Customer Type", accessor: (item: any) => item.customerType?.name || "" },
      { header: "Grade", accessor: (item: any) => item.customerGrade?.name || "" },
      { header: "GSTIN", accessor: (item: any) => item.gstNumber || item.gstin || "" },
      { header: "Status", accessor: (item: any) => item.status || "" },
    ];
    return {
      csvColumns: columns,
      csvFilename: `Customer_List_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, []);

  const handleView = useCallback((customer: any) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  }, []);

  const handleEdit = useCallback((customer: any) => {
    navigate(`/customers/edit/${customer.id}`, { state: customer });
  }, [navigate]);

  const triggerDelete = useCallback((id: string) => {
    setCustomerToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!customerToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await removeCustomer(customerToDelete);
      toast.success("Customer deleted successfully!");
      loadCustomers({
        search:          searchTerm || undefined,
        page:            currentPage,
        limit:           ITEMS_PER_PAGE,
        status:          appliedFilters.status        || undefined,
        customerTypeId:  appliedFilters.customerTypeId  ? Number(appliedFilters.customerTypeId)  : undefined,
        customerGradeId: appliedFilters.customerGradeId ? Number(appliedFilters.customerGradeId) : undefined,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to delete customer");
    } finally {
      setShowDeleteModal(false);
      setCustomerToDelete(null);
      setIsDeleting(false);
    }
  }, [customerToDelete, isDeleting, removeCustomer, loadCustomers, searchTerm, currentPage, appliedFilters]);

  // ── Derived values ────────────────────────────────────────────────────────
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const gradeOptions = customerGrades.map((g) => ({ label: g.name, value: g.id }));
  const typeOptions  = customerTypes.map((t)  => ({ label: t.name, value: t.id }));

  const activeTypeName  = customerTypes.find((t) => String(t.id) === appliedFilters.customerTypeId)?.name;
  const activeGradeName = customerGrades.find((g) => String(g.id) === appliedFilters.customerGradeId)?.name;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="max-w-[1300px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
          <h2 className="text-2xl font-bold text-ink">Customer Management</h2>

          <div className="flex flex-wrap items-center gap-3 relative w-full md:w-auto">
            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search customer..."
            />

            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onOpen={handleFilterOpen}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
            >
              <div className="space-y-3">
                {/* Customer Grade */}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    Customer Grade
                  </label>
                  <SelectInput
                    name="filterGrade"
                    value={draftFilters.customerGradeId}
                    options={gradeOptions}
                    defaultOptionLabel="All Grades"
                    searchable={false}
                    noMargin
                    onChange={(e) =>
                      setDraftFilters((p) => ({ ...p, customerGradeId: e.target.value }))
                    }
                  />
                </div>

                {/* Customer Type */}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    Customer Type
                  </label>
                  <SelectInput
                    name="filterType"
                    value={draftFilters.customerTypeId}
                    options={typeOptions}
                    defaultOptionLabel="All Types"
                    searchable={false}
                    noMargin
                    onChange={(e) =>
                      setDraftFilters((p) => ({ ...p, customerTypeId: e.target.value }))
                    }
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    Status
                  </label>
                  <SelectInput
                    name="filterStatus"
                    value={draftFilters.status}
                    options={[
                      { value: "Active",   label: "Active" },
                      { value: "Inactive", label: "Inactive" },
                    ]}
                    defaultOptionLabel="All Statuses"
                    searchable={false}
                    noMargin
                    onChange={(e) =>
                      setDraftFilters((p) => ({ ...p, status: e.target.value }))
                    }
                  />
                </div>
              </div>
            </FilterPopover>

            <ExportCSVButton
              fetchData={fetchCustomersForExport}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
            />

            {canCreate && (
              <CustomButton
                text="Add Customer"
                icon={FaPlus}
                onClick={() => navigate("/customers/create")}
              />
            )}
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 px-6 py-2 border-b border-line flex-wrap">
            <span className="text-xs text-ink-subtle">Active filters:</span>

            {appliedFilters.status && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                Status: {appliedFilters.status}
                <FaTimes
                  className="cursor-pointer hover:text-indigo-200 ml-0.5"
                  onClick={() => { setAppliedFilters((p) => ({ ...p, status: "" })); setCurrentPage(1); }}
                />
              </span>
            )}

            {appliedFilters.customerTypeId && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                Type: {activeTypeName}
                <FaTimes
                  className="cursor-pointer hover:text-indigo-200 ml-0.5"
                  onClick={() => { setAppliedFilters((p) => ({ ...p, customerTypeId: "" })); setCurrentPage(1); }}
                />
              </span>
            )}

            {appliedFilters.customerGradeId && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                Grade: {activeGradeName}
                <FaTimes
                  className="cursor-pointer hover:text-indigo-200 ml-0.5"
                  onClick={() => { setAppliedFilters((p) => ({ ...p, customerGradeId: "" })); setCurrentPage(1); }}
                />
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="p-0">
          <DataTable
            data={customers ?? []}
            rowKey={(customer) => customer.id}
            loading={loading}
            emptyMessage="No customers found."
            pagination={
              totalPages > 1
                ? { currentPage, totalPages, onPageChange: (page) => setCurrentPage(page) }
                : undefined
            }
            columns={[
              { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
              { header: " NAME",     accessor: "firmName" },
              { header: "TYPE",  render: (c) => c.customerType?.name  || "—" },
              { header: "GRADE", render: (c) => c.customerGrade?.name || "—" },
              {
                header: "MOBILE",
                render: (c) =>
                  Array.isArray(c.mobile) && c.mobile.length > 0
                    ? c.mobile[0].number
                    : typeof c.mobile === "string"
                    ? c.mobile
                    : "N/A",
              },
              { header: "EMAIL", render: (c) => c.email || "N/A" },
              {
                header: "BALANCE",
                render: (c: any) => {
                  const netBal = Number(
                    c.netBalance ??
                      (c.openingBalanceType === "CREDIT"
                        ? -Math.abs(c.openingBalance || 0)
                        : Math.abs(c.openingBalance || 0))
                  );
                  const amt = Math.abs(netBal);
                  const formattedAmt = amt.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                  if (netBal > 0) {
                    return (
                      <span className="font-mono font-bold text-blue-400">
                        ₹{formattedAmt} Dr
                      </span>
                    );
                  } else if (netBal < 0) {
                    return (
                      <span className="font-mono font-bold text-emerald-400">
                        ₹{formattedAmt} Cr
                      </span>
                    );
                  }
                  return <span className="font-mono text-ink-muted">₹0.00</span>;
                },
                align: "right",
              },
              {
                header: "STATUS",
                render: (c) => <StatusBadge status={c.status === "Active" ? "ACTIVE" : "INACTIVE"} />,
                align: "center",
              },
              {
                header: "ACTIONS",
                render: (customer) => (
                  <div className="flex items-center gap-2">
                    <ViewButton onClick={() => handleView(customer)} />
                    {canEditCustomer   && <EditButton   onClick={() => handleEdit(customer)} />}
                    {canDeleteCustomer && <DeleteButton onClick={() => triggerDelete(customer.id)} />}
                  </div>
                ),
                align: "center",
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

      <CommonConfirmModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        confirmText={isDeleting ? "Deleting..." : "Delete"}
        confirmVariant="danger"
        isDangerous={true}
      />
    </div>
  );
};

export default CustomerListPage;
