import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { FaTimes, FaPlus, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
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
import { useListCache, markStaleByPrefix } from "../../../hooks/useListCache";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { usePermission } from "../../../hooks/usePermission";
import { useCustomerTypes } from "../../../hooks/useCustomerTypes";
import { useCustomerGrades } from "../../../hooks/useCustomerGrades";
import CustomerViewModal from "../components/CustomerViewModal";
import DataTable from "../../../components/ui/table/DataTable";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { customerService } from "../../../services/customerService";

const ITEMS_PER_PAGE = 15;

type SortOrder = "default" | "asc" | "desc";

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

const CACHE_PREFIX = "customers:";
const SORT_STORAGE_KEY = "sunsea_customer_sort_name";

const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const { customerTypes } = useCustomerTypes();
  const { customerGrades } = useCustomerGrades();

  const { can } = usePermission();
  const canCreate      = can("customers.create");
  const canEditCustomer   = can("customers.edit");
  const canDeleteCustomer = can("customers.delete");
  const canExport      = can("customers.export");

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  const location = useLocation();
  const initialSearch = new URLSearchParams(location.search).get("search") || "";
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const cacheKey = `${CACHE_PREFIX}${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}:${appliedFilters.status}:${appliedFilters.customerTypeId}:${appliedFilters.customerGradeId}`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await customerService.fetchAll({
      search:          debouncedSearch || undefined,
      page:            currentPage,
      limit:           ITEMS_PER_PAGE,
      status:          appliedFilters.status        || undefined,
      customerTypeId:  appliedFilters.customerTypeId  ? Number(appliedFilters.customerTypeId)  : undefined,
      customerGradeId: appliedFilters.customerGradeId ? Number(appliedFilters.customerGradeId) : undefined,
    });
    return { data: res.customers || [], total: res.total || 0 };
  }, [debouncedSearch, currentPage, appliedFilters]);

  const { data: rawCustomers, total, loading, refresh } = useListCache({
    cacheKey,
    socketModule: "customer",
    fetcher,
    enabled: can("customers.view"),
  });

  // Client-side sorted customers based on persistent sortOrder
  const customers = useMemo(() => {
    if (!rawCustomers || !Array.isArray(rawCustomers)) return [];
    if (sortOrder === "default") return rawCustomers;

    return [...rawCustomers].sort((a: any, b: any) => {
      const nameA = (a.firmName || a.customerName || a.companyName || "").trim().toLowerCase();
      const nameB = (b.firmName || b.customerName || b.companyName || "").trim().toLowerCase();
      if (sortOrder === "asc") {
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
      } else {
        return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: "base" });
      }
    });
  }, [rawCustomers, sortOrder]);

  usePageShortcuts({
    onRefresh: () => refresh(),
    onSort: () => toggleSortOrder(),
    onDelete: () => setShowDeleteModal(true),
    onNew: () => canCreate && navigate("/customers/create"),
    onExport: () => {
      const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-btn], button:has(svg):has(span)");
      exportBtn?.click();
    },
  });

  const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE);

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
    // Return focus to the table after modal closes
    setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
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

  // ── Table keyboard navigation ─────────────────────────────────────────────
  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    count: customers?.length ?? 0,
    onEnter: (i) => {
      const customer = customers?.[i];
      if (customer) handleView(customer);
    },
    onEdit: (i) => {
      const customer = customers?.[i];
      if (customer && canEditCustomer) handleEdit(customer);
    },
    containerRef: tableRef,
  });

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
      await customerService.delete(customerToDelete);
      toast.success("Customer deleted successfully!");
      markStaleByPrefix(CACHE_PREFIX);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to delete customer");
    } finally {
      setShowDeleteModal(false);
      setCustomerToDelete(null);
      setIsDeleting(false);
    }
  }, [customerToDelete, isDeleting, refresh]);

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
          <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
            Customer Management
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-xs dark:bg-slate-800/90 dark:text-slate-200 dark:border dark:border-slate-700/60">
              {total ?? 0}
            </span>
          </h2>

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

            {canExport && (
              <ExportCSVButton
                fetchData={fetchCustomersForExport}
                columns={csvColumns}
                filename={csvFilename}
                text="Export"
              />
            )}

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

        {/* Table — data-table-nav lets F3-exit restore focus here */}
        <div
          ref={tableRef}
          tabIndex={0}
          data-table-nav
          className="p-0 outline-none"
        >
          <DataTable
            data={customers ?? []}
            rowKey={(customer) => customer.id}
            loading={loading}
            emptyMessage="No customers found."
            rowClassName={(_row, index) =>
              index === focusedIndex
                ? "bg-primary/8"
                : ""
            }
            onRowClick={(customer, index) => {
              setFocusedIndex(index);
              // Refocus the container so arrow keys keep working after the
              // view modal closes (handleCloseViewModal also does this, but
              // doing it here covers edge cases like dismissing without action).
              tableRef.current?.focus({ preventScroll: true });
              handleView(customer);
            }}
            pagination={
              totalPages > 1
                ? { currentPage, totalPages, onPageChange: (page) => setCurrentPage(page) }
                : undefined
            }
            columns={[
              { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
              {
                header: "NAME",
                accessor: "firmName",
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
                      NAME
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
              },
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
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
        onHide={handleCloseViewModal}
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
