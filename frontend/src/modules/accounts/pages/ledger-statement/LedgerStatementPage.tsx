import React, { useState, useEffect, useMemo } from "react";
import {
  FaBook,
  FaSync,
  FaSearch,
  FaChevronRight,
  FaChevronDown,
  FaFolderOpen,
  FaFileAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import { DATE_RANGE_OPTIONS } from "../../../../constants/selectOption";
import {
  accountService,
  type AccountLedger,
  type LedgerStatementResult,
} from "../../../../services/accountService";
import { useSocketSync } from "../../../../hooks/useSocketSync";

export const LedgerStatementPage: React.FC = () => {
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [groupedLedgers, setGroupedLedgers] = useState<Array<{ group: string; ledgers: AccountLedger[] }>>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");
  const [statement, setStatement] = useState<LedgerStatementResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [sidebarSearch, setSidebarSearch] = useState<string>("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadLedgerList = async () => {
      try {
        const res = await accountService.fetchLedgers({
          page: 1,
          limit: 1000,
          search: sidebarSearch || undefined,
          grouped: true,
        });
        setLedgers(res.ledgers || []);
        setGroupedLedgers(res.grouped || []);
        if (res.ledgers && res.ledgers.length > 0 && !selectedLedgerId) {
          setSelectedLedgerId(res.ledgers[0].id);
        }
      } catch (err: any) {
        toast.error("Failed to load ledgers list");
      }
    };
    loadLedgerList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarSearch]);

  const loadStatement = async () => {
    if (!selectedLedgerId) return;
    setLoading(true);
    try {
      const res = await accountService.fetchStatement(selectedLedgerId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm || undefined,
      });
      setStatement(res);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load ledger statement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatement();
  }, [selectedLedgerId, startDate, endDate, searchTerm]);

  useSocketSync("voucher", undefined, loadStatement);
  useSocketSync("accountLedger", undefined, loadStatement);
  useSocketSync("journalItem", undefined, loadStatement);
  useSocketSync("payment", undefined, loadStatement);
  useSocketSync("grnInvoice", undefined, loadStatement);
  useSocketSync("salesInvoice", undefined, loadStatement);
  useSocketSync("expense", undefined, loadStatement);

  const handleDateRangeChange = (val: string) => {
    setDateRangePreset(val);
    if (val === "custom") return;
    const today = new Date();
    let start = new Date();
    let end = new Date();
    if (val === "yesterday") {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (val === "last_week") start.setDate(today.getDate() - 7);
    else if (val === "last_month") start.setMonth(today.getMonth() - 1);
    else if (val === "last_6_months") start.setMonth(today.getMonth() - 6);
    else if (val === "last_year") start.setFullYear(today.getFullYear() - 1);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  // Backend now filters entries and sidebar ledgers; use statement.entries directly
  const filteredEntries = statement?.entries || [];

  const toggleGroup = (g: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    if (!statement)
      return { csvData: [], csvColumns: [], csvFilename: "Ledger_Statement.csv" };
    const columns = [
      { header: "Date", accessor: (item: any) => item.date },
      { header: "Voucher No", accessor: (item: any) => item.voucherNo },
      { header: "Type", accessor: (item: any) => item.voucherType },
      { header: "Particulars", accessor: (item: any) => item.particulars },
      { header: "Narration", accessor: (item: any) => item.narration || "-" },
      { header: "Debit (Dr)", accessor: (item: any) => item.debit },
      { header: "Credit (Cr)", accessor: (item: any) => item.credit },
      { header: "Running Balance", accessor: (item: any) => item.runningBalance },
    ];
    return {
      csvData: filteredEntries,
      csvColumns: columns,
      csvFilename: `Ledger_Statement_${statement.ledger.code}_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, [statement, filteredEntries]);

  return (
    <div className="p-3 bg-card-2 font-sans text-ink flex gap-3" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* LEFT SIDEBAR — Ledger tree */}
      <aside className="w-[280px] shrink-0 bg-card rounded-lg border border-line overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 120px)" }}>
        <div className="px-3 py-2 border-b border-line bg-card-2 flex items-center gap-2 shrink-0">
          <FaBook className="text-blue-500 text-xs" />
          <h2 className="text-xs font-bold text-ink">Ledger Statement</h2>
        </div>

        {/* Sidebar search */}
        <div className="p-2 border-b border-line shrink-0">
          <div className="relative">
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search ledgers..."
              className="w-full border border-line rounded pl-7 pr-2 py-1 text-xs bg-card text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
            />
            <FaSearch className="absolute left-2 top-2 text-ink-subtle text-[10px]" />
          </div>
        </div>

        {/* Ledger tree */}
        <div className="overflow-auto flex-1 min-h-0 p-2">
          {ledgers.length === 0 ? (
            <div className="text-[11px] text-ink-subtle italic px-2 py-4 text-center">Loading ledgers...</div>
          ) : groupedLedgers.length === 0 ? (
            <div className="text-[11px] text-ink-subtle italic px-2 py-4 text-center">No ledgers match</div>
          ) : (
            groupedLedgers.map(({ group: gname, ledgers: gledgers }) => {
              const isExpanded = expandedGroups.has(gname) || !!sidebarSearch.trim();
              const isCollapsed = !isExpanded;
              return (
                <div key={gname} className="mb-1">
                  <button
                    onClick={() => toggleGroup(gname)}
                    className="w-full flex items-center gap-1.5 text-[11px] font-bold text-ink px-1 py-1 hover:bg-card-2/60 rounded"
                  >
                    {isCollapsed ? (
                      <FaChevronRight className="text-[9px] text-ink-subtle" />
                    ) : (
                      <FaChevronDown className="text-[9px] text-ink-subtle" />
                    )}
                    <FaFolderOpen className="text-[10px] text-blue-400" />
                    <span className="truncate flex-1 text-left">{gname}</span>
                    <span className="text-[9px] text-ink-subtle font-mono">{gledgers.length}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="ml-2 mt-0.5 space-y-0.5 border-l border-line-soft pl-2">
                      {gledgers.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setSelectedLedgerId(l.id)}
                          className={`w-full text-left px-2 py-1 text-[11px] rounded transition-colors ${
                            selectedLedgerId === l.id
                              ? "bg-blue-500/15 text-blue-400 font-semibold"
                              : "text-ink-muted hover:bg-card-2/60"
                          }`}
                        >
                          <div className="truncate">{l.name}</div>
                          <div className="text-[9px] text-ink-subtle font-mono">{l.code}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-line text-[10px] text-ink-subtle italic shrink-0">
          <FaFileAlt className="inline mr-1" /> Click any ledger to view
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Filter bar */}
        <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-3 sticky top-0 z-20">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
            <FaBook className="text-blue-500 text-sm" /> Ledger Statement
            {statement && (
              <span className="text-[10px] font-medium text-ink-subtle uppercase tracking-wide">
                · {statement.ledger.name}
              </span>
            )}
          </h3>

          <div className="w-[120px]">
            <SelectInput
              name="dateRangePreset"
              value={dateRangePreset}
              options={DATE_RANGE_OPTIONS}
              hideLabel={true}
              onChange={(e) => handleDateRangeChange(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">From</label>
            <div className="w-[130px]">
              <DatePickerCalendar
                name="startDate"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateRangePreset("custom");
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">To</label>
            <div className="w-[130px]">
              <DatePickerCalendar
                name="endDate"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateRangePreset("custom");
                }}
              />
            </div>
          </div>

          <div className="relative flex-1 min-w-[160px]">
            <input
              type="text"
              className="w-full border border-line rounded pl-7 pr-2 py-1 text-xs bg-card text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher no, particulars..."
            />
            <FaSearch className="absolute left-2 top-2 text-ink-subtle text-[10px]" />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={loadStatement}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line disabled:opacity-50"
            >
              <FaSync className={loading ? "animate-spin text-blue-500" : ""} /> Refresh
            </button>
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
            />
          </div>
        </div>

        {/* Statement */}
        {!statement && !loading && (
          <div className="bg-card border border-line rounded-lg p-12 text-center text-xs text-ink-subtle">
            <FaBook className="text-blue-500/40 text-3xl mx-auto mb-2" />
            <div className="text-sm text-ink-muted font-semibold mb-1">Select a ledger from the sidebar</div>
            <div className="text-[11px]">Statement will load automatically</div>
          </div>
        )}

        {statement && (
          <div className="bg-card border border-line rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {/* Summary Banner */}
            <div className="px-3 py-2 bg-card-2 text-ink border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded font-mono font-bold text-[10px] uppercase tracking-wide border border-blue-500/20 shrink-0">
                  {statement.ledger.code}
                </span>
                <span className="text-sm font-bold text-ink truncate">{statement.ledger.name}</span>
                <span className="text-[11px] text-ink-subtle whitespace-nowrap">
                  · {statement.ledger.group} · {statement.ledger.type}
                </span>
              </div>

              <div className="flex items-center gap-4 text-right shrink-0">
                <div>
                  <span className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide block leading-tight">
                    Opening
                  </span>
                  <span className="text-sm font-mono font-bold text-ink">
                    ₹ {statement.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-l border-line pl-4">
                  <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide block leading-tight">
                    Closing
                  </span>
                  <span className="text-sm font-mono font-black text-blue-500">
                    ₹ {statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-head text-ink-muted font-bold border-b border-line text-[10px] uppercase tracking-wide">
                    <th className="py-2 px-3 bg-head">Date</th>
                    <th className="py-2 px-3 bg-head">Voucher No</th>
                    <th className="py-2 px-3 bg-head">Type</th>
                    <th className="py-2 px-3 bg-head">Particulars</th>
                    <th className="py-2 px-3 bg-head">Narration</th>
                    <th className="py-2 px-3 bg-head text-right">Debit (Dr)</th>
                    <th className="py-2 px-3 bg-head text-right">Credit (Cr)</th>
                    <th className="py-2 px-3 bg-head text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium text-ink-muted">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-ink-subtle">
                        <FaSync className="animate-spin text-lg mx-auto mb-1 text-blue-500" />
                        Loading entries...
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-ink-subtle text-xs">
                        No voucher entries found.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((row) => (
                      <tr key={row.id} className="hover:bg-card-2/50 transition-colors">
                        <td className="py-1.5 px-3 font-mono text-[11px] whitespace-nowrap">{row.date}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-ink whitespace-nowrap">
                          {row.voucherNo}
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-card-2 text-ink-muted border border-line">
                            {row.voucherType}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 font-semibold text-ink whitespace-nowrap">
                          {row.particulars}
                        </td>
                        <td className="py-1.5 px-3 text-ink-subtle text-[11px] max-w-xs truncate">
                          {row.narration || "-"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-ink whitespace-nowrap">
                          {row.debit > 0 ? `₹ ${row.debit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-amber-500 font-semibold whitespace-nowrap">
                          {row.credit > 0 ? `₹ ${row.credit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-ink whitespace-nowrap">
                          ₹ {row.runningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 border-t-2 border-line bg-card-2 px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-ink-subtle">
                {filteredEntries.length} entries · Filtered Totals
              </span>
              <div className="flex items-center gap-4">
                <span className="font-mono text-ink">
                  Dr ₹ {filteredEntries.reduce((s, e) => s + e.debit, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="font-mono text-amber-500 font-semibold">
                  Cr ₹ {filteredEntries.reduce((s, e) => s + e.credit, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="font-mono font-black text-blue-500">
                  Closing ₹ {statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LedgerStatementPage;
