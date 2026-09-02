import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBuilding,
  FaSync,
  FaChevronRight,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaCheckCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import { DATE_RANGE_OPTIONS } from "../../../../constants/selectOption";
import { payableService, type SupplierPayableSummary } from "../../../../services/payableService";
import { supplierService } from "../../../../services/supplierService";
import { useListCache, prefetchCache } from "../../../../hooks/useListCache";

type ColumnKey =
  | "index"
  | "code"
  | "supplier"
  | "invoiced"
  | "paid"
  | "debit"
  | "credit"
  | "netBalance"
  | "dueDays"
  | "action";

const ALL_COLUMNS: { id: ColumnKey; label: string; alwaysOn?: boolean }[] = [
  { id: "index", label: "#", alwaysOn: true },
  { id: "code", label: "Code" },
  { id: "supplier", label: "Supplier", alwaysOn: true },
  { id: "invoiced", label: "Invoiced" },
  { id: "paid", label: "Paid" },
  { id: "debit", label: "Debit" },
  { id: "credit", label: "Credit" },
  { id: "netBalance", label: "Net Balance", alwaysOn: true },
  { id: "dueDays", label: "Due Days" },
  { id: "action", label: "Action", alwaysOn: true },
];

export const AmountPayablePage: React.FC = () => {
  const navigate = useNavigate();

  // Applied filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [asOnDate, setAsOnDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Draft filter state for Apply / Clear All
  const [draftAsOnDate, setDraftAsOnDate] = useState<string>(asOnDate);
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");
  const [draftSupplierId, setDraftSupplierId] = useState<string>(supplierId);
  const [draftSearch, setDraftSearch] = useState<string>(search);

  const [suppliersList, setSuppliersList] = useState<any[]>([]);

  // Row selection for status bar
  const [selectedRow, setSelectedRow] = useState<string | number | null>(null);

  // Column visibility (persisted)
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => {
    const saved = localStorage.getItem("amountPayableVisibleColumns_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id: string): id is ColumnKey =>
            ALL_COLUMNS.some((c) => c.id === id)
          );
          if (valid.length > 0) return valid;
        }
      } catch {
        return ALL_COLUMNS.map((c) => c.id);
      }
    }
    return ALL_COLUMNS.map((c) => c.id);
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("amountPayableVisibleColumns_v2", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const isVisible = (id: ColumnKey) => visibleColumns.includes(id);

  // Load suppliers list for filter dropdown
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const res = await supplierService.fetchAll({ limit: 10000 });
        const list = Array.isArray(res) ? res : (res?.suppliers || []);
        setSuppliersList(list);
      } catch (err) {
        console.error("Failed to load suppliers dropdown", err);
      }
    };
    loadSuppliers();
  }, []);

  const cacheKey = `accounts:amount-payable:${asOnDate}:${startDate}:${endDate}:${supplierId}:${search}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await payableService.getPayableSummaries({
          asOnDate,
          startDate,
          endDate,
          supplierId,
          search,
          page: 1,
          limit: 10000,
        });
        const list = Array.isArray(res) ? res : res.data || [];
        return { data: list, total: list.length };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load supplier payables");
        throw err;
      }
    },
    [asOnDate, startDate, endDate, supplierId, search]
  );

  // Prefetch each supplier's breakdown in the background when the list loads.
  const onListSuccess = useCallback((list: SupplierPayableSummary[]) => {
    for (const s of list) {
      const detailKey = `accounts:supplier-breakdown-${s.supplierId}::`;
      prefetchCache(detailKey, async () => {
        const data = await payableService.getSupplierPayableDetail(
          typeof s.supplierId === "string" ? parseInt(s.supplierId, 10) : s.supplierId,
          { startDate: "", endDate: "" }
        );
        return { data: data ? [data] : [], total: data ? 1 : 0 };
      });
    }
  }, []);

  const { data: payables, loading, refreshing, refresh } = useListCache<SupplierPayableSummary>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
    onSuccess: onListSuccess,
  });

  // Date range preset handler
  const handleDateRangeChange = (val: string) => {
    setDateRangePreset(val);
    if (val === "custom") return;

    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (val === "today") {
      // both today
    } else if (val === "yesterday") {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (val === "last_week") {
      start.setDate(today.getDate() - 7);
    } else if (val === "last_month") {
      start.setMonth(today.getMonth() - 1);
    } else if (val === "last_6_months") {
      start.setMonth(today.getMonth() - 6);
    } else if (val === "last_year") {
      start.setFullYear(today.getFullYear() - 1);
    }

    setDraftStartDate(start.toISOString().split("T")[0]);
    setDraftEndDate(end.toISOString().split("T")[0]);
  };

  const handleApplyFilters = () => {
    setAsOnDate(draftAsOnDate);
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setSupplierId(draftSupplierId);
    setSearch(draftSearch);
  };

  const handleClearFilters = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    setDraftAsOnDate(todayStr);
    setDraftStartDate("");
    setDraftEndDate("");
    setDateRangePreset("custom");
    setDraftSupplierId("");
    setDraftSearch("");

    setAsOnDate(todayStr);
    setStartDate("");
    setEndDate("");
    setSupplierId("");
    setSearch("");
  };

  const [sortBy, setSortBy] = useState<string>("activity");

  const filteredSuppliers = useMemo(() => {
    // Only suppliers with a POSITIVE Cr balance (we owe them) actually count
    // as payable. A supplier with a Dr balance (we paid advance / debit note
    // pending from them) is NOT a payable — it's an asset. Hide them so this
    // page only shows real dues. Supplier `balanceAsOnDate` uses the same
    // sign convention as customer: positive = we owe them (Cr from our side).
    const list = (Array.isArray(payables) ? payables : [])
      .filter((s: any) => Number(s.balanceAsOnDate || 0) > 0.005);
    if (sortBy === "activity") {
      list.sort((a: any, b: any) => {
        const aAct = (a.totalBilled || 0) + (a.totalPaid || 0);
        const bAct = (b.totalBilled || 0) + (b.totalPaid || 0);
        if (aAct !== bAct) return bAct - aAct;
        return (b.balanceAsOnDate || 0) - (a.balanceAsOnDate || 0);
      });
    } else if (sortBy === "balance") {
      list.sort((a: any, b: any) => (b.balanceAsOnDate || 0) - (a.balanceAsOnDate || 0));
    } else if (sortBy === "overdue") {
      list.sort((a: any, b: any) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return (b.overdueAmount || 0) - (a.overdueAmount || 0);
      });
    } else if (sortBy === "name") {
      list.sort((a: any, b: any) => (a.legalName || "").localeCompare(b.legalName || ""));
    }
    return list;
  }, [payables, sortBy]);

  // Dashboard Totals
  const totals = useMemo(() => {
    return filteredSuppliers.reduce(
      (acc, curr) => {
        const d = curr.debit !== undefined ? curr.debit : (curr.totalPaid || 0) + (curr.totalReturned || 0);
        const c = curr.credit !== undefined ? curr.credit : (curr.totalBilled || 0);
        acc.totalOpening += curr.openingBalance || 0;
        acc.totalBilled += curr.totalBilled || 0;
        acc.totalPaid += curr.totalPaid || 0;
        acc.totalDebit += d;
        acc.totalCredit += c;
        acc.totalNetBalance += curr.balanceAsOnDate || 0;
        if (curr.isOverdue) acc.overdueCount += 1;
        return acc;
      },
      { totalOpening: 0, totalBilled: 0, totalPaid: 0, totalDebit: 0, totalCredit: 0, totalNetBalance: 0, overdueCount: 0 }
    );
  }, [filteredSuppliers]);

  // CSV Export dataset configuration
  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Supplier Code", accessor: (item: any) => item.supplierCode },
      { header: "Supplier Name", accessor: (item: any) => item.legalName },
      { header: "GSTIN", accessor: (item: any) => item.gstin || "-" },
      { header: "Phone", accessor: (item: any) => item.phone || "-" },
      { header: "Opening Balance", accessor: (item: any) => item.openingBalance || 0 },
      { header: "Invoiced Amount", accessor: (item: any) => item.totalBilled || 0 },
      { header: "Paid Amount", accessor: (item: any) => item.totalPaid || 0 },
      { header: "Returned Amount", accessor: (item: any) => item.totalReturned || 0 },
      { header: "Debit Amount", accessor: (item: any) => item.debit || 0 },
      { header: "Credit Amount", accessor: (item: any) => item.credit || 0 },
      { header: "Net Balance", accessor: (item: any) => item.balanceAsOnDate || 0 },
      { header: "Overdue Amount", accessor: (item: any) => item.overdueAmount || 0 },
      { header: "Is Overdue", accessor: (item: any) => (item.isOverdue ? "Yes" : "No") },
    ];

    return {
      csvData: filteredSuppliers,
      csvColumns: columns,
      csvFilename: `Amount_Payable_Report_${asOnDate}.csv`,
    };
  }, [filteredSuppliers, asOnDate]);

  return (
    <div className="p-3 flex gap-3 w-full items-start font-sans text-ink">
      <div className="flex-1 space-y-2 min-w-0 max-w-7xl">

        {/* Single-row header — filters + actions */}
        <div className="bg-card rounded-md border border-line shadow-sm px-3 py-2 flex flex-wrap items-end gap-2">
          <div className="w-[120px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">As On</label>
            <DatePickerCalendar
              name="draftAsOnDate"
              value={draftAsOnDate}
              onChange={(e) => setDraftAsOnDate(e.target.value)}
            />
          </div>

          <div className="w-[120px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Range</label>
            <SelectInput
              name="dateRangePreset"
              value={dateRangePreset}
              options={DATE_RANGE_OPTIONS}
              hideLabel
              searchable={false}
              onChange={(e) => handleDateRangeChange(e.target.value)}
            />
          </div>

          <div className="w-[120px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">From</label>
            <DatePickerCalendar
              name="draftStartDate"
              value={draftStartDate}
              onChange={(e) => { setDraftStartDate(e.target.value); setDateRangePreset("custom"); }}
            />
          </div>

          <div className="w-[120px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">To</label>
            <DatePickerCalendar
              name="draftEndDate"
              value={draftEndDate}
              onChange={(e) => { setDraftEndDate(e.target.value); setDateRangePreset("custom"); }}
            />
          </div>

          <div className="w-[180px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Search</label>
            <input
              type="text"
              className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500 focus:outline-none"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Code / Name..."
            />
          </div>

          <div className="w-[150px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Supplier</label>
            <SelectInput
              name="draftSupplierId"
              value={draftSupplierId}
              options={suppliersList.map(s => ({ label: s.legalName || s.displayName || s.supplierCode, value: s.id }))}
              defaultOptionLabel="All Suppliers"
              hideLabel
              searchable
              onChange={(e) => setDraftSupplierId(e.target.value)}
            />
          </div>

          <button
            onClick={handleClearFilters}
            className="px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card rounded border border-line"
          >
            Clear
          </button>
          <button
            onClick={handleApplyFilters}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded"
          >
            Apply
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={refresh}
              className="flex items-center gap-1 px-2 py-1.5 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line"
              title="Refresh"
            >
              <FaSync className={refreshing ? "animate-spin text-orange-600" : ""} /> Refresh
            </button>
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
            />
          </div>
        </div>

        {/* Table card — Busy density */}
        <div
          className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
          style={{ height: "calc(100vh - 240px)" }}
        >
          {/* Table toolbar row */}
          <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between gap-2 shrink-0">
            <h2 className="text-xs font-semibold text-ink">Supplier Payables</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-2 py-1 border border-line rounded text-[11px] bg-card text-ink focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                >
                  <option value="activity">Recent Activity</option>
                  <option value="balance">Highest Balance</option>
                  <option value="overdue">Overdue First</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>
              <div className="relative">
                <button
                  onClick={() => setColsMenuOpen((o) => !o)}
                  className="px-2 py-1 border border-line rounded text-[11px] bg-card text-ink hover:bg-card-2 cursor-pointer"
                >
                  Columns ▾
                </button>
                {colsMenuOpen && (
                  <div className="absolute right-0 mt-1 z-20 w-52 bg-card border border-line rounded-md shadow-lg p-2 space-y-1">
                    {ALL_COLUMNS.map((c) => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 px-1.5 py-1 rounded text-[11px] ${c.alwaysOn ? "opacity-60 cursor-not-allowed" : "hover:bg-card-2 cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          disabled={c.alwaysOn}
                          checked={isVisible(c.id)}
                          onChange={(e) => {
                            if (c.alwaysOn) return;
                            setVisibleColumns((prev) =>
                              e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                            );
                          }}
                        />
                        <span className="text-ink">{c.label}</span>
                      </label>
                    ))}
                    <div className="pt-1 mt-1 border-t border-line-soft flex justify-end">
                      <button
                        onClick={() => setColsMenuOpen(false)}
                        className="text-[10px] text-ink-subtle hover:text-ink px-2 py-0.5"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-ink-subtle font-mono">Total: {filteredSuppliers.length}</span>
            </div>
          </div>

          {filteredSuppliers.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-subtle flex-1">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <FaSync className="animate-spin text-orange-600 text-[10px]" />
                  Loading supplier payables…
                </span>
              ) : (
                "No supplier payables matching the selected filter criteria."
              )}
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-[11px] text-ink-muted border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-card-2 text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                    {isVisible("index") && <th className="px-2 py-1.5 border-r border-line w-10 text-center">#</th>}
                    {isVisible("code") && <th className="px-2 py-1.5 border-r border-line w-24">Code</th>}
                    {isVisible("supplier") && <th className="px-2 py-1.5 border-r border-line">Supplier</th>}
                    {isVisible("invoiced") && <th className="px-2 py-1.5 border-r border-line w-28 text-right">Invoiced</th>}
                    {isVisible("paid") && <th className="px-2 py-1.5 border-r border-line w-28 text-right">Paid</th>}
                    {isVisible("debit") && <th className="px-2 py-1.5 border-r border-line w-28 text-right">Debit</th>}
                    {isVisible("credit") && <th className="px-2 py-1.5 border-r border-line w-28 text-right">Credit</th>}
                    {isVisible("netBalance") && <th className="px-2 py-1.5 border-r border-line w-32 text-right">Net Balance</th>}
                    {isVisible("dueDays") && <th className="px-2 py-1.5 border-r border-line w-20 text-center">Due Days</th>}
                    {isVisible("action") && <th className="px-2 py-1.5 w-20 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((item: any, rowIdx: number) => {
                    const isSelected = selectedRow === item.supplierId;
                    const bal = Number(item.balanceAsOnDate || 0);
                    const balAbs = Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    return (
                      <tr
                        key={item.supplierId}
                        onClick={() => setSelectedRow(item.supplierId)}
                        className={`border-b border-line-soft cursor-pointer ${
                          isSelected
                            ? "bg-orange-500/20 text-ink"
                            : rowIdx % 2 === 0
                              ? "hover:bg-card-2/70"
                              : "bg-card-2/20 hover:bg-card-2/70"
                        }`}
                      >
                        {isVisible("index") && (
                          <td className="px-2 py-1 border-r border-line-soft text-center font-mono text-[11px] text-ink-subtle">
                            {rowIdx + 1}
                          </td>
                        )}
                        {isVisible("code") && (
                          <td className="px-2 py-1 border-r border-line-soft font-mono font-semibold text-orange-500">
                            {item.supplierCode || "-"}
                          </td>
                        )}
                        {isVisible("supplier") && (
                          <td className="px-2 py-1 border-r border-line-soft">
                            <div className="font-bold text-ink uppercase truncate">{item.legalName}</div>
                            {item.gstin && (
                              <div className="text-[10px] text-ink-subtle font-mono">GST: {item.gstin}</div>
                            )}
                          </td>
                        )}
                        {isVisible("invoiced") && (
                          <td className="px-2 py-1 border-r border-line-soft text-right font-mono">
                            ₹{(item.totalBilled || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        )}
                        {isVisible("paid") && (
                          <td className="px-2 py-1 border-r border-line-soft text-right font-mono">
                            ₹{(item.totalPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        )}
                        {isVisible("debit") && (
                          <td className="px-2 py-1 border-r border-line-soft text-right font-mono">
                            ₹{(item.debit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        )}
                        {isVisible("credit") && (
                          <td className="px-2 py-1 border-r border-line-soft text-right font-mono font-semibold text-amber-700">
                            ₹{(item.credit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        )}
                        {isVisible("netBalance") && (
                          <td className="px-2 py-1 border-r border-line-soft text-right font-mono font-bold whitespace-nowrap">
                            {Math.abs(bal) < 0.005 ? (
                              <span className="text-ink">₹0.00</span>
                            ) : bal > 0 ? (
                              <span className="text-ink">₹{balAbs} <span className="text-[10px] text-ink-subtle">Cr</span></span>
                            ) : (
                              <span className="text-emerald-500">₹{balAbs} <span className="text-[10px] text-emerald-500/70">Dr</span></span>
                            )}
                          </td>
                        )}
                        {isVisible("dueDays") && (
                          <td className="px-2 py-1 border-r border-line-soft text-center font-mono text-[11px] text-ink-muted">
                            {item.dueDays !== null && item.dueDays !== undefined ? `${item.dueDays} d` : "—"}
                          </td>
                        )}
                        {isVisible("action") && (
                          <td className="px-2 py-1 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/accounts/payable/${item.supplierId}`);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold rounded text-[11px] border border-orange-200"
                            >
                              View <FaChevronRight size={8} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {/* Busy-style empty filler rows */}
                  {Array.from({ length: Math.max(0, 25 - filteredSuppliers.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-line-soft">
                      {isVisible("index") && <td className="px-2 py-1 border-r border-line-soft">&nbsp;</td>}
                      {isVisible("code") && <td className="px-2 py-1 border-r border-line-soft"></td>}
                      {isVisible("supplier") && <td className="px-2 py-1 border-r border-line-soft"></td>}
                      {isVisible("invoiced") && <td className="px-2 py-1 border-r border-line-soft"></td>}
                      {isVisible("paid") && <td className="px-2 py-1 border-r border-line-soft"></td>}
                      {isVisible("debit") && <td className="px-2 py-1 border-r border-line-soft"></td>}
                      {isVisible("credit") && <td className="px-2 py-1 border-r border-line-soft"></td>}
                      {isVisible("netBalance") && <td className="px-2 py-1 border-r border-line-soft"></td>}
                      {isVisible("dueDays") && <td className="px-2 py-1 border-r border-line-soft"></td>}
                      {isVisible("action") && <td className="px-2 py-1"></td>}
                    </tr>
                  ))}
                </tbody>
                {/* Sticky footer with grand totals */}
                <tfoot className="sticky bottom-0 z-10 bg-card-2 border-t-2 border-line">
                  <tr>
                    <td
                      colSpan={
                        (isVisible("index") ? 1 : 0) +
                        (isVisible("code") ? 1 : 0) +
                        (isVisible("supplier") ? 1 : 0)
                      }
                      className="px-2 py-1.5 text-right text-[10px] font-bold text-ink uppercase tracking-wide border-r border-line"
                    >
                      Grand Total ({filteredSuppliers.length})
                    </td>
                    {isVisible("invoiced") && (
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-ink border-r border-line">
                        ₹{totals.totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    {isVisible("paid") && (
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-ink border-r border-line">
                        ₹{totals.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    {isVisible("debit") && (
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-ink border-r border-line">
                        ₹{totals.totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    {isVisible("credit") && (
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-amber-700 border-r border-line">
                        ₹{totals.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    {isVisible("netBalance") && (
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-orange-600 border-r border-line">
                        ₹{Math.abs(totals.totalNetBalance).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-[10px] ml-1">{totals.totalNetBalance >= 0 ? "Cr" : "Dr"}</span>
                      </td>
                    )}
                    {isVisible("dueDays") && <td className="border-r border-line"></td>}
                    {isVisible("action") && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Busy-style status bar */}
          <div className="border-t border-line bg-card-2/60 px-3 py-1 flex items-center justify-between text-[10px] font-mono text-ink-subtle shrink-0">
            <div className="flex gap-4">
              <span>
                Entry No: <b className="text-ink">{filteredSuppliers.length > 0 ? 1 : 0} / {filteredSuppliers.length}</b>
              </span>
              <span>
                Row No: <b className="text-ink">
                  {selectedRow
                    ? filteredSuppliers.findIndex((v: any) => v.supplierId === selectedRow) + 1
                    : (filteredSuppliers.length > 0 ? 1 : 0)}
                  {" / "}{filteredSuppliers.length}
                </b>
              </span>
            </div>
            <div className="flex gap-3 uppercase tracking-wide">
              <span>Suppliers: <b className="text-ink">{filteredSuppliers.length}</b></span>
              <span>Overdue: <b className="text-amber-600">{totals.overdueCount}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar — 4 summary stats. Amounts render on their own row so
         crores-scale values never squeeze the label or overflow the card. */}
      <aside className="w-[240px] shrink-0 bg-card border border-line rounded-md shadow-sm overflow-hidden">
        <div className="px-3 py-1.5 bg-card-2 border-b border-line text-[11px] font-bold uppercase tracking-wide text-ink flex items-center gap-1.5">
          <FaBuilding className="text-orange-600 text-xs" /> Summary
        </div>
        <div className="divide-y divide-line-soft">
          <div className="px-3 py-2 bg-orange-500/5">
            <div className="flex items-center gap-1.5 mb-1">
              <FaMoneyBillWave className="text-orange-600 text-[10px]" />
              <span className="text-[11px] font-semibold text-ink-muted">Total Payable</span>
            </div>
            {(() => {
              const bal = Number(totals.totalNetBalance || 0);
              const abs = Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              if (Math.abs(bal) < 0.005) {
                return <div className="text-sm font-mono font-bold text-ink break-all leading-tight">₹0.00</div>;
              }
              return (
                <div className={`text-sm font-mono font-bold break-all leading-tight ${bal >= 0 ? "text-orange-600" : "text-emerald-500"}`}>
                  ₹{abs} <span className="text-[9px] font-sans">{bal >= 0 ? "Cr" : "Dr"}</span>
                </div>
              );
            })()}
          </div>

          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <FaBuilding className="text-indigo-600 text-[10px]" />
              <span className="text-[11px] font-semibold text-ink-muted">Suppliers</span>
            </div>
            <div className="text-sm font-mono font-bold text-ink break-all leading-tight">{filteredSuppliers.length}</div>
          </div>

          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <FaExclamationTriangle className="text-amber-600 text-[10px]" />
              <span className="text-[11px] font-semibold text-ink-muted">Overdue</span>
            </div>
            <div className="text-sm font-mono font-bold text-amber-600 break-all leading-tight">{totals.overdueCount}</div>
          </div>

          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <FaCheckCircle className="text-emerald-600 text-[10px]" />
              <span className="text-[11px] font-semibold text-ink-muted">Total Credit</span>
            </div>
            <div className="text-sm font-mono font-bold text-ink break-all leading-tight">
              ₹{totals.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default AmountPayablePage;
