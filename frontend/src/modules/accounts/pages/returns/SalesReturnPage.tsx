import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUndo,
  FaPlus,
  FaSync,
  FaTimes,
  FaSearch,
  FaEye,
  FaEdit,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService, type SalesReturn } from "../../../../services/returnService";
import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";
import { useCustomerGrades } from "../../../../hooks/useCustomerGrades";
import { formatStockQty } from "../../../../utils/uomConversion";
import { useSocketSync } from "../../../../hooks/useSocketSync";
import { useListCache } from "../../../../hooks/useListCache";

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
  const [selectedViewReturn, setSelectedViewReturn] = useState<SalesReturn | null>(null);

  const { customerGrades } = useCustomerGrades();
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const [searchTerm, setSearchTerm] = useState<string>("");

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

  const { data: returns, loading, refreshing, refresh } = useListCache<SalesReturn>({
    cacheKey,
    socketModule: "salesReturn",
    fetcher,
  });

  useSocketSync("salesInvoice", undefined, refresh);
  useSocketSync("customer", undefined, refresh);

  const hasActiveFilters = Boolean(appliedFilters.customerGradeId || appliedFilters.status);

  const handleClearFilters = () => {
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const handleRemoveFilter = (key: keyof FilterState) => {
    setAppliedFilters((prev) => ({ ...prev, [key]: "" }));
  };

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

  const paginatedReturns = filteredReturns;

  return (
    <div className="p-3 space-y-3 min-h-screen">
      {/* Compact Header + Filters */}
      <div className="bg-card rounded-lg border border-line">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line">
          <h1 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaUndo className="text-pink-500 text-sm" /> Sales Returns (Credit Note)
            {refreshing && <FaSync className="animate-spin text-pink-500 text-[10px]" />}
          </h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={refresh}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line"
            >
              <FaSync className={refreshing ? "animate-spin text-pink-500" : ""} /> Refresh
            </button>
            <button
              onClick={() => navigate("/sales-returns/create")}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-pink-500 hover:bg-pink-600 text-white rounded text-xs font-semibold transition cursor-pointer"
            >
              <FaPlus className="text-[10px]" /> New Sales Return
            </button>
          </div>
        </div>

        <div className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2">
          <div className="w-[160px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Customer Grade</label>
            <select
              value={appliedFilters.customerGradeId}
              onChange={(e) => {
                setAppliedFilters((prev) => ({ ...prev, customerGradeId: e.target.value }));
              }}
              className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-pink-500/40 focus:border-pink-500 focus:outline-none"
            >
              <option value="">All Grades</option>
              {customerGrades.map((g) => (
                <option key={g.id} value={String(g.id)}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="w-[140px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Status</label>
            <select
              value={appliedFilters.status}
              onChange={(e) => {
                setAppliedFilters((prev) => ({ ...prev, status: e.target.value }));
              }}
              className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-pink-500/40 focus:border-pink-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved / Completed</option>
            </select>
          </div>

          <div className="w-full max-w-[320px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Return no, customer, reason..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
                className="w-full pl-7 pr-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-pink-500/40 focus:border-pink-500 focus:outline-none"
              />
              <FaSearch className="absolute left-2.5 top-2.5 text-ink-subtle text-[10px]" />
            </div>
          </div>

          {(hasActiveFilters || searchTerm) && (
            <button
              onClick={() => {
                handleClearFilters();
                setSearchTerm("");
              }}
              className="px-2.5 py-1.5 text-xs text-ink-muted hover:text-ink border border-line rounded cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="px-3 py-1.5 border-t border-line-soft bg-card flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-ink-subtle uppercase tracking-wide font-semibold">Active:</span>

            {appliedFilters.customerGradeId && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-500/10 text-pink-500 border border-pink-500/20">
                Grade: {customerGrades.find((g) => String(g.id) === appliedFilters.customerGradeId)?.name || appliedFilters.customerGradeId}
                <button
                  type="button"
                  onClick={() => handleRemoveFilter("customerGradeId")}
                  className="hover:text-rose-500 cursor-pointer"
                >
                  <FaTimes size={8} />
                </button>
              </span>
            )}

            {appliedFilters.status && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-500/10 text-pink-500 border border-pink-500/20">
                Status: {appliedFilters.status}
                <button
                  type="button"
                  onClick={() => handleRemoveFilter("status")}
                  className="hover:text-rose-500 cursor-pointer"
                >
                  <FaTimes size={8} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-ink">Sales Returns</h2>
          <span className="text-[11px] text-ink-subtle font-mono">Total: {filteredReturns.length}</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-ink-muted">Loading...</div>
        ) : paginatedReturns.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-subtle">No sales return records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink-muted">
              <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                <tr>
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Return No</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Refund Mode</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Grand Total (₹)</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {paginatedReturns.map((item, index) => {
                  const gradeName = item.customer?.customerGrade?.name || item.customer?.grade;
                  return (
                    <tr key={item.id} className="hover:bg-card-2 transition-colors">
                      <td className="px-3 py-1.5 text-ink-subtle font-mono text-[11px]">
                        {index + 1}
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => setSelectedViewReturn(item)}
                          className="font-mono font-semibold text-pink-500 hover:underline cursor-pointer"
                          title="Click to view Sales Return Details"
                        >
                          {item.returnNo}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px]">
                        {new Date(item.returnDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-ink">{item.customer?.firmName || "-"}</span>
                          {gradeName && (
                            <span className="text-[10px] text-ink-subtle">Grade: {gradeName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-card-2 text-ink-muted border border-line">
                          {item.refundMode || "CREDIT_NOTE"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-pink-500 whitespace-nowrap">
                        ₹{Number(item.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5 text-ink-subtle max-w-xs truncate">{item.reason || "-"}</td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedViewReturn(item)}
                            className="p-1 text-pink-500 hover:text-white hover:bg-pink-500 border border-pink-200 rounded transition cursor-pointer"
                            title="View"
                          >
                            <FaEye className="w-2.5 h-2.5" />
                          </button>
                          {item.status === "DRAFT" && (
                            <button
                              onClick={() => navigate(`/sales-returns/edit/${item.id}`)}
                              className="p-1 text-blue-500 hover:text-white hover:bg-blue-500 border border-blue-200 rounded transition cursor-pointer"
                              title="Edit"
                            >
                              <FaEdit className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-line bg-card-2">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right text-[10px] font-bold text-ink uppercase tracking-wide">
                    Page Total ({paginatedReturns.length}):
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-sm text-pink-500 font-mono">
                    ₹{paginatedReturns.reduce((s, r) => s + Number(r.grandTotal || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

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
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-ink mb-1.5 text-[10px] uppercase tracking-wide">
                  Returned Items List
                </h4>
                <div className="border border-line rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                      <tr>
                        <th className="px-3 py-1.5">Product ID / Item</th>
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
                              {item.weight != null ? formatStockQty(item.weight, item.uom || undefined) : "—"}
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
                  <span className="font-semibold text-ink block mb-0.5 text-[10px] uppercase tracking-wide">Narration / Notes</span>
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
