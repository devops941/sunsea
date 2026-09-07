import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTimes, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { toast } from "react-toastify";

import { returnService, type SalesReturn } from "../../../../services/returnService";
import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";
import { useCustomerGrades } from "../../../../hooks/useCustomerGrades";
import { formatStockQty } from "../../../../utils/uomConversion";
import { useSocketSync } from "../../../../hooks/useSocketSync";
import { useListCache } from "../../../../hooks/useListCache";
import CustomButton from "../../../../components/ui/Button/Button";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import FilterPopover from "../../../../components/ui/FilterPopover/FilterPopover";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import DataTable, { type DataTableColumn } from "../../../../components/ui/table/DataTable";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import { usePermission } from "../../../../hooks/usePermission";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../../hooks/useTableKeyboardNav";

type SortOrder = "default" | "asc" | "desc";
const SORT_STORAGE_KEY = "sunsea_sales_return_sort";

interface FilterState {
  customerGradeId: string;
  status: string;
}

const DEFAULT_FILTERS: FilterState = {
  customerGradeId: "",
  status: "",
};

export const SalesReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const { can } = usePermission();
  const [selectedViewReturn, setSelectedViewReturn] = useState<SalesReturn | null>(null);

  const { customerGrades } = useCustomerGrades();
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // ── Alphabetical / Column Sorting with localStorage persistence ──────────
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

  const cacheKey = `accounts:sales-returns`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    try {
      const rData = await returnService.fetchSalesReturns();
      const list = rData || [];
      return { data: list, total: list.length };
    } catch (err: any) {
      toast.error(err?.message || "Failed to load sales returns");
      throw err;
    }
  }, []);

  const { data: returns, loading, refresh } = useListCache<SalesReturn>({
    cacheKey,
    socketModule: "salesReturn",
    fetcher,
  });

  useSocketSync("salesInvoice", undefined, refresh);
  useSocketSync("customer", undefined, refresh);

  const activeFilterCount = [appliedFilters.customerGradeId, appliedFilters.status].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const handleFilterOpen = () => setDraftFilters(appliedFilters);

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
  };

  const handleClearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const handleRemoveFilter = (key: keyof FilterState) => {
    setAppliedFilters((prev) => ({ ...prev, [key]: "" }));
  };

  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          r.returnNo?.toLowerCase().includes(term) ||
          r.customer?.firmName?.toLowerCase().includes(term) ||
          r.reason?.toLowerCase().includes(term) ||
          r.status?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      if (appliedFilters.customerGradeId) {
        const gradeId = Number(appliedFilters.customerGradeId);
        const matchGrade =
          r.customer?.customerGradeId === gradeId ||
          r.customer?.customerGrade?.id === gradeId;
        if (!matchGrade) return false;
      }

      if (appliedFilters.status) {
        if (r.status !== appliedFilters.status) return false;
      }

      return true;
    });
  }, [returns, searchTerm, appliedFilters]);

  // Client-side sorted returns based on sortOrder
  const sortedReturns = useMemo(() => {
    if (!filteredReturns || !Array.isArray(filteredReturns)) return [];
    if (sortOrder === "default") return filteredReturns;

    return [...filteredReturns].sort((a: any, b: any) => {
      const nameA = (a.customer?.firmName || a.customer?.displayName || a.returnNo || "").trim().toLowerCase();
      const nameB = (b.customer?.firmName || b.customer?.displayName || b.returnNo || "").trim().toLowerCase();
      if (sortOrder === "asc") {
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
      } else {
        return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: "base" });
      }
    });
  }, [filteredReturns, sortOrder]);

  // ── Table keyboard navigation (Arrow keys, Enter to view, E to edit) ────
  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    count: sortedReturns.length,
    onEnter: (i) => {
      const item = sortedReturns[i];
      if (item) setSelectedViewReturn(item);
    },
    onEdit: (i) => {
      const item = sortedReturns[i];
      if (item) navigate(`/sales-returns/edit/${item.id}`);
    },
    containerRef: tableRef,
  });

  // ── Page Shortcuts (F5 refresh, F6 sort, Ins new, Ctrl+Shift+E export) ──
  usePageShortcuts({
    onRefresh: () => refresh(),
    onSort: () => toggleSortOrder(),
    onNew: () => navigate("/sales-returns/create"),
    onExport: () => {
      const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-btn], button:has(svg):has(span)");
      exportBtn?.click();
    },
  });

  const fetchSalesReturnsForExport = useCallback(async () => {
    try {
      const list = await returnService.fetchSalesReturns();
      if (Array.isArray(list) && list.length > 0) return list;
    } catch (e) {
      console.warn("fetchSalesReturns failed, using current returns:", e);
    }
    return Array.isArray(returns) ? returns : [];
  }, [returns]);

  const { csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Return No", accessor: (item: any) => item.returnNo || "" },
      { header: "Return Date", accessor: (item: any) => item.returnDate ? new Date(item.returnDate).toLocaleDateString("en-IN") : "" },
      { header: "Customer", accessor: (item: any) => item.customer?.firmName || item.customer?.displayName || "" },
      { header: "Invoice No", accessor: (item: any) => item.salesInvoice?.invoiceNo || (item.salesInvoiceId ? `INV #${item.salesInvoiceId}` : "") },
      { header: "Grand Total (₹)", accessor: (item: any) => item.grandTotal != null ? Number(item.grandTotal).toFixed(2) : "0.00" },
      { header: "Reason", accessor: (item: any) => item.reason || "" },
      { header: "Status", accessor: (item: any) => item.status || "" },
    ];
    return {
      csvColumns: columns,
      csvFilename: `Sales_Returns_List_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, []);

  const activeGradeName = customerGrades.find(
    (g) => String(g.id) === appliedFilters.customerGradeId
  )?.name;

  const gradeOptions = customerGrades.map((g) => ({ label: g.name, value: String(g.id) }));

  const columns: DataTableColumn<SalesReturn>[] = [
    {
      header: "#",
      width: "60px",
      render: (_item, index) => index + 1,
      align: "center",
    },
    {
      header: "RETURN NO",
      render: (item) => (
        <button
          onClick={() => setSelectedViewReturn(item)}
          className="font-mono font-semibold text-indigo-500 hover:underline cursor-pointer"
          title="Click to view Sales Return Details"
        >
          {item.returnNo}
        </button>
      ),
    },
    {
      header: "DATE",
      render: (item) => (
        <span className="text-ink-muted">
          {new Date(item.returnDate).toLocaleDateString("en-IN")}
        </span>
      ),
    },
    {
      header: "CUSTOMER",
      headerNode: (
        <button
          type="button"
          onClick={toggleSortOrder}
          className="flex items-center gap-1.5 hover:text-ink transition-colors cursor-pointer group/sort text-left uppercase tracking-wider text-[11px] font-bold"
          title="Click to sort by customer name (or press F6 / Alt+S)"
        >
          <span>CUSTOMER</span>
          <span
            className={`p-0.5 rounded transition-transform ${
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
      render: (item) => {
        const gradeName = item.customer?.customerGrade?.name || item.customer?.grade;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-ink">{item.customer?.firmName || "—"}</span>
            {gradeName && (
              <span className="text-[11px] text-ink-subtle">Grade: {gradeName}</span>
            )}
          </div>
        );
      },
    },
    {
      header: "STATUS",
      render: (item) => <StatusBadge status={item.status} />,
      align: "center",
    },
    {
      header: "GRAND TOTAL (₹)",
      render: (item) => (
        <span className="font-mono font-semibold text-indigo-500 whitespace-nowrap">
          ₹{Number(item.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
      align: "right",
    },
    {
      header: "REASON",
      render: (item) => (
        <span className="text-ink-subtle truncate max-w-xs block">{item.reason || "—"}</span>
      ),
    },
    {
      header: "ACTIONS",
      align: "center",
      render: (item) => (
        <div className="flex items-center gap-2">
          <ViewButton onClick={() => setSelectedViewReturn(item)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="max-w-[1400px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
          <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
            Sales Returns 
          </h2>

          <div className="flex flex-wrap items-center gap-3 relative w-full md:w-auto">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Return no, customer, reason..."
            />

            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onOpen={handleFilterOpen}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
            >
              <div className="space-y-3">
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

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    Status
                  </label>
                  <SelectInput
                    name="filterStatus"
                    value={draftFilters.status}
                    options={[
                      { value: "APPROVED", label: "Approved" },
                      { value: "COMPLETED", label: "Completed" },
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

            {can("sales-returns.export") && (
              <ExportCSVButton
                fetchData={fetchSalesReturnsForExport}
                columns={csvColumns}
                filename={csvFilename}
                text="Export"
              />
            )}

            <CustomButton
              text="New Sales Return"
              icon={FaPlus}
              onClick={() => navigate("/sales-returns/create")}
            />
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 px-6 py-2 border-b border-line flex-wrap">
            <span className="text-xs text-ink-subtle">Active filters:</span>

            {appliedFilters.customerGradeId && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                Grade: {activeGradeName || appliedFilters.customerGradeId}
                <FaTimes
                  className="cursor-pointer hover:text-indigo-200 ml-0.5"
                  onClick={() => handleRemoveFilter("customerGradeId")}
                />
              </span>
            )}

            {appliedFilters.status && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                Status: {appliedFilters.status}
                <FaTimes
                  className="cursor-pointer hover:text-indigo-200 ml-0.5"
                  onClick={() => handleRemoveFilter("status")}
                />
              </span>
            )}
          </div>
        )}

        {/* Table with Keyboard Navigation */}
        <div
          ref={tableRef}
          tabIndex={0}
          data-table-nav
          className="p-0 outline-none"
        >
          <DataTable
            columns={columns}
            data={sortedReturns}
            rowKey={(item) => item.id}
            loading={loading}
            emptyMessage="No sales return records found."
            rowClassName={(_row, index) =>
              index === focusedIndex ? "bg-primary/8" : ""
            }
            onRowClick={(item, index) => {
              setFocusedIndex(index);
              tableRef.current?.focus({ preventScroll: true });
              setSelectedViewReturn(item);
            }}
          />
        </div>
      </div>

      {/* Sales Return Detail Modal */}
      <CommonViewModal
        show={Boolean(selectedViewReturn)}
        onHide={() => {
          setSelectedViewReturn(null);
          setTimeout(() => tableRef.current?.focus({ preventScroll: true }), 100);
        }}
        modalTitle="Sales Return Details"
        avatarText={selectedViewReturn?.returnNo ? "SR" : ""}
        headerTitle={selectedViewReturn?.returnNo || ""}
        headerSubtitle={selectedViewReturn?.customer?.firmName || ""}
        statusNode={<StatusBadge status={selectedViewReturn?.status || "COMPLETED"} />}
        sections={[
          {
            fields: [
              {
                label: "Return Date",
                value: selectedViewReturn
                  ? new Date(selectedViewReturn.returnDate).toLocaleDateString("en-IN")
                  : "—",
              },
              {
                label: "Customer",
                value: selectedViewReturn?.customer?.firmName
                  ? `${selectedViewReturn.customer.firmName}${
                      selectedViewReturn.customer.customerGrade?.name
                        ? ` (${selectedViewReturn.customer.customerGrade.name})`
                        : ""
                    }`
                  : "—",
              },
              {
                label: "Sales Invoice",
                value: selectedViewReturn?.salesInvoiceId
                  ? `INV #${selectedViewReturn.salesInvoiceId}`
                  : "Direct Return",
              },
              {
                label: "Grand Total",
                value: selectedViewReturn
                  ? `₹${Number(selectedViewReturn.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                  : "—",
              },
            ],
          },
        ]}
        customContent={
          selectedViewReturn && (
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-ink mb-1.5 text-[10px] uppercase tracking-wide">
                  Returned Items List
                </h4>
                <div className="border border-line rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                      <tr>
                        <th className="px-3 py-1.5">Product / Item</th>
                        <th className="px-3 py-1.5 text-center">Qty</th>
                        <th className="px-3 py-1.5 text-center">Weight / UOM</th>
                        <th className="px-3 py-1.5 text-right">Unit Price (₹)</th>
                        <th className="px-3 py-1.5 text-right">Tax Rate</th>
                        <th className="px-3 py-1.5 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {selectedViewReturn.items && selectedViewReturn.items.length > 0 ? (
                        selectedViewReturn.items.map((item, i) => (
                          <tr key={item.id || i} className="hover:bg-card-2 transition-colors">
                            <td className="px-3 py-1.5 font-medium text-ink">
                              {item.product?.productName || item.description || `Product #${item.productId}`}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-semibold text-ink">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-1.5 text-center font-medium text-ink-muted">
                              {item.weight != null
                                ? formatStockQty(item.weight, item.uom || undefined)
                                : "—"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-ink">
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-ink-subtle">
                              {item.taxRate || 0}%
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold text-ink">
                              ₹{Number(item.lineTotal).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-ink-subtle text-xs">
                            No item details found for this return.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedViewReturn.narration && (
                <div className="bg-card-2 p-2 rounded border border-line text-xs">
                  <span className="font-semibold text-ink block mb-0.5 text-[10px] uppercase tracking-wide">
                    Narration / Notes
                  </span>
                  <p className="text-ink-muted leading-relaxed">{selectedViewReturn.narration}</p>
                </div>
              )}
            </div>
          )
        }
      />
    </div>
  );
};

export default SalesReturnPage;

