import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService, type SalesReturn } from "../../../../services/returnService";
import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../../components/ui/EditButton/EditButton";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";
import FilterPopover from "../../../../components/ui/FilterPopover/FilterPopover";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import { useCustomerGrades } from "../../../../hooks/useCustomerGrades";
import { formatStockQty } from "../../../../utils/uomConversion";
import { useSocketSync } from "../../../../hooks/useSocketSync";

const ITEMS_PER_PAGE = 10;

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
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedViewReturn, setSelectedViewReturn] = useState<SalesReturn | null>(null);

  const { customerGrades } = useCustomerGrades();
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const rData = await returnService.fetchSalesReturns();
      setReturns(rData || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load sales returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useSocketSync("salesReturn", undefined, loadData);
  useSocketSync("salesInvoice", undefined, loadData);
  useSocketSync("customer", undefined, loadData);

  const hasActiveFilters = Boolean(appliedFilters.customerGradeId || appliedFilters.status);
  const activeFilterCount = (appliedFilters.customerGradeId ? 1 : 0) + (appliedFilters.status ? 1 : 0);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setCurrentPage(1);
  }, [draftFilters]);

  const handleClearFilters = useCallback(() => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  }, []);

  const handleRemoveFilter = useCallback((key: keyof FilterState) => {
    setAppliedFilters((prev) => ({ ...prev, [key]: "" }));
    setDraftFilters((prev) => ({ ...prev, [key]: "" }));
    setCurrentPage(1);
  }, []);

  const filteredReturns = returns.filter((r) => {
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

  const totalPages = Math.ceil(filteredReturns.length / ITEMS_PER_PAGE) || 1;
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-line p-6 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Sales Returns (Credit Note)</h1>
          <p className="text-sm text-ink-muted mt-1">
            Manage customer sales returns, inventory auto-restock, and credit notes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search sales returns..."
          />

          <FilterPopover
            activeFilterCount={activeFilterCount}
            hasActiveFilters={hasActiveFilters}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            onOpen={() => setDraftFilters(appliedFilters)}
          >
            <div className="space-y-4">
              {/* Customer Grade Filter */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5 uppercase tracking-wider">
                  Customer Grade
                </label>
                <SelectInput
                  name="customerGradeId"
                  value={draftFilters.customerGradeId}
                  options={customerGrades.map((g) => ({
                    label: g.name,
                    value: String(g.id),
                  }))}
                  defaultOptionLabel="All Customer Grades"
                  searchable={false}
                  noMargin
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      customerGradeId: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5 uppercase tracking-wider">
                  Status
                </label>
                <SelectInput
                  name="status"
                  value={draftFilters.status}
                  options={[
                    { label: "Draft", value: "DRAFT" },
                    { label: "Approved / Completed", value: "APPROVED" },
                  ]}
                  defaultOptionLabel="All Statuses"
                  searchable={false}
                  noMargin
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </FilterPopover>

          <CustomButton
            text="New Sales Return"
            icon={FaPlus}
            onClick={() => navigate("/sales-returns/create")}
          />
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 py-2 border-b border-line flex-wrap">
          <span className="text-xs text-ink-subtle">Active filters:</span>

          {appliedFilters.customerGradeId && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Grade:{" "}
              {customerGrades.find((g) => String(g.id) === appliedFilters.customerGradeId)?.name ||
                appliedFilters.customerGradeId}
              <button
                type="button"
                onClick={() => handleRemoveFilter("customerGradeId")}
                className="hover:text-red-500 cursor-pointer ml-0.5"
                title="Remove grade filter"
              >
                <FaTimes size={10} />
              </button>
            </span>
          )}

          {appliedFilters.status && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Status: {appliedFilters.status}
              <button
                type="button"
                onClick={() => handleRemoveFilter("status")}
                className="hover:text-red-500 cursor-pointer ml-0.5"
                title="Remove status filter"
              >
                <FaTimes size={10} />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-ink-muted hover:text-red-500 underline ml-2 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <DataTable
        data={paginatedReturns}
        rowKey={(item) => item.id}
        loading={loading}
        emptyMessage="No sales return records found."
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
          {
            header: "RETURN NO",
            render: (item) => (
              <button
                onClick={() => setSelectedViewReturn(item)}
                className="font-mono font-bold text-ink hover:text-primary transition-colors text-left cursor-pointer"
                title="Click to view Sales Return Details"
              >
                {item.returnNo}
              </button>
            ),
          },
          {
            header: "DATE",
            render: (item) => <span className="text-ink-muted">{new Date(item.returnDate).toLocaleDateString("en-IN")}</span>,
          },
          {
            header: "CUSTOMER",
            render: (item) => {
              const gradeName = item.customer?.customerGrade?.name || item.customer?.grade;
              return (
                <div className="flex flex-col">
                  <span className="font-medium text-ink">{item.customer?.firmName || "-"}</span>
                  {gradeName && (
                    <span className="text-[11px] text-ink-muted">Grade: {gradeName}</span>
                  )}
                </div>
              );
            },
          },
          {
            header: "REFUND MODE",
            render: (item) => (
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-card-2 text-ink-muted border border-line">
                {item.refundMode || "CREDIT_NOTE"}
              </span>
            ),
          },
          {
            header: "STATUS",
            render: (item) => <StatusBadge status={item.status} />,
          },
          {
            header: "GRAND TOTAL",
            align: "right",
            render: (item) => (
              <span className="font-semibold text-ink">
                ₹{Number(item.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            ),
          },
          {
            header: "REASON",
            render: (item) => <span className="text-ink-muted max-w-xs truncate block">{item.reason || "-"}</span>,
          },
          {
            header: "ACTIONS",
            render: (item) => (
              <div className="flex items-center gap-2">
                <ViewButton onClick={() => setSelectedViewReturn(item)} />
                {item.status === "DRAFT" && (
                  <EditButton onClick={() => navigate(`/sales-returns/edit/${item.id}`)} />
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Sales Return Detail Modal using CommonViewModal */}
      <CommonViewModal
        show={Boolean(selectedViewReturn)}
        onHide={() => setSelectedViewReturn(null)}
        modalTitle="Sales Return Details"
        avatarText={selectedViewReturn?.returnNo ? "SR" : ""}
        headerTitle={selectedViewReturn?.returnNo || ""}
        headerSubtitle={selectedViewReturn?.customer?.firmName || ""}
        statusNode={<StatusBadge status={selectedViewReturn?.status || "COMPLETED"} />}
        sections={[
          {
            fields: [
              { label: "Return Date", value: selectedViewReturn ? new Date(selectedViewReturn.returnDate).toLocaleDateString("en-IN") : "-" },
              {
                label: "Customer",
                value: selectedViewReturn?.customer?.firmName
                  ? `${selectedViewReturn.customer.firmName}${selectedViewReturn.customer.customerGrade?.name
                    ? ` (${selectedViewReturn.customer.customerGrade.name})`
                    : ""
                  }`
                  : "-",
              },
              { label: "Sales Invoice", value: selectedViewReturn?.salesInvoiceId ? `INV #${selectedViewReturn.salesInvoiceId}` : "Direct Return" },
              { label: "Refund Mode", value: selectedViewReturn?.refundMode || "CREDIT_NOTE" },
              { label: "Grand Total", value: selectedViewReturn ? `₹${Number(selectedViewReturn.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-" },
            ],
          },
        ]}
        customContent={
          selectedViewReturn && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-ink mb-3 text-xs uppercase tracking-wider">
                  Returned Items List
                </h4>
                <div className="border border-line rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-head font-semibold text-ink-muted border-b border-line uppercase">
                      <tr>
                        <th className="px-3 py-2.5">Product ID / Item</th>
                        <th className="px-3 py-2.5 text-center">Qty</th>
                        <th className="px-3 py-2.5 text-center">Weight / UOM</th>
                        <th className="px-3 py-2.5 text-right">Unit Price (₹)</th>
                        <th className="px-3 py-2.5 text-right">Tax Rate</th>
                        <th className="px-3 py-2.5 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft bg-card">
                      {selectedViewReturn.items && selectedViewReturn.items.length > 0 ? (
                        selectedViewReturn.items.map((item, i) => (
                          <tr key={item.id || i} className="hover:bg-card-2 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-ink">
                              {item.product?.productName || item.description || `Product #${item.productId}`}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-ink">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-center font-medium text-ink-muted">
                              {item.weight != null ? formatStockQty(item.weight, item.uom || undefined) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-ink">
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-ink-subtle">
                              {item.taxRate || 0}%
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">
                              ₹{Number(item.lineTotal).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-ink-subtle">
                            No item details found for this return.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedViewReturn.narration && (
                <div className="bg-card-2 p-3.5 rounded-lg border border-line text-xs">
                  <span className="font-semibold text-ink block mb-1">Narration / Notes:</span>
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
